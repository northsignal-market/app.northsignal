create index if not exists idx_campaign_daily_acct_date on campaign_daily (account, date desc);
create index if not exists idx_adgroup_daily_acct_date on adgroup_daily (account, date desc);
create index if not exists idx_keywords_daily_acct_date on keywords_daily (account, date desc);
create index if not exists idx_search_terms_daily_acct_date on search_terms_daily (account, date desc);
create index if not exists idx_conv_daily_acct_date on conversion_actions_daily (account, date desc);
create index if not exists idx_budget_daily_acct_date on budget_daily (account, date desc);
create index if not exists idx_change_events_acct_dt on change_events (account, change_datetime desc);
create index if not exists idx_live_events_acct_date on google_live_events (account, event_date desc);
create index if not exists idx_config_snapshot_date on config_snapshot (snapshot_date desc);
create index if not exists idx_funnel_events_acct_date on funnel_events (account, reached_at desc);

create or replace function mantenimiento_semanal() returns table(tabla text, filas_borradas bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
declare n bigint;
begin
  delete from google_live_events where event_type = 'METRICS' and event_date < current_date - 3;
  get diagnostics n = row_count; tabla := 'google_live_events METRICS >3d'; filas_borradas := n; return next;
  delete from google_live_events where event_type in ('USER_CHANGE','AUTO_CHANGE') and event_date < current_date - 90;
  get diagnostics n = row_count; tabla := 'google_live_events cambios >90d'; filas_borradas := n; return next;
  delete from config_snapshot where snapshot_date < current_date - 90;
  get diagnostics n = row_count; tabla := 'config_snapshot >90d'; filas_borradas := n; return next;
  delete from run_log where run_ts < now() - interval '180 days';
  get diagnostics n = row_count; tabla := 'run_log >180d'; filas_borradas := n; return next;
  delete from webhook_events where received_at < now() - interval '90 days';
  get diagnostics n = row_count; tabla := 'webhook_events >90d'; filas_borradas := n; return next;
  tabla := 'capa diaria y semanal: NUNCA se borran (archivo permanente)'; filas_borradas := 0; return next;
end $$;

comment on function mantenimiento_semanal is 'Limpieza con politica de retencion por tabla. Correr semanalmente (Make, lunes 06:00, antes de las tareas). La capa diaria y semanal nunca se borran: son el archivo permanente desde que Google retiene solo 37 meses.';

create or replace view v_salud_sistema as
with t as (
  select relname as tabla, n_live_tup as filas, pg_total_relation_size(relid) as bytes
  from pg_stat_user_tables where schemaname = 'public'
),
diaria as (
  select 'keywords_daily' as tabla, count(*)::numeric / nullif(count(distinct date), 0) as filas_por_dia from keywords_daily
  union all select 'search_terms_daily', count(*)::numeric / nullif(count(distinct date), 0) from search_terms_daily
  union all select 'campaign_daily', count(*)::numeric / nullif(count(distinct date), 0) from campaign_daily
  union all select 'adgroup_daily', count(*)::numeric / nullif(count(distinct date), 0) from adgroup_daily
)
select t.tabla, t.filas, pg_size_pretty(t.bytes) as tamano,
       round(d.filas_por_dia) as filas_por_dia,
       round(d.filas_por_dia * 365) as filas_en_un_ano,
       case
         when t.tabla = 'google_live_events' and t.filas > 500 then 'LIMPIAR: mantenimiento_semanal() no esta corriendo'
         when t.tabla = 'config_snapshot' and t.filas > 5000 then 'LIMPIAR: snapshots acumulados'
         when d.filas_por_dia * 365 > 200000 then 'VIGILAR: mas de 200k filas/ano, considerar particionar'
         else 'OK'
       end as estado
from t left join diaria d on d.tabla = t.tabla
where t.filas > 0 order by t.bytes desc;

comment on view v_salud_sistema is 'Tamano, ritmo de crecimiento diario y proyeccion a un ano por tabla. LIMPIAR = mantenimiento_semanal() no corre. VIGILAR = hora de particionar por mes. Con 3 cuentas, ninguna tabla deberia pasar de 200k filas/ano.';

select * from mantenimiento_semanal();;
