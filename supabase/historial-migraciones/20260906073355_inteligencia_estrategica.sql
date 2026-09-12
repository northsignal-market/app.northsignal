-- ================================================================
-- INTELIGENCIA ESTRATEGICA: decisiones de media buyer con evidencia
-- ================================================================
-- Principios de la investigacion (sep 2026):
--   1. El presupuesto esta bien asignado cuando el CPA MARGINAL se iguala
--      entre campanas. No el promedio: lo que produce el siguiente peso.
--   2. Separar campana solo cuando una configuracion DEBE ser distinta.
--   3. 15 conv/mes por campana minimo para Smart Bidding. Menos = consolidar.
--   4. Tres zonas: PROPONER (evidencia suficiente, reversible) / REVISAR
--      (evidencia parcial o irreversible) / NO PROPONER (sin evidencia).
--      Los umbrales salen de perdida de negocio y reversibilidad.
--   5. 50+ clics antes de juzgar una keyword. 4 semanas consolidadas antes
--      de juzgar una campana.
--   6. Si el efecto minimo detectable a 4 semanas supera 30%, la pregunta
--      no es testeable hoy: se registra, no se testea.
-- ================================================================

-- ---- 1. CPA MARGINAL: donde produce mas el siguiente peso ----
create or replace view v_cpa_marginal as
with ult as (
  select account, campaign, max(run_ts) as run_ts from simulations where sim_type = 'BUDGET' group by account, campaign
),
curva as (
  select s.account, s.campaign, s.target_value as presupuesto_diario, s.est_conversions, s.est_cost,
         lag(s.target_value) over (partition by s.account, s.campaign order by s.target_value) as pres_ant,
         lag(s.est_conversions) over (partition by s.account, s.campaign order by s.target_value) as conv_ant,
         lag(s.est_cost) over (partition by s.account, s.campaign order by s.target_value) as cost_ant
  from simulations s join ult u on u.account = s.account and u.campaign = s.campaign and u.run_ts = s.run_ts
  where s.sim_type = 'BUDGET'
),
actual as (
  select account, campaign, max(daily_budget) as presupuesto_actual from budget_daily
  where date >= current_date - 7 group by account, campaign
)
select c.account, c.campaign,
       a.presupuesto_actual,
       c.presupuesto_diario as escalon,
       round(c.est_cost / nullif(c.est_conversions, 0), 0) as cpa_promedio_en_escalon,
       case when c.conv_ant is not null and c.est_conversions > c.conv_ant
            then round((c.est_cost - c.cost_ant) / (c.est_conversions - c.conv_ant), 0) end as cpa_marginal_desde_anterior,
       round((c.est_cost - c.cost_ant) / nullif(c.est_conversions - c.conv_ant, 0) / nullif(c.est_cost / nullif(c.est_conversions, 0), 0), 2) as ratio_marginal_sobre_promedio,
       case
         when c.presupuesto_diario <= a.presupuesto_actual then 'actual o menor'
         when (c.est_cost - c.cost_ant) / nullif(c.est_conversions - c.conv_ant, 0) > 2 * (c.est_cost / nullif(c.est_conversions, 0)) then 'SATURADA: el siguiente peso cuesta mas del doble'
         when (c.est_cost - c.cost_ant) / nullif(c.est_conversions - c.conv_ant, 0) > 1.3 * (c.est_cost / nullif(c.est_conversions, 0)) then 'RENDIMIENTO DECRECIENTE: marginal 30%+ sobre promedio'
         else 'HEADROOM: el siguiente peso rinde parecido'
       end as lectura
from curva c left join actual a on a.account = c.account and a.campaign = c.campaign
order by c.account, c.campaign, c.presupuesto_diario;

comment on view v_cpa_marginal is 'Curva de rendimientos decrecientes por campana desde campaign_simulation. cpa_marginal_desde_anterior = cuanto cuesta cada conversion ADICIONAL al pasar al siguiente escalon de presupuesto. Si el marginal duplica al promedio, la campana esta saturada y subir presupuesto compra conversiones al doble. El presupuesto esta bien asignado cuando el marginal se iguala entre campanas.';

