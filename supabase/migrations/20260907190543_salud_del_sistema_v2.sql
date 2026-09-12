drop view if exists v_salud_sistema cascade;
create view v_salud_sistema with (security_invoker = true) as
with x as (
  select 'integridad' area, prueba, cuenta, estado, detalle from auditar_integridad()
  union all
  select 'ejecucion', 'trabajo_manual_evitable', account, 'ATENCION',
    count(*) || ' accionable(s) se podrian ejecutar solos: ' || string_agg(distinct verbo_sugerido, ', ')
  from v_ejecucion_perdida group by account
  union all
  select 'notion', 'espejo_huerfano', account, 'FALLA', lectura from v_espejo_huerfano
  union all
  select 'notion', 'espejo_fresco', '-', case when max(sincronizado) > now() - interval '2 hours' then 'OK' else 'ATENCION' end,
    'Ultima sincronizacion del espejo: ' || max(sincronizado)::text from accionables_espejo
  union all
  select 'mapeo', 'campanas_sin_dim', account, 'FALLA', 'Campana con gasto fuera de campaign_dim: ' || campaign from v_campanas_sin_dim
  union all
  select 'mapeo', 'objetivo_sin_definicion', account, 'FALLA', lectura from v_integridad_mapeo where not tiene_definicion and objetivo <> 'generico'
  union all
  select 'tareas', 'tickets_abiertos', coalesce(cuenta,'-'), case when count(*) > 5 then 'ATENCION' else 'OK' end,
    count(*) || ' ticket(s) de sistema abiertos' from tickets where estado = 'abierto' group by cuenta
  union all
  select 'ejecucion', 'acciones_fallidas', account, 'ATENCION',
    count(*) || ' ejecucion(es) fallidas en 7 dias: ' || left(string_agg(distinct resultado, ' | '), 200)
  from acciones_aprobadas where estado = 'fallida' and aprobada_el > now() - interval '7 days' group by account
)
select area, prueba, cuenta, estado, detalle from x
order by case estado when 'FALLA' then 1 when 'ATENCION' then 2 else 3 end, area, prueba;

create or replace function get_salud_sistema() returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'al', now(),
    'veredicto', case
      when exists (select 1 from v_salud_sistema where estado = 'FALLA') then 'hay algo roto'
      when exists (select 1 from v_salud_sistema where estado = 'ATENCION') then 'funciona, con cosas para mirar'
      else 'todo bien' end,
    'fallas', (select coalesce(jsonb_agg(jsonb_build_object('area', area, 'prueba', prueba, 'cuenta', cuenta, 'detalle', detalle)), '[]') from v_salud_sistema where estado = 'FALLA'),
    'atencion', (select coalesce(jsonb_agg(jsonb_build_object('area', area, 'prueba', prueba, 'cuenta', cuenta, 'detalle', detalle)), '[]') from v_salud_sistema where estado = 'ATENCION'),
    'ok', (select count(*) from v_salud_sistema where estado = 'OK')
  );
$$;
comment on function get_salud_sistema is 'Una consulta que dice si el sistema esta sano. Reune la auditoria de integridad, el trabajo manual evitable, el estado del espejo, el mapeo, los tickets y las ejecuciones fallidas. El briefing la lee: si hay una falla, sale en el mail antes de que Andres la descubra leyendo la salida de un agente.';
select (get_salud_sistema())->>'veredicto' veredicto, (get_salud_sistema())->'atencion' atencion;;
