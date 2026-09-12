-- ================================================================
-- ROBUSTEZ: lo que es SQL puro corre dentro de Postgres
-- ================================================================
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- ---- Respaldo de la memoria no re-extraible ----
-- Todo lo de Google Ads se puede volver a bajar (37 meses). Esto no:
-- lo que Andres escribio, lo que las tareas aprendieron, los objetivos,
-- la escalera, los cierres reales. Un JSON por semana, 12 semanas de retencion.
create table if not exists backups_memoria (
  id bigserial primary key,
  creado timestamptz default now(),
  tablas jsonb not null,
  filas_total int,
  bytes int
);
alter table backups_memoria enable row level security;
revoke all on backups_memoria from anon, authenticated;

create or replace function respaldar_memoria() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; n int; b int;
begin
  select jsonb_build_object(
    'operator_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from operator_log t),
    'reflexiones', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from reflexiones t),
    'doc_maestro_humano', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from doc_maestro_humano t),
    'doc_maestro_consolidado', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from doc_maestro_consolidado t),
    'account_targets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from account_targets t),
    'funnel_stages', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from funnel_stages t),
    'funnel_events', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from funnel_events t),
    'run_quality', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from run_quality t),
    'true_roas_events', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from true_roas_events t),
    'cierres_sin_atribucion', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from cierres_sin_atribucion t),
    'accionables_ejecutados', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from accionables_ejecutados t)
  ) into v;
  select sum(jsonb_array_length(value)) into n from jsonb_each(v);
  b := octet_length(v::text);
  insert into backups_memoria (tablas, filas_total, bytes) values (v, n, b);
  delete from backups_memoria where creado < now() - interval '84 days';
  return jsonb_build_object('filas', n, 'bytes', b, 'tablas', (select count(*) from jsonb_object_keys(v)));
end $$;
revoke execute on function respaldar_memoria from anon, authenticated, public;
comment on function respaldar_memoria is 'Respalda en JSON las 11 tablas que NO se pueden re-extraer de Google Ads: lo que Andres escribio, lo que el sistema aprendio, objetivos, escalera, cierres reales. Retencion 12 semanas. Para restaurar: select tablas->''operator_log'' from backups_memoria order by creado desc limit 1.';

-- ---- Programacion dentro de Postgres ----
-- Mantenimiento: lunes 06:00 UTC (03:00 BA). Igual que en Vercel; ahora corren ambos y el que falle no importa.
select cron.unschedule(jobid) from cron.job where jobname in ('mantenimiento_semanal', 'respaldo_memoria', 'eventos_escalera_diario');
select cron.schedule('mantenimiento_semanal', '0 6 * * 1', $$select mantenimiento_semanal()$$);
-- Respaldo: domingos 23:00 UTC (20:00 BA), antes de la semana nueva
select cron.schedule('respaldo_memoria', '0 23 * * 0', $$select respaldar_memoria()$$);
-- Eventos de escalera: diario 09:30 UTC (06:30 BA), despues del script diario
select cron.schedule('eventos_escalera_diario', '30 9 * * *', $$select actualizar_eventos_escalera()$$);

-- Primer respaldo ahora
select respaldar_memoria();;
