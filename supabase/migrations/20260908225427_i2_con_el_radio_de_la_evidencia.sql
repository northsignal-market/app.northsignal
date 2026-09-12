-- I2 usaba un solo booleano de simular_negativa como veredicto: bloquearia_conversiones.
-- Ese booleano es de CUENTA, porque se enciende cuando el termino figura en
-- terminos_protegidos, que no tiene columna de campana ni de grupo. Las cifras numericas
-- de la misma simulacion SI respetan el alcance: verificado el 8 sep 2026 con
-- "iclick travel", que a nivel grupo en SEGURO EN EL EXTRANJERO devuelve 0 conversiones
-- bloqueadas en 90 dias y a nivel campana devuelve 3.
--
-- Resultado: una negativa de grupo correcta quedaba bloqueada por conversiones que ocurren
-- en OTRO grupo. Es el mismo defecto de radio que se corrigio hoy en el veredicto de
-- v_terminos_sin_cobertura y en el guardarrail del endpoint: el radio del chequeo tiene que
-- ser el radio de la evidencia.
--
-- QUE NO CAMBIA, a proposito:
--   * A nivel CAMPANA se sigue bloqueando igual que antes, incluida la lista de protegidos.
--     Es el caso que motivo la invariante y el radio ahi es ancho.
--   * Si CUALQUIER ventana ve conversiones dentro del alcance, bloquea. Sin excepciones.
--   * A nivel grupo, la lista de protegidos deja de ser bloqueo y pasa a ser AVISO, pero
--     solo si la capa semanal tiene al menos 8 semanas de la cuenta. Sin esa historia, un
--     cero puede ser falta de datos y no ausencia de conversiones, asi que se bloquea.
--     Esa salvaguarda es la que impide que esto sea un aflojamiento.

