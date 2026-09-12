-- 1. foto_leida va en run_quality (registro de corridas de la tarea), no en run_log (log de extraccion de scripts)
alter table run_quality add column if not exists foto_leida timestamptz;
alter table run_log drop column if exists foto_leida;
comment on column run_quality.foto_leida is 'foto_tomada de get_estado_cuenta que la corrida leyo al arrancar.';
comment on table run_log is 'Log de extraccion de los scripts de Google Ads (filas por tabla y semana). NO es el registro de corridas de la tarea semanal: eso es run_quality.';

-- 2. actionables_memory es legacy (fase de embeddings, nunca se pobló). Se marca y se saca del camino.
comment on table actionables_memory is 'LEGACY. Fase anterior con embeddings; nunca se poblo. No es falla que este vacia. La memoria de accionables vive en accionables_espejo (sincronizado desde Notion).';
alter table actionables_memory rename to legacy_actionables_memory;

-- 3. Guard de idempotencia: hubo corrida hoy sobre el mismo periodo y sin datos nuevos?
create or replace function corrida_redundante(p_account text) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  with ult as (select semana_analizada, created_at, foto_leida from run_quality where account = p_account order by created_at desc limit 1),
  datos as (select max(date) diaria, (select max(week_start) from campaign where account = p_account) semanal from campaign_daily where account = p_account),
  nuevo as (
    select exists (select 1 from pulso_diario p, ult where p.account = p_account and p.created_at > ult.created_at) as pulso_nuevo,
           exists (select 1 from operator_log o, ult where o.account = p_account and o.created_at > ult.created_at) as operador_nuevo,
           exists (select 1 from google_live_events g, ult where g.account = p_account and g.created_at > ult.created_at and g.event_type in ('USER_CHANGE','AUTO_CHANGE')) as google_nuevo,
           exists (select 1 from run_log r, ult where r.account = p_account and r.run_ts > ult.created_at and r.status = 'ok') as extraccion_nueva
  )
  select jsonb_build_object(
    'ultima_corrida', (select created_at from ult), 'semana_analizada', (select semana_analizada from ult),
    'semana_disponible', (select semanal from datos), 'diaria_hasta', (select diaria from datos),
    'hubo_corrida_hoy', (select created_at::date = current_date from ult),
    'hay_datos_nuevos', (select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva from nuevo),
    'detalle', (select jsonb_build_object('pulso', pulso_nuevo, 'operador', operador_nuevo, 'google', google_nuevo, 'extraccion', extraccion_nueva) from nuevo),
    'redundante', (select created_at::date = current_date from ult) and not (select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva from nuevo)
  );
$$;
comment on function corrida_redundante is 'Antes de analizar: si ya hubo corrida hoy y no entro nada nuevo (pulso, operador, Google, extraccion) desde entonces, redundante = true y la tarea termina en una linea.';

select corrida_redundante('KAREDO');;
