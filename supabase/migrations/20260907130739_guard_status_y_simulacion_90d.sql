-- 1. corrida_redundante: el status del run_log es 'OK' en mayusculas
create or replace function corrida_redundante(p_account text) returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  with ult as (select semana_analizada, created_at, foto_leida from run_quality where account = p_account order by created_at desc limit 1),
  datos as (select max(date) diaria, (select max(week_start) from campaign where account = p_account) semanal from campaign_daily where account = p_account),
  nuevo as (
    select exists (select 1 from pulso_diario p, ult where p.account = p_account and p.created_at > ult.created_at) as pulso_nuevo,
           exists (select 1 from operator_log o, ult where o.account = p_account and o.created_at > ult.created_at) as operador_nuevo,
           exists (select 1 from google_live_events g, ult where g.account = p_account and g.created_at > ult.created_at and g.event_type in ('USER_CHANGE','AUTO_CHANGE')) as google_nuevo,
           exists (select 1 from run_log r, ult where r.account = p_account and r.run_ts > ult.created_at and upper(r.status) = 'OK') as extraccion_nueva
  ),
  lunes as (select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date as este_lunes)
  select jsonb_build_object(
    'ultima_corrida', (select created_at from ult), 'semana_analizada', (select semana_analizada from ult),
    'semana_disponible', (select semanal from datos), 'diaria_hasta', (select diaria from datos),
    'semana_a_analizar', (select este_lunes - 7 from lunes),
    'semana_cerrada_disponible', (select semanal from datos) >= (select este_lunes - 7 from lunes) and (select diaria from datos) >= (select este_lunes - 1 from lunes),
    'hubo_corrida_hoy', (select created_at::date = current_date from ult),
    'hay_datos_nuevos', (select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva from nuevo),
    'detalle', (select jsonb_build_object('pulso', pulso_nuevo, 'operador', operador_nuevo, 'google', google_nuevo, 'extraccion', extraccion_nueva) from nuevo),
    'redundante', (select created_at::date = current_date from ult) and not (select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva from nuevo)
  );
$$;

-- 2. simular_negativa: 30 dias diarios + 90 dias semanales, para no depender de cuando se recalculo la lista de protegidos
create or replace function simular_negativa(p_account text, p_negativa text, p_match text, p_nivel text default 'campana', p_grupo text default null) returns jsonb
language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  with terms30 as (
    select search_term, ad_group, sum(clicks) clics, sum(cost) gasto, sum(conversions) conv
    from search_terms_daily where account = p_account and date >= current_date - 30 and (p_nivel <> 'grupo' or ad_group = p_grupo) group by search_term, ad_group
  ),
  bloq30 as (select * from terms30 where negativa_bloquea(p_negativa, p_match, search_term)),
  terms90 as (
    select search_term, sum(clicks) clics, sum(cost) gasto, sum(conversions) conv
    from search_terms where account = p_account and week_start >= current_date - 90 and (p_nivel <> 'grupo' or ad_group = p_grupo) group by search_term
  ),
  bloq90 as (select * from terms90 where negativa_bloquea(p_negativa, p_match, search_term))
  select jsonb_build_object(
    'terminos_bloqueados', (select count(*) from bloq30),
    'clics_bloqueados', (select coalesce(sum(clics), 0) from bloq30),
    'gasto_bloqueado', (select coalesce(round(sum(gasto), 2), 0) from bloq30),
    'conversiones_bloqueadas', (select coalesce(sum(conv), 0) from bloq30),
    'conversiones_bloqueadas_90d', (select coalesce(sum(conv), 0) from bloq90),
    'gasto_bloqueado_90d', (select coalesce(round(sum(gasto)), 0) from bloq90),
    'ejemplos', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'clics', clics, 'conv', conv) order by conv desc, gasto desc), '[]') from (select * from bloq90 order by conv desc, gasto desc limit 8) x),
    'protegidos_afectados', (select coalesce(jsonb_agg(termino), '[]') from terminos_protegidos tp where tp.account = p_account and negativa_bloquea(p_negativa, p_match, tp.termino))
  );
$$;

