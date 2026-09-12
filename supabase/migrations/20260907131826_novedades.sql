-- Comentarios de accionables, espejados desde Notion
create table if not exists accionable_comentarios (
  comment_id text primary key,
  notion_id text not null,
  account text,
  autor text not null,                     -- 'agente' | 'andres' | 'notion'
  prefijo text,                            -- [TAREA SEMANAL], [PULSO], [v], [RECONCILIADOR], [POLÍTICA], [INVARIANTE]...
  texto text not null,
  creado timestamptz not null,
  sincronizado timestamptz default now()
);
create index if not exists idx_com_notion on accionable_comentarios (notion_id, creado desc);
alter table accionable_comentarios enable row level security; revoke all on accionable_comentarios from anon, authenticated;

-- Novedades: lo que paso que Andres todavia no vio
create table if not exists novedades (
  id bigserial primary key,
  tipo text not null check (tipo in ('comentario','editado','propuesta','ticket','ejecucion','alerta')),
  account text,
  ref_tipo text not null check (ref_tipo in ('accionable','propuesta','ticket','ejecucion','alerta')),
  ref_id text not null,
  titulo text not null,
  texto text,
  autor text,
  creada timestamptz default now(),
  leida_el timestamptz,
  clave text unique                        -- dedupe
);
create index if not exists idx_nov_noleidas on novedades (leida_el) where leida_el is null;
alter table novedades enable row level security; revoke all on novedades from anon, authenticated;
comment on table novedades is 'Lo que los agentes hicieron y Andres no vio: comentaron un accionable, lo editaron, propusieron algo, respondieron un ticket, ejecutaron algo. Se marca leida al abrir el objeto.';

-- Generar novedades desde lo que ya existe en la base (versiones, propuestas, tickets, ejecuciones). Los comentarios los trae el server.
create or replace function novedades_generar() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0;
begin
  -- Ediciones de agentes (version > 1, no hechas por Andres): solo cambios sustantivos
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, creada, clave)
  select 'editado', e.account, 'accionable', v.notion_id, 'Editaron: ' || left(e.titulo, 80),
    'Cambió ' || (select string_agg(k, ', ') from jsonb_object_keys(v.diff) k), coalesce(v.autor, 'agente'), v.fecha, 'version:' || v.notion_id || ':' || v.version
  from accionable_versiones v join accionables_espejo e on e.notion_id = v.notion_id
  where v.version > 1 and v.fecha >= now() - interval '7 days' and (v.diff ? 'por_que' or v.diff ? 'accion' or v.diff ? 'titulo' or v.diff ? 'prioridad')
    and e.estado in ('Propuesto','Bloqueado','En curso')
  on conflict (clave) do nothing; get diagnostics n = row_count;
  -- Propuestas nuevas
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, creada, clave)
  select 'propuesta', account, 'propuesta', id::text, 'Propuesta estratégica: ' || left(titulo, 80), resultado_esperado, escrita_por, fecha::timestamptz, 'propuesta:' || id
  from propuestas_estrategicas where estado = 'propuesta' and fecha >= current_date - 7 on conflict (clave) do nothing;
  -- Tickets respondidos
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, creada, clave)
  select 'ticket', cuenta, 'ticket', id::text, 'Ticket #' || id || ' respondido: ' || left(titulo, 70), left(respuesta, 200), 'claude', resuelto_el, 'ticket:' || id || ':' || estado
  from tickets where estado in ('resuelto','descartado') and resuelto_el >= now() - interval '7 days' and creado_por = 'andres' on conflict (clave) do nothing;
  -- Ejecuciones automaticas (por politica) y fallidas
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, creada, clave)
  select 'ejecucion', account, 'ejecucion', id::text, (case when estado = 'fallida' then 'Falló: ' else 'El sistema ejecutó: ' end) || tipo || ' ' || coalesce(keyword, array_to_string(keywords, ', ')), left(resultado, 200), coalesce(aprobada_por, 'script'), ejecutada_el, 'ejecucion:' || id || ':' || estado
  from acciones_aprobadas where estado in ('ejecutada','fallida') and ejecutada_el >= now() - interval '7 days' and (por_politica or estado = 'fallida') on conflict (clave) do nothing;
  return n;
end $$;
revoke execute on function novedades_generar from anon, authenticated, public;

-- Vista para la app
create or replace view v_novedades with (security_invoker = true) as
select n.*, case n.ref_tipo when 'accionable' then e.titulo else null end accionable_titulo
from novedades n left join accionables_espejo e on n.ref_tipo = 'accionable' and e.notion_id = n.ref_id
where n.leida_el is null order by n.creada desc;
select novedades_generar();;
