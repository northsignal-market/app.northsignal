-- §12 de docs/PENDIENTE_VERACIDAD.md: tres cosas que aparecieron AL ARREGLAR,
-- no al leer el árbol.
--
-- 1 · v_location_ranking_bayes hacía COALESCE(cpa_grupo, 0). Si el grupo de pares no
--     tiene conversiones, cpa_grupo es NULL y el encogimiento bayesiano arrastraba al
--     local hacia CPA CERO: lo mostraba MÁS BARATO de lo que se midió, y ese número es
--     el que decide qué local "se salió de la manada" en Fresh Monkee. Sin ancla de
--     grupo no hay hacia dónde encoger, así que se devuelve el CPA crudo.
--
-- 2 · v_run_scorecard no exponía la PK, así que la UI caía a run_date — que las cuatro
--     cuentas comparten. Se expone al FINAL: CREATE OR REPLACE no puede insertar una
--     columna en el medio (renombraría las siguientes) y un DROP arrastraría lo que
--     depende de la vista.
--
-- 3 · resolver_grupo_alertas filtraba account = p_account, que nunca matchea NULL: las
--     alertas de sistema sin cuenta no se podían resolver por grupo. Con
--     IS NOT DISTINCT FROM, y mapeando la etiqueta '(sistema)' a NULL, sí se pueden.
--
-- REVERTIR: definiciones anteriores en 20260912182011_remote_schema.sql

CREATE OR REPLACE VIEW public.v_location_ranking_bayes AS
WITH base AS (
         SELECT d.account,
            d.location,
            d.objetivo,
            sum(c.cost) AS gasto,
            sum(c.conversions) AS conv,
            sum(c.conv_value) AS valor
           FROM campaign c
             JOIN campaign_dim d ON d.account = c.account AND d.campaign = c.campaign
          WHERE d.location IS NOT NULL AND c.week_start > ((( SELECT max(x.week_start) AS max
                   FROM campaign x
                  WHERE x.account = c.account)) - 28)
          GROUP BY d.account, d.location, d.objetivo
        ), grupo AS (
         SELECT base.account,
            base.objetivo,
            sum(base.gasto) / NULLIF(sum(base.conv), 0::numeric) AS cpa_grupo,
            count(*) AS locales
           FROM base
          GROUP BY base.account, base.objetivo
        )
 SELECT b.account,
    b.location AS local,
    b.objetivo,
    b.objetivo AS grupo_par,
    round(b.gasto, 2) AS gasto_4sem,
    round(b.conv, 1) AS conv_4sem,
    round(b.gasto / NULLIF(b.conv, 0::numeric), 2) AS cpa_crudo,
    CASE WHEN g.cpa_grupo IS NULL
            THEN round(b.gasto / NULLIF(b.conv, 0::numeric), 2)
            ELSE round((b.gasto + 10::numeric * g.cpa_grupo) / NULLIF(b.conv + 10::numeric, 0::numeric), 2)
        END AS cpa_ajustado,
    g.locales AS en_el_grupo,
        CASE
            WHEN g.locales < 5 THEN ('NO COMPARABLE: su grupo tiene '::text || g.locales) || ' local(es). Con menos de 5, el promedio del grupo es practicamente este mismo local y la comparacion no dice nada. No usar para recomendar escalar ni pausar.'::text
            WHEN b.conv < 5::numeric THEN 'volumen bajo: el CPA crudo es ruido, mirar el ajustado'::text
            ELSE ((('comparable: '::text || g.locales) || ' locales en el grupo y '::text) || round(b.conv, 1)) || ' conversiones'::text
        END AS lectura,
    g.locales >= 5 AND b.conv >= 5::numeric AS apto_para_recomendar
   FROM base b
     JOIN grupo g ON g.account = b.account AND g.objetivo = b.objetivo;

-- ----------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_run_scorecard AS
SELECT account,
    run_date,
    semana_analizada,
    COALESCE(brief_creado_o_actualizado::integer, 0) + COALESCE(handoff_escrito::integer, 0) + COALESCE((handoff_lineas >= 1 AND handoff_lineas <= 5)::integer, 0) + COALESCE(fechas_explicitas::integer, 0) + COALESCE(dias_provisionales_marcados::integer, 0) + COALESCE((accionables_con_naturaleza = accionables_nuevos)::integer, 0) + COALESCE((accionables_con_causa_raiz = accionables_nuevos)::integer, 0) + COALESCE((accionables_con_verificar_fecha = accionables_nuevos)::integer, 0) + COALESCE(titulos_son_acciones::integer, 0) + COALESCE((comentarios_pendientes = 0)::integer, 0) + COALESCE(propagacion_ejecutada::integer, 0) + COALESCE(operator_log_consultado::integer, 0) + COALESCE(cambios_detectados_consultado::integer, 0) + COALESCE(inferencias_en_bloqueado::integer, 0) + COALESCE(duplicado_evitado::integer, 0) AS puntos,
    15 AS puntos_posibles,
    revision_humana,
    que_fallo,
    preguntas_a_andres,
    tiempo_estimado_min,
    lag(run_date) OVER (PARTITION BY account ORDER BY run_date, id) AS corrida_previa,
    row_number() OVER (PARTITION BY account, semana_analizada ORDER BY run_date DESC, id DESC) = 1 AS es_ultima_de_la_semana,
    count(*) OVER (PARTITION BY account, semana_analizada) AS corridas_sobre_esta_semana,
    id
   FROM run_quality;

-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolver_grupo_alertas(p_account text, p_tipo text, p_dia date)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with r as (update alertas set estado = 'resuelta', resuelta_el = now()
    where estado = 'abierta' and account IS NOT DISTINCT FROM nullif(p_account, '(sistema)') and tipo = p_tipo and creada::date = p_dia returning 1)
  select count(*)::int from r;
$function$;
