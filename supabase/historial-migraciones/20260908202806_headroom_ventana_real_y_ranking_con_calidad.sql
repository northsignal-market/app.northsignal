-- Tickets 37 y 40, los dos abiertos y los dos rompiendo una decision hoy.
--
-- DEFECTO 1 (ticket 37). conv_30d sumaba v_serie_diaria entre current_date-30 y
-- current_date-1, sobre una tabla que tiene 15 a 17 dias. Devolvia el total de 15 dias
-- con la etiqueta "30d" y el veredicto comparaba ESE numero contra el minimo de 15
-- conversiones que Smart Bidding necesita EN 30 DIAS. Medido hoy contra la tabla
-- semanal, que si tiene 13 semanas y es la fuente que las propias reglas mandan usar
-- para retrospectiva:
--     BHI  10 -> 27 reales    360  8 -> 14    KAREDO 51,5 -> 95,9    FM 305,3 -> 926,1
-- El "NO ESCALAR: menos de 15 conv en 30d" de BHI es FALSO. El de 360 acierta por
-- casualidad: 14 contra 15, y el numero que citaba era 8.
-- Se habia "cerrado" agregando la columna dias_consolidados, pero el veredicto nunca la
-- uso. Mostrar la ventana no es corregir el calculo.
-- Nota: dias_consolidados se calcula sobre la ventana de 14 dias, no sobre la de 30.
-- Mezclarlas en un mismo veredicto era, ademas, un error de granularidad.
--
-- DEFECTO 2 (ticket 40). La rama de ranking recetaba "Mejorar QS, relevancia, landing"
-- solo por lost_rank > lost_budget, sin mirar la calidad real. En KAREDO el QS ponderado
-- es el mas alto de las cuatro cuentas y ningun componente llega al 15% del gasto: la
-- restriccion es de puja. Afecta a KAREDO y a FRESH_MONKEE, no solo a KAREDO.
-- v_por_que_limitada ya tiene esta logica pero DEPENDE de v_headroom, asi que
-- referenciarla seria un ciclo: se calcula adentro, con el mismo criterio.
--
-- Se conservan las 25 columnas originales en su orden: v_por_que_limitada y
-- v_proyeccion_escalamiento dependen de esta vista. Las nuevas van al final.
-- conv_30d cambia de significado (pasa a ser real) y por eso se agrega
-- conv_30d_diaria_truncada con el valor viejo, para poder auditar la diferencia.

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
-- La ventana de volumen sale de la tabla SEMANAL, no de la diaria. Es la regla que ya
-- estaba escrita en el sistema y que esta vista no seguia: para retrospectiva, la
-- semanal, que tiene 13 semanas.
volumen as (
  select c.account,
         round(sum(c.conversions)::numeric, 1) as conv_ventana,
         count(distinct c.week_start) * 7 as dias_ventana,
         count(distinct c.week_start) as semanas_ventana
    from campaign c
   where c.week_start > (select max(week_start) from campaign c2 where c2.account = c.account) - 28
   group by c.account
),
-- El valor viejo, solo para poder auditar cuanto mentia.
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
-- Misma descomposicion que v_por_que_limitada, calculada aca para no crear un ciclo.
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
              else 'el CTR esperado' end as peor_componente
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
         when u.lost_rank_pct > u.lost_budget_pct and q.peor_pct is null
           then 'LIMITADA POR RANKING: pierde mas por ranking (' || round(u.lost_rank_pct,1) ||
                '%) que por presupuesto (' || round(u.lost_budget_pct,1) || '%), pero NO hay datos de ' ||
                'quality score en la ultima semana para decir si es calidad o puja. No recetar sin eso.'
         when u.lost_rank_pct > u.lost_budget_pct and q.peor_pct < 15
           then 'LIMITADA POR RANKING, POR PUJA: la calidad esta bien (QS ponderado ' || q.qs_ponderado ||
                ', peor componente ' || q.peor_pct || '% del gasto). Subir la puja o el objetivo. ' ||
                'NO tocar QS, relevancia ni landing: no es ahi.'
         when u.lost_rank_pct > u.lost_budget_pct
           then 'LIMITADA POR RANKING, POR CALIDAD: pesa ' || q.peor_componente || ', ' || q.peor_pct ||
                '% del gasto (QS ponderado ' || q.qs_ponderado || '). Ver v_por_que_limitada para las peores keywords.'
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
       -- nuevas, al final, para no mover las que ya consumen otras vistas
       'tabla semanal, ' || v.semanas_ventana || ' semanas completas' as conv_30d_origen,
       v.dias_ventana as conv_ventana_dias,
       round(vv.conv_30d_truncada::numeric, 1) as conv_30d_diaria_truncada,
       q.qs_ponderado,
       q.peor_pct as pct_gasto_peor_componente,
       'conv_30d sale de la tabla SEMANAL (' || v.dias_ventana || ' dias reales), no de la capa diaria, ' ||
       'que tiene entre 15 y 17 dias. conv_30d_diaria_truncada es lo que devolvia antes esta vista: ' ||
       'la diferencia es cuanto subestimaba. dias_consolidados se refiere a la ventana de 14 dias, ' ||
       'no a esta.' as lectura
  from ultimos14 u
  join account_targets t on t.account = u.account
  left join volumen v on v.account = u.account
  left join volumen_viejo vv on vv.account = u.account
  left join impr_share i on i.account = u.account
  left join q on q.account = u.account;

comment on view public.v_headroom is
  'Veredicto de escalamiento por cuenta. El volumen se mide sobre la tabla SEMANAL (4 semanas completas, 28 dias reales) y NO sobre la capa diaria, que tiene 15 a 17 dias y devolvia el total de esa ventana con la etiqueta "30d": asi el NO ESCALAR de BHI era falso (10 contra 27 reales). La rama de ranking distingue puja de calidad mirando la descomposicion de quality score, en vez de recetar QS por defecto. Si no hay datos de QS, no receta.';;
