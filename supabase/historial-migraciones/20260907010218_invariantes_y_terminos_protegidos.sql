-- ================================================================
-- INVARIANTES: lo que nunca se puede hacer, evaluado por codigo contra cualquier accion,
-- la proponga quien la proponga. Un modelo mas listo no reemplaza esto.
-- ================================================================

-- ---- Terminos protegidos: el nucleo de cada cuenta, derivado de los datos + lo que Andres agregue ----
create table if not exists terminos_protegidos (
  id bigserial primary key,
  account text not null,
  termino text not null,
  motivo text not null,                      -- 'convirtio_90d' | 'top_conversiones' | 'marca' | 'manual'
  conversiones_90d numeric, gasto_90d numeric,
  agregado_por text default 'sistema', agregado_el timestamptz default now(),
  unique (account, termino)
);
alter table terminos_protegidos enable row level security; revoke all on terminos_protegidos from anon, authenticated;
comment on table terminos_protegidos is 'El nucleo semantico de cada cuenta: keywords que convirtieron en 90 dias, las que concentran el 80% de conversiones, la marca, y lo que Andres agregue. Ninguna negativa puede bloquearlas; ninguna pausa las toca sin confirmacion explicita con numeros.';

create or replace function terminos_protegidos_actualizar() returns int language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n int := 0;
begin
  -- Keywords con conversion en 90 dias (semanal)
  insert into terminos_protegidos (account, termino, motivo, conversiones_90d, gasto_90d)
  select account, regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g'), 'convirtio_90d', sum(conversions), sum(cost)
  from keywords where week_start >= current_date - 90 group by account, regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g') having sum(conversions) >= 1
  on conflict (account, termino) do update set conversiones_90d = excluded.conversiones_90d, gasto_90d = excluded.gasto_90d;
  get diagnostics n = row_count;
  -- Terminos de busqueda que convirtieron (no solo keywords)
  insert into terminos_protegidos (account, termino, motivo, conversiones_90d, gasto_90d)
  select account, search_term, 'convirtio_90d', sum(conversions), sum(cost) from search_terms where week_start >= current_date - 90 group by account, search_term having sum(conversions) >= 1
  on conflict (account, termino) do update set conversiones_90d = greatest(terminos_protegidos.conversiones_90d, excluded.conversiones_90d);
  -- Marca: del nombre del cliente
  insert into terminos_protegidos (account, termino, motivo) select account, lower(split_part(nombre_cliente, ' ', 1)), 'marca' from cuentas where activa on conflict do nothing;
  return n;
end $$;
select terminos_protegidos_actualizar();
select cron.unschedule(jobid) from cron.job where jobname = 'terminos_protegidos';
select cron.schedule('terminos_protegidos', '15 9 * * 1', $$select terminos_protegidos_actualizar()$$);

-- ---- Simulacion de impacto: que habria bloqueado esta negativa en 30 dias ----
create or replace function simular_negativa(p_account text, p_negativa text, p_match text, p_nivel text default 'campana', p_grupo text default null) returns jsonb
language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  with terms as (
    select search_term, ad_group, sum(clicks) clics, sum(cost) gasto, sum(conversions) conv
    from search_terms_daily where account = p_account and date >= current_date - 30 and (p_nivel <> 'grupo' or ad_group = p_grupo)
    group by search_term, ad_group
  ),
  bloq as (select * from terms where negativa_bloquea(p_negativa, p_match, search_term))
  select jsonb_build_object(
    'terminos_bloqueados', (select count(*) from bloq),
    'clics_bloqueados', (select coalesce(sum(clics), 0) from bloq),
    'gasto_bloqueado', (select coalesce(round(sum(gasto), 2), 0) from bloq),
    'conversiones_bloqueadas', (select coalesce(sum(conv), 0) from bloq),
    'ejemplos', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'clics', clics, 'conv', conv) order by conv desc, gasto desc), '[]') from (select * from bloq order by conv desc, gasto desc limit 8) x),
    'protegidos_afectados', (select coalesce(jsonb_agg(termino), '[]') from terminos_protegidos tp where tp.account = p_account and negativa_bloquea(p_negativa, p_match, tp.termino))
  );
$$;

