-- Nucleo semantico: los conceptos que definen la cuenta. Declarado, no derivado. Andres lo edita.
alter table cuentas add column if not exists nucleo text[] default '{}';
comment on column cuentas.nucleo is 'Conceptos que definen la cuenta. Cualquier negativa o pausa que los toque (por raiz de palabra, sin importar plural ni articulos) se bloquea. Ejemplo BHI: seguro salud internacional.';
update cuentas set nucleo = '{seguro salud internacional, seguro medico internacional, seguro de salud internacional, bhi, best health}' where account = 'BHI';
update cuentas set nucleo = '{betreuungssoftware, software berufsbetreuer, berufsbetreuer software, betreuer software, karedo}' where account = 'KAREDO';
update cuentas set nucleo = '{productora eventos, eventos corporativos, produccion eventos, 360 producciones}' where account = '360';

-- Raices: minusculas, sin acentos, sin stopwords, sin plural
create or replace function raices(t text) returns text[] language sql immutable set search_path = public, extensions as $$
  select coalesce(array_agg(w order by w), '{}') from (
    select distinct regexp_replace(w, '(es|s)$', '') w from unnest(string_to_array(regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '[^a-z0-9 ]', ' ', 'g'), ' ')) w
    where length(w) > 2 and w not in ('de','la','el','los','las','del','para','por','con','sin','una','uno','und','fur','der','die','das','den','von','mit')
  ) s;
$$;
-- Toca el nucleo si todas las raices de algun concepto del nucleo estan en el texto
create or replace function toca_nucleo(p_account text, p_texto text) returns text language sql stable set search_path = public, extensions as $$
  select c from cuentas, unnest(nucleo) c where account = p_account and raices(c) <@ raices(p_texto) limit 1;
$$;

