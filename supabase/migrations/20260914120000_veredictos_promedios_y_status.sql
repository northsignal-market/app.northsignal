-- Generada el 14/9/2026 a partir de pg_get_viewdef(), con ediciones quirúrgicas.
-- Cubre §4.1, §4.2, §6 y §3.6 de docs/PENDIENTE_VERACIDAD.md.
--
-- REVERTIR: las definiciones anteriores están en
-- supabase/migrations/20260912182011_remote_schema.sql.

-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_acierto_por_tipo AS
WITH t AS (
         SELECT v_impacto_accionables.account,
            v_impacto_accionables.ejecutado_el,
            v_impacto_accionables.veredicto,
            v_impacto_accionables.variacion_pct,
                CASE
                    WHEN v_impacto_accionables.titulo ~* 'negativ'::text THEN 'negativa'::text
                    WHEN v_impacto_accionables.titulo ~* 'pausar'::text THEN 'pausa'::text
                    WHEN v_impacto_accionables.titulo ~* 'puja|tcpa|cpa objetivo|maximizar'::text THEN 'puja'::text
                    WHEN v_impacto_accionables.titulo ~* 'presupuesto'::text THEN 'presupuesto'::text
                    WHEN v_impacto_accionables.titulo ~* 'concordancia|frase|exacta'::text THEN 'concordancia'::text
                    WHEN v_impacto_accionables.titulo ~* 'anuncio|rsa|titular'::text THEN 'anuncio'::text
                    WHEN v_impacto_accionables.titulo ~* 'conversi'::text THEN 'conversiones'::text
                    WHEN v_impacto_accionables.titulo ~* 'landing|url'::text THEN 'landing'::text
                    ELSE 'otro'::text
                END AS tipo
           FROM v_impacto_accionables
          WHERE v_impacto_accionables.veredicto IS NOT NULL
        )
 SELECT account,
    tipo,
    count(*) AS n,
    sum(
        CASE
            WHEN veredicto ~~ 'FUNCIONO%'::text THEN 1
            ELSE 0
        END) AS mejoraron,
    sum(
        CASE
            WHEN veredicto ~~ 'EMPEORO%'::text THEN 1
            ELSE 0
        END) AS empeoraron,
    round(avg(variacion_pct), 1) AS variacion_promedio_pct,
        CASE
            WHEN count(*) FILTER (WHERE veredicto !~~ 'PENDIENTE%'::text AND veredicto !~~ 'SIN METRICA%'::text) < 3 THEN 'pocas para juzgar'::text
            WHEN (sum(
            CASE
                WHEN veredicto ~~ 'FUNCIONO%'::text THEN 1
                ELSE 0
            END)::numeric / NULLIF(count(*) FILTER (WHERE veredicto !~~ 'PENDIENTE%'::text AND veredicto !~~ 'SIN METRICA%'::text), 0)::numeric) >= 0.66 THEN 'funciona en esta cuenta'::text
            WHEN (sum(
            CASE
                WHEN veredicto ~~ 'EMPEORO%'::text THEN 1
                ELSE 0
            END)::numeric / NULLIF(count(*) FILTER (WHERE veredicto !~~ 'PENDIENTE%'::text AND veredicto !~~ 'SIN METRICA%'::text), 0)::numeric) >= 0.5 THEN 'suele empeorar: revisar antes de repetir'::text
            ELSE 'mixto'::text
        END AS veredicto,
    count(*) FILTER (WHERE veredicto !~~ 'PENDIENTE%'::text AND veredicto !~~ 'SIN METRICA%'::text) AS n_juzgables
   FROM t
  GROUP BY account, tipo
  ORDER BY account, (count(*)) DESC;

