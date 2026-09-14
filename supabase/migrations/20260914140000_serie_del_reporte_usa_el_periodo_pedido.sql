-- §3.4 de docs/PENDIENTE_VERACIDAD.md.
-- La `serie` del reporte era SIEMPRE p_hasta-13..p_hasta, sin importar el período
-- pedido, mientras los totales de la misma función sí usaban p_desde..p_hasta. Esa
-- serie se le manda al modelo bajo el rótulo "período ${desde} a ${hasta}": razonaba
-- sobre 14 días creyendo que eran los que decía el prompt.
--
-- REVERTIR: definición anterior en supabase/migrations/20260912182011_remote_schema.sql

CREATE OR REPLACE FUNCTION public.get_reporte_datos(p_account text, p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with act as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde and p_hasta),
  ant as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde - (p_hasta - p_desde + 1) and p_desde - 1),
  is_act as (select round(sum(impr_share * impressions) / nullif(sum(impressions), 0), 1) impr_share from campaign_daily where account = p_account and date between p_desde and p_hasta),
  camp as (select * from jsonb_to_recordset(((get_entidades('campaign', p_account, p_desde, p_hasta))::jsonb)->'data') as x(campaign text, cost numeric, conversions numeric, cost_per_conv numeric, ctr numeric)),
  grp as (select * from jsonb_to_recordset(((get_entidades('adgroup', p_account, p_desde, p_hasta))::jsonb)->'data') as x(ad_group text, campaign text, cost numeric, conversions numeric, cost_per_conv numeric))
  select jsonb_build_object(
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
  ) from act a, ant n, is_act i;
$function$;
