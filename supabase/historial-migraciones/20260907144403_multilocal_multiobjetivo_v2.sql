create table if not exists locations (id bigserial primary key, account text not null, codigo text not null, nombre text not null, ciudad text, region text, pais text default 'US', zona_horaria text, activa boolean default true, presupuesto_mensual numeric, cpa_objetivo_visitas numeric, cpa_objetivo_online numeric, abrio date, notas text, unique (account, codigo));
alter table locations enable row level security; revoke all on locations from anon, authenticated;
create table if not exists objetivos_conversion (id bigserial primary key, account text not null, objetivo text not null check (objetivo in ('visitas','compra_online','llamadas','marca','leads','generico')), nombre_humano text not null, conversion_actions text[] not null, metrica_principal text not null default 'cpa' check (metrica_principal in ('cpa','roas','conversiones')), objetivo_valor numeric, unique (account, objetivo));
alter table objetivos_conversion enable row level security; revoke all on objetivos_conversion from anon, authenticated;
create table if not exists campaign_mapa (id bigserial primary key, account text not null, patron text not null, prioridad int default 100, location_codigo text, objetivo text not null default 'generico', tipo_campana text check (tipo_campana in ('search','pmax','pmax_store','shopping','video','demand_gen','display','local','otro')), activa boolean default true, nota text);
alter table campaign_mapa enable row level security; revoke all on campaign_mapa from anon, authenticated;
create or replace function resolver_campana(p_account text, p_campaign text) returns jsonb language sql stable set search_path = public, extensions as $$
  select coalesce((select jsonb_build_object('location', m.location_codigo, 'objetivo', m.objetivo, 'tipo', m.tipo_campana, 'patron', m.patron) from campaign_mapa m where m.account = p_account and m.activa and p_campaign ~* m.patron order by m.prioridad, length(m.patron) desc limit 1),
    jsonb_build_object('location', (select l.codigo from locations l where l.account = p_account and p_campaign ~* ('\m' || l.codigo || '\M') order by length(l.codigo) desc limit 1), 'objetivo', 'generico', 'tipo', null, 'patron', null));
$$;
create or replace view v_campana_resuelta with (security_invoker = true) as
select c.account, c.week_start, c.campaign, c.cost, c.clicks, c.impressions, c.conversions, c.conv_value, r->>'location' as location, r->>'objetivo' as objetivo, r->>'tipo' as tipo_campana from campaign c, lateral resolver_campana(c.account, c.campaign) r;
create or replace view v_por_objetivo_semanal with (security_invoker = true) as
with conv as (select ca.account, ca.week_start, ca.campaign, o.objetivo, sum(ca.conversions) conv_obj, sum(ca.conv_value) valor_obj from conversion_actions ca join objetivos_conversion o on o.account = ca.account and ca.conversion_action = any(o.conversion_actions) group by ca.account, ca.week_start, ca.campaign, o.objetivo)
select v.account, v.week_start, v.objetivo, count(distinct v.campaign) campanas, sum(v.cost) gasto, sum(v.clicks) clics, coalesce(sum(cv.conv_obj), sum(v.conversions)) conversiones, coalesce(sum(cv.valor_obj), sum(v.conv_value)) valor,
  sum(v.cost) / nullif(coalesce(sum(cv.conv_obj), sum(v.conversions)), 0) cpa, coalesce(sum(cv.valor_obj), sum(v.conv_value)) / nullif(sum(v.cost), 0) roas
from v_campana_resuelta v left join conv cv on cv.account = v.account and cv.week_start = v.week_start and cv.campaign = v.campaign and cv.objetivo = v.objetivo group by v.account, v.week_start, v.objetivo;
create or replace view v_por_location_semanal with (security_invoker = true) as
select v.account, v.week_start, coalesce(v.location, '(sin local)') location, l.nombre, v.objetivo, count(distinct v.campaign) campanas, sum(v.cost) gasto, sum(v.clicks) clics, sum(v.conversions) conversiones, sum(v.cost) / nullif(sum(v.conversions), 0) cpa
from v_campana_resuelta v left join locations l on l.account = v.account and l.codigo = v.location group by v.account, v.week_start, v.location, l.nombre, v.objetivo;
create or replace view v_location_ranking with (security_invoker = true) as
with base as (select account, location, nombre, objetivo, sum(gasto)::numeric gasto, sum(conversiones)::numeric conv, (sum(gasto) / nullif(sum(conversiones), 0))::numeric cpa from v_por_location_semanal where week_start >= (select max(week_start) from campaign) - 21 group by account, location, nombre, objetivo),
med as (select account, objetivo, (percentile_cont(0.5) within group (order by cpa))::numeric cpa_mediana from base where conv > 0 group by account, objetivo)
select b.*, m.cpa_mediana, round(b.cpa / nullif(m.cpa_mediana, 0), 2) cpa_vs_mediana,
  case when b.conv = 0 and b.gasto > 0 then 'sin conversiones con gasto' when b.cpa > m.cpa_mediana * 2 then 'CPA doble que la mediana' when b.cpa < m.cpa_mediana * 0.6 then 'rinde muy por encima: candidato a escalar' else 'en rango' end lectura,
  rank() over (partition by b.account, b.objetivo order by b.cpa nulls last) puesto
from base b left join med m on m.account = b.account and m.objetivo = b.objetivo;
insert into cuentas (account, nombre_cliente, cid, activa, moneda, zona_horaria, locale, idioma_reporte, frecuencia_reporte, canal_reporte, nucleo, reglas_dominio)
values ('FRESH_MONKEE', 'Fresh Monkee', null, false, 'USD', 'America/Chicago', 'en-US', 'es', 'semanal', 'email', '{fresh monkee, protein shake, protein smoothie, smoothie}',
  'Cadena multi-local en EE.UU. de batidos de proteina. Una cuenta, muchos locales: cada local tiene su economia; nunca un CPA unico de cuenta. Objetivos distintos por campana (visitas y direcciones, compra online, llamadas): se juzga cada uno con su metrica (objetivos_conversion). Ranking de locales por objetivo (v_location_ranking) con minimo de gasto antes de opinar. Convencion de nombres con codigo de local obligatoria. Meta Ads fuera de este sistema por ahora.')
on conflict (account) do update set nucleo = excluded.nucleo, reglas_dominio = excluded.reglas_dominio, moneda = excluded.moneda, locale = excluded.locale;
insert into account_targets (account, cpa_maximo, conversiones_mes_objetivo, cpa_maximo_origen) values ('FRESH_MONKEE', null, null, 'pendiente') on conflict (account) do nothing;
insert into objetivos_conversion (account, objetivo, nombre_humano, conversion_actions, metrica_principal) values
  ('FRESH_MONKEE', 'visitas', 'Visitas y direcciones', '{Store visits, Get directions, Directions}', 'cpa'), ('FRESH_MONKEE', 'compra_online', 'Compra online', '{Purchase, Online order, Order}', 'roas'), ('FRESH_MONKEE', 'llamadas', 'Llamadas', '{Calls from ads, Phone calls, Click to call}', 'cpa')
on conflict (account, objetivo) do nothing;;