create or replace function public.verificar_invariantes(p_account text, p_accion jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare v jsonb := '[]'; verbo text; kw text; mt text; nivel text; grupo text; campana text;
        sim jsonb; conv90 numeric; topconv numeric; k text; nuc text; impr numeric;
        c_dia numeric; c_90 numeric; prot jsonb; semanas int; donde_convierte text;
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
      v := v || jsonb_build_object('invariante', 'I0_toca_nucleo', 'bloquea', true, 'detalle', (case verbo when 'agregar_negativa' then 'La negativa "' else 'Pausar "' end) || k || '" toca el nucleo de la cuenta ("' || nuc || '")' || (case when verbo = 'pausar_keyword' then ' y tuvo ' || impr || ' impresiones en 30 dias' else '' end) || ': es la intencion en la que se basa la subasta.');
    end loop;
  end if;

  if verbo = 'agregar_negativa' then
    select count(distinct week_start) into semanas from campaign where account = p_account;
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      sim  := simular_negativa(p_account, k, mt, nivel, grupo);
      c_dia := coalesce((sim->>'conversiones_bloqueadas')::numeric, 0);
      c_90  := coalesce((sim->>'conversiones_bloqueadas_90d')::numeric, 0);
      prot  := coalesce(sim->'protegidos_afectados', '[]'::jsonb);

      if c_dia > 0 or c_90 > 0 then
        -- Dentro del alcance elegido se pierden conversiones. Bloquea siempre.
        v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle',
          'La negativa "' || k || '" bloquearia trafico que convirtio DENTRO de su alcance (' || nivel ||
          case when nivel = 'grupo' and grupo is not null then ' ' || grupo else '' end || '): ' ||
          c_dia || ' conversiones en la ventana diaria (' || coalesce(sim->>'ventana_diaria_real','sin datos') ||
          ') y ' || c_90 || ' en 90 dias sobre la capa semanal.', 'simulacion', sim);

      elsif jsonb_array_length(prot) > 0 and nivel = 'grupo' and coalesce(semanas, 0) >= 8 then
        -- El termino esta protegido a nivel CUENTA pero no convierte en este grupo, y hay
        -- historia semanal suficiente para afirmarlo. Aviso con el dato, no bloqueo.
        select string_agg(distinct s.ad_group, ', ') into donde_convierte
          from search_terms s
         where s.account = p_account and s.week_start > current_date - 90
           and normalizar_entidad(s.search_term) = normalizar_entidad(k)
           and s.conversions > 0 and s.ad_group is distinct from grupo;
        v := v || jsonb_build_object('invariante', 'I2b_protegido_en_otro_alcance', 'bloquea', false, 'detalle',
          'La negativa "' || k || '" NO bloquea ninguna conversion en ' || coalesce(grupo, 'este grupo') ||
          ' (0 en la ventana diaria y 0 en ' || semanas || ' semanas), pero el termino figura en ' ||
          'terminos_protegidos, que es una lista de CUENTA: convierte en ' ||
          coalesce(donde_convierte, 'otro grupo de la cuenta') ||
          '. Por eso la exclusion va a nivel grupo y no de campana. Confirmar que es lo que se quiere.',
          'simulacion', sim);

      elsif (sim->>'bloquearia_conversiones')::boolean then
        -- Nivel campana, o sin historia semanal suficiente: se mantiene el bloqueo de antes.
        -- Un cero sin historia puede ser falta de datos y no ausencia de conversiones.
        v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle',
          'La negativa "' || k || '" toca terminos protegidos: ' || prot::text ||
          '. Alcance ' || nivel || case when coalesce(semanas,0) < 8 then ', y la capa semanal tiene solo ' || coalesce(semanas,0) || ' semanas: un cero ahi puede ser falta de datos.' else '. A nivel campana la exclusion alcanza a todos los grupos, incluido donde convierte.' end,
          'simulacion', sim);
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
    if toca_nucleo(p_account, kw) is not null and coalesce(p_accion->'parametros'->>'match_type_destino', '') = 'EXACT' then v := v || jsonb_build_object('invariante', 'I4b_nucleo_a_exacta', 'bloquea', false, 'detalle', 'Pasar un termino del nucleo a exacta corta todas sus variantes.'); end if;
  end if;

  if verbo = 'cambiar_presupuesto' and (p_accion->'parametros'->>'valor_actual') is not null and (p_accion->'parametros'->>'valor_nuevo') is not null then
    if (p_accion->'parametros'->>'valor_nuevo')::numeric < (p_accion->'parametros'->>'valor_actual')::numeric * 0.7 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_baja_brusca', 'bloquea', false, 'detalle', 'Bajar mas de 30% de una vez reinicia el aprendizaje. En dos pasos.'); end if;
    if (p_accion->'parametros'->>'valor_nuevo')::numeric > (p_accion->'parametros'->>'valor_actual')::numeric * 1.2 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_sube_brusca', 'bloquea', false, 'detalle', 'Subir mas de 20% de una vez: el CPA sube unos dias. En dos pasos.'); end if;
  end if;

  if verbo in ('cambiar_estrategia_puja', 'cambiar_puja') and campana is not null then
    if exists (select 1 from operator_log where account = p_account and fecha >= current_date - 14 and (que_cambio ilike '%puja%' or que_cambio ilike '%presupuesto%' or que_cambio ilike '%conversi%') and donde ilike '%' || campana || '%') then v := v || jsonb_build_object('invariante', 'I6_estructural_reciente', 'bloquea', false, 'detalle', 'Hubo otro cambio estructural en ' || campana || ' hace menos de 14 dias. Esperar.'); end if;
  end if;

  return v;
end $function$;

comment on function public.verificar_invariantes(text, jsonb) is
  'Invariantes antes de encolar una accion. I2 mide el radio de la evidencia: bloquea siempre que se pierdan conversiones DENTRO del alcance elegido, y a nivel grupo degrada a aviso (I2b) cuando el termino solo esta protegido a nivel cuenta y hay al menos 8 semanas de historia semanal para afirmar el cero. A nivel campana se mantiene el bloqueo completo, que es el caso que motivo la invariante.';;
