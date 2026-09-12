-- ================================================================
-- OBJETIVOS POR CUENTA
-- ================================================================
-- Sin un objetivo declarado, el analisis solo puede comparar contra la
-- semana previa. Con objetivo, puede decir "estamos a 60% del volumen que
-- el negocio necesita, y hay margen para crecer sin romper el CPA".
--
-- El CPA maximo sale del margen del negocio, no de la historia. Es el
-- unico numero defendible: que costo por adquisicion permite ganar dinero
-- al volumen que se quiere. Si no esta disponible, se usa el reciente como
-- piso provisional y se marca como tal.
-- ================================================================
create table if not exists account_targets (
  account text primary key,
  -- Objetivo de volumen
  conversiones_mes_objetivo numeric,
  conversiones_mes_origen text,          -- 'negocio' | 'historico' | 'provisional'
  -- Restriccion de eficiencia
  cpa_maximo numeric,
  cpa_maximo_origen text,                -- 'margen' | 'historico' | 'provisional'
  -- Restriccion de gasto
  presupuesto_mes_maximo numeric,
  -- Contexto
  ciclo_venta_dias int,                  -- cuanto tarda un lead en cerrar
  conversiones_minimas_smart_bidding int default 15,  -- Google requiere 15 en 30 dias para tCPA
  notas text,
  actualizado timestamptz default now(),
  actualizado_por text
);
alter table account_targets enable row level security;

comment on table account_targets is 'Objetivos declarados por cuenta. Sin esto, el analisis solo compara contra la semana previa; con esto, compara contra lo que el negocio necesita. cpa_maximo debe venir del margen (finanzas), no de la historia: es el unico numero defendible. Si el origen es provisional, las proyecciones se marcan tentativas.';

insert into account_targets (account, conversiones_mes_objetivo, conversiones_mes_origen, cpa_maximo, cpa_maximo_origen, presupuesto_mes_maximo, ciclo_venta_dias, notas, actualizado_por) values
('KAREDO', 110, 'historico', 40, 'historico', 4050, 14,
 'Objetivo provisional: 110 registros/mes es el ritmo actual (26/semana). CPA 40 EUR es el reciente + margen. FALTA: Andres confirma con Karedo el CPA que el negocio tolera. Limitada por RANKING, no por presupuesto: escalar = mejorar relevancia, no subir presupuesto.', 'Claude (provisional)'),
('BHI', 14, 'historico', 15000, 'historico', 600000, 45,
 'Objetivo provisional: 14 solicitudes/mes fue el benchmark del mes 1. CPA 15.000 CLP es el promedio historico. Subir presupuesto genera volumen a CPA +55%: el marginal es malo. Ciclo largo: 45 dias. FALTA: cuanto vale una solicitud para BHI.', 'Claude (provisional)'),
('360', 14, 'historico', 35000, 'historico', 630000, 60,
 'Objetivo provisional: 14 formularios/mes historico, 0,5 cierres. CPA 35.000 CLP es el reciente. Pierde 53% de impresiones por PRESUPUESTO: hay headroom real. Ticket 3-25M CLP: un cierre paga meses de pauta. FALTA: presupuesto maximo que 360 aprueba.', 'Claude (provisional)');


-- ================================================================
-- HEADROOM: SEÑALES DE ESCALAMIENTO
-- ================================================================
-- La literatura de 2026 converge en cuatro senales para escalar:
--   1. CPA dentro de objetivo 14+ dias consecutivos
--   2. Impression share perdida por presupuesto > 20%
--   3. Tasa de conversion estable (sin deriva)
--   4. Smart Bidding fuera de aprendizaje
-- Y tres senales de techo:
--   1. Impression share > 85%: inventario saturado, ir horizontal
--   2. CPA sube >20% tras aumento y no recupera en 2 semanas
--   3. Menos de 15 conversiones en 30 dias: tCPA no puede funcionar
-- ================================================================
create or replace view v_headroom as
with ultimos14 as (
  select account,
         sum(gasto) as gasto_14d,
         sum(conversiones) as conv_14d,
         round(sum(gasto) / nullif(sum(conversiones),0), 2) as cpa_14d,
         count(*) filter (where madurez = 'consolidado') as dias_consolidados,
         -- Dias con CPA dentro de objetivo
         count(*) filter (where cpa is not null and madurez = 'consolidado'
                            and cpa <= (select cpa_maximo from account_targets t where t.account = s.account)) as dias_dentro_cpa,
         -- Estabilidad: coeficiente de variacion del CPA
         round(stddev_samp(cpa) / nullif(avg(cpa),0), 2) as cv_cpa,
         avg(perdido_presupuesto) as lost_budget_pct,
         avg(perdido_ranking) as lost_rank_pct
  from v_serie_diaria s
  where date >= current_date - 14 and date < current_date - 1
  group by account
),
ultimos30 as (
  select account, sum(conversiones) as conv_30d, sum(gasto) as gasto_30d
  from v_serie_diaria where date >= current_date - 30 and date < current_date - 1
  group by account
),
impr_share as (
  select account, avg(impr_share) as impr_share_pct
  from v_campaign_daily
  where date >= current_date - 7 and status = 'ENABLED'
  group by account
)
select
  u.account,
  t.conversiones_mes_objetivo,
  round(u.conv_14d * 30.0 / 14, 1) as conv_mes_proyectado,
  round(u.conv_14d * 30.0 / 14 / nullif(t.conversiones_mes_objetivo,0) * 100) as pct_del_objetivo,
  u.cpa_14d,
  t.cpa_maximo,
  round(u.cpa_14d / nullif(t.cpa_maximo,0) * 100) as cpa_pct_del_maximo,
  u.dias_dentro_cpa,
  u.dias_consolidados,
  u.cv_cpa,
  round(u.lost_budget_pct, 1) as lost_is_budget_pct,
  round(u.lost_rank_pct, 1) as lost_is_rank_pct,
  round(i.impr_share_pct, 1) as impr_share_pct,
  u30.conv_30d,
  t.conversiones_minimas_smart_bidding,
  -- Las cuatro senales de headroom
  (u.dias_dentro_cpa >= greatest(u.dias_consolidados - 2, 8)) as senal_cpa_estable,
  (u.lost_budget_pct >= 20) as senal_limitada_presupuesto,
  (u.cv_cpa <= 0.5) as senal_conversion_estable,
  (u30.conv_30d >= t.conversiones_minimas_smart_bidding) as senal_volumen_suficiente,
  -- Las senales de techo
  (i.impr_share_pct >= 85) as techo_inventario_saturado,
  (u.lost_rank_pct > u.lost_budget_pct) as techo_limitada_por_ranking,
  -- Veredicto
  case
    when i.impr_share_pct >= 85 then 'TECHO: inventario saturado. Escalar horizontal (keywords, geos), no presupuesto'
    when u30.conv_30d < t.conversiones_minimas_smart_bidding then 'NO ESCALAR: menos de ' || t.conversiones_minimas_smart_bidding || ' conv en 30d, Smart Bidding inestable'
    when u.lost_rank_pct > u.lost_budget_pct then 'LIMITADA POR RANKING: subir presupuesto no da volumen. Mejorar QS, relevancia, landing'
    when u.dias_dentro_cpa >= greatest(u.dias_consolidados - 2, 8) and u.lost_budget_pct >= 20 and u.cv_cpa <= 0.5
      then 'HEADROOM: CPA estable + limitada por presupuesto. Escalar 20-30%, esperar 2 ciclos'
    when u.dias_dentro_cpa >= greatest(u.dias_consolidados - 2, 8) and u.lost_budget_pct < 20
      then 'ESTABLE SIN MARGEN: CPA bien pero no pierde por presupuesto. Buscar volumen horizontal'
    when u.cv_cpa > 0.5 then 'INESTABLE: CPA varia demasiado. Estabilizar antes de escalar'
    else 'FUERA DE OBJETIVO: CPA sobre maximo. Optimizar antes de escalar'
  end as veredicto,
  t.cpa_maximo_origen,
  t.conversiones_mes_origen,
  (t.cpa_maximo_origen = 'provisional' or t.conversiones_mes_origen in ('provisional','historico')) as objetivos_provisionales
