drop view if exists v_decision_estructural;
drop view if exists v_cpa_marginal;
create view v_cpa_marginal as
with ult as (
  select account, campaign, sim_type, max(run_ts) as run_ts from simulations
  where sim_type in ('BUDGET', 'TARGET_CPA', 'TARGET_CPA_ADGROUP') group by account, campaign, sim_type
),
curva as (
  select s.account, s.campaign, s.sim_type, s.target_value as escalon, s.est_conversions, s.est_cost,
         lag(s.target_value) over (partition by s.account, s.campaign, s.sim_type order by s.target_value) as esc_ant,
         lag(s.est_conversions) over (partition by s.account, s.campaign, s.sim_type order by s.target_value) as conv_ant,
         lag(s.est_cost) over (partition by s.account, s.campaign, s.sim_type order by s.target_value) as cost_ant
  from simulations s join ult u on u.account = s.account and u.campaign = s.campaign and u.sim_type = s.sim_type and u.run_ts = s.run_ts
),
actual as (
  select account, campaign, max(daily_budget) as presupuesto_actual from budget_daily where date >= current_date - 7 group by account, campaign
),
tcpa_actual as (
  select account, campaign || ' › ' || ad_group as campaign, max(target_cpa) as tcpa_actual from bid_targets
  where week_start = (select max(week_start) from bid_targets) group by account, campaign, ad_group
)
select c.account, c.campaign, c.sim_type,
       coalesce(a.presupuesto_actual, t.tcpa_actual) as presupuesto_actual,
       c.escalon,
       round(c.est_cost / nullif(c.est_conversions, 0), 0) as cpa_promedio_en_escalon,
       case when c.conv_ant is not null and c.est_conversions > c.conv_ant
            then round((c.est_cost - c.cost_ant) / (c.est_conversions - c.conv_ant), 0) end as cpa_marginal_desde_anterior,
       round((c.est_cost - c.cost_ant) / nullif(c.est_conversions - c.conv_ant, 0) / nullif(c.est_cost / nullif(c.est_conversions, 0), 0), 2) as ratio_marginal_sobre_promedio,
       case
         when c.escalon <= coalesce(a.presupuesto_actual, t.tcpa_actual) then 'actual o menor'
         when c.conv_ant is null then 'primer escalón'
         when c.est_conversions <= c.conv_ant then 'SIN GANANCIA: más gasto, mismas conversiones'
         when (c.est_cost - c.cost_ant) / nullif(c.est_conversions - c.conv_ant, 0) > 2 * (c.est_cost / nullif(c.est_conversions, 0)) then 'SATURADA: el siguiente peso cuesta más del doble'
         when (c.est_cost - c.cost_ant) / nullif(c.est_conversions - c.conv_ant, 0) > 1.3 * (c.est_cost / nullif(c.est_conversions, 0)) then 'RENDIMIENTO DECRECIENTE: marginal 30%+ sobre promedio'
         else 'HEADROOM: el siguiente peso rinde parecido'
       end as lectura
from curva c
left join actual a on a.account = c.account and a.campaign = c.campaign
left join tcpa_actual t on t.account = c.account and t.campaign = c.campaign
order by c.account, c.campaign, c.sim_type, c.escalon;
comment on view v_cpa_marginal is 'Curva de rendimientos decrecientes por campana (BUDGET) o por grupo (TARGET_CPA_ADGROUP, script v8). cpa_marginal = cuanto cuesta cada conversion adicional al pasar al siguiente escalon. Si duplica al promedio, saturada.';

