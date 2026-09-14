-- §3.3 de docs/PENDIENTE_VERACIDAD.md.
--
-- v_decision_estructural decía "28d" y "4 semanas" sobre los días que la capa diaria
-- tuviera CONSOLIDADOS. La misma tarjeta se contradecía en pantalla: Clientes.tsx
-- mostraba "42 conv en 13 días consolidados" arriba y, renderizado verbatim desde
-- esta vista, "con 42 conv en 28d... Mínimo 100/mes" abajo. El umbral quedaba
-- inalcanzable por construcción.
--
-- La vista YA contaba los días reales en dias_28d y no los usaba para nada.
--
-- EL UMBRAL NO CAMBIA, y eso es deliberado. testeabilidad(conv/4, 4) calcula
-- conv_por_brazo = conv*split: el divisor y el multiplicador se cancelan, así que el
-- MDE depende solo del total de conversiones. Pasando las semanas REALES con el mismo
-- producto, la estadística es idéntica y el veredicto deja de decir "NO TESTEABLE en
-- 4 semanas" sobre 13 días de datos. Mover el umbral sí sería una decisión de
-- producto: cambia QUÉ propone el sistema, y eso lo decide Andrés.
--
-- REVERTIR: definición anterior en supabase/migrations/20260912182011_remote_schema.sql

