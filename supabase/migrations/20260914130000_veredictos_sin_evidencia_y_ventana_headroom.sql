-- Generada el 14/9/2026 desde pg_get_viewdef()/pg_get_functiondef(), con
-- ediciones quirúrgicas. Cubre §2.6 (SQL) y §3.2 de docs/PENDIENTE_VERACIDAD.md.
--
-- REVERTIR: las definiciones anteriores están en
-- supabase/migrations/20260912182011_remote_schema.sql.

CREATE OR REPLACE VIEW public.v_campaign_analisis AS
SELECT account,
    week_start,
    week_end,
    campaign,
    status,
    channel,
    bid_strategy,
    currency,
    impressions,
    clicks,
    ctr,
    avg_cpc,
    avg_cpm,
    cost,
    conversions,
    cost_per_conv,
    conv_rate,
    impr_share,
    top_impr_share,
    abs_top_impr_share,
    lost_is_budget,
    lost_is_rank,
    click_share,
        CASE
            WHEN lost_is_budget IS NULL OR lost_is_rank IS NULL THEN NULL::text
            WHEN lost_is_budget IS NULL OR lost_is_rank IS NULL THEN NULL::text
            WHEN lost_is_budget > lost_is_rank THEN 'presupuesto'::text
            ELSE 'ranking'::text
        END AS limitada_por
   FROM campaign;

-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_campaign_daily AS
SELECT account,
    date,
    campaign,
    status,
    channel,
    bid_strategy,
    currency,
    impressions,
    clicks,
    ctr,
    avg_cpc,
    avg_cpm,
    cost,
    conversions,
    cost_per_conv,
    conv_rate,
    impr_share,
    top_impr_share,
    abs_top_impr_share,
    lost_is_budget,
    lost_is_rank,
    click_share,
        CASE
            WHEN lost_is_budget IS NULL OR lost_is_rank IS NULL THEN NULL::text
            WHEN lost_is_budget IS NULL OR lost_is_rank IS NULL THEN NULL::text
            WHEN lost_is_budget > lost_is_rank THEN 'presupuesto'::text
            ELSE 'ranking'::text
        END AS limitada_por,
    madurez_dato(date) AS madurez,
    CURRENT_DATE - date AS dias_transcurridos,
    EXTRACT(isodow FROM date)::integer AS dia_semana,
    to_char(date::timestamp with time zone, 'TMDay'::text) AS nombre_dia
   FROM campaign_daily;

-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_entidades(p_entidad text, p_account text, p_from date, p_to date, p_search text DEFAULT NULL::text, p_order_by text DEFAULT 'cost'::text, p_order_dir text DEFAULT 'desc'::text, p_limit integer DEFAULT 1000, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
             case when sum(lost_is_budget) is null and sum(lost_is_rank) is null then null when sum(coalesce(lost_is_budget,0)*impressions) > sum(coalesce(lost_is_rank,0)*impressions) then 'presupuesto' else 'ranking' end as limitada_por,
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
  if coalesce(p_order_by, '') not in ('cost','clicks','impressions','conversions','ctr','avg_cpc','cost_per_conv','conv_rate','impr_share','quality_score','lost_is_budget','lost_is_rank','campaign','ad_group','keyword','search_term','dias_con_datos') then
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
                 v_sql, p_order_by, case when lower(coalesce(p_order_dir, 'desc'))='asc' then 'asc' else 'desc' end, greatest(coalesce(p_limit, 1000), 1), greatest(coalesce(p_offset, 0), 0)) into v_data;

  return json_build_object('data', v_data, 'total', v_total, 'totals', v_totals,
                           'dias_con_datos', v_dias, 'dias_en_rango', (p_to - p_from + 1),
                           'rango_completo', v_dias = (p_to - p_from + 1));
end;
$function$;

