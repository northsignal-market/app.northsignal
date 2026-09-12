create table if not exists escritores (entidad text primary key, dueno text not null, proponen text[] default '{}', leen text[] default '{}', regla text);
insert into escritores (entidad, dueno, proponen, leen, regla) values
  ('accionables', 'semanal', '{pulso,anomalias,andres}', '{todos}', 'Solo Semanal y Andres crean Propuesto. Pulso y Anomalias crean Bloqueado con Origen y Vence = +7 dias; el Semanal los confirma, fusiona o descarta el lunes. Nadie crea si ya hay uno abierto con la misma Entidad.'),
  ('plan_semanal', 'semanal', '{}', '{pulso,app}', 'El Pulso lee, nunca escribe.'),
  ('pulso_diario', 'pulso', '{}', '{semanal,app,reconciliador}', 'Una fila por cuenta y dia; upsert idempotente.'),
  ('alertas', 'crons', '{}', '{app}', 'Andres resuelve o silencia. El reconciliador cierra las que ya no aplican.'),
  ('doc_maestro_humano', 'andres', '{}', '{todos}', 'Solo Andres edita desde la app. Versionada.'),
  ('doc_maestro_consolidado', 'semanal', '{}', '{todos}', 'Espejo de Notion; lo escribe el cron del lunes.'),
  ('reflexiones', 'semanal', '{}', '{semanal,pulso,app}', 'Solo la tarea semanal escribe.'),
  ('operator_log', 'andres', '{}', '{todos}', 'Solo Andres, desde la app o Bitacora.'),
  ('reportes_cliente', 'cron_reportes', '{}', '{app}', 'Andres aprueba o edita el texto; nadie mas.')
on conflict (entidad) do update set dueno = excluded.dueno, proponen = excluded.proponen, regla = excluded.regla;
alter table escritores enable row level security; revoke all on escritores from anon, authenticated;

create table if not exists accionables_espejo (
  notion_id text primary key, account text, titulo text, estado text, prioridad text, naturaleza text, origen text, entidad text, causa_raiz text, por_que text,
  detectado date, ejecutado_el date, vence date, reemplazado_por text, semanas_pendiente int, revision_ia text, ultima_edicion timestamptz, sincronizado timestamptz default now()
);
create index if not exists idx_esp_acct_estado on accionables_espejo (account, estado);
alter table accionables_espejo enable row level security; revoke all on accionables_espejo from anon, authenticated;

create or replace function normalizar_entidad(t text) returns text language sql immutable set search_path = public, extensions as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '\s+', ' ', 'g');
$$;
create or replace function accionables_vigentes(p_account text) returns jsonb language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', notion_id, 'titulo', titulo, 'estado', estado, 'origen', origen, 'entidad', entidad, 'causa_raiz', causa_raiz, 'detectado', detectado, 'vence', vence) order by detectado desc), '[]')
  from accionables_espejo where account = p_account and estado in ('Propuesto','Bloqueado','En curso') and reemplazado_por is null;
$$;
create or replace function accionable_existente(p_account text, p_entidad text, p_causa text default null) returns text language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  select notion_id from accionables_espejo where account = p_account and estado in ('Propuesto','Bloqueado','En curso') and reemplazado_por is null
    and (normalizar_entidad(entidad) = normalizar_entidad(p_entidad) or (p_causa is not null and causa_raiz is not null and extensions.similarity(normalizar_entidad(causa_raiz), normalizar_entidad(p_causa)) > 0.6))
  order by detectado desc limit 1;
$$;

create or replace function get_estado_cuenta(p_account text) returns jsonb language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object(
    'cuenta', p_account, 'foto_tomada', now(),
    'ultima_extraccion', (select jsonb_build_object('diaria', max(date), 'semanal', (select max(week_start) from campaign where account = p_account)) from campaign_daily where account = p_account),
    'plan_vigente', (select jsonb_build_object('id', id, 'semana', semana, 'contexto', contexto, 'indicadores', indicadores, 'hipotesis', hipotesis, 'condiciones_escalamiento', condiciones_escalamiento, 'escrito_el', escrito_el) from plan_semanal where account = p_account and semana <= current_date order by semana desc limit 1),
    'accionables_abiertos', accionables_vigentes(p_account),
    'accionables_hechos_14d', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'ejecutado_el', ejecutado_el, 'entidad', entidad)), '[]') from accionables_espejo where account = p_account and estado = 'Hecho' and ejecutado_el >= current_date - 14),
    'pulsos_recientes', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'nivel', nivel, 'hallazgo', hallazgo_principal, 'evidencia', evidencia, 'hipotesis_movidas', hipotesis_movidas) order by fecha desc), '[]') from (select * from pulso_diario where account = p_account order by fecha desc limit 7) p),
    'alertas_abiertas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nivel', nivel, 'tipo', tipo, 'titulo', titulo, 'entidad', entidad, 'fecha', fecha_dato)), '[]') from alertas where account = p_account and estado in ('abierta','vista')),
    'operator_log_14d', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'que', que_cambio, 'donde', donde, 'por_que', por_que) order by fecha desc), '[]') from operator_log where account = p_account and fecha >= current_date - 14),
    'cambios_google_7d', (select coalesce(jsonb_agg(jsonb_build_object('fecha', event_date, 'entidad', entity_name, 'tipo', event_type, 'quien', user_email)), '[]') from google_live_events where account = p_account and event_type in ('USER_CHANGE','AUTO_CHANGE') and event_date >= now() - interval '7 days'),
    'reflexiones_vigentes', (select coalesce(jsonb_agg(que_haria_distinto order by run_date desc), '[]') from (select que_haria_distinto, run_date from reflexiones where account = p_account order by run_date desc limit 5) r),
    'hipotesis_consolidadas', (select hipotesis_abiertas from doc_maestro_consolidado where account = p_account limit 1),
    'objetivos', (select jsonb_build_object('cpa_max', cpa_maximo, 'conv_mes', conversiones_mes_objetivo, 'provisional', cpa_maximo_origen = 'historico') from account_targets where account = p_account),
    'reglas', (select reglas_dominio from cuentas where account = p_account)
  );
