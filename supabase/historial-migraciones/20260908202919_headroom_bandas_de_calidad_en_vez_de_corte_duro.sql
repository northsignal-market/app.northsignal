-- Correccion sobre el arreglo anterior, en la misma sesion.
-- Puse un corte duro en 15% para separar "es puja" de "es calidad", copiado de
-- v_por_que_limitada. KAREDO dio 16%: un punto del lado equivocado, con el QS ponderado
-- mas alto de las cuatro cuentas (8,5). O sea que el veredicto volvia a recetar
-- "mejorar la relevancia" justo en la cuenta que el ticket 40 nombra como el caso donde
-- la calidad esta bien. Un umbral mal calibrado no se distingue de uno que funciona:
-- reprodujo el bug adentro del arreglo.
--
-- Ahora hay dos senales y tres bandas, no un corte:
--   POR PUJA    si el QS ponderado es 7 o mas y el peor componente no llega a 40%,
--               o si el peor componente esta por debajo de 15% con cualquier QS.
--   POR CALIDAD si el peor componente pesa 40% del gasto o mas.
--   MIXTA       en el medio: se nombran las dos y no se receta una sola.
-- El 7 es la linea habitual de "QS bueno" sobre 10. El 15% viene de v_por_que_limitada.
-- El 40% es criterio: por debajo de eso, arreglar calidad mueve poco gasto.
-- Si manana estas bandas dan un veredicto raro, el numero esta a la vista en
-- qs_ponderado y pct_gasto_peor_componente para poder discutirlo con datos.

