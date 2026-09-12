-- CORRECCION DE MI PROPIO LINTER. v_metricas_reescritas marcaba 9 objetos y los 9 eran
-- falsos positivos: marcaba el PATRON sin preguntar si el patron hacia dano.
--   * Las 6 marcadas por ventana leen de tablas SEMANALES, que tienen 91 dias. Pedir 30 o
--     90 ahi es honesto. La trampa solo existe contra las diarias, que tienen 17.
--   * Las 3 marcadas por CPA lo calculan por dia, semana o keyword. Es OTRO GRANO, no una
--     reescritura de la canonica, que es de cuenta y 4 semanas.
-- Mismo error que advierte la literatura de testing metamorfico: una relacion fuera de su
-- dominio de validez da falso positivo, y un chequeo que grita en todos lados se ignora.
-- Ahora MIDE: una ventana es drift solo si la tabla de la que lee tiene menos dias que los
-- que pide, siguiendo v_linaje. El patron de CPA sale: no se puede distinguir grano
-- estaticamente, eso lo verifica la relacion headroom_usa_la_metrica_canonica.

create or replace view public.v_retencion_tablas as
select 'campaign_daily'::text as tabla, count(distinct date)::int as dias from campaign_daily
union all select 'keywords_daily', count(distinct date)::int from keywords_daily
union all select 'search_terms_daily', count(distinct date)::int from search_terms_daily
union all select 'adgroup_daily', count(distinct date)::int from adgroup_daily
union all select 'campaign', (count(distinct week_start)*7)::int from campaign
union all select 'keywords', (count(distinct week_start)*7)::int from keywords
union all select 'search_terms', (count(distinct week_start)*7)::int from search_terms
union all select 'conversion_actions', (count(distinct week_start)*7)::int from conversion_actions
union all select 'adgroup', (count(distinct week_start)*7)::int from adgroup;

comment on view public.v_retencion_tablas is
  'Cuantos dias tiene REALMENTE cada tabla de hechos. Las diarias tienen 17, las semanales 91. Es el dato que convierte al linter de ventanas en un chequeo preciso en vez de una alarma que grita en todos lados.';

delete from patrones_drift where metrica in ('cpa','conversiones');

drop view if exists public.v_salud_calidad;
drop view if exists public.v_metricas_reescritas;

create view public.v_metricas_reescritas as
with pedidos as (
  select c.relname::text as objeto,
         (regexp_match(pg_get_viewdef(c.oid), 'current_date\s*-\s*([0-9]+)'))[1]::int as dias_pedidos
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v','m')
     and pg_get_viewdef(c.oid) ~ 'current_date\s*-\s*[0-9]+'
     and c.relname not in ('v_metricas_reescritas','v_ventana_real','v_retencion_tablas','v_drift_semantico')
),
fuentes as (
  select p.objeto, p.dias_pedidos, r.tabla, r.dias as dias_disponibles
    from pedidos p
    join v_linaje l on l.objeto = p.objeto and l.tipo_fuente = 'tabla'
    join v_retencion_tablas r on r.tabla = l.depende_de
)
select f.objeto, 'ventana'::text as metrica, f.tabla as lee_de,
       f.dias_pedidos, f.dias_disponibles,
       'Pide ' || f.dias_pedidos || ' dias sobre ' || f.tabla || ', que tiene ' || f.dias_disponibles ||
       '. Devuelve el total de ' || f.dias_disponibles || ' dias con la etiqueta de ' || f.dias_pedidos || '.' as por_que,
       'ventana_metrica(cuenta, tipo)'::text as usar_en_su_lugar
  from fuentes f
 where f.dias_pedidos > f.dias_disponibles;

comment on view public.v_metricas_reescritas is
  'Vistas que piden una ventana mayor que la que su tabla de origen tiene. MIDE en vez de marcar el patron: cruza la ventana pedida, parseada de la definicion, contra la retencion real, siguiendo el linaje. La version anterior marcaba 9 objetos y los 9 eran falsos positivos.';

create view public.v_salud_calidad as
select 'metricas'::text as area, 'ventana_mayor_que_la_tabla' as prueba, m.objeto as cuenta, 'FALLA' as estado,
       m.por_que || ' Usar ' || m.usar_en_su_lugar as detalle
  from v_metricas_reescritas m
union all
select 'verdad', 'relacion_violada', v.cuenta, 'FALLA',
       v.familia || ' / ' || v.nombre || ': ' || v.detalle
  from v_relaciones_violadas v
union all
select 'semantica', d.familia, d.objeto || '.' || d.columna,
       case when d.familia in ('ventana_que_miente','tipo_que_miente') then 'FALLA' else 'ATENCION' end,
       d.detalle || ' ' || d.que_hacer
  from v_drift_semantico d
union all
select 'verdad', 'cifra_no_verificada', c.cuenta, 'ATENCION',
       c.etiqueta || ': publicada el ' || c.publicada_el::date || ' y todavia sin verificar.'
  from cifras_publicadas c where c.veredicto is null and c.publicada_el < now() - interval '2 hours'
union all
select 'verdad', 'cifra_sospechosa', s.cuenta, 'FALLA',
       s.etiqueta || ' [' || s.veredicto || ']: ' || left(s.detalle, 200)
  from v_cifras_sospechosas s;

comment on view public.v_salud_calidad is
  'La capa de calidad semantica en una vista: ventanas mayores que su tabla, relaciones de verdad violadas, nombres que mienten, y cifras publicadas sin verificar o que no se reproducen. Es lo que distingue "el dato existe" de "el dato significa lo que dice".';;
