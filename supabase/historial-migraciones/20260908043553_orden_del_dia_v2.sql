create or replace function orden_del_dia() returns table (
  bloque text, orden int, cuenta text, titulo text, por_que text,
  cuanto_cuesta text, notion_id text, urgencia text)
language sql stable security invoker set search_path = public, pg_temp as $$
  select x.bloque, x.orden, x.cuenta, x.titulo, x.por_que, x.cuanto_cuesta, x.notion_id, x.urgencia
  from (
    select 'Un clic'::text bloque, 1 orden, a.account cuenta, a.titulo, left(a.por_que, 200) por_que,
      'un clic: el ejecutor lo aplica dentro de la hora'::text cuanto_cuesta, a.notion_id,
      coalesce(a.prioridad, 'Media') urgencia
    from accionables_espejo a
    where a.estado in ('Propuesto','Bloqueado') and a.accion_valida and prevuelo(a.notion_id) is null
    union all
    select 'Esperan una fecha o un conflicto', 2, a.account, a.titulo,
      coalesce(prevuelo(a.notion_id), left(a.por_que, 200)),
      'no se puede hoy: el pre-vuelo lo frena', a.notion_id, coalesce(a.prioridad, 'Media')
    from accionables_espejo a
    where a.estado in ('Propuesto','Bloqueado') and prevuelo(a.notion_id) is not null
    union all
    select 'A mano', 3, a.account, a.titulo, left(a.por_que, 200),
      case
        when a.titulo ~* 'preguntar|confirmar|consultar' then 'un mensaje: es una pregunta, no un cambio'
        when a.titulo ~* 'make|sheet|crm|gtm|zapier|asana' then 'fuera de Google Ads: otro sistema'
        when a.titulo ~* 'investigar|revisar|analizar' then 'diagnostico: mirar antes de decidir'
        when a.titulo ~* 'conversion|conversión' then 'Objetivos > Conversiones, no se puede por script'
        when a.titulo ~* 'anuncio|rsa|copy' then 'la interfaz de Google: los RSA no se crean por script'
        else 'a mano en la interfaz de Google Ads' end,
      a.notion_id, coalesce(a.prioridad, 'Media')
    from accionables_espejo a
    where a.estado in ('Propuesto','Bloqueado') and not coalesce(a.accion_valida, false)
      and prevuelo(a.notion_id) is null
  ) x
  order by x.orden, case x.urgencia when 'Alta' then 1 when 'Media' then 2 else 3 end, x.cuenta;
$$;
comment on function orden_del_dia is 'Lo que espera decision de Andres, ordenado por costo de decidirlo. Primero lo que es un clic, despues lo bloqueado con su motivo, y al final el trabajo a mano con el tiempo que lleva. Abrir la app tiene que dar un plan, no una lista.';
select bloque, count(*) n, string_agg(distinct cuenta, ', ') cuentas from orden_del_dia() group by 1, orden order by orden;;