create or replace function verificar_invariantes(p_account text, p_accion jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare v jsonb := '[]'; verbo text; kw text; mt text; nivel text; grupo text; campana text; sim jsonb; conv90 numeric; topconv numeric; k text; nuc text;
begin
  verbo := p_accion->>'verbo'; kw := p_accion->'objeto'->>'keyword'; grupo := p_accion->'objeto'->>'grupo'; campana := p_accion->'objeto'->>'campana';
  mt := coalesce(p_accion->'parametros'->>'match_type_destino', p_accion->'objeto'->>'match_type', 'PHRASE'); nivel := coalesce(p_accion->'parametros'->>'nivel', 'grupo');

  -- I0. Nucleo semantico: ninguna negativa ni pausa toca los conceptos que definen la cuenta. Sin importar plural, articulos ni reglas literales de Google.
  if verbo in ('agregar_negativa', 'pausar_keyword') then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      nuc := toca_nucleo(p_account, k);
      if nuc is not null then
        v := v || jsonb_build_object('invariante', 'I0_toca_nucleo', 'bloquea', true, 'detalle', (case verbo when 'agregar_negativa' then 'La negativa "' else 'Pausar "' end) || k || '" toca el nucleo de la cuenta ("' || nuc || '"): es la intencion en la que se basa la subasta. No se negativiza ni se pausa; si gasta sin convertir, el problema es la landing o la concordancia.');
      end if;
    end loop;
  end if;

  if verbo = 'agregar_negativa' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      sim := simular_negativa(p_account, k, mt, nivel, grupo);
      if jsonb_array_length(sim->'protegidos_afectados') > 0 then
        v := v || jsonb_build_object('invariante', 'I1_negativa_bloquea_protegido', 'bloquea', true, 'detalle', 'La negativa "' || k || '" (' || mt || ') bloquearia terminos protegidos: ' || (sim->'protegidos_afectados')::text || '.');
      end if;
      if (sim->>'conversiones_bloqueadas')::numeric > 0 then
        v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle', 'La negativa "' || k || '" habria bloqueado ' || (sim->>'conversiones_bloqueadas') || ' conversiones en 30 dias (' || (sim->>'terminos_bloqueados') || ' terminos, ' || (sim->>'gasto_bloqueado') || ' de gasto).', 'simulacion', sim);
      end if;
    end loop;
  end if;

  if verbo = 'pausar_keyword' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(k);
      if coalesce(conv90, 0) > 0 then v := v || jsonb_build_object('invariante', 'I3_pausar_convierte', 'bloquea', true, 'detalle', 'La keyword "' || k || '" convirtio ' || conv90 || ' veces en 30 dias. No se pausa; a lo sumo se ajusta concordancia o puja.'); end if;
      if exists (select 1 from terminos_protegidos where account = p_account and normalizar_entidad(termino) = normalizar_entidad(k)) then v := v || jsonb_build_object('invariante', 'I3b_pausar_protegido', 'bloquea', true, 'detalle', 'La keyword "' || k || '" es un termino protegido.'); end if;
    end loop;
  end if;

  if verbo = 'cambiar_concordancia' and kw is not null then
    select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(kw);
    select sum(conversions) into topconv from keywords_daily where account = p_account and date >= current_date - 30 and ad_group = grupo;
    if coalesce(conv90, 0) > 0 and coalesce(topconv, 0) > 0 and conv90 / topconv > 0.4 then
      v := v || jsonb_build_object('invariante', 'I4_concordancia_keyword_principal', 'bloquea', false, 'detalle', 'La keyword "' || kw || '" trae el ' || round(conv90 / topconv * 100) || '% de las conversiones de ' || grupo || '. Cerrar la concordancia puede cortar volumen: medir 14 dias antes de otra cosa en el grupo.');
    end if;
    if toca_nucleo(p_account, kw) is not null and coalesce(p_accion->'parametros'->>'match_type_destino', '') = 'EXACT' then
      v := v || jsonb_build_object('invariante', 'I4b_nucleo_a_exacta', 'bloquea', false, 'detalle', 'Pasar un termino del nucleo a exacta corta todas sus variantes. Frase suele ser el punto medio.');
    end if;
  end if;

  if verbo = 'cambiar_presupuesto' and (p_accion->'parametros'->>'valor_actual') is not null and (p_accion->'parametros'->>'valor_nuevo') is not null then
    if (p_accion->'parametros'->>'valor_nuevo')::numeric < (p_accion->'parametros'->>'valor_actual')::numeric * 0.7 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_baja_brusca', 'bloquea', false, 'detalle', 'Bajar el presupuesto mas de 30% de una vez reinicia el aprendizaje. En dos pasos.'); end if;
    if (p_accion->'parametros'->>'valor_nuevo')::numeric > (p_accion->'parametros'->>'valor_actual')::numeric * 1.2 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_sube_brusca', 'bloquea', false, 'detalle', 'Subir mas de 20% de una vez: el CPA sube unos dias. En dos pasos.'); end if;
  end if;

  if verbo in ('cambiar_estrategia_puja', 'cambiar_puja') and campana is not null then
    if exists (select 1 from operator_log where account = p_account and fecha >= current_date - 14 and (que_cambio ilike '%puja%' or que_cambio ilike '%presupuesto%' or que_cambio ilike '%conversi%') and donde ilike '%' || campana || '%') then
      v := v || jsonb_build_object('invariante', 'I6_estructural_reciente', 'bloquea', false, 'detalle', 'Hubo otro cambio estructural en ' || campana || ' hace menos de 14 dias. Esperar.');
    end if;
  end if;
  return v;
end $$;

select (verificar_invariantes('BHI', '{"verbo":"agregar_negativa","objeto":{"campana":"BHI_SEARCH_07-26","keyword":"seguros de salud internacionales"},"parametros":{"nivel":"campana","match_type_destino":"PHRASE"}}'::jsonb))->0->>'detalle' as caso_bhi,
       verificar_invariantes('BHI', '{"verbo":"agregar_negativa","objeto":{"campana":"BHI_SEARCH_07-26","keyword":"iclick travel"},"parametros":{"nivel":"campana","match_type_destino":"PHRASE"}}'::jsonb) as caso_ok,
       (verificar_invariantes('KAREDO', '{"verbo":"pausar_keyword","objeto":{"keyword":"Betreuungssoftwares"}}'::jsonb))->0->>'invariante' as karedo_plural;;
