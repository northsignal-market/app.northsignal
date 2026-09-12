create or replace function corrida_redundante(p_account text) returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  with ult as (
    -- La ultima corrida REAL: las redundantes no cuentan como analisis
    select semana_analizada, created_at, foto_leida from run_quality where account = p_account and coalesce(que_fallo, '') not ilike 'redundante%' and coalesce(que_fallo, '') not ilike 'semana cerrada no disponible%' order by created_at desc limit 1
  ),
  datos as (select max(date) diaria, (select max(week_start) from campaign where account = p_account) semanal from campaign_daily where account = p_account),
  nuevo as (
    select exists (select 1 from pulso_diario p, ult where p.account = p_account and p.created_at > ult.created_at) as pulso_nuevo,
           exists (select 1 from operator_log o, ult where o.account = p_account and o.created_at > ult.created_at) as operador_nuevo,
           exists (select 1 from google_live_events g, ult where g.account = p_account and g.created_at > ult.created_at and g.event_type in ('USER_CHANGE','AUTO_CHANGE')) as google_nuevo,
           -- run_ts viene en hora local de la cuenta escrita como UTC (hasta 5h de desfase): tolerancia
           exists (select 1 from run_log r, ult where r.account = p_account and r.run_ts + interval '5 hours' > ult.created_at and upper(r.status) = 'OK') as extraccion_nueva
  ),
  lunes as (select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date as este_lunes)
  select jsonb_build_object(
    'ultima_corrida', (select created_at from ult), 'semana_analizada', (select semana_analizada from ult),
    'semana_disponible', (select semanal from datos), 'diaria_hasta', (select diaria from datos),
    'semana_a_analizar', (select este_lunes - 7 from lunes),
    'semana_cerrada_disponible', (select semanal from datos) >= (select este_lunes - 7 from lunes) and (select diaria from datos) >= (select este_lunes - 1 from lunes),
    'hubo_corrida_hoy', coalesce((select created_at::date = current_date from ult), false),
    'hay_datos_nuevos', coalesce((select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva from nuevo), true),
    'detalle', (select jsonb_build_object('pulso', pulso_nuevo, 'operador', operador_nuevo, 'google', google_nuevo, 'extraccion', extraccion_nueva) from nuevo),
    'redundante', coalesce((select created_at::date = current_date from ult), false) and not coalesce((select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva from nuevo), true)
  );
$$;
select (corrida_redundante('360'))->>'redundante' redundante_360, (corrida_redundante('360'))->'detalle' detalle_360, (corrida_redundante('360'))->>'ultima_corrida' ultima_real;;
