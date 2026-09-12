-- Clasificacion de madurez del dato.
-- La practica establecida es esperar entre 5 y 7 dias tras el cierre de un
-- periodo antes de tratar los numeros como definitivos: costo y conversiones
-- se mueven por latencia de procesamiento y por ajustes de atribucion.
-- En BHI y 360 pesa mas que el promedio, porque las conversiones offline
-- llegan semanas despues del clic.
create or replace function madurez_dato(p_fecha date)
returns text language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when current_date - p_fecha <= 2 then 'provisional'
    when current_date - p_fecha <= 6 then 'madurando'
    else 'consolidado'
  end;
$$;

comment on function madurez_dato(date) is 'provisional: el costo sirve, las conversiones no. madurando: mirar con reservas. consolidado: numero final. Nunca sacar conclusiones sobre conversiones de datos provisionales.';


create or replace view v_campaign_daily as
select
  account, date, campaign, status, channel, bid_strategy, currency,
  impressions, clicks, ctr, avg_cpc, avg_cpm, cost,
  conversions, cost_per_conv, conv_rate,
  impr_share, top_impr_share, abs_top_impr_share,
  lost_is_budget, lost_is_rank, click_share,
  case when lost_is_budget > lost_is_rank then 'presupuesto' else 'ranking' end as limitada_por,
  madurez_dato(date) as madurez,
  (current_date - date) as dias_transcurridos,
  extract(isodow from date)::int as dia_semana,
  to_char(date, 'TMDay') as nombre_dia
from campaign_daily;

comment on view v_campaign_daily is 'Campanas por dia con marca de madurez. Al analizar, filtrar madurez = consolidado para conclusiones sobre conversiones; los dias provisionales sirven para vigilar gasto, no para juzgar rendimiento.';


create or replace view v_adgroup_daily as
select account, date, campaign, campaign_status, ad_group, ad_group_status,
       currency, impressions, clicks, ctr, avg_cpc, cost,
       conversions, cost_per_conv, conv_rate, impr_share,
       madurez_dato(date) as madurez,
       (current_date - date) as dias_transcurridos
from adgroup_daily;


create or replace view v_conversiones_diarias as
select account, date, campaign, conversion_action, category, currency, conversions,
       madurez_dato(date) as madurez,
       (current_date - date) as dias_transcurridos
from conversion_actions_daily;


-- Serie diaria agregada por cuenta: es la que alimenta el centro de mando
create or replace view v_serie_diaria as
select
  account, date,
  round(sum(cost), 2) as gasto,
  sum(clicks) as clics,
  sum(impressions) as impresiones,
  round(sum(conversions), 2) as conversiones,
  round(sum(cost) / nullif(sum(conversions), 0), 2) as cpa,
  round(sum(clicks)::numeric / nullif(sum(impressions), 0) * 100, 2) as ctr,
  round(sum(cost) / nullif(sum(clicks), 0), 2) as cpc,
  round(avg(lost_is_budget), 2) as perdido_presupuesto,
  round(avg(lost_is_rank), 2) as perdido_ranking,
  madurez_dato(date) as madurez,
  extract(isodow from date)::int as dia_semana
from campaign_daily
where status = 'ENABLED'
group by account, date;

comment on view v_serie_diaria is 'Serie diaria por cuenta, solo campanas activas. Base del centro de mando y del analisis de patrones por dia de la semana.';


-- Cruce entre cambios y rendimiento: responde si un movimiento lo causo
-- un cambio propio o el mercado, que es la primera pregunta ante cualquier
-- variacion.
create or replace view v_dia_con_cambios as
select
  s.account, s.date, s.gasto, s.conversiones, s.cpa, s.ctr, s.madurez,
  coalesce(c.cantidad_cambios, 0) as cambios_ese_dia,
  coalesce(c.incluye_auto_google, false) as hubo_cambio_automatico,
  c.campos_tocados,
  lag(s.cpa) over (partition by s.account order by s.date) as cpa_dia_previo,
  round(s.cpa - lag(s.cpa) over (partition by s.account order by s.date), 2) as delta_cpa
from v_serie_diaria s
left join v_change_annotations c
  on c.account = s.account and c.fecha = s.date::text;

comment on view v_dia_con_cambios is 'Cada dia con su rendimiento y los cambios aplicados ese mismo dia. Si una metrica se movio y hubo un cambio en la misma ventana, la explicacion mas probable es el cambio, no el mercado.';;
