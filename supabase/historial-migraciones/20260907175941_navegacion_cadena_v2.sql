create or replace function nav_objetivos(p_account text, p_semanas int default 4)
returns table (objetivo text, nombre text, metrica text, campanas int, campanas_activas int,
  gasto numeric, clics numeric, conv numeric, cpa numeric, roas numeric, locales int, gasto_prev numeric, conv_prev numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  act as (select v.objetivo o, sum(v.cost)::numeric g, sum(v.clicks)::numeric cl, count(distinct v.campaign)::int n, count(distinct v.location)::int nl
          from v_campana_resuelta v, sem where v.account = p_account and v.week_start > sem.w - p_semanas * 7 group by 1),
  prev as (select v.objetivo o, sum(v.cost)::numeric g, sum(v.conversions)::numeric cv
           from v_campana_resuelta v, sem where v.account = p_account and v.week_start > sem.w - p_semanas * 14 and v.week_start <= sem.w - p_semanas * 7 group by 1),
  cvs as (select x.objetivo o, sum(x.conversiones)::numeric cv, sum(x.valor)::numeric val
          from v_por_objetivo_semanal x, sem where x.account = p_account and x.week_start > sem.w - p_semanas * 7 group by 1)
  select a.o,
    coalesce((select nombre_humano from objetivos_conversion oc where oc.account = p_account and oc.objetivo = a.o), initcap(replace(a.o,'_',' '))),
    coalesce((select metrica_principal from objetivos_conversion oc where oc.account = p_account and oc.objetivo = a.o), 'cpa'),
    a.n, (select count(*)::int from campaign_fechas f join campaign_dim d on d.account = f.account and d.campaign = f.campaign where f.account = p_account and d.objetivo = a.o and f.estado_real = 'ENABLED'),
    round(a.g, 2), round(a.cl), round(coalesce(c.cv, 0), 1),
    round(a.g / nullif(c.cv, 0), 2), round(c.val / nullif(a.g, 0), 2),
    a.nl, round(coalesce(p.g, 0), 2), round(coalesce(p.cv, 0), 1)
  from act a left join cvs c on c.o = a.o left join prev p on p.o = a.o order by a.g desc;
$$;

create or replace function nav_campanas(p_account text, p_location text default null, p_objetivo text default null, p_semanas int default 4)
returns table (campana text, objetivo text, tipo text, location text, estado text, inicio date, fin date,
  gasto numeric, clics numeric, conv numeric, cpa numeric, ai_max boolean)
language sql stable security invoker set search_path = public, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  agg as (
    select v.campaign c, v.objetivo o, v.tipo t, v.location loc,
      sum(v.cost)::numeric g, sum(v.clicks)::numeric cl, sum(v.conversions)::numeric cv
    from v_campana_resuelta v, sem
    where v.account = p_account and v.week_start > sem.w - p_semanas * 7
      and (p_location is null or v.location = p_location) and (p_objetivo is null or v.objetivo = p_objetivo)
    group by 1,2,3,4)
  select a.c, a.o, a.t, a.loc, coalesce(f.estado_real, 'desconocido'), f.start_date, f.end_date,
    round(a.g, 2), round(a.cl), round(a.cv, 1), round(a.g / nullif(a.cv, 0), 2),
    exists (select 1 from google_live_events e where e.account = p_account and e.client_type = 'AI_MAX_SETTING' and e.entity_name = a.c)
  from agg a left join campaign_fechas f on f.account = p_account and f.campaign = a.c
  where a.g > 0 or coalesce(f.estado_real,'') = 'ENABLED' order by a.g desc;
$$;

create or replace function nav_grupos(p_account text, p_location text default null, p_campana text default null, p_semanas int default 4)
returns table (location text, campana text, grupo text, gasto numeric, clics numeric, conv numeric, cpa numeric, ctr numeric, keywords int)
language sql stable security invoker set search_path = public, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account)
  select g.location, g.campaign, g.ad_group,
    round(sum(g.cost)::numeric, 2), round(sum(g.clicks)::numeric), round(sum(g.conversions)::numeric, 1),
    round(sum(g.cost)::numeric / nullif(sum(g.conversions), 0)::numeric, 2),
    round(sum(g.clicks)::numeric / nullif(sum(g.impressions), 0)::numeric * 100, 2),
    (select count(distinct k.keyword)::int from v_keywords_resueltas k where k.account = p_account and k.campaign = g.campaign and k.ad_group = g.ad_group and k.week_start > (select w from sem) - p_semanas * 7)
  from v_grupos_resueltos g, sem
  where g.account = p_account and g.week_start > sem.w - p_semanas * 7
    and (p_location is null or g.location = p_location) and (p_campana is null or g.campaign = p_campana)
  group by 1,2,3 having sum(g.cost) > 0 order by sum(g.cost) desc;