CREATE OR REPLACE VIEW public.v_decision_estructural AS
WITH base AS (
         SELECT v_serie_diaria.account,
            sum(v_serie_diaria.conversiones) FILTER (WHERE v_serie_diaria.date >= (CURRENT_DATE - 28) AND v_serie_diaria.madurez = 'consolidado'::text) AS conv_28d,
            sum(v_serie_diaria.gasto) FILTER (WHERE v_serie_diaria.date >= (CURRENT_DATE - 28) AND v_serie_diaria.madurez = 'consolidado'::text) AS gasto_28d,
            count(DISTINCT v_serie_diaria.date) FILTER (WHERE v_serie_diaria.date >= (CURRENT_DATE - 28) AND v_serie_diaria.madurez = 'consolidado'::text) AS dias_28d
           FROM v_serie_diaria
          GROUP BY v_serie_diaria.account
        ), campanas AS (
         SELECT campaign_daily.account,
            count(DISTINCT campaign_daily.campaign) AS n_campanas
           FROM campaign_daily
          WHERE campaign_daily.date >= (CURRENT_DATE - 7)
          GROUP BY campaign_daily.account
        ), grupos AS (
         SELECT adgroup_daily.account,
            adgroup_daily.ad_group,
            sum(adgroup_daily.conversions) AS conv
           FROM adgroup_daily
          WHERE adgroup_daily.date >= (CURRENT_DATE - 28)
          GROUP BY adgroup_daily.account, adgroup_daily.ad_group
        ), top_grupo AS (
         SELECT g.account,
            g.ad_group,
            g.conv,
            round(g.conv / NULLIF(( SELECT sum(x.conv) AS sum
                   FROM grupos x
                  WHERE x.account = g.account), 0::numeric) * 100::numeric, 0) AS pct
           FROM grupos g
          WHERE g.conv = (( SELECT max(y.conv) AS max
                   FROM grupos y
                  WHERE y.account = g.account))
        ), saturacion AS (
         SELECT v_cpa_marginal.account,
            max(v_cpa_marginal.ratio_marginal_sobre_promedio) FILTER (WHERE v_cpa_marginal.lectura ~~ 'SATURADA%'::text OR v_cpa_marginal.lectura ~~ 'RENDIMIENTO%'::text OR v_cpa_marginal.lectura ~~ 'SIN GANANCIA%'::text) AS peor_ratio
           FROM v_cpa_marginal
          WHERE v_cpa_marginal.escalon > v_cpa_marginal.presupuesto_actual
          GROUP BY v_cpa_marginal.account
        ), targets AS (
         SELECT account_targets.account,
            account_targets.conversiones_mes_objetivo,
            account_targets.conversiones_mes_origen,
            account_targets.cpa_maximo,
            account_targets.cpa_maximo_origen,
            account_targets.presupuesto_mes_maximo,
            account_targets.ciclo_venta_dias,
            account_targets.conversiones_minimas_smart_bidding,
            account_targets.notas,
            account_targets.actualizado,
            account_targets.actualizado_por
           FROM account_targets
        ), tst AS (
         SELECT b_1.account,
            testeabilidad(b_1.conv_28d / GREATEST(round(b_1.dias_28d::numeric / 7.0), 1::numeric), GREATEST(round(b_1.dias_28d::numeric / 7.0)::integer, 1)) AS t
           FROM base b_1
        )
 SELECT b.account,
    round(b.conv_28d, 0) AS conv_28d,
    b.dias_28d,
    c.n_campanas,
    round(b.conv_28d / NULLIF(c.n_campanas, 0)::numeric, 0) AS conv_por_campana,
    tg.ad_group AS grupo_dominante,
    tg.pct AS pct_grupo_dominante,
    (tst.t ->> 'mde_relativo_pct'::text)::integer AS mde_4_semanas_pct,
    tst.t ->> 'veredicto'::text AS testeabilidad,
        CASE
            WHEN tg.pct >= 50::numeric AND (b.conv_28d - tg.conv) >= 60::numeric THEN ((((('PROPONER · Separar "'::text || tg.ad_group) || '" en campaña propia con puja manual/Max Clicks y exacta. Concentra '::text) || tg.pct) || '% de las conversiones; el resto tiene '::text) || round(b.conv_28d - tg.conv)) || ' en los ' || b.dias_28d || ' dias consolidados que hay. Reversible.'::text
            WHEN tg.pct >= 50::numeric AND (b.conv_28d - tg.conv) >= 30::numeric THEN ((((((('REVISAR · "'::text || tg.ad_group) || '" concentra '::text) || tg.pct) || '% pero el resto tiene solo '::text) || round(b.conv_28d - tg.conv)) || ' conv en los '::text) || b.dias_28d) || ' dias consolidados que hay. Evaluar con Andrés.'::text
            WHEN tg.pct >= 50::numeric THEN ((((((('NO PROPONER · "'::text || tg.ad_group) || '" concentra '::text) || tg.pct) || '% pero separar dejaría a la no-marca sin densidad ('::text) || round(b.conv_28d - tg.conv)) || ' conv en los '::text) || b.dias_28d) || ' dias consolidados que hay, mínimo 60).'::text
            ELSE 'NO APLICA · ningún grupo supera 50% de las conversiones.'::text
        END AS separar_marca,
        CASE
            WHEN c.n_campanas > 1 AND (b.conv_28d / c.n_campanas::numeric) < 15::numeric THEN ((('PROPONER · '::text || c.n_campanas) || ' campañas con '::text) || round(b.conv_28d / c.n_campanas::numeric)) || ' conv/mes cada una: por debajo de 15. Consolidar. Reversible.'::text
            WHEN c.n_campanas = 1 THEN 'NO APLICA · una sola campaña.'::text
            ELSE ('NO PROPONER · densidad suficiente ('::text || round(b.conv_28d / c.n_campanas::numeric)) || ' conv/mes por campaña).'::text
        END AS consolidar,
        CASE
            WHEN b.conv_28d >= 100::numeric THEN 'REVISAR · volumen suficiente (100+ conv/mes) SI hay una configuración que deba diferir: presupuesto, puja, geo, primaria o landing. Nunca para reportar.'::text
            ELSE ('NO PROPONER · con '::text || round(b.conv_28d)) || ' conv en los ' || b.dias_28d || ' dias consolidados que hay, una campaña nueva restaría densidad. Mínimo 100/mes.'::text
        END AS crear_campana,
        CASE
            WHEN tg.pct IS NULL THEN 'NO APLICA'::text
            WHEN b.dias_28d < 28 THEN ('NO PROPONER · faltan días consolidados ('::text || b.dias_28d) || ' de 28).'::text
            WHEN t.cpa_maximo IS NOT NULL AND (b.gasto_28d / NULLIF(b.conv_28d, 0::numeric)) > (2::numeric * t.cpa_maximo) AND c.n_campanas > 1 THEN 'REVISAR · CPA del período duplica el máximo. Antes de pausar: mover presupuesto a la que tiene headroom.'::text
            WHEN t.cpa_maximo IS NOT NULL AND (b.gasto_28d / NULLIF(b.conv_28d, 0::numeric)) > (2::numeric * t.cpa_maximo) THEN 'REVISAR · CPA del período duplica el máximo y es la única campaña: pausar apaga la cuenta. Antes: reducir presupuesto 20%.'::text
            ELSE 'NO PROPONER · CPA dentro de 2× el máximo.'::text
        END AS pausar,
        CASE
            WHEN s.peor_ratio >= 2::numeric THEN ('NO PROPONER · saturada: el siguiente escalón cuesta '::text || round(s.peor_ratio, 1)) || '× el CPA promedio.'::text
            WHEN s.peor_ratio >= 1.3 THEN ('REVISAR · rendimiento decreciente: marginal '::text || round(s.peor_ratio, 1)) || '× el promedio. Solo si el cliente acepta ese CPA.'::text
            WHEN s.peor_ratio IS NOT NULL THEN 'PROPONER · headroom real. Subir 15-20%, no más, y medir 2 semanas.'::text
            ELSE 'SIN DATOS · sin curva de simulación. Karedo: llega con script v8 (simulaciones de grupo).'::text
        END AS escalar,
        CASE
            WHEN tg.pct >= 50::numeric AND b.conv_28d >= 100::numeric THEN ('REVISAR · marca concentra '::text || tg.pct) || '%: geo-split de 4 semanas mide incrementalidad. Costo: perder marca en la mitad de las regiones 4 semanas.'::text
            WHEN tg.pct >= 50::numeric THEN ('NO PROPONER · marca concentra '::text || tg.pct) || '% pero sin volumen para geo-split.'::text
            ELSE 'NO APLICA'::text
        END AS test_incrementalidad_marca
   FROM base b
     LEFT JOIN campanas c ON c.account = b.account
     LEFT JOIN top_grupo tg ON tg.account = b.account
     LEFT JOIN saturacion s ON s.account = b.account
     LEFT JOIN targets t ON t.account = b.account
     LEFT JOIN tst ON tst.account = b.account;
