-- El script v2 escribia sin ad_group (''); el v3 escribe con ad_group. Ambas
-- claves coexisten para el mismo dia y se suman. Las del v3 cuadran con
-- campaign_daily; las del v2 sobran donde el v3 ya escribio.
-- Detectado por la tarea de BHI el 6 sep: v_headroom inflado de 46% a 107%.
with con_grupo as (
  select distinct account, date, campaign from conversion_actions_daily where ad_group <> ''
)
delete from conversion_actions_daily cad
using con_grupo cg
where cad.account = cg.account and cad.date = cg.date and cad.campaign = cg.campaign and cad.ad_group = '';

-- Verificacion: por dia, la suma debe coincidir con campaign_daily
select cad.account, count(distinct cad.date) as dias,
       sum(case when abs(coalesce(x.conv_cad, 0) - coalesce(c.conversions, 0)) > 0.01 then 1 else 0 end) as dias_descuadrados
from (select account, date, campaign, sum(conversions) as conv_cad from conversion_actions_daily group by 1,2,3) x
join conversion_actions_daily cad on cad.account = x.account and cad.date = x.date and cad.campaign = x.campaign
left join campaign_daily c on c.account = x.account and c.date = x.date and c.campaign = x.campaign
group by cad.account;;
