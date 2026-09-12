alter table novedades add column if not exists actor text;
alter table novedades add column if not exists verbo text;
alter table novedades add column if not exists objeto_titulo text;
create or replace function actor_desde_prefijo(p text) returns text language sql immutable as $$
  select case
    when p is null then 'sistema'
    when upper(p) like 'TAREA SEMANAL%' or upper(p) like 'SEMANAL%' or p = 'v' then 'semanal'
    when upper(p) like 'PULSO%' then 'pulso'
    when upper(p) like 'MENSUAL%' or upper(p) like 'REVISION MENSUAL%' then 'mensual'
    when upper(p) like 'RECONCILIADOR%' then 'reconciliador'
    when upper(p) like 'POL%TICA%' then 'politica'
    when upper(p) like 'INVARIANTE%' then 'invariante'
    when upper(p) like 'ANOMAL%' then 'anomalias'
    when upper(p) like 'CLAUDE%' then 'claude'
    when upper(p) like 'APP%' then 'sistema'
    else 'agente' end;
$$;
create or replace function novedades_generar() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0;
begin
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'editado', e.account, 'accionable', v.notion_id, 'Editaron: ' || left(e.titulo, 80),
    'Cambió ' || (select string_agg(case k when 'por_que' then 'el por qué' when 'accion' then 'la acción' when 'titulo' then 'el título' when 'prioridad' then 'la prioridad' when 'entidad' then 'la entidad' else k end, ', ') from jsonb_object_keys(v.diff) k),
    coalesce(v.autor, 'agente'), 'semanal', 'edito', e.titulo, v.fecha, 'version:' || v.notion_id || ':' || v.version
  from accionable_versiones v join accionables_espejo e on e.notion_id = v.notion_id
  where v.version > 1 and v.fecha >= now() - interval '7 days' and (v.diff ? 'por_que' or v.diff ? 'accion' or v.diff ? 'titulo' or v.diff ? 'prioridad')
    and e.estado in ('Propuesto','Bloqueado','En curso')
  on conflict (clave) do nothing; get diagnostics n = row_count;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'propuesta', account, 'propuesta', id::text, 'Propuesta estratégica: ' || left(titulo, 80), resultado_esperado, escrita_por, case when escrita_por ilike '%mensual%' then 'mensual' else 'semanal' end, 'propuso', titulo, fecha::timestamptz, 'propuesta:' || id
  from propuestas_estrategicas where estado = 'propuesta' and fecha >= current_date - 7 on conflict (clave) do nothing;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'ticket', cuenta, 'ticket', id::text, 'Ticket #' || id || ' respondido: ' || left(titulo, 70), left(respuesta, 200), 'claude', 'claude', 'respondio', titulo, resuelto_el, 'ticket:' || id || ':' || estado
  from tickets where estado in ('resuelto','descartado') and resuelto_el >= now() - interval '7 days' and creado_por = 'andres' on conflict (clave) do nothing;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'ejecucion', account, 'ejecucion', id::text, (case when estado = 'fallida' then 'Falló: ' else 'Ejecutado: ' end) || replace(tipo, '_', ' ') || ' ' || coalesce(keyword, array_to_string(keywords, ', ')), left(resultado, 200), coalesce(aprobada_por, 'script'), case when por_politica then 'politica' else 'script' end, case when estado = 'fallida' then 'fallo' else 'ejecuto' end, replace(tipo, '_', ' ') || ' ' || coalesce(keyword, array_to_string(keywords, ', ')), ejecutada_el, 'ejecucion:' || id || ':' || estado
  from acciones_aprobadas where estado in ('ejecutada','fallida') and ejecutada_el >= now() - interval '7 days' and (por_politica or estado = 'fallida') on conflict (clave) do nothing;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'alerta', account, 'alerta', id::text, titulo, accion, origen, case origen when 'mensual' then 'mensual' when 'centinela' then 'script' when 'pulso' then 'pulso' when 'claude' then 'claude' else 'sistema' end, 'alerto', titulo, creada, 'alerta:' || id
  from alertas where estado = 'abierta' and nivel = 'hoy' and creada >= now() - interval '7 days' on conflict (clave) do nothing;
  update novedades set actor = actor_desde_prefijo(autor), verbo = 'comento' where tipo = 'comentario' and actor is null;
  return n;
end $$;
drop view if exists v_novedades;
create view v_novedades with (security_invoker = true) as
select n.*, coalesce(n.objeto_titulo, e.titulo) as objeto from novedades n left join accionables_espejo e on n.ref_tipo = 'accionable' and e.notion_id = n.ref_id
where n.leida_el is null order by n.creada desc;
create or replace view v_novedades_7d with (security_invoker = true) as
select n.*, coalesce(n.objeto_titulo, e.titulo) as objeto from novedades n left join accionables_espejo e on n.ref_tipo = 'accionable' and e.notion_id = n.ref_id
where n.creada >= now() - interval '7 days' order by n.creada desc;
select novedades_generar();;
