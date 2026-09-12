-- ================================================================
-- Ticket 9: I0 no aplica a pausar keywords sin impresiones (no estan en la subasta)
-- ================================================================
create or replace function verificar_invariantes(p_account text, p_accion jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare v jsonb := '[]'; verbo text; kw text; mt text; nivel text; grupo text; campana text; sim jsonb; conv90 numeric; topconv numeric; k text; nuc text; impr numeric;
begin
  verbo := p_accion->>'verbo'; kw := p_accion->'objeto'->>'keyword'; grupo := p_accion->'objeto'->>'grupo'; campana := p_accion->'objeto'->>'campana';
  mt := coalesce(p_accion->'parametros'->>'match_type_destino', p_accion->'objeto'->>'match_type', 'PHRASE'); nivel := coalesce(p_accion->'parametros'->>'nivel', 'grupo');

  -- I0. Nucleo: negativas siempre; pausas solo si la keyword tuvo impresiones en 30 dias (si no, no esta en la subasta y pausarla no cambia nada)
  if verbo in ('agregar_negativa', 'pausar_keyword') then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      nuc := toca_nucleo(p_account, k);
      if nuc is null then continue; end if;
      if verbo = 'pausar_keyword' then
        select coalesce(sum(impressions), 0) into impr from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(k);
        if impr = 0 then continue; end if;  -- sin impresiones: no toca la subasta
      end if;
      v := v || jsonb_build_object('invariante', 'I0_toca_nucleo', 'bloquea', true, 'detalle', (case verbo when 'agregar_negativa' then 'La negativa "' else 'Pausar "' end) || k || '" toca el nucleo de la cuenta ("' || nuc || '")' || (case when verbo = 'pausar_keyword' then ' y tuvo ' || impr || ' impresiones en 30 dias' else '' end) || ': es la intencion en la que se basa la subasta. Si gasta sin convertir, el problema es la landing o la concordancia.');
    end loop;
  end if;

  if verbo = 'agregar_negativa' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      sim := simular_negativa(p_account, k, mt, nivel, grupo);
      if jsonb_array_length(sim->'protegidos_afectados') > 0 then v := v || jsonb_build_object('invariante', 'I1_negativa_bloquea_protegido', 'bloquea', true, 'detalle', 'La negativa "' || k || '" (' || mt || ') bloquearia terminos protegidos: ' || (sim->'protegidos_afectados')::text || '.'); end if;
      if (sim->>'conversiones_bloqueadas')::numeric > 0 then v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle', 'La negativa "' || k || '" habria bloqueado ' || (sim->>'conversiones_bloqueadas') || ' conversiones en 30 dias (' || (sim->>'terminos_bloqueados') || ' terminos, ' || (sim->>'gasto_bloqueado') || ' de gasto).', 'simulacion', sim); end if;
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

-- ================================================================
-- Ticket 8: el guard sabe si la semana cerrada esta disponible
-- ================================================================
create or replace function corrida_redundante(p_account text) returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  with ult as (select semana_analizada, created_at, foto_leida from run_quality where account = p_account order by created_at desc limit 1),
  datos as (select max(date) diaria, (select max(week_start) from campaign where account = p_account) semanal from campaign_daily where account = p_account),
  nuevo as (
    select exists (select 1 from pulso_diario p, ult where p.account = p_account and p.created_at > ult.created_at) as pulso_nuevo,
           exists (select 1 from operator_log o, ult where o.account = p_account and o.created_at > ult.created_at) as operador_nuevo,
           exists (select 1 from google_live_events g, ult where g.account = p_account and g.created_at > ult.created_at and g.event_type in ('USER_CHANGE','AUTO_CHANGE')) as google_nuevo,
           exists (select 1 from run_log r, ult where r.account = p_account and r.run_ts > ult.created_at and r.status = 'ok') as extraccion_nueva
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

-- ================================================================
-- Ticket 6: dos umbrales del doc maestro de 360 que el script no implementa, en SQL para todas
-- ================================================================
create or replace function alertas_umbrales_diarios() returns int language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n int := 0; r record;
begin
  -- U1. Gasto diario bajo 50% del presupuesto tres dias seguidos (excluye dias sin extraccion)
  for r in
    select c.account, c.presupuesto_diario, string_agg(d.date::text || '=' || round(d.gasto), ', ' order by d.date) dias
    from cuentas c join lateral (select date, sum(cost) gasto from campaign_daily where account = c.account and date >= current_date - 4 and date < current_date group by date order by date desc limit 3) d on true
    where c.activa and c.presupuesto_diario > 0 group by c.account, c.presupuesto_diario
    having count(*) = 3 and bool_and(d.gasto < c.presupuesto_diario * 0.5)
  loop
    perform alerta_registrar(r.account, 'hoy', 'gasto_bajo', 'Gasto bajo 50% del presupuesto tres dias seguidos en ' || r.account, 'Presupuesto ' || r.presupuesto_diario || '; gasto por dia: ' || r.dias, 'Revisar en Google Ads si la campana esta limitada (estado, aprobacion de anuncios, puja, presupuesto compartido). Si fue un cambio tuyo, anotalo en Bitacora.', 'umbrales', null, current_date - 1);
    n := n + 1;
  end loop;
  -- U2. Mas de 30% de leads nuevos de la semana sin click id (360 y cualquier cuenta con funnel_events)
  for r in
    select account, count(*) leads, count(*) filter (where coalesce(click_id, '') = '') sin_click
    from funnel_events where reached_at >= current_date - 7 and stage_order = (select min(stage_order) from funnel_events f2 where f2.account = funnel_events.account)
    group by account having count(*) >= 3 and count(*) filter (where coalesce(click_id, '') = '')::numeric / count(*) > 0.3
  loop
    perform alerta_registrar(r.account, 'semana', 'leads_sin_gclid', r.sin_click || ' de ' || r.leads || ' leads nuevos sin click id esta semana en ' || r.account, 'Sin GCLID no se pueden subir como conversion offline; Smart Bidding no aprende de ellos.', 'Revisar el formulario y el mapeo de GCLID en el CRM (GHL o Asana). Mientras, esos leads no cuentan.', 'umbrales', null, current_date - 1);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function alertas_umbrales_diarios from anon, authenticated, public;
select cron.unschedule(jobid) from cron.job where jobname = 'alertas_umbrales';
select cron.schedule('alertas_umbrales', '25 9 * * *', $$select alertas_umbrales_diarios()$$);

-- Respuestas a los tickets
update tickets set estado = 'resuelto', resuelto_el = now(), resuelto_en_version = 'fix-v50 + sql', respuesta =
  'Confirmado: el conector MCP de Notion rechaza texto JSON parseable. Dos salidas, ambas ya funcionan: (1) el parser del server (fix-v50) toma de la primera { a la ultima }, asi que envolver en backticks simples, en ```json o con un caracter delante es valido; (2) el server escribe por API directa sin ese limite (el pulso ya lo hace). Regla en el prompt: escribir Accion JSON entre backticks simples. Los tres que quedaron como json\n{...} y los cuatro de Karedo entre backticks quedan validos al desplegar v50.' where id = 7;
update tickets set estado = 'resuelto', resuelto_el = now(), resuelto_en_version = 'sql', respuesta =
  'No es un bug de agenda: las corridas de 01:32 UTC las dispara Cowork al guardar el prompt, no el cron. El programado es 10:45 UTC, despues de la extraccion diaria (06:00) y la semanal (07:00). Igual, corrida_redundante ahora devuelve semana_cerrada_disponible y semana_a_analizar: si es lunes y la semana cerrada no llego, la tarea termina en una linea en vez de escribir un brief parcial.' where id = 8;
update tickets set estado = 'resuelto', resuelto_el = now(), resuelto_en_version = 'sql', respuesta =
  'Aplicado. I0 para pausar_keyword solo bloquea si la keyword tuvo impresiones en 30 dias: una keyword del nucleo con cero impresiones no esta en la subasta y pausarla no cambia nada. Para negativas I0 sigue igual. Las dos listas (21 y 17) pueden volver a su tamano original; la tarea del lunes las reformula.' where id = 9;
update tickets set estado = 'resuelto', resuelto_el = now(), resuelto_en_version = 'sql', respuesta =
  'Implementado en SQL para todas las cuentas, no en el script: alertas_umbrales_diarios() a las 09:25 UTC. U1: gasto bajo 50% del presupuesto tres dias seguidos, alerta nivel hoy. U2: mas de 30% de leads nuevos de la semana sin click id en funnel_events, alerta nivel semana. El doc maestro de 360 queda correcto; el que estaba mal era el script.' where id = 6;
select alertas_umbrales_diarios() as alertas_generadas_ahora;;