-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_headroom AS
WITH ultimos14 AS (
         SELECT s.account,
            sum(s.gasto) AS gasto_14d,
            sum(s.conversiones) AS conv_14d,
            sum(s.conversiones) FILTER (WHERE s.madurez = 'consolidado'::text) AS conv_consolidadas,
            round(sum(s.gasto) / NULLIF(sum(s.conversiones), 0::numeric), 2) AS cpa_14d,
            count(*) FILTER (WHERE s.madurez = 'consolidado'::text) AS dias_consolidados,
            count(*) FILTER (WHERE s.cpa IS NOT NULL AND s.madurez = 'consolidado'::text AND s.cpa <= (( SELECT t_1.cpa_maximo
                   FROM account_targets t_1
                  WHERE t_1.account = s.account))) AS dias_dentro_cpa,
            round(stddev_samp(s.cpa) / NULLIF(avg(s.cpa), 0::numeric), 2) AS cv_cpa,
            avg(s.perdido_presupuesto) AS lost_budget_pct,
            avg(s.perdido_ranking) AS lost_rank_pct
           FROM v_serie_diaria s
          WHERE s.date >= (CURRENT_DATE - 14) AND s.date <= (CURRENT_DATE - 1)
          GROUP BY s.account
        ), volumen AS (
         SELECT c.account,
            round(sum(c.conversions), 1) AS conv_ventana,
            count(DISTINCT c.week_start) * 7 AS dias_ventana,
            count(DISTINCT c.week_start) AS semanas_ventana
           FROM campaign c
          WHERE c.week_start > ((( SELECT max(c2.week_start) AS max
                   FROM campaign c2
                  WHERE c2.account = c.account)) - 28)
          GROUP BY c.account
        ), volumen_viejo AS (
         SELECT v_serie_diaria.account,
            sum(v_serie_diaria.conversiones) AS conv_30d_truncada
           FROM v_serie_diaria
          WHERE v_serie_diaria.date >= (CURRENT_DATE - 30) AND v_serie_diaria.date < (CURRENT_DATE - 1)
          GROUP BY v_serie_diaria.account
        ), impr_share AS (
         SELECT v_campaign_daily.account,
            avg(v_campaign_daily.impr_share) AS impr_share_pct
           FROM v_campaign_daily
          WHERE v_campaign_daily.date >= (CURRENT_DATE - 7) AND v_campaign_daily.status = 'ENABLED'::text
          GROUP BY v_campaign_daily.account
        ), calidad AS (
         SELECT k.account,
            round(sum(k.cost * k.quality_score) / NULLIF(sum(k.cost), 0::numeric), 1) AS qs_ponderado,
            round(sum(k.cost *
                CASE k.qs_expected_ctr
                    WHEN 'BELOW_AVERAGE'::text THEN 1
                    ELSE 0
                END::numeric) / NULLIF(sum(k.cost), 0::numeric) * 100::numeric) AS pct_ctr,
            round(sum(k.cost *
                CASE k.qs_ad_relevance
                    WHEN 'BELOW_AVERAGE'::text THEN 1
                    ELSE 0
                END::numeric) / NULLIF(sum(k.cost), 0::numeric) * 100::numeric) AS pct_rel,
            round(sum(k.cost *
                CASE k.qs_landing_page
                    WHEN 'BELOW_AVERAGE'::text THEN 1
                    ELSE 0
                END::numeric) / NULLIF(sum(k.cost), 0::numeric) * 100::numeric) AS pct_lp
           FROM keywords k
          WHERE k.week_start = (( SELECT max(keywords.week_start) AS max
                   FROM keywords)) AND k.cost > 0::numeric AND k.quality_score IS NOT NULL
          GROUP BY k.account
        ), q AS (
         SELECT calidad.account,
            calidad.qs_ponderado,
            calidad.pct_ctr,
            calidad.pct_rel,
            calidad.pct_lp,
            GREATEST(calidad.pct_ctr, calidad.pct_rel, calidad.pct_lp) AS peor_pct,
                CASE
                    WHEN calidad.pct_lp = GREATEST(calidad.pct_ctr, calidad.pct_rel, calidad.pct_lp) THEN 'la experiencia de landing'::text
                    WHEN calidad.pct_rel = GREATEST(calidad.pct_ctr, calidad.pct_rel, calidad.pct_lp) THEN 'la relevancia del anuncio'::text
                    ELSE 'el CTR esperado'::text
                END AS peor_componente,
                CASE
                    WHEN GREATEST(calidad.pct_ctr, calidad.pct_rel, calidad.pct_lp) < 15::numeric OR calidad.qs_ponderado >= 7::numeric AND GREATEST(calidad.pct_ctr, calidad.pct_rel, calidad.pct_lp) < 40::numeric THEN 'PUJA'::text
                    WHEN GREATEST(calidad.pct_ctr, calidad.pct_rel, calidad.pct_lp) >= 40::numeric THEN 'CALIDAD'::text
                    ELSE 'MIXTA'::text
                END AS banda
           FROM calidad
        )
 SELECT u.account,
    t.conversiones_mes_objetivo,
    round(u.conv_consolidadas * 30.0 / NULLIF(u.dias_consolidados, 0)::numeric, 1) AS conv_mes_proyectado,
    round(u.conv_consolidadas * 30.0 / NULLIF(u.dias_consolidados, 0)::numeric / NULLIF(t.conversiones_mes_objetivo, 0::numeric) * 100::numeric) AS pct_del_objetivo,
    u.cpa_14d,
    t.cpa_maximo,
    round(u.cpa_14d / NULLIF(t.cpa_maximo, 0::numeric) * 100::numeric) AS cpa_pct_del_maximo,
    u.dias_dentro_cpa,
    u.dias_consolidados,
    u.cv_cpa,
    round(u.lost_budget_pct, 1) AS lost_is_budget_pct,
    round(u.lost_rank_pct, 1) AS lost_is_rank_pct,
    round(i.impr_share_pct, 1) AS impr_share_pct,
    v.conv_ventana,
    t.conversiones_minimas_smart_bidding,
    u.dias_dentro_cpa >= GREATEST(u.dias_consolidados - 2, 8::bigint) AS senal_cpa_estable,
    u.lost_budget_pct >= 20::numeric AS senal_limitada_presupuesto,
    u.cv_cpa <= 0.5 AS senal_conversion_estable,
    v.conv_ventana >= t.conversiones_minimas_smart_bidding::numeric AS senal_volumen_suficiente,
    i.impr_share_pct >= 85::numeric AS techo_inventario_saturado,
    u.lost_rank_pct > u.lost_budget_pct AS techo_limitada_por_ranking,
        CASE
            WHEN i.impr_share_pct >= 85::numeric THEN 'TECHO: inventario saturado. Escalar horizontal (keywords, geos), no presupuesto'::text
            WHEN v.semanas_ventana < 3 THEN (('NO SE PUEDE SABER: solo '::text || v.semanas_ventana) || ' semana(s) completas de historia. '::text) || 'Hacen falta al menos 3 para juzgar volumen. No emitir veredicto de escalamiento.'::text
            WHEN v.conv_ventana < t.conversiones_minimas_smart_bidding::numeric THEN ((((('NO ESCALAR: '::text || v.conv_ventana) || ' conv en '::text) || v.dias_ventana) || ' dias (minimo '::text) || t.conversiones_minimas_smart_bidding) || '), Smart Bidding inestable'::text
            WHEN u.lost_rank_pct > u.lost_budget_pct AND q.banda IS NULL THEN (((('LIMITADA POR RANKING: pierde mas por ranking ('::text || round(u.lost_rank_pct, 1)) || '%) que por presupuesto ('::text) || round(u.lost_budget_pct, 1)) || '%), pero NO hay datos de '::text) || 'quality score en la ultima semana para decir si es calidad o puja. No recetar sin eso.'::text
            WHEN u.lost_rank_pct > u.lost_budget_pct AND q.banda = 'PUJA'::text THEN ((((('LIMITADA POR RANKING, POR PUJA: la calidad no lo explica. QS ponderado '::text || q.qs_ponderado) || ' y el peor componente ('::text) || q.peor_componente) || ') pesa '::text) || q.peor_pct) || '% del gasto. Subir la puja o el objetivo. NO tocar QS, relevancia ni landing: no es ahi.'::text
            WHEN u.lost_rank_pct > u.lost_budget_pct AND q.banda = 'CALIDAD'::text THEN ((((('LIMITADA POR RANKING, POR CALIDAD: pesa '::text || q.peor_componente) || ', '::text) || q.peor_pct) || '% del gasto (QS ponderado '::text) || q.qs_ponderado) || '). Ver v_por_que_limitada para las peores keywords.'::text
            WHEN u.lost_rank_pct > u.lost_budget_pct THEN (((((('LIMITADA POR RANKING, MIXTA: '::text || q.peor_componente) || ' pesa '::text) || q.peor_pct) || '% del gasto con QS ponderado '::text) || q.qs_ponderado) || '. Ni la calidad ni la puja explican '::text) || 'sola la perdida: no recetar una sin medir la otra.'::text
            WHEN u.dias_dentro_cpa >= GREATEST(u.dias_consolidados - 2, 8::bigint) AND u.lost_budget_pct >= 20::numeric AND u.cv_cpa <= 0.5 THEN 'HEADROOM: CPA estable + limitada por presupuesto. Escalar 20-30%, esperar 2 ciclos'::text
            WHEN u.dias_dentro_cpa >= GREATEST(u.dias_consolidados - 2, 8::bigint) AND u.lost_budget_pct < 20::numeric THEN 'ESTABLE SIN MARGEN: CPA bien pero no pierde por presupuesto. Buscar volumen horizontal'::text
            WHEN u.cv_cpa > 0.5 THEN 'INESTABLE: CPA varia demasiado. Estabilizar antes de escalar'::text
            ELSE 'FUERA DE OBJETIVO: CPA sobre maximo. Optimizar antes de escalar'::text
        END AS veredicto,
    t.cpa_maximo_origen,
    t.conversiones_mes_origen,
    t.cpa_maximo_origen = 'provisional'::text OR (t.conversiones_mes_origen = ANY (ARRAY['provisional'::text, 'historico'::text])) AS objetivos_provisionales,
    ('tabla semanal, '::text || v.semanas_ventana) || ' semanas completas'::text AS conv_ventana_origen,
    v.dias_ventana AS conv_ventana_dias,
    round(vv.conv_30d_truncada, 1) AS conv_diaria_truncada,
    q.qs_ponderado,
    q.peor_pct AS pct_gasto_peor_componente,
    (((((('conv_30d sale de la tabla SEMANAL ('::text || v.dias_ventana) || ' dias reales), no de la capa diaria, '::text) || 'que tiene entre 15 y 17 dias. conv_30d_diaria_truncada es lo que devolvia antes esta vista: la '::text) || 'diferencia es cuanto subestimaba. La banda de calidad ('::text) || COALESCE(q.banda, 'sin datos'::text)) || ') sale de cruzar QS ponderado con el peso del peor componente, no de un corte unico. '::text) || 'dias_consolidados se refiere a la ventana de 14 dias, no a esta.'::text AS lectura
   FROM ultimos14 u
     JOIN account_targets t ON t.account = u.account
     LEFT JOIN volumen v ON v.account = u.account
     LEFT JOIN volumen_viejo vv ON vv.account = u.account
     LEFT JOIN impr_share i ON i.account = u.account
     LEFT JOIN q ON q.account = u.account;