-- ---- Invariantes: evaluar una accion estructurada. Devuelve lista de violaciones con numeros. Vacia = puede pasar. ----
create or replace function verificar_invariantes(p_account text, p_accion jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare v jsonb := '[]'; verbo text; kw text; mt text; nivel text; grupo text; campana text; sim jsonb; prot jsonb; conv90 numeric; topconv numeric; k text;
begin
  verbo := p_accion->>'verbo'; kw := p_accion->'objeto'->>'keyword'; grupo := p_accion->'objeto'->>'grupo'; campana := p_accion->'objeto'->>'campana';
  mt := coalesce(p_accion->'parametros'->>'match_type_destino', p_accion->'objeto'->>'match_type', 'PHRASE'); nivel := coalesce(p_accion->'parametros'->>'nivel', 'grupo');

  -- I1. Una negativa no puede bloquear un termino protegido ni un termino que convirtio en 30 dias
  if verbo = 'agregar_negativa' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      sim := simular_negativa(p_account, k, mt, nivel, grupo);
      if jsonb_array_length(sim->'protegidos_afectados') > 0 then
        v := v || jsonb_build_object('invariante', 'I1_negativa_bloquea_protegido', 'bloquea', true, 'detalle', 'La negativa "' || k || '" (' || mt || ') bloquearia terminos protegidos: ' || (sim->'protegidos_afectados')::text || '. Son el nucleo de la cuenta.');
      end if;
      if (sim->>'conversiones_bloqueadas')::numeric > 0 then
        v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle', 'La negativa "' || k || '" habria bloqueado ' || (sim->>'conversiones_bloqueadas') || ' conversiones en 30 dias (' || (sim->>'terminos_bloqueados') || ' terminos, ' || (sim->>'gasto_bloqueado') || ' de gasto). Ajustar concordancia o no negativizar.', 'simulacion', sim);
      end if;
    end loop;
  end if;

  -- I3. No pausar una keyword que convirtio en 30 dias o que es protegida
  if verbo = 'pausar_keyword' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(k);
      if coalesce(conv90, 0) > 0 then v := v || jsonb_build_object('invariante', 'I3_pausar_convierte', 'bloquea', true, 'detalle', 'La keyword "' || k || '" convirtio ' || conv90 || ' veces en 30 dias. No se pausa; a lo sumo se ajusta concordancia o puja.'); end if;
      if exists (select 1 from terminos_protegidos where account = p_account and normalizar_entidad(termino) = normalizar_entidad(k)) then v := v || jsonb_build_object('invariante', 'I3b_pausar_protegido', 'bloquea', true, 'detalle', 'La keyword "' || k || '" es un termino protegido de la cuenta.'); end if;
    end loop;
  end if;

  -- I4. Cambio de concordancia a mas cerrada en una keyword que concentra >40% de las conversiones del grupo: avisa
  if verbo = 'cambiar_concordancia' and kw is not null then
    select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(kw);
    select sum(conversions) into topconv from keywords_daily where account = p_account and date >= current_date - 30 and ad_group = grupo;
    if coalesce(conv90, 0) > 0 and coalesce(topconv, 0) > 0 and conv90 / topconv > 0.4 then
      v := v || jsonb_build_object('invariante', 'I4_concordancia_keyword_principal', 'bloquea', false, 'detalle', 'La keyword "' || kw || '" trae el ' || round(conv90 / topconv * 100) || '% de las conversiones de ' || grupo || '. Cerrar la concordancia puede cortar volumen: medir 14 dias antes de otra cosa en el grupo.');
    end if;
  end if;

  -- I5. Presupuesto: no bajar mas de 30% de una vez, no subir mas de 20%
  if verbo = 'cambiar_presupuesto' and (p_accion->'parametros'->>'valor_actual') is not null and (p_accion->'parametros'->>'valor_nuevo') is not null then
    if (p_accion->'parametros'->>'valor_nuevo')::numeric < (p_accion->'parametros'->>'valor_actual')::numeric * 0.7 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_baja_brusca', 'bloquea', false, 'detalle', 'Bajar el presupuesto mas de 30% de una vez reinicia el aprendizaje de Smart Bidding. En dos pasos.'); end if;
    if (p_accion->'parametros'->>'valor_nuevo')::numeric > (p_accion->'parametros'->>'valor_actual')::numeric * 1.2 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_sube_brusca', 'bloquea', false, 'detalle', 'Subir mas de 20% de una vez: Smart Bidding reaprende y el CPA sube unos dias. En dos pasos.'); end if;
  end if;

  -- I6. Estrategia de puja: no cambiar si hubo otro cambio estructural en la campana en 14 dias
  if verbo in ('cambiar_estrategia_puja', 'cambiar_puja') and campana is not null then
    if exists (select 1 from operator_log where account = p_account and fecha >= current_date - 14 and (que_cambio ilike '%puja%' or que_cambio ilike '%presupuesto%' or que_cambio ilike '%conversi%') and donde ilike '%' || campana || '%') then
      v := v || jsonb_build_object('invariante', 'I6_estructural_reciente', 'bloquea', false, 'detalle', 'Hubo otro cambio estructural en ' || campana || ' hace menos de 14 dias. Smart Bidding sigue aprendiendo; esperar.');
    end if;
  end if;

  return v;
end $$;
revoke execute on function verificar_invariantes from anon, authenticated, public;
comment on function verificar_invariantes is 'Guardrails deterministas. Devuelve violaciones con numeros; bloquea=true impide ejecutar. Corre en el pre-vuelo, en la sincronizacion (marca el accionable) y el prompt lo consulta antes de proponer.';

-- Pre-vuelo: relaciones + invariantes
create or replace function prevuelo(p_notion_id text) returns text language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare rel text; inv jsonb; acc record; motivos text[] := '{}';
begin
  select string_agg(motivo, ' | ') into rel from accionable_relaciones where not resuelta and severidad = 'bloquea' and (a = p_notion_id or b = p_notion_id);
  if rel is not null then motivos := motivos || rel; end if;
  select account, accion into acc from accionables_espejo where notion_id = p_notion_id;
  if acc.accion is not null then
    inv := verificar_invariantes(acc.account, acc.accion);
    select array_agg(x->>'detalle') into motivos from (select x from jsonb_array_elements(inv) x where (x->>'bloquea')::boolean) s, lateral (select x) t(x) where true;
    if rel is not null then motivos := motivos || rel; end if;
  end if;
  return nullif(array_to_string(motivos, ' | '), '');
end $$;

select account, count(*) protegidos, string_agg(termino, ', ' order by conversiones_90d desc nulls last) filter (where motivo = 'convirtio_90d') top from terminos_protegidos group by account;;