-- ---- 2. TESTEABILIDAD: que se puede responder con este volumen ----
create or replace function testeabilidad(p_conv_por_semana numeric, p_semanas int default 4, p_split numeric default 0.5) returns jsonb
language sql immutable as $$
  -- Aproximacion: MDE relativo para dos proporciones con alpha 0.05, potencia 0.8.
  -- Con n conversiones por brazo, el MDE relativo ~ 2.8 / sqrt(n) (regla practica para tasas bajas).
  select jsonb_build_object(
    'conv_por_brazo', round(p_conv_por_semana * p_semanas * p_split, 1),
    'mde_relativo_pct', round(280 / sqrt(greatest(p_conv_por_semana * p_semanas * p_split, 1)), 0),
    'veredicto', case
      when 280 / sqrt(greatest(p_conv_por_semana * p_semanas * p_split, 1)) <= 20 then 'TESTEABLE: detecta cambios de 20% o mas'
      when 280 / sqrt(greatest(p_conv_por_semana * p_semanas * p_split, 1)) <= 35 then 'TESTEABLE SOLO PARA EFECTOS GRANDES: necesita 35%+ de diferencia'
      else 'NO TESTEABLE en ' || p_semanas || ' semanas: el efecto minimo detectable supera 35%. Registrar la pregunta, no correr el test.'
    end
  );
$$;
comment on function testeabilidad is 'Dado el volumen semanal de conversiones, cuanto tendria que moverse una metrica para que un test A/B de N semanas lo detecte. Si el MDE supera 35%, no hay test que responda: se registra la pregunta como no testeable hoy. Evita proponer experimentos que no pueden decidir nada.';

