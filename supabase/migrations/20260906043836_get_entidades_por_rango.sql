-- ================================================================
-- ENTIDADES POR RANGO: como lo hace Google Ads
-- ================================================================
-- Elegis cualquier rango de fechas y ves campanas, grupos, keywords o
-- terminos con sus metricas SUMADAS en ese rango. Lee la capa diaria, que
-- es la unica que puede responder a un rango arbitrario.
--
-- Las metricas de tasa (CTR, CPA, CPC, conv rate) se recalculan sobre las
-- sumas, nunca se promedian. Impression share y Quality Score se ponderan
-- por impresiones, que es como Google los agrega.
-- ================================================================
create or replace function get_entidades(
  p_entidad text, p_account text, p_from date, p_to date,
  p_search text default null, p_order_by text default 'cost', p_order_dir text default 'desc',
  p_limit int default 1000, p_offset int default 0
) returns json
language plpgsql stable security invoker set search_path = public, pg_temp
as $$
declare
  v_sql text; v_where text; v_search text := '';
  v_data json; v_total int; v_totals json; v_dias int;
begin
  if p_entidad not in ('campaign','adgroup','keyword','search_term') then
    raise exception 'Entidad no permitida: %', p_entidad;
  end if;
  v_where := format('account = %L and date between %L and %L', p_account, p_from, p_to);

  -- Cuantos dias del rango tienen datos: para saber si el rango esta completo
  select count(distinct date) into v_dias from campaign_daily
    where account = p_account and date between p_from and p_to;

  if p_entidad = 'campaign' then
    if p_search is not null and p_search <> '' then v_search := format(' and campaign ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select campaign, max(status) as status, max(bid_strategy) as bid_strategy, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             round(sum(conversions)/nullif(sum(clicks),0)*100,2) as conv_rate,
             round(sum(impr_share*impressions)/nullif(sum(impressions),0),1) as impr_share,
             round(sum(lost_is_budget*impressions)/nullif(sum(impressions),0),1) as lost_is_budget,
             round(sum(lost_is_rank*impressions)/nullif(sum(impressions),0),1) as lost_is_rank,
             case when sum(coalesce(lost_is_budget,0)*impressions) > sum(coalesce(lost_is_rank,0)*impressions) then 'presupuesto' else 'ranking' end as limitada_por,
             count(distinct date) as dias_con_datos
      from campaign_daily where %s %s group by campaign$q$, v_where, v_search);

  elsif p_entidad = 'adgroup' then
    if p_search is not null and p_search <> '' then v_search := format(' and ad_group ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select ad_group, campaign, max(ad_group_status) as ad_group_status, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             round(sum(conversions)/nullif(sum(clicks),0)*100,2) as conv_rate,
             round(sum(impr_share*impressions)/nullif(sum(impressions),0),1) as impr_share,
             count(distinct date) as dias_con_datos
      from adgroup_daily where %s %s group by ad_group, campaign$q$, v_where, v_search);

  elsif p_entidad = 'keyword' then
    if p_search is not null and p_search <> '' then v_search := format(' and keyword ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select keyword, match_type, ad_group, campaign, max(keyword_status) as keyword_status,
             max(serving_status) as serving_status, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             round(sum(conversions)/nullif(sum(clicks),0)*100,2) as conv_rate,
             round(sum(quality_score*impressions)/nullif(sum(impressions),0),1) as quality_score,
             round(sum(impr_share*impressions)/nullif(sum(impressions),0),1) as impr_share,
             count(distinct date) as dias_con_datos
      from keywords_daily where %s %s group by keyword, match_type, ad_group, campaign$q$, v_where, v_search);

  else
    if p_search is not null and p_search <> '' then v_search := format(' and search_term ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select search_term, match_type, triggered_keyword, ad_group, campaign, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             case when sum(conversions) > 0 then 'convierte'
                  when sum(cost) > 0 then 'gasta sin convertir' else 'sin gasto' end as clasificacion,
             count(distinct date) as dias_con_datos
      from search_terms_daily where %s %s group by search_term, match_type, triggered_keyword, ad_group, campaign$q$, v_where, v_search);
  end if;

  -- Orden: solo columnas conocidas
  if p_order_by not in ('cost','clicks','impressions','conversions','ctr','avg_cpc','cost_per_conv','conv_rate','impr_share','quality_score','lost_is_budget','lost_is_rank','campaign','ad_group','keyword','search_term','dias_con_datos') then
    p_order_by := 'cost';
  end if;

  execute format('select count(*) from (%s) s', v_sql) into v_total;

  execute format($t$select row_to_json(t) from (
    select count(*) as filas, round(coalesce(sum(cost),0),2) as cost, coalesce(sum(clicks),0) as clicks,
           coalesce(sum(impressions),0) as impressions, round(coalesce(sum(conversions),0),2) as conversions,
           round(sum(cost)/nullif(sum(conversions),0),2) as cpa,
           round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
           round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc
    from (%s) s) t$t$, v_sql) into v_totals;

  execute format('select coalesce(json_agg(row_to_json(t)), ''[]''::json) from (select * from (%s) s order by %I %s nulls last limit %s offset %s) t',
                 v_sql, p_order_by, case when lower(p_order_dir)='asc' then 'asc' else 'desc' end, greatest(p_limit,1), greatest(p_offset,0)) into v_data;

  return json_build_object('data', v_data, 'total', v_total, 'totals', v_totals,
                           'dias_con_datos', v_dias, 'dias_en_rango', (p_to - p_from + 1),
                           'rango_completo', v_dias = (p_to - p_from + 1));
end;
$$;

comment on function get_entidades is 'Entidades (campaign, adgroup, keyword, search_term) con metricas sumadas en cualquier rango de fechas, desde la capa diaria. Tasas recalculadas sobre sumas; impression share y QS ponderados por impresiones. Devuelve dias_con_datos vs dias_en_rango para saber si el rango esta cubierto. Es la forma correcta de responder a un selector de fechas arbitrario, como Google Ads.';;
