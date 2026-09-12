-- La tarea cambios_no_informados fallaba con
--   operator does not exist: text >= timestamp with time zone
-- porque change_events.change_datetime es TEXT y se comparaba con ejecutada_el, que es
-- timestamptz. Es la misma trampa que me comi hoy escribiendo get_weekly_package_cadena.
-- corridas_ok = 0 y corridas_falla = 1: nunca funciono desde que se la vigila.
create or replace function public.detectar_cambios_no_informados()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare n int := 0; r record;
begin
  for r in
    select a.id, a.account, a.keyword, a.resultado, c.changed_field, c.old_value, c.new_value,
           c.change_datetime::timestamptz as cuando
    from acciones_aprobadas a
    join change_events c on c.account = a.account
      -- ::timestamptz explicito: la columna es TEXT. Sin el cast, la funcion no compila
      -- y la tarea muere entera, arrastrando a la que corre en el mismo job.
      and c.change_datetime::timestamptz between a.ejecutada_el - interval '5 minutes' and a.ejecutada_el + interval '60 minutes'
      and (a.keyword is null or normalizar_entidad(coalesce(c.entity_name, '')) like '%' || normalizar_entidad(a.keyword) || '%')
    where a.estado = 'ejecutada' and a.ejecutada_el >= now() - interval '7 days'
      and c.changed_field is not null
      and (c.changed_field ilike '%cpc%' and a.resultado not ilike '%cpc%'
        or c.changed_field ilike '%url%' and a.resultado not ilike '%url%'
        or c.changed_field ilike '%bid%' and a.resultado not ilike '%puja%' and a.resultado not ilike '%cpc%')
  loop
    perform alerta_registrar(r.account, 'semana', 'cambio_no_informado',
      'El script cambio algo que no reporto en ' || coalesce(r.keyword, 'la entidad'),
      'Google registro: ' || r.changed_field || ' de ' || coalesce(r.old_value, '?') || ' a ' || coalesce(r.new_value, '?') || '. El resultado del script decia: ' || left(r.resultado, 200),
      'Revisar en Google Ads > Historial de cambios y corregir si hace falta. Si el script tiene que cambiar, ticket.',
      'reconciliador', r.keyword, r.cuando::date);
    n := n + 1;
  end loop;
  return n;
end $function$;

comment on function public.detectar_cambios_no_informados() is
  'Cruza acciones ejecutadas contra change_events para detectar cambios que el script hizo y no reporto. OJO: change_events.change_datetime es TEXT, no timestamp. Toda comparacion de fechas contra esa columna necesita ::timestamptz explicito. Sin el cast la funcion no compila y la tarea muere, arrastrando a la que corre en el mismo job de pg_cron.';;