-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_impacto_accionables AS
WITH ventanas AS (
         SELECT a.notion_id,
            a.account,
            a.titulo,
            a.ejecutado_el,
            a.metrica_objetivo,
            a.direccion_esperada,
            a.entidad_tipo,
            a.entidad_nombre,
            a.causa_raiz,
            a.naturaleza,
            a.sincronizado_el,
            a.ejecutado_el - 14 AS antes_desde,
            a.ejecutado_el - 1 AS antes_hasta,
            a.ejecutado_el + 1 AS despues_desde,
            a.ejecutado_el + 14 AS despues_hasta
           FROM accionables_ejecutados a
        ), metricas AS (
         SELECT v_1.notion_id,
            ( SELECT round(sum(s.gasto), 2) AS round
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.antes_desde AND s.date <= v_1.antes_hasta) AS gasto_antes,
            ( SELECT round(sum(s.conversiones), 2) AS round
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.antes_desde AND s.date <= v_1.antes_hasta) AS conv_antes,
            ( SELECT round(avg(s.ctr), 2) AS round
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.antes_desde AND s.date <= v_1.antes_hasta) AS ctr_antes,
            ( SELECT count(*) AS count
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.antes_desde AND s.date <= v_1.antes_hasta) AS dias_antes,
            ( SELECT round(sum(s.gasto), 2) AS round
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.despues_desde AND s.date <= v_1.despues_hasta AND s.madurez = 'consolidado'::text) AS gasto_despues,
            ( SELECT round(sum(s.conversiones), 2) AS round
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.despues_desde AND s.date <= v_1.despues_hasta AND s.madurez = 'consolidado'::text) AS conv_despues,
            ( SELECT round(avg(s.ctr), 2) AS round
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.despues_desde AND s.date <= v_1.despues_hasta AND s.madurez = 'consolidado'::text) AS ctr_despues,
            ( SELECT count(*) AS count
                   FROM v_serie_diaria s
                  WHERE s.account = v_1.account AND s.date >= v_1.despues_desde AND s.date <= v_1.despues_hasta AND s.madurez = 'consolidado'::text) AS dias_despues
           FROM ventanas v_1
        )
 SELECT v.notion_id,
    v.account,
    v.titulo,
    v.ejecutado_el,
    v.metrica_objetivo,
    v.direccion_esperada,
    v.causa_raiz,
    v.naturaleza,
    m.dias_antes,
    m.dias_despues,
    m.gasto_antes,
    m.gasto_despues,
    m.conv_antes,
    m.conv_despues,
    round(m.gasto_antes / NULLIF(m.conv_antes, 0::numeric), 2) AS cpa_antes,
    round(m.gasto_despues / NULLIF(m.conv_despues, 0::numeric), 2) AS cpa_despues,
    m.ctr_antes,
    m.ctr_despues,
        CASE v.metrica_objetivo
            WHEN 'cpa'::text THEN round((m.gasto_despues / NULLIF(m.conv_despues, 0::numeric) - m.gasto_antes / NULLIF(m.conv_antes, 0::numeric)) / NULLIF(m.gasto_antes / NULLIF(m.conv_antes, 0::numeric), 0::numeric) * 100::numeric, 1)
            WHEN 'gasto'::text THEN round((m.gasto_despues - m.gasto_antes) / NULLIF(m.gasto_antes, 0::numeric) * 100::numeric, 1)
            WHEN 'conversiones'::text THEN round((m.conv_despues - m.conv_antes) / NULLIF(m.conv_antes, 0::numeric) * 100::numeric, 1)
            WHEN 'ctr'::text THEN round((m.ctr_despues - m.ctr_antes) / NULLIF(m.ctr_antes, 0::numeric) * 100::numeric, 1)
            ELSE NULL::numeric
        END AS variacion_pct,
        CASE
            WHEN m.dias_despues < 7 THEN 'PENDIENTE: menos de 7 dias consolidados despues'::text
            WHEN v.metrica_objetivo IS NULL THEN 'SIN METRICA: el accionable no declaro que medir'::text
            WHEN v.direccion_esperada = 'baja'::text AND
            CASE v.metrica_objetivo
                WHEN 'cpa'::text THEN (m.gasto_despues / NULLIF(m.conv_despues, 0::numeric)) < (m.gasto_antes / NULLIF(m.conv_antes, 0::numeric) * 0.9)
                WHEN 'gasto'::text THEN m.gasto_despues < (m.gasto_antes * 0.9)
                ELSE NULL::boolean
            END THEN 'FUNCIONO: bajo mas de 10%'::text
            WHEN v.direccion_esperada = 'sube'::text AND
            CASE v.metrica_objetivo
                WHEN 'conversiones'::text THEN m.conv_despues > (m.conv_antes * 1.1)
                WHEN 'ctr'::text THEN m.ctr_despues > (m.ctr_antes * 1.1)
                ELSE NULL::boolean
            END THEN 'FUNCIONO: subio mas de 10%'::text
            WHEN (
            CASE v.metrica_objetivo
                WHEN 'cpa'::text THEN (m.gasto_despues / NULLIF(m.conv_despues, 0::numeric) - m.gasto_antes / NULLIF(m.conv_antes, 0::numeric)) / NULLIF(m.gasto_antes / NULLIF(m.conv_antes, 0::numeric), 0::numeric)
                WHEN 'gasto'::text THEN (m.gasto_despues - m.gasto_antes) / NULLIF(m.gasto_antes, 0::numeric)
                WHEN 'conversiones'::text THEN (m.conv_despues - m.conv_antes) / NULLIF(m.conv_antes, 0::numeric)
                WHEN 'ctr'::text THEN (m.ctr_despues - m.ctr_antes) / NULLIF(m.ctr_antes, 0::numeric)
                ELSE NULL::numeric
            END) IS NULL THEN 'SIN METRICA: no se pudo calcular la variacion (falta la base de comparacion)'::text
            WHEN abs(COALESCE(
            CASE v.metrica_objetivo
                WHEN 'cpa'::text THEN (m.gasto_despues / NULLIF(m.conv_despues, 0::numeric) - m.gasto_antes / NULLIF(m.conv_antes, 0::numeric)) / NULLIF(m.gasto_antes / NULLIF(m.conv_antes, 0::numeric), 0::numeric)
                WHEN 'gasto'::text THEN (m.gasto_despues - m.gasto_antes) / NULLIF(m.gasto_antes, 0::numeric)
                WHEN 'conversiones'::text THEN (m.conv_despues - m.conv_antes) / NULLIF(m.conv_antes, 0::numeric)
                WHEN 'ctr'::text THEN (m.ctr_despues - m.ctr_antes) / NULLIF(m.ctr_antes, 0::numeric)
                ELSE NULL::numeric
            END, 0::numeric)) < 0.1 THEN 'NEUTRO: menos de 10% de cambio'::text
            ELSE 'EMPEORO: se movio en direccion contraria'::text
        END AS veredicto
   FROM ventanas v
     JOIN metricas m ON m.notion_id = v.notion_id;