-- ---- 3. DECISIONES ESTRUCTURALES con zona y evidencia ----
create or replace view v_decision_estructural as
with base as (
  select account,
         sum(conversiones) filter (where date >= current_date - 28 and madurez = 'consolidado') as conv_28d,
         sum(gasto) filter (where date >= current_date - 28 and madurez = 'consolidado') as gasto_28d,
         count(distinct date) filter (where date >= current_date - 28 and madurez = 'consolidado') as dias_28d
  from v_serie_diaria group by account
),
campanas as (
  select account, count(distinct campaign) as n_campanas from campaign_daily where date >= current_date - 7 group by account
),
grupos as (
  select account, ad_group, sum(conversions) as conv from adgroup_daily where date >= current_date - 28 group by account, ad_group
),
top_grupo as (
  select g.account, g.ad_group, g.conv, round(g.conv / nullif((select sum(conv) from grupos x where x.account = g.account), 0) * 100, 0) as pct
  from grupos g where g.conv = (select max(conv) from grupos y where y.account = g.account)
),
saturacion as (
  select account, campaign, max(ratio_marginal_sobre_promedio) filter (where lectura like 'SATURADA%' or lectura like 'RENDIMIENTO%') as peor_ratio
  from v_cpa_marginal where escalon > presupuesto_actual group by account, campaign
),
targets as (select * from account_targets),
tst as (select b.account, testeabilidad(b.conv_28d / 4.0, 4) as t from base b)
select b.account,
       round(b.conv_28d, 0) as conv_28d,
       b.dias_28d,
       c.n_campanas,
       round(b.conv_28d / nullif(c.n_campanas, 0), 0) as conv_por_campana,
       tg.ad_group as grupo_dominante, tg.pct as pct_grupo_dominante,
       (tst.t->>'mde_relativo_pct')::int as mde_4_semanas_pct,
       tst.t->>'veredicto' as testeabilidad,
       -- DECISION 1: Separar el grupo dominante (marca) en campana propia
       case
         when tg.pct >= 50 and b.conv_28d - tg.conv >= 60 then
           'PROPONER · Separar "' || tg.ad_group || '" en campaña propia con puja manual/Max Clicks y exacta. Concentra ' || tg.pct || '% de las conversiones; el resto tiene ' || round(b.conv_28d - tg.conv) || ' en 28d, suficiente para que Smart Bidding aprenda de los no-marca sin contaminación. Reversible.'
         when tg.pct >= 50 and b.conv_28d - tg.conv >= 30 then
           'REVISAR · "' || tg.ad_group || '" concentra ' || tg.pct || '% pero el resto tiene solo ' || round(b.conv_28d - tg.conv) || ' conv en 28d: separar dejaría a la no-marca con menos de 60/mes. Evaluar con Andrés.'
         when tg.pct >= 50 then
           'NO PROPONER · "' || tg.ad_group || '" concentra ' || tg.pct || '% pero separar dejaría a la no-marca sin densidad (' || round(b.conv_28d - tg.conv) || ' conv en 28d, mínimo 60).'
         else 'NO APLICA · ningún grupo supera 50% de las conversiones.'
       end as separar_marca,
       -- DECISION 2: Consolidar campanas
       case
         when c.n_campanas > 1 and b.conv_28d / c.n_campanas < 15 then
           'PROPONER · ' || c.n_campanas || ' campañas con ' || round(b.conv_28d / c.n_campanas) || ' conv/mes cada una: por debajo de 15, Smart Bidding no aprende. Consolidar. Reversible.'
         when c.n_campanas = 1 then 'NO APLICA · una sola campaña.'
         else 'NO PROPONER · densidad suficiente (' || round(b.conv_28d / c.n_campanas) || ' conv/mes por campaña).'
       end as consolidar,
       -- DECISION 3: Crear campana nueva
       case
         when b.conv_28d >= 100 then 'REVISAR · volumen suficiente para una campaña adicional (100+ conv/mes) SI hay una configuración que deba diferir: presupuesto, puja, geo, primaria o landing. Nunca para reportar.'
         else 'NO PROPONER · con ' || round(b.conv_28d) || ' conv en 28d, una campaña nueva restaría densidad a la existente. Mínimo 100/mes en la cuenta.'
       end as crear_campana,
       -- DECISION 4: Pausar campana
       case
         when tg.pct is null then 'NO APLICA'
         when b.dias_28d < 28 then 'NO PROPONER · faltan días consolidados (' || b.dias_28d || ' de 28). Mínimo 4 semanas consolidadas para juzgar.'
         when t.cpa_maximo is not null and b.gasto_28d / nullif(b.conv_28d, 0) > 2 * t.cpa_maximo and c.n_campanas > 1 then
           'REVISAR · CPA de 28d duplica el máximo. Con más de una campaña, antes de pausar: mover presupuesto a la que tiene headroom en v_cpa_marginal.'
         when t.cpa_maximo is not null and b.gasto_28d / nullif(b.conv_28d, 0) > 2 * t.cpa_maximo then
           'REVISAR · CPA de 28d duplica el máximo y es la única campaña: pausar apaga la cuenta. Antes: reducir presupuesto 20%, no pausar. Irreversible en aprendizaje.'
         else 'NO PROPONER · CPA dentro de 2× el máximo.'
       end as pausar,
       -- DECISION 5: Escalar presupuesto
       case
         when s.peor_ratio >= 2 then 'NO PROPONER · saturada: el siguiente escalón cuesta ' || round(s.peor_ratio, 1) || '× el CPA promedio (v_cpa_marginal).'
         when s.peor_ratio >= 1.3 then 'REVISAR · rendimiento decreciente: marginal ' || round(s.peor_ratio, 1) || '× el promedio. Solo si el cliente acepta ese CPA.'
         when s.peor_ratio is not null then 'PROPONER · headroom real: el siguiente escalón rinde parecido al actual. Subir 15-20%, no más, y medir 2 semanas.'
         else 'SIN DATOS · sin curva de simulación para esta cuenta.'
       end as escalar,
       -- DECISION 6: Test de incrementalidad de marca
       case
         when tg.pct >= 50 and b.conv_28d >= 100 then 'REVISAR · marca concentra ' || tg.pct || '%: un geo-split de 4 semanas (pausar marca en la mitad de las regiones) mide cuánto es incremental y cuánto canibaliza orgánico. Costo: perder las conversiones de marca en esas regiones 4 semanas.'
         when tg.pct >= 50 then 'NO PROPONER · marca concentra ' || tg.pct || '% pero sin volumen para un geo-split (' || round(b.conv_28d) || ' conv en 28d).'
         else 'NO APLICA'
       end as test_incrementalidad_marca
from base b
left join campanas c on c.account = b.account
left join top_grupo tg on tg.account = b.account
left join saturacion s on s.account = b.account
left join targets t on t.account = b.account
left join tst on tst.account = b.account;

comment on view v_decision_estructural is 'Evalua las seis decisiones estructurales de media buyer por cuenta con zona y evidencia: separar marca, consolidar, crear campana, pausar, escalar, test de incrementalidad. PROPONER = evidencia suficiente y reversible, nace Propuesto. REVISAR = evidencia parcial o irreversible, nace Bloqueado con lo que falta. NO PROPONER = sin evidencia, no se menciona. Incluye testeabilidad: MDE a 4 semanas segun el volumen.';

select account, conv_28d, n_campanas, grupo_dominante, pct_grupo_dominante, mde_4_semanas_pct, left(testeabilidad, 50) test from v_decision_estructural;;