from ultimos14 u
join account_targets t on t.account = u.account
left join ultimos30 u30 on u30.account = u.account
left join impr_share i on i.account = u.account;

comment on view v_headroom is 'Señales de escalamiento por cuenta contra los objetivos de account_targets. Cuatro senales positivas (CPA estable 14d, limitada por presupuesto >20%, conversion estable, volumen >= 15 en 30d) y tres de techo (IS >= 85%, limitada por ranking, volumen insuficiente). El veredicto es la accion recomendada. Si objetivos_provisionales es true, todo es tentativo hasta que Andres confirme los numeros del negocio.';


-- ================================================================
-- PROYECCIÓN: QUÉ PASA SI SE ESCALA
-- ================================================================
-- Google recomienda incrementos de 20-30%, dos ciclos de conversion por paso.
-- Esta vista no predice: proyecta linealmente y marca hasta donde la
-- proyeccion es defendible (el punto donde lost_is_budget llega a cero).
-- Mas alla, el CPA marginal es desconocido y probablemente peor.
-- ================================================================
create or replace view v_proyeccion_escalamiento as
select
  h.account,
  h.veredicto,
  h.cpa_14d as cpa_actual,
  h.lost_is_budget_pct,
  -- Cuanto volumen adicional hay disponible sin cambiar la puja
  -- (aproximacion: si pierde X% por presupuesto, hay X/(100-X) de volumen extra)
  round(h.lost_is_budget_pct / nullif(100 - h.lost_is_budget_pct, 0) * 100, 1) as volumen_extra_disponible_pct,
  -- Escenarios de +20% y +30% de presupuesto
  round(h.conv_mes_proyectado * 1.20, 1) as conv_mes_si_mas_20pct,
  round(h.conv_mes_proyectado * 1.30, 1) as conv_mes_si_mas_30pct,
  -- CPA esperado: se asume que el marginal es 15-25% peor que el promedio
  -- (la demanda justo detras del cap es mas cara)
  round(h.cpa_14d * 1.15, 0) as cpa_esperado_optimista,
  round(h.cpa_14d * 1.25, 0) as cpa_esperado_pesimista,
  -- Sigue dentro del maximo?
  (h.cpa_14d * 1.25 <= h.cpa_maximo) as escalable_dentro_de_cpa_max,
  -- Hasta donde
  case
    when h.lost_is_budget_pct >= 40 then 'Dos pasos de +25% con 2 semanas entre cada uno'
    when h.lost_is_budget_pct >= 20 then 'Un paso de +20-30%, evaluar a las 2 semanas'
    else 'Sin margen por presupuesto: el volumen extra no esta ahi'
  end as plan_sugerido,
  h.objetivos_provisionales,
  'Proyeccion lineal sobre ' || h.dias_consolidados || ' dias consolidados. No es prediccion: el CPA marginal real se conoce solo escalando.' as advertencia
from v_headroom h;

comment on view v_proyeccion_escalamiento is 'Escenarios de +20% y +30% con CPA esperado entre 15% y 25% peor que el actual, porque la demanda justo detras del cap de presupuesto es mas cara. escalable_dentro_de_cpa_max dice si aun el escenario pesimista respeta el maximo del negocio. Es proyeccion lineal, no prediccion: el marginal real solo se conoce probando.';;
