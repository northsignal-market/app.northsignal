-- ================================================================
-- CAMBIOS DETECTADOS POR DIFERENCIA DE FOTOS
-- change_events depende de que Google los registre y los exponga. En FRESH_MONKEE
-- no aparece nada desde el 15 de agosto, pese a que NJ_Ridgewood_OP se pauso alrededor
-- del 1 de septiembre. La foto diaria de configuracion (config_snapshot) SI lo ve.
-- Esto compara la foto de hoy con la anterior y registra lo que cambio.
-- ================================================================
create table if not exists cambios_config (
  id bigserial primary key,
  account text not null, entidad text not null, entity_type text not null,
  campo text not null, valor_anterior text, valor_nuevo text,
  detectado_el date not null, foto_anterior date, foto_actual date,
  visto boolean default false,
  unique (account, entidad, campo, foto_actual)
);
alter table cambios_config enable row level security; revoke all on cambios_config from anon, authenticated;
comment on table cambios_config is 'Cambios detectados comparando dos fotos consecutivas de config_snapshot. No depende de que Google los registre en change_events, que tiene huecos: en FRESH_MONKEE no expuso nada desde el 15 de agosto pese a que una campana se pauso el 1 de septiembre.';

create or replace function detectar_cambios_config() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0;
begin
  insert into cambios_config (account, entidad, entity_type, campo, valor_anterior, valor_nuevo, detectado_el, foto_anterior, foto_actual)
  select h.account, h.entity_name, h.entity_type, k.campo,
         a.config->>k.campo, h.config->>k.campo, current_date, a.snapshot_date, h.snapshot_date
  from config_snapshot h
  join lateral (select max(snapshot_date) d from config_snapshot x where x.account = h.account and x.snapshot_date < h.snapshot_date) prev on true
  join config_snapshot a on a.account = h.account and a.entity_name = h.entity_name and a.entity_type = h.entity_type and a.snapshot_date = prev.d
  cross join lateral (select unnest(array['status','estado_real','bidding_strategy','target_cpa','target_roas','daily_budget','end_date','primary_for_goal','include_in_conversions','counting_type','default_value']) campo) k
  where h.snapshot_date = (select max(snapshot_date) from config_snapshot y where y.account = h.account)
    and coalesce(a.config->>k.campo, '~') is distinct from coalesce(h.config->>k.campo, '~')
  on conflict (account, entidad, campo, foto_actual) do nothing;
  get diagnostics n = row_count;
  -- Los que importan generan alerta: estado, puja y conversion primaria
  insert into alertas (account, nivel, tipo, titulo, detalle, accion, origen, entidad, fecha_dato, estado)
  select c.account, 'hoy', 'cambio_no_registrado',
    'Cambio en ' || c.entidad || ' que Google no registro en el historial',
    c.campo || ': ' || coalesce(c.valor_anterior, 'sin valor') || ' -> ' || coalesce(c.valor_nuevo, 'sin valor') || '. Detectado comparando la foto del ' || c.foto_anterior || ' con la del ' || c.foto_actual || '. No aparece en change_events: puede haberlo hecho el cliente, un franquiciado, o Google sin registrarlo.',
    'Confirmar quien lo hizo y si es deliberado. Si fue el cliente, anotarlo en la bitacora.',
    'diff_config', c.entidad, c.foto_actual, 'abierta'
  from cambios_config c
  where c.detectado_el = current_date and not c.visto
    and c.campo in ('status','bidding_strategy','primary_for_goal','include_in_conversions')
    and not exists (select 1 from change_events e where e.account = c.account and e.change_datetime::date between c.foto_anterior and c.foto_actual and coalesce(e.campaign_name, e.entity_name) = c.entidad)
    and not exists (select 1 from alertas al where al.account = c.account and al.tipo = 'cambio_no_registrado' and al.entidad = c.entidad and al.fecha_dato = c.foto_actual);
  return n;
end $$;
revoke execute on function detectar_cambios_config from anon, authenticated, public;
select cron.unschedule(jobid) from cron.job where jobname = 'cambios_config';
select cron.schedule('cambios_config', '22 9 * * *', $$select detectar_cambios_config()$$);
select detectar_cambios_config() cambios_detectados;;
