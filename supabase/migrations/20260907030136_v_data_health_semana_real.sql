-- v_data_health: la semana de los datos es la mas reciente en campaign, no la ultima escrita.
-- Y la ultima corrida se juzga por la ultima corrida SEMANAL (week_start mas reciente), no por un relleno historico.
create or replace view v_data_health with (security_invoker = true) as
with semana_real as (select account, max(week_start) semana_datos from campaign group by account),
ultima as (
  select r.account, max(r.run_ts) ultimo_run from run_log r join semana_real s on s.account = r.account and r.week_start = s.semana_datos group by r.account
),
detalle as (
  select r.account, u.ultimo_run, s.semana_datos,
    count(*) filter (where r.status = 'OK') tablas_ok,
    count(*) filter (where r.status = 'ERROR' and r.tabla <> 'CHANGE_EVENTS') tablas_error,   -- CHANGE_EVENTS mas de 30 dias atras falla por diseño de Google
    count(*) filter (where r.status = 'VACIO') tablas_vacias,
    sum(r.filas) filas_totales,
    string_agg(distinct r.tabla, ', ') filter (where r.status = 'ERROR' and r.tabla <> 'CHANGE_EVENTS') tablas_con_error
  from run_log r join ultima u on u.account = r.account and r.run_ts = u.ultimo_run join semana_real s on s.account = r.account
  group by r.account, u.ultimo_run, s.semana_datos
)
select account, ultimo_run, semana_datos,
  round(extract(epoch from now() - ultimo_run) / 3600::numeric, 1) horas_desde_actualizacion,
  tablas_ok, tablas_error, tablas_vacias, filas_totales, tablas_con_error,
  case when tablas_error > 0 then 'ERROR' when now() - ultimo_run > interval '8 days' then 'DESACTUALIZADO' when tablas_ok < 10 then 'INCOMPLETO' else 'OK' end estado,
  case when tablas_error > 0 then 'Fallaron tablas en la ultima corrida: ' || coalesce(tablas_con_error, '')
       when now() - ultimo_run > interval '8 days' then 'El script no corre hace mas de 8 dias. Los datos mostrados son viejos.'
       when tablas_ok < 10 then 'La corrida escribio menos tablas de las esperadas.'
       else 'Datos completos y actualizados.' end mensaje
from detalle;
select account, semana_datos, estado, tablas_ok, tablas_error, horas_desde_actualizacion from v_data_health order by 1;
select account, count(distinct week_start) semanas, min(week_start) desde, max(week_start) hasta from campaign group by 1 order by 1;;