-- I2 usa tambien los 90 dias
create or replace function verificar_invariantes(p_account text, p_accion jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare v jsonb := '[]'; verbo text; kw text; mt text; nivel text; grupo text; campana text; sim jsonb; conv90 numeric; topconv numeric; k text; nuc text; impr numeric;
begin
  verbo := p_accion->>'verbo'; kw := p_accion->'objeto'->>'keyword'; grupo := p_accion->'objeto'->>'grupo'; campana := p_accion->'objeto'->>'campana';
  mt := coalesce(p_accion->'parametros'->>'match_type_destino', p_accion->'objeto'->>'match_type', 'PHRASE'); nivel := coalesce(p_accion->'parametros'->>'nivel', 'grupo');
  if verbo in ('agregar_negativa', 'pausar_keyword') then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      nuc := toca_nucleo(p_account, k);
      if nuc is null then continue; end if;
      if verbo = 'pausar_keyword' then
        select coalesce(sum(impressions), 0) into impr from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(k);
        if impr = 0 then continue; end if;
      end if;
      v := v || jsonb_build_object('invariante', 'I0_toca_nucleo', 'bloquea', true, 'detalle', (case verbo when 'agregar_negativa' then 'La negativa "' else 'Pausar "' end) || k || '" toca el nucleo de la cuenta ("' || nuc || '")' || (case when verbo = 'pausar_keyword' then ' y tuvo ' || impr || ' impresiones en 30 dias' else '' end) || ': es la intencion en la que se basa la subasta. Si gasta sin convertir, el problema es la landing o la concordancia.');
    end loop;
  end if;
  if verbo = 'agregar_negativa' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      sim := simular_negativa(p_account, k, mt, nivel, grupo);
      if jsonb_array_length(sim->'protegidos_afectados') > 0 then v := v || jsonb_build_object('invariante', 'I1_negativa_bloquea_protegido', 'bloquea', true, 'detalle', 'La negativa "' || k || '" (' || mt || ') bloquearia terminos protegidos: ' || (sim->'protegidos_afectados')::text || '.'); end if;
      if (sim->>'conversiones_bloqueadas')::numeric > 0 or (sim->>'conversiones_bloqueadas_90d')::numeric > 0 then
        v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle', 'La negativa "' || k || '" habria bloqueado ' || (sim->>'conversiones_bloqueadas') || ' conversiones en 30 dias y ' || (sim->>'conversiones_bloqueadas_90d') || ' en 90 (' || (sim->>'gasto_bloqueado_90d') || ' de gasto en 90 dias). Revisar si son conversiones reales antes de negativizar.', 'simulacion', sim);
      end if;
    end loop;
  end if;
  if verbo = 'pausar_keyword' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(k);
      if coalesce(conv90, 0) > 0 then v := v || jsonb_build_object('invariante', 'I3_pausar_convierte', 'bloquea', true, 'detalle', 'La keyword "' || k || '" convirtio ' || conv90 || ' veces en 30 dias. No se pausa.'); end if;
      if exists (select 1 from terminos_protegidos where account = p_account and normalizar_entidad(termino) = normalizar_entidad(k)) then v := v || jsonb_build_object('invariante', 'I3b_pausar_protegido', 'bloquea', true, 'detalle', 'La keyword "' || k || '" es un termino protegido.'); end if;
    end loop;
  end if;
  if verbo = 'cambiar_concordancia' and kw is not null then
    select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(kw);
    select sum(conversions) into topconv from keywords_daily where account = p_account and date >= current_date - 30 and ad_group = grupo;
    if coalesce(conv90, 0) > 0 and coalesce(topconv, 0) > 0 and conv90 / topconv > 0.4 then v := v || jsonb_build_object('invariante', 'I4_concordancia_keyword_principal', 'bloquea', false, 'detalle', 'La keyword "' || kw || '" trae el ' || round(conv90 / topconv * 100) || '% de las conversiones de ' || grupo || '. Medir 14 dias antes de otra cosa en el grupo.'); end if;
    if toca_nucleo(p_account, kw) is not null and coalesce(p_accion->'parametros'->>'match_type_destino', '') = 'EXACT' then v := v || jsonb_build_object('invariante', 'I4b_nucleo_a_exacta', 'bloquea', false, 'detalle', 'Pasar un termino del nucleo a exacta corta todas sus variantes. Frase suele ser el punto medio.'); end if;
  end if;
  if verbo = 'cambiar_presupuesto' and (p_accion->'parametros'->>'valor_actual') is not null and (p_accion->'parametros'->>'valor_nuevo') is not null then
    if (p_accion->'parametros'->>'valor_nuevo')::numeric < (p_accion->'parametros'->>'valor_actual')::numeric * 0.7 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_baja_brusca', 'bloquea', false, 'detalle', 'Bajar el presupuesto mas de 30% de una vez reinicia el aprendizaje. En dos pasos.'); end if;
    if (p_accion->'parametros'->>'valor_nuevo')::numeric > (p_accion->'parametros'->>'valor_actual')::numeric * 1.2 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_sube_brusca', 'bloquea', false, 'detalle', 'Subir mas de 20% de una vez: el CPA sube unos dias. En dos pasos.'); end if;
  end if;
  if verbo in ('cambiar_estrategia_puja', 'cambiar_puja') and campana is not null then
    if exists (select 1 from operator_log where account = p_account and fecha >= current_date - 14 and (que_cambio ilike '%puja%' or que_cambio ilike '%presupuesto%' or que_cambio ilike '%conversi%') and donde ilike '%' || campana || '%') then v := v || jsonb_build_object('invariante', 'I6_estructural_reciente', 'bloquea', false, 'detalle', 'Hubo otro cambio estructural en ' || campana || ' hace menos de 14 dias. Esperar.'); end if;
  end if;
  return v;
end $$;

-- 3. Protegidos: diario, no solo lunes; y ahora mismo
select cron.unschedule(jobid) from cron.job where jobname = 'terminos_protegidos';
select cron.schedule('terminos_protegidos', '10 9 * * *', $$select terminos_protegidos_actualizar()$$);
select terminos_protegidos_actualizar();

-- 4. Alerta para Andres con los numeros corregidos por el triple conteo
select alerta_registrar('BHI', 'semana', 'negativa_dudosa', 'La negativa "iclick travel" aplicada hoy bloquea un termino que convirtio en 90 dias',
  'iclick travel: 2 clics, 18.633 CLP y 3 conversiones en 90 dias, pero las 3 son la misma persona contada tres veces (formulario + asesoria + cliente activo, antes del 5 de septiembre). Solicitud real: 1, CPA real 18.633, sobre el maximo de 15.000. Las otras 6 negativas no bloquean nada que haya convertido. La ejecute a las 03:52 con la lista de protegidos vacia: error de secuencia mio, corregido (la simulacion ahora mira 90 dias y los protegidos se recalculan a diario).',
  'Decision tuya. Mantenerla es defendible: es marca de competidor, 1 solicitud en 3 meses sobre el CPA maximo. Si preferis revertir: Campanas > BHI_SEARCH_07-26 > Palabras clave negativas > quitar "iclick travel".', 'claude', 'iclick travel', current_date) as alerta;
select (corrida_redundante('360'))->'detalle' as guard_360;;
