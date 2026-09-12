drop view if exists v_campana_resuelta cascade;
create view v_campana_resuelta with (security_invoker = true) as
select c.account, c.week_start, c.campaign, c.cost, c.clicks, c.impressions, c.conversions, c.conv_value,
  d.location, coalesce(d.objetivo, 'generico') objetivo, d.tipo_campana tipo
from campaign c left join campaign_dim d on d.account = c.account and d.campaign = c.campaign;

create or replace view v_keywords_resueltas with (security_invoker = true) as
select k.account, k.week_start, d.location, coalesce(d.objetivo,'generico') objetivo,
  k.campaign, k.ad_group, k.keyword, k.match_type, k.quality_score,
  k.impressions, k.clicks, k.ctr, k.avg_cpc, k.cost, k.conversions, k.conv_value, k.cost_per_conv
from keywords k left join campaign_dim d on d.account = k.account and d.campaign = k.campaign;

create or replace view v_terminos_resueltos with (security_invoker = true) as
select s.account, s.week_start, d.location, coalesce(d.objetivo,'generico') objetivo,
  s.campaign, s.ad_group, s.search_term, s.match_type, s.triggered_keyword,
  s.impressions, s.clicks, s.ctr, s.avg_cpc, s.cost, s.conversions, s.conv_value
from search_terms s left join campaign_dim d on d.account = s.account and d.campaign = s.campaign;

create or replace view v_grupos_resueltos with (security_invoker = true) as
select a.account, a.week_start, d.location, coalesce(d.objetivo,'generico') objetivo,
  a.campaign, a.ad_group, a.impressions, a.clicks, a.ctr, a.avg_cpc, a.cost,
  a.conversions, a.conv_value, a.cost_per_conv, a.conv_rate, a.impr_share
from adgroup a left join campaign_dim d on d.account = a.account and d.campaign = a.campaign;

create or replace function v_keywords_entre_locales(p_account text, p_semanas int default 4)
returns table (keyword text, match_type text, locales int, locales_que_convierten int,
  clics numeric, conv numeric, gasto numeric, cpa numeric, tasa numeric, lectura text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with base as (
    select k.keyword kw, k.match_type mt, k.location loc, sum(k.clicks)::numeric cl, sum(k.conversions)::numeric cv, sum(k.cost)::numeric g
    from v_keywords_resueltas k
    where k.account = p_account and k.week_start >= (select max(week_start) from campaign where account = p_account) - (p_semanas - 1) * 7 and k.cost > 0
    group by 1, 2, 3
  ),
  agg as (select kw, mt, count(distinct loc)::int n_loc, count(distinct loc) filter (where cv > 0)::int n_conv, sum(cl) cl, sum(cv) cv, sum(g) g from base group by 1, 2)
  select kw, mt, n_loc, n_conv, round(cl), round(cv, 1), round(g, 2),
    round(g / nullif(cv, 0), 2), round(cv / nullif(cl, 0) * 100, 2),
    case when n_loc = 1 then 'Solo en un local'
         when n_conv = 0 then 'En ' || n_loc || ' locales y no convierte en ninguno: revisar en toda la cuenta'
         when n_conv::numeric / n_loc < 0.34 then 'Convierte en ' || n_conv || ' de ' || n_loc || ' locales: funciona en algunos mercados, no en todos'
         else 'Convierte en ' || n_conv || ' de ' || n_loc || ' locales: consistente' end
  from agg order by g desc;
$$;
select cron.unschedule(jobid) from cron.job where jobname = 'campaign_dim';
select cron.schedule('campaign_dim', '18 9 * * *', $$select campaign_dim_refrescar()$$);
select count(*) campanas_en_dim from campaign_dim;;