$$;

create table if not exists reconciliaciones (id bigserial primary key, corrida timestamptz default now(), account text, regla text not null, objeto text not null, accion text not null, detalle text, aplicada boolean default false, aplicada_el timestamptz);
create unique index if not exists uq_reconc_pendiente on reconciliaciones (objeto, accion) where aplicada = false;
alter table reconciliaciones enable row level security; revoke all on reconciliaciones from anon, authenticated;

create or replace function reconciliar() returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n_venc int := 0; n_dup int := 0; n_hecho int := 0; n_alert int := 0; r record;
begin
  for r in select notion_id, account, titulo from accionables_espejo where estado in ('Propuesto','Bloqueado') and vence is not null and vence < current_date and reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R1_vencido', 'accionable:' || r.notion_id, 'vencer', 'Vencio sin ejecutarse: ' || r.titulo) on conflict do nothing; n_venc := n_venc + 1;
  end loop;
  for r in select a.account, a.notion_id as viejo, b.notion_id as nuevo, a.entidad from accionables_espejo a join accionables_espejo b
    on a.account = b.account and a.notion_id < b.notion_id and normalizar_entidad(a.entidad) = normalizar_entidad(b.entidad) and coalesce(a.entidad, '') <> ''
    where a.estado in ('Propuesto','Bloqueado','En curso') and b.estado in ('Propuesto','Bloqueado','En curso') and a.reemplazado_por is null and b.reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R2_duplicado', 'accionable:' || r.nuevo, 'duplicado', 'Misma entidad que ' || r.viejo || ' (' || r.entidad || '). Pasa a Reemplazado por el mas viejo.') on conflict do nothing; n_dup := n_dup + 1;
  end loop;
  for r in select e.notion_id, e.account, e.titulo, g.event_date from accionables_espejo e
    join google_live_events g on g.account = e.account and g.event_type = 'USER_CHANGE' and g.event_date::date >= coalesce(e.detectado, current_date - 30)
      and coalesce(e.entidad, '') <> '' and normalizar_entidad(g.entity_name) like '%' || split_part(normalizar_entidad(e.entidad), '|', array_length(string_to_array(e.entidad, '|'), 1)) || '%'
    where e.estado in ('Propuesto','Bloqueado') and e.reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R3_posible_hecho', 'accionable:' || r.notion_id, 'ya_hecho', 'Cambio de usuario en esa entidad el ' || r.event_date::date || '. Confirmar si corresponde a "' || r.titulo || '".') on conflict do nothing; n_hecho := n_hecho + 1;
  end loop;
  for r in select a.id, a.account, a.entidad from alertas a where a.tipo = 'plan_condicion' and a.estado in ('abierta','vista')
    and not exists (select 1 from pulso_diario p, jsonb_array_elements(p.evidencia) e where p.account = a.account and p.fecha = (select max(fecha) from pulso_diario where account = a.account) and (e->>'cumple')::boolean and coalesce(e->>'grupo', e->>'nombre') = a.entidad) loop
    update alertas set estado = 'resuelta', resuelta_el = now() where id = r.id;
    insert into reconciliaciones (account, regla, objeto, accion, detalle, aplicada, aplicada_el) values (r.account, 'R4_condicion_cesa', 'alerta:' || r.id, 'cerrar_alerta', 'La condicion dejo de cumplirse en el ultimo pulso.', true, now()); n_alert := n_alert + 1;
  end loop;
  return jsonb_build_object('vencidos', n_venc, 'duplicados', n_dup, 'posibles_hechos', n_hecho, 'alertas_cerradas', n_alert, 'corrida', now());
end $$;
revoke execute on function reconciliar from anon, authenticated, public;
select cron.unschedule(jobid) from cron.job where jobname = 'reconciliar_diario';
select cron.schedule('reconciliar_diario', '35 9 * * *', $$select reconciliar()$$);
select 'ok';;
