drop view if exists v_terminos_nuevos;
create view v_terminos_nuevos as
with primera as (
  select account, search_term, min(date) as primera_aparicion
  from search_terms_daily group by account, search_term
),
acumulado as (
  select s.account, s.search_term,
         sum(s.cost) as gasto_acumulado,
         sum(s.clicks) as clics_acumulados,
         sum(s.conversions) as conversiones_acumuladas,
         sum(s.impressions) as impresiones_acumuladas,
         -- La keyword que mas veces lo disparo, y su grupo y campana
         mode() within group (order by s.triggered_keyword) as keyword_disparadora,
         mode() within group (order by s.match_type) as match_type,
         mode() within group (order by s.ad_group) as ad_group,
         mode() within group (order by s.campaign) as campaign
  from search_terms_daily s group by s.account, s.search_term
)
select p.account, p.search_term, p.primera_aparicion,
       (current_date - p.primera_aparicion) as dias_desde_aparicion,
       round(a.gasto_acumulado, 2) as gasto_acumulado,
       a.clics_acumulados, round(a.conversiones_acumuladas, 1) as conversiones_acumuladas,
       a.impresiones_acumuladas,
       a.keyword_disparadora, a.match_type, a.ad_group, a.campaign,
       case when a.clics_acumulados > 0 then round(a.gasto_acumulado / a.clics_acumulados, 2) end as cpc,
       case when a.conversiones_acumuladas > 0 then round(a.gasto_acumulado / a.conversiones_acumuladas, 2) end as cpa
from primera p join acumulado a on a.account = p.account and a.search_term = p.search_term
where p.primera_aparicion >= current_date - 14;

comment on view v_terminos_nuevos is 'Terminos de busqueda que aparecieron por primera vez en los ultimos 14 dias, con gasto, clics, conversiones e impresiones acumulados, y la keyword, grupo y campana que mas veces los disparo. Un termino con gasto y sin conversiones es candidato a negativa; con keyword_disparadora se sabe en que grupo agregarla.';

select account, search_term, keyword_disparadora, ad_group, gasto_acumulado, clics_acumulados, conversiones_acumuladas
from v_terminos_nuevos where account='KAREDO' order by gasto_acumulado desc limit 4;;