-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_serie_diaria AS
SELECT account,
    date,
    round(sum(cost), 2) AS gasto,
    sum(clicks) AS clics,
    sum(impressions) AS impresiones,
    round(sum(conversions), 2) AS conversiones,
    round(sum(cost) / NULLIF(sum(conversions), 0::numeric), 2) AS cpa,
    round(sum(clicks) / NULLIF(sum(impressions), 0::numeric) * 100::numeric, 2) AS ctr,
    round(sum(cost) / NULLIF(sum(clicks), 0::numeric), 2) AS cpc,
    round(sum(lost_is_budget * impressions) / NULLIF(sum(impressions) FILTER (WHERE lost_is_budget IS NOT NULL), 0)::numeric, 2) AS perdido_presupuesto,
    round(sum(lost_is_rank * impressions) / NULLIF(sum(impressions) FILTER (WHERE lost_is_rank IS NOT NULL), 0)::numeric, 2) AS perdido_ranking,
    madurez_dato(date) AS madurez,
    EXTRACT(isodow FROM date)::integer AS dia_semana
   FROM campaign_daily
  GROUP BY account, date;

-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_tendencia_semanal AS
SELECT account,
    week_start,
    sum(cost) AS gasto,
    sum(clicks) AS clics,
    sum(impressions) AS impresiones,
    sum(conversions) AS conversiones,
    round(sum(cost) / NULLIF(sum(conversions), 0::numeric), 2) AS cpa,
    round(sum(clicks)::numeric / NULLIF(sum(impressions), 0)::numeric * 100::numeric, 2) AS ctr_promedio,
    round(sum(impr_share * impressions) / NULLIF(sum(impressions) FILTER (WHERE impr_share IS NOT NULL), 0)::numeric, 2) AS impr_share_promedio,
    round(sum(lost_is_budget * impressions) / NULLIF(sum(impressions) FILTER (WHERE lost_is_budget IS NOT NULL), 0)::numeric, 2) AS perdido_presupuesto,
    round(sum(lost_is_rank * impressions) / NULLIF(sum(impressions) FILTER (WHERE lost_is_rank IS NOT NULL), 0)::numeric, 2) AS perdido_ranking
   FROM campaign
  GROUP BY account, week_start;