-- Recrear v_decision_estructural (dependia de v_cpa_marginal)
create view v_decision_estructural as
with base as (
  select account,
         sum(conversiones) filter (where date >= current_date - 28 and madurez = 'consolidado') as conv_28d,
         sum(gasto) filter (where date >= current_date - 28 and madurez = 'consolidado') as gasto_28d,
         count(distinct date) filter (where date >= current_date - 28 and madurez = 'consolidado') as dias_28d
  from v_serie_diaria group by account
),
campanas as (select account, count(distinct campaign) as n_campanas from campaign_daily where date >= current_date - 7 group by account),
grupos as (select account, ad_group, sum(conversions) as conv from adgroup_daily where date >= current_date - 28 group by account, ad_group),
top_grupo as (
  select g.account, g.ad_group, g.conv, round(g.conv / nullif((select sum(conv) from grupos x where x.account = g.account), 0) * 100, 0) as pct
  from grupos g where g.conv = (select max(conv) from grupos y where y.account = g.account)
),
saturacion as (
  select account, max(ratio_marginal_sobre_promedio) filter (where lectura like 'SATURADA%' or lectura like 'RENDIMIENTO%' or lectura like 'SIN GANANCIA%') as peor_ratio
  from v_cpa_marginal where escalon > presupuesto_actual group by account
),
targets as (select * from account_targets),
tst as (select b.account, testeabilidad(b.conv_28d / 4.0, 4) as t from base b)
select b.account, round(b.conv_28d, 0) as conv_28d, b.dias_28d, c.n_campanas, round(b.conv_28d / nullif(c.n_campanas, 0), 0) as conv_por_campana,
       tg.ad_group as grupo_dominante, tg.pct as pct_grupo_dominante,
       (tst.t->>'mde_relativo_pct')::int as mde_4_semanas_pct, tst.t->>'veredicto' as testeabilidad,
       case
         when tg.pct >= 50 and b.conv_28d - tg.conv >= 60 then 'PROPONER · Separar "' || tg.ad_group || '" en campaña propia con puja manual/Max Clicks y exacta. Concentra ' || tg.pct || '% de las conversiones; el resto tiene ' || round(b.conv_28d - tg.conv) || ' en 28d. Reversible.'
         when tg.pct >= 50 and b.conv_28d - tg.conv >= 30 then 'REVISAR · "' || tg.ad_group || '" concentra ' || tg.pct || '% pero el resto tiene solo ' || round(b.conv_28d - tg.conv) || ' conv en 28d. Evaluar con Andrés.'
         when tg.pct >= 50 then 'NO PROPONER · "' || tg.ad_group || '" concentra ' || tg.pct || '% pero separar dejaría a la no-marca sin densidad (' || round(b.conv_28d - tg.conv) || ' conv en 28d, mínimo 60).'
         else 'NO APLICA · ningún grupo supera 50% de las conversiones.' end as separar_marca,
       case
         when c.n_campanas > 1 and b.conv_28d / c.n_campanas < 15 then 'PROPONER · ' || c.n_campanas || ' campañas con ' || round(b.conv_28d / c.n_campanas) || ' conv/mes cada una: por debajo de 15. Consolidar. Reversible.'
         when c.n_campanas = 1 then 'NO APLICA · una sola campaña.'
         else 'NO PROPONER · densidad suficiente (' || round(b.conv_28d / c.n_campanas) || ' conv/mes por campaña).' end as consolidar,
       case
         when b.conv_28d >= 100 then 'REVISAR · volumen suficiente (100+ conv/mes) SI hay una configuración que deba diferir: presupuesto, puja, geo, primaria o landing. Nunca para reportar.'
         else 'NO PROPONER · con ' || round(b.conv_28d) || ' conv en 28d, una campaña nueva restaría densidad. Mínimo 100/mes.' end as crear_campana,
       case
         when tg.pct is null then 'NO APLICA'
         when b.dias_28d < 28 then 'NO PROPONER · faltan días consolidados (' || b.dias_28d || ' de 28).'
         when t.cpa_maximo is not null and b.gasto_28d / nullif(b.conv_28d, 0) > 2 * t.cpa_maximo and c.n_campanas > 1 then 'REVISAR · CPA de 28d duplica el máximo. Antes de pausar: mover presupuesto a la que tiene headroom.'
         when t.cpa_maximo is not null and b.gasto_28d / nullif(b.conv_28d, 0) > 2 * t.cpa_maximo then 'REVISAR · CPA de 28d duplica el máximo y es la única campaña: pausar apaga la cuenta. Antes: reducir presupuesto 20%.'
         else 'NO PROPONER · CPA dentro de 2× el máximo.' end as pausar,
       case
         when s.peor_ratio >= 2 then 'NO PROPONER · saturada: el siguiente escalón cuesta ' || round(s.peor_ratio, 1) || '× el CPA promedio.'
         when s.peor_ratio >= 1.3 then 'REVISAR · rendimiento decreciente: marginal ' || round(s.peor_ratio, 1) || '× el promedio. Solo si el cliente acepta ese CPA.'
         when s.peor_ratio is not null then 'PROPONER · headroom real. Subir 15-20%, no más, y medir 2 semanas.'
         else 'SIN DATOS · sin curva de simulación. Karedo: llega con script v8 (simulaciones de grupo).' end as escalar,
       case
         when tg.pct >= 50 and b.conv_28d >= 100 then 'REVISAR · marca concentra ' || tg.pct || '%: geo-split de 4 semanas mide incrementalidad. Costo: perder marca en la mitad de las regiones 4 semanas.'
         when tg.pct >= 50 then 'NO PROPONER · marca concentra ' || tg.pct || '% pero sin volumen para geo-split.'
         else 'NO APLICA' end as test_incrementalidad_marca
from base b
left join campanas c on c.account = b.account
left join top_grupo tg on tg.account = b.account
left join saturacion s on s.account = b.account
left join targets t on t.account = b.account
left join tst on tst.account = b.account;
comment on view v_decision_estructural is 'Seis decisiones estructurales por cuenta con zona (PROPONER/REVISAR/NO PROPONER) y evidencia. NO PROPONER no se menciona. Incluye testeabilidad (MDE a 4 semanas).';
select 'ok';;
