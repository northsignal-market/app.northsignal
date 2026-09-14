-- El reporte al cliente declara la ventana que SUMÓ, no la que le pidieron.
--
-- Encontrado el 14/9/2026 con datos reales: a las 00:40 faltaba el 13 de septiembre
-- en las CUATRO cuentas. No es un bug del script — extrae hasta "ayer", así que
-- hasta que corre, el último día no está. El problema es que nada lo decía: un
-- reporte de "1 al 13" sumaba 12 días y le mandaba a un cliente que paga un total
-- ~5% más bajo. En KAREDO eran 94,56 EUR de 1.806,84.
--
-- Es la regla 3 de CLAUDE.md —"la ventana que declarás tiene que ser la que
-- sumaste"— aplicada al único lugar donde el número sale de la empresa.
--
-- REVERTIR: definición anterior en supabase/migrations/20260912182011_remote_schema.sql

CREATE OR REPLACE FUNCTION public.get_reporte_datos(p_account text, p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with
  cob as (
    select (p_hasta - p_desde + 1)                                   as dias_pedidos,
           count(distinct s.date)                                    as dias_con_dato,
           max(s.date)                                               as ultimo_dia_con_dato,
           coalesce(array_agg(distinct g.dia::date order by g.dia::date)
                    filter (where s.date is null), '{}')             as dias_faltantes
      from generate_series(p_desde, p_hasta, '1 day') g(dia)
      left join (select distinct date from v_serie_diaria
                  where account = p_account and date between p_desde and p_hasta) s
        on s.date = g.dia::date
  ),
  act as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde and p_hasta),
  ant as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde - (p_hasta - p_desde + 1) and p_desde - 1),
  is_act as (select round(sum(impr_share * impressions) / nullif(sum(impressions), 0), 1) impr_share from campaign_daily where account = p_account and date between p_desde and p_hasta),
  camp as (select * from jsonb_to_recordset(((get_entidades('campaign', p_account, p_desde, p_hasta))::jsonb)->'data') as x(campaign text, cost numeric, conversions numeric, cost_per_conv numeric, ctr numeric)),
  grp as (select * from jsonb_to_recordset(((get_entidades('adgroup', p_account, p_desde, p_hasta))::jsonb)->'data') as x(ad_group text, campaign text, cost numeric, conversions numeric, cost_per_conv numeric))
  select jsonb_build_object(
    -- La ventana que se SUMÓ, no la que se pidió. Si difieren, el PDF lo dice.
    'cobertura', jsonb_build_object(
      'dias_pedidos', cob.dias_pedidos,
      'dias_con_dato', cob.dias_con_dato,
      'completa', cob.dias_con_dato = cob.dias_pedidos,
      'ultimo_dia_con_dato', cob.ultimo_dia_con_dato,
      'dias_faltantes', to_jsonb(cob.dias_faltantes)),
    'metricas', jsonb_build_object(
      'cost', jsonb_build_object('actual', round(a.cost, 2), 'anterior', round(n.cost, 2)),
      'conversions', jsonb_build_object('actual', round(a.conversions, 1), 'anterior', round(n.conversions, 1)),
      'cpa', jsonb_build_object('actual', round(a.cost / nullif(a.conversions, 0), 2), 'anterior', round(n.cost / nullif(n.conversions, 0), 2)),
      'ctr', jsonb_build_object('actual', round(a.clicks::numeric / nullif(a.impressions, 0) * 100, 2), 'anterior', round(n.clicks::numeric / nullif(n.impressions, 0) * 100, 2)),
      'clicks', jsonb_build_object('actual', a.clicks, 'anterior', n.clicks),
      'impr_share', jsonb_build_object('actual', i.impr_share, 'anterior', null)),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'conv', conversiones, 'cpa', cpa, 'gasto', gasto, 'madurez', madurez) order by date), '[]') from v_serie_diaria where account = p_account and date between p_desde and p_hasta),
    'campanas', (select coalesce(jsonb_agg(jsonb_build_object('nombre', campaign, 'gasto', cost, 'conv', conversions, 'cpa', cost_per_conv, 'ctr', ctr) order by cost desc), '[]') from camp where cost > 0),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', ad_group, 'campana', campaign, 'gasto', cost, 'conv', conversions, 'cpa', cost_per_conv) order by cost desc), '[]') from (select * from grp where cost > 0 order by cost desc limit 12) g),
    'accionables_ejecutados', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'ejecutado', ejecutado_el, 'veredicto', veredicto, 'variacion', variacion_pct) order by ejecutado_el desc), '[]') from v_impacto_accionables where account = p_account and ejecutado_el between p_desde - 14 and p_hasta)
  ) from act a, ant n, is_act i, cob;
$function$;