create or replace view public.v_headroom as
with ultimos14 as (
  select s.account,
         sum(s.gasto) as gasto_14d,
         sum(s.conversiones) as conv_14d,
         round(sum(s.gasto) / nullif(sum(s.conversiones), 0), 2) as cpa_14d,
         count(*) filter (where s.madurez = 'consolidado') as dias_consolidados,
         count(*) filter (where s.cpa is not null and s.madurez = 'consolidado'
                            and s.cpa <= (select t_1.cpa_maximo from account_targets t_1 where t_1.account = s.account)) as dias_dentro_cpa,
         round(stddev_samp(s.cpa) / nullif(avg(s.cpa), 0), 2) as cv_cpa,
         avg(s.perdido_presupuesto) as lost_budget_pct,
         avg(s.perdido_ranking) as lost_rank_pct
    from v_serie_diaria s
   where s.date >= current_date - 14 and s.date < current_date - 1
   group by s.account
),
volumen as (
  select c.account,
         round(sum(c.conversions)::numeric, 1) as conv_ventana,
         count(distinct c.week_start) * 7 as dias_ventana,
         count(distinct c.week_start) as semanas_ventana
    from campaign c
   where c.week_start > (select max(week_start) from campaign c2 where c2.account = c.account) - 28
   group by c.account
),
volumen_viejo as (
  select account, sum(conversiones) as conv_30d_truncada
    from v_serie_diaria
   where date >= current_date - 30 and date < current_date - 1
   group by account
),
impr_share as (
  select v_campaign_daily.account, avg(v_campaign_daily.impr_share) as impr_share_pct
    from v_campaign_daily
   where v_campaign_daily.date >= current_date - 7 and v_campaign_daily.status = 'ENABLED'
   group by v_campaign_daily.account
),
calidad as (
  select k.account,
         round(sum(k.cost * k.quality_score) / nullif(sum(k.cost), 0), 1) as qs_ponderado,
         round(sum(k.cost * (case k.qs_expected_ctr  when 'BELOW_AVERAGE' then 1 else 0 end)) / nullif(sum(k.cost),0) * 100) as pct_ctr,
         round(sum(k.cost * (case k.qs_ad_relevance  when 'BELOW_AVERAGE' then 1 else 0 end)) / nullif(sum(k.cost),0) * 100) as pct_rel,
         round(sum(k.cost * (case k.qs_landing_page  when 'BELOW_AVERAGE' then 1 else 0 end)) / nullif(sum(k.cost),0) * 100) as pct_lp
    from keywords k
   where k.week_start = (select max(week_start) from keywords)
     and k.cost > 0 and k.quality_score is not null
   group by k.account
),
q as (
  select account, qs_ponderado, pct_ctr, pct_rel, pct_lp,
         greatest(pct_ctr, pct_rel, pct_lp) as peor_pct,
         case when pct_lp  = greatest(pct_ctr, pct_rel, pct_lp) then 'la experiencia de landing'
              when pct_rel = greatest(pct_ctr, pct_rel, pct_lp) then 'la relevancia del anuncio'
              else 'el CTR esperado' end as peor_componente,
         case when greatest(pct_ctr, pct_rel, pct_lp) < 15 or (qs_ponderado >= 7 and greatest(pct_ctr, pct_rel, pct_lp) < 40) then 'PUJA'
              when greatest(pct_ctr, pct_rel, pct_lp) >= 40 then 'CALIDAD'
              else 'MIXTA' end as banda
    from calidad
)
select u.account,
       t.conversiones_mes_objetivo,
       round(u.conv_14d * 30.0 / 14, 1) as conv_mes_proyectado,
       round(u.conv_14d * 30.0 / 14 / nullif(t.conversiones_mes_objetivo, 0) * 100) as pct_del_objetivo,
       u.cpa_14d,
       t.cpa_maximo,
       round(u.cpa_14d / nullif(t.cpa_maximo, 0) * 100) as cpa_pct_del_maximo,
       u.dias_dentro_cpa,
       u.dias_consolidados,
       u.cv_cpa,
       round(u.lost_budget_pct, 1) as lost_is_budget_pct,
       round(u.lost_rank_pct, 1) as lost_is_rank_pct,
       round(i.impr_share_pct, 1) as impr_share_pct,
       v.conv_ventana as conv_30d,
       t.conversiones_minimas_smart_bidding,
       u.dias_dentro_cpa >= greatest(u.dias_consolidados - 2, 8::bigint) as senal_cpa_estable,
       u.lost_budget_pct >= 20 as senal_limitada_presupuesto,
       u.cv_cpa <= 0.5 as senal_conversion_estable,
       v.conv_ventana >= t.conversiones_minimas_smart_bidding::numeric as senal_volumen_suficiente,
       i.impr_share_pct >= 85 as techo_inventario_saturado,
       u.lost_rank_pct > u.lost_budget_pct as techo_limitada_por_ranking,
       case
         when i.impr_share_pct >= 85
           then 'TECHO: inventario saturado. Escalar horizontal (keywords, geos), no presupuesto'
         when v.semanas_ventana < 3
           then 'NO SE PUEDE SABER: solo ' || v.semanas_ventana || ' semana(s) completas de historia. ' ||
                'Hacen falta al menos 3 para juzgar volumen. No emitir veredicto de escalamiento.'
         when v.conv_ventana < t.conversiones_minimas_smart_bidding::numeric
           then 'NO ESCALAR: ' || v.conv_ventana || ' conv en ' || v.dias_ventana || ' dias (minimo ' ||
                t.conversiones_minimas_smart_bidding || '), Smart Bidding inestable'
         when u.lost_rank_pct > u.lost_budget_pct and q.banda is null
           then 'LIMITADA POR RANKING: pierde mas por ranking (' || round(u.lost_rank_pct,1) ||
                '%) que por presupuesto (' || round(u.lost_budget_pct,1) || '%), pero NO hay datos de ' ||
                'quality score en la ultima semana para decir si es calidad o puja. No recetar sin eso.'
         when u.lost_rank_pct > u.lost_budget_pct and q.banda = 'PUJA'
           then 'LIMITADA POR RANKING, POR PUJA: la calidad no lo explica. QS ponderado ' || q.qs_ponderado ||
                ' y el peor componente (' || q.peor_componente || ') pesa ' || q.peor_pct ||
                '% del gasto. Subir la puja o el objetivo. NO tocar QS, relevancia ni landing: no es ahi.'
         when u.lost_rank_pct > u.lost_budget_pct and q.banda = 'CALIDAD'
           then 'LIMITADA POR RANKING, POR CALIDAD: pesa ' || q.peor_componente || ', ' || q.peor_pct ||
                '% del gasto (QS ponderado ' || q.qs_ponderado || '). Ver v_por_que_limitada para las peores keywords.'
         when u.lost_rank_pct > u.lost_budget_pct
           then 'LIMITADA POR RANKING, MIXTA: ' || q.peor_componente || ' pesa ' || q.peor_pct ||
                '% del gasto con QS ponderado ' || q.qs_ponderado || '. Ni la calidad ni la puja explican ' ||
                'sola la perdida: no recetar una sin medir la otra.'
         when u.dias_dentro_cpa >= greatest(u.dias_consolidados - 2, 8::bigint) and u.lost_budget_pct >= 20 and u.cv_cpa <= 0.5
           then 'HEADROOM: CPA estable + limitada por presupuesto. Escalar 20-30%, esperar 2 ciclos'
         when u.dias_dentro_cpa >= greatest(u.dias_consolidados - 2, 8::bigint) and u.lost_budget_pct < 20
           then 'ESTABLE SIN MARGEN: CPA bien pero no pierde por presupuesto. Buscar volumen horizontal'
         when u.cv_cpa > 0.5
           then 'INESTABLE: CPA varia demasiado. Estabilizar antes de escalar'
         else 'FUERA DE OBJETIVO: CPA sobre maximo. Optimizar antes de escalar'
       end as veredicto,
       t.cpa_maximo_origen,
       t.conversiones_mes_origen,
       t.cpa_maximo_origen = 'provisional' or (t.conversiones_mes_origen = any (array['provisional','historico'])) as objetivos_provisionales,
       'tabla semanal, ' || v.semanas_ventana || ' semanas completas' as conv_30d_origen,
       v.dias_ventana as conv_ventana_dias,
       round(vv.conv_30d_truncada::numeric, 1) as conv_30d_diaria_truncada,
       q.qs_ponderado,
       q.peor_pct as pct_gasto_peor_componente,
       'conv_30d sale de la tabla SEMANAL (' || v.dias_ventana || ' dias reales), no de la capa diaria, ' ||
       'que tiene entre 15 y 17 dias. conv_30d_diaria_truncada es lo que devolvia antes esta vista: la ' ||
       'diferencia es cuanto subestimaba. La banda de calidad (' || coalesce(q.banda,'sin datos') ||
       ') sale de cruzar QS ponderado con el peso del peor componente, no de un corte unico. ' ||
       'dias_consolidados se refiere a la ventana de 14 dias, no a esta.' as lectura
  from ultimos14 u
  join account_targets t on t.account = u.account
  left join volumen v on v.account = u.account
  left join volumen_viejo vv on vv.account = u.account
  left join impr_share i on i.account = u.account
  left join q on q.account = u.account;;