$$;

create or replace function nav_keywords(p_account text, p_location text default null, p_campana text default null, p_grupo text default null, p_semanas int default 4)
returns table (location text, campana text, grupo text, keyword text, concordancia text, qs int,
  gasto numeric, clics numeric, conv numeric, cpa numeric, ctr numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account)
  select k.location, k.campaign, k.ad_group, k.keyword, k.match_type, max(k.quality_score)::int,
    round(sum(k.cost)::numeric, 2), round(sum(k.clicks)::numeric), round(sum(k.conversions)::numeric, 1),
    round(sum(k.cost)::numeric / nullif(sum(k.conversions), 0)::numeric, 2),
    round(sum(k.clicks)::numeric / nullif(sum(k.impressions), 0)::numeric * 100, 2)
  from v_keywords_resueltas k, sem
  where k.account = p_account and k.week_start > sem.w - p_semanas * 7
    and (p_location is null or k.location = p_location) and (p_campana is null or k.campaign = p_campana) and (p_grupo is null or k.ad_group = p_grupo)
  group by 1,2,3,4,5 having sum(k.cost) > 0 order by sum(k.cost) desc limit 300;
$$;

create or replace function nav_terminos(p_account text, p_location text default null, p_campana text default null, p_grupo text default null, p_semanas int default 4)
returns table (location text, campana text, grupo text, termino text, disparo_por text, concordancia text,
  gasto numeric, clics numeric, conv numeric, cpa numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account)
  select s.location, s.campaign, s.ad_group, s.search_term, s.triggered_keyword, s.match_type,
    round(sum(s.cost)::numeric, 2), round(sum(s.clicks)::numeric), round(sum(s.conversions)::numeric, 1),
    round(sum(s.cost)::numeric / nullif(sum(s.conversions), 0)::numeric, 2)
  from v_terminos_resueltos s, sem
  where s.account = p_account and s.week_start > sem.w - p_semanas * 7
    and (p_location is null or s.location = p_location) and (p_campana is null or s.campaign = p_campana) and (p_grupo is null or s.ad_group = p_grupo)
  group by 1,2,3,4,5,6 having sum(s.cost) > 0 order by sum(s.cost) desc limit 300;
$$;

create or replace function nav_contadores(p_account text, p_semanas int default 4)
returns table (dimension text, valor text, etiqueta text, n int, gasto numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  base as (select v.* from v_campana_resuelta v, sem where v.account = p_account and v.week_start > sem.w - p_semanas * 7 and v.cost > 0)
  select 'objetivo', b.objetivo, coalesce((select nombre_humano from objetivos_conversion oc where oc.account = p_account and oc.objetivo = b.objetivo), initcap(replace(b.objetivo,'_',' '))), count(distinct b.campaign)::int, round(sum(b.cost)::numeric, 2) from base b group by b.objetivo
  union all
  select 'local', coalesce(b.location, '(corporativa)'), coalesce((select nombre from locations l where l.account = p_account and l.codigo = b.location), coalesce(b.location, 'Corporativas')), count(distinct b.campaign)::int, round(sum(b.cost)::numeric, 2) from base b group by b.location
  union all
  select 'grupo_par', coalesce(l.grupo_par, 'sin_grupo'), initcap(replace(coalesce(l.grupo_par,'sin grupo'),'_',' ')), count(distinct b.campaign)::int, round(sum(b.cost)::numeric, 2)
  from base b left join locations l on l.account = p_account and l.codigo = b.location group by l.grupo_par
  order by 1, 5 desc;
$$;
select (select count(*) from nav_objetivos('FRESH_MONKEE')) objetivos, (select count(*) from nav_contadores('FRESH_MONKEE')) contadores, (select count(*) from nav_campanas('FRESH_MONKEE')) campanas;;
