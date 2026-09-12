create or replace view v_por_objetivo_semanal with (security_invoker = true) as
with conv as (
  select ca.account, ca.week_start, ca.campaign, o.objetivo, sum(ca.conversions) conv_obj, sum(ca.conv_value) valor_obj
  from conversion_actions ca join objetivos_conversion o on o.account = ca.account and ca.conversion_action = any(o.conversion_actions)
  group by 1,2,3,4
)
select v.account, v.week_start, v.objetivo, count(distinct v.campaign) campanas, sum(v.cost) gasto, sum(v.clicks) clics,
  coalesce(sum(cv.conv_obj), sum(v.conversions)) conversiones, coalesce(sum(cv.valor_obj), sum(v.conv_value)) valor,
  sum(v.cost) / nullif(coalesce(sum(cv.conv_obj), sum(v.conversions)), 0) cpa,
  coalesce(sum(cv.valor_obj), sum(v.conv_value)) / nullif(sum(v.cost), 0) roas
from v_campana_resuelta v left join conv cv on cv.account = v.account and cv.week_start = v.week_start and cv.campaign = v.campaign and cv.objetivo = v.objetivo
group by v.account, v.week_start, v.objetivo;

create or replace view v_por_location_semanal with (security_invoker = true) as
select v.account, v.week_start, coalesce(v.location, '(sin local)') location, l.nombre, v.objetivo, count(distinct v.campaign) campanas,
  sum(v.cost) gasto, sum(v.clicks) clics, sum(v.conversiones) conversiones, sum(v.cost) / nullif(sum(v.conversiones), 0) cpa
from (select account, week_start, campaign, cost, clicks, conversions conversiones, location, objetivo from v_campana_resuelta) v
left join locations l on l.account = v.account and l.codigo = v.location
group by v.account, v.week_start, v.location, l.nombre, v.objetivo;

create or replace function v_corporativas(p_account text, p_semanas int default 4)
returns table (campana text, objetivo text, gasto numeric, conv numeric, cpa numeric, pct_conv_cuenta numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  tot as (select sum(conversions)::numeric c from campaign, sem where account = p_account and week_start >= sem.w - (p_semanas - 1) * 7)
  select v.campaign, v.objetivo, round(sum(v.cost)::numeric, 2), round(sum(v.conversions)::numeric, 1),
    round(sum(v.cost)::numeric / nullif(sum(v.conversions), 0)::numeric, 2),
    round(sum(v.conversions)::numeric / nullif((select c from tot), 0) * 100, 1)
  from v_campana_resuelta v, sem
  where v.account = p_account and v.location is null and v.week_start >= sem.w - (p_semanas - 1) * 7 and v.cost > 0
  group by 1, 2 order by 3 desc;
$$;
select (select count(*) from v_por_objetivo_semanal where account='FRESH_MONKEE') obj_filas,
       (select count(*) from v_por_location_semanal where account='FRESH_MONKEE') loc_filas;;
