-- KAREDO: sin conv_value ni roas. El valor de conversion es un fijo arbitrario
-- de 20 EUR, asi que cualquier ROAS derivado carece de sentido.
create or replace view v_karedo_campaign as
select week_start, week_end, campaign, status, bid_strategy, currency,
       impressions, clicks, ctr, avg_cpc, cost,
       conversions, cost_per_conv, conv_rate,
       impr_share, top_impr_share, abs_top_impr_share,
       lost_is_budget, lost_is_rank, click_share
from campaign where account = 'KAREDO';

comment on view v_karedo_campaign is 'Campanas de Karedo. Deliberadamente NO expone conv_value ni roas: el valor de conversion es un fijo arbitrario de 20 EUR por registro definido a nivel cuenta, asi que cualquier ROAS derivado no significa nada. Las conversiones son direccionales: Enhanced Conversions con 0-15% de coincidencia y disparo en el clic, no en el registro completado. La direccion del error es DESCONOCIDA.';

-- 360: sin conv_value ni all_conversions. El valor esta inflado por la regla
-- 1,5x y all_conversions suma clics a WhatsApp, mail y llamadas.
create or replace view v_360_campaign as
select week_start, week_end, campaign, status, bid_strategy, currency,
       impressions, clicks, ctr, avg_cpc, cost,
       conversions, cost_per_conv, conv_rate,
       impr_share, lost_is_budget, lost_is_rank
from campaign where account = '360';

comment on view v_360_campaign is 'Campanas de 360. Deliberadamente NO expone conv_value ni all_conversions: el valor esta inflado por la regla de valor 1,5x para empresa grande, y all_conversions suma clics a WhatsApp, mail y llamadas que no son negocio real. Los montos de negocio salen del campo Monto de Asana, nunca de aca.';

-- BHI: expone all_conversions porque el desglose importa, pero el comentario
-- deja claro que la fuente de verdad es GoHighLevel.
create or replace view v_bhi_campaign as
select week_start, week_end, campaign, status, bid_strategy, currency,
       impressions, clicks, ctr, avg_cpc, cost,
       conversions, all_conversions, cost_per_conv, conv_rate,
       impr_share, lost_is_budget, lost_is_rank
from campaign where account = 'BHI';

comment on view v_bhi_campaign is 'Campanas de BHI. Las conversiones de Google NO son la fuente de verdad del negocio: las solicitudes reales, el pipeline y los cierres viven en GoHighLevel, que esta base no lee. Nunca presentar estas cifras como solicitudes reales. lost_is_budget alto significa que subir presupuesto SI genera volumen, pero a un costo por conversion 55% mayor.';

-- Tendencia semanal por cuenta. Responde en una consulta lo que antes requeria
-- abrir varios archivos y comparar a mano.
create or replace view v_tendencia_semanal as
select account, week_start,
       sum(cost) as gasto,
       sum(clicks) as clics,
       sum(impressions) as impresiones,
       sum(conversions) as conversiones,
       round(sum(cost) / nullif(sum(conversions), 0), 2) as cpa,
       round(avg(ctr), 2) as ctr_promedio,
       round(avg(impr_share), 2) as impr_share_promedio,
       round(avg(lost_is_budget), 2) as perdido_presupuesto,
       round(avg(lost_is_rank), 2) as perdido_ranking
from campaign
where status = 'ENABLED'
group by account, week_start;

comment on view v_tendencia_semanal is 'Serie semanal por cuenta, solo campanas activas. Usar para tendencias en vez de leer semanas sueltas. Con volumen bajo (BHI, 360) un movimiento semanal casi nunca es significativo: mirar la serie.';

-- Keywords que requieren atencion, ya filtradas y con el motivo explicito.
create or replace view v_keywords_atencion as
select account, week_start, campaign, ad_group, keyword, match_type,
       serving_status, quality_score, impressions, clicks, cost, conversions,
       est_top_of_page_cpc, effective_cpc_bid,
       case
         when serving_status = 'RARELY_SERVED' then 'Bajo volumen de busqueda: no va a servir'
         when impressions = 0 then 'Activa pero sin impresiones'
         when quality_score <= 4 and cost > 0 then 'Quality Score bajo con gasto activo'
         when conversions = 0 and cost > 0 then 'Gasta sin convertir'
       end as motivo
from keywords
where keyword_status = 'ENABLED'
  and campaign_status = 'ENABLED'
  and ad_group_status = 'ENABLED'
  and (serving_status = 'RARELY_SERVED'
       or impressions = 0
       or (quality_score <= 4 and cost > 0)
       or (conversions = 0 and cost > 0));

comment on view v_keywords_atencion is 'Keywords activas que requieren atencion, con el motivo ya clasificado. Devuelve nombres exactos con su campana y grupo, listos para copiar a un accionable. Evita tener que leer el inventario completo.';

-- Conversiones separando primarias de secundarias, que es la distincion
-- que rompe el analisis cuando se pasa por alto.
create or replace view v_conversiones_por_accion as
select account, week_start, campaign, conversion_action, category,
       conversions as primarias,
       all_conversions as total_incluyendo_secundarias,
       round(all_conversions - conversions, 2) as solo_secundarias
from conversion_actions;

comment on view v_conversiones_por_accion is 'Conversiones desglosadas. La columna primarias es la que entrena Smart Bidding. total_incluyendo_secundarias suma eventos blandos y casi nunca es negocio real. En 360, reportar el total en vez de las primarias infla el numero 2,5 veces.';;
