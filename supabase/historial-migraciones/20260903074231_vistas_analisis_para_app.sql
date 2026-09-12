-- Vistas de analisis para la interfaz. Excluyen conv_value, all_conversions y
-- roas en todos los casos, porque esas columnas no son confiables en ninguna
-- de las tres cuentas por motivos distintos. Asi la app no puede mostrarlas
-- aunque el codigo se equivoque.

create or replace view v_campaign_analisis as
select account, week_start, week_end, campaign, status, channel, bid_strategy, currency,
       impressions, clicks, ctr, avg_cpc, avg_cpm, cost,
       conversions, cost_per_conv, conv_rate,
       impr_share, top_impr_share, abs_top_impr_share,
       lost_is_budget, lost_is_rank, click_share,
       case when lost_is_budget > lost_is_rank then 'presupuesto' else 'ranking' end as limitada_por
from campaign;

comment on view v_campaign_analisis is 'Campanas de todas las cuentas para la interfaz. No expone conv_value, all_conversions ni roas: no son confiables en ninguna cuenta. La columna limitada_por dice si la restriccion principal es presupuesto o ad rank, que determina si subir presupuesto sirve o no.';

create or replace view v_adgroup_analisis as
select account, week_start, campaign, campaign_status, ad_group, ad_group_status,
       ad_group_type, currency, impressions, clicks, ctr, avg_cpc, cost,
       conversions, cost_per_conv, conv_rate, impr_share
from adgroup;

comment on view v_adgroup_analisis is 'Grupos de anuncios de todas las cuentas. Incluye grupos con cero impresiones: eso es senal, no ausencia de dato.';

create or replace view v_keywords_analisis as
select k.account, k.week_start, k.campaign, k.campaign_status, k.ad_group, k.ad_group_status,
       k.keyword, k.match_type, k.keyword_status, k.serving_status, k.approval_status,
       k.currency, k.quality_score, k.qs_ad_relevance, k.qs_landing_page, k.qs_expected_ctr,
       k.impressions, k.clicks, k.ctr, k.avg_cpc, k.cost,
       k.conversions, k.cost_per_conv, k.conv_rate,
       k.impr_share, k.top_impr_share, k.lost_is_rank,
       k.est_top_of_page_cpc, k.effective_cpc_bid,
       case
         when k.serving_status = 'RARELY_SERVED' then 'Bajo volumen de busqueda'
         when k.keyword_status = 'ENABLED' and k.impressions = 0 then 'Activa sin impresiones'
         when k.approval_status like '%DISAPPROVED%' then 'Rechazada'
         when k.quality_score <= 4 and k.cost > 0 then 'Quality Score bajo'
         when k.conversions = 0 and k.cost > 0 then 'Gasta sin convertir'
         else null
       end as motivo
from keywords k;

comment on view v_keywords_analisis is 'INVENTARIO COMPLETO de keywords con metricas y un motivo clasificado cuando hay problema. A diferencia de v_keywords_atencion, incluye tambien las keywords sanas: sirve para explorar, filtrar y ordenar toda la cuenta. No expone conv_value ni all_conversions.';

create or replace view v_search_terms_analisis as
select account, week_start, campaign, ad_group, search_term, match_type,
       triggered_keyword, currency, impressions, clicks, ctr, avg_cpc, cost,
       conversions, cost_per_conv,
       case
         when conversions = 0 and cost > 0 then 'Gasta sin convertir'
         when conversions > 0 then 'Convierte'
         else 'Sin gasto'
       end as clasificacion
from search_terms;

comment on view v_search_terms_analisis is 'Terminos de busqueda reales con clasificacion. Insumo para negativas y para keywords nuevas. No expone conv_value.';;
