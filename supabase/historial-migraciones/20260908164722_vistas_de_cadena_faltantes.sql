-- Estas cuatro estaban DOCUMENTADAS en notas_de_objetos y nunca se crearon.
-- El diccionario las ofrecia, el prompt de Fresh las nombraba, y el agente que
-- las consultaba recibia un error y perdia la corrida.
create or replace view v_carteras_puja with (security_invoker = true) as
select d.account, d.objetivo,
  case when c.bid_strategy ilike '%value%' then 'maximizar valor'
       when c.bid_strategy ilike '%conversion%' then 'maximizar conversiones'
       when c.bid_strategy ilike '%clicks%' or c.bid_strategy ilike '%spend%' then 'maximizar clics'
       else coalesce(nullif(c.bid_strategy,''), 'sin definir') end estrategia,
  count(distinct c.campaign) campanas, round(sum(c.cost)::numeric, 2) gasto,
  round(sum(c.conversions)::numeric, 1) conversiones,
  round((sum(c.cost) / nullif(sum(c.conversions), 0))::numeric, 2) cpa
from campaign c join campaign_dim d on d.account = c.account and d.campaign = c.campaign
where c.week_start > (select max(week_start) from campaign x where x.account = c.account) - 28
group by 1, 2, 3;
comment on view v_carteras_puja is 'Campanas por objetivo y estrategia de puja. Mezclar estrategias dentro de un objetivo hace que el CPA promedio no signifique nada.';

create or replace view v_corporativas with (security_invoker = true) as
select c.account, c.campaign, d.objetivo, round(sum(c.cost)::numeric,2) gasto,
  round(sum(c.conversions)::numeric,1) conversiones
from campaign c join campaign_dim d on d.account = c.account and d.campaign = c.campaign
where d.location is null and c.week_start > (select max(week_start) from campaign x where x.account = c.account) - 28
group by 1, 2, 3;
comment on view v_corporativas is 'Campana SIN local asignado: la paga la empresa, no un franquiciado. Se saca del ranking porque no compite en el mismo tablero.';

create or replace view v_keywords_entre_locales with (security_invoker = true) as
select k.account, k.keyword,
  count(distinct d.location) en_locales,
  count(distinct d.location) filter (where k.conversions > 0) convierte_en,
  round(sum(k.cost)::numeric, 2) gasto_total,
  round(sum(k.conversions)::numeric, 1) conversiones
from keywords k join campaign_dim d on d.account = k.account and d.campaign = k.campaign
where k.week_start > (select max(week_start) from keywords x where x.account = k.account) - 28
group by 1, 2 having count(distinct d.location) > 1;
comment on view v_keywords_entre_locales is 'Una keyword que corre en muchos locales y convierte en pocos es candidata a revision por local, no a pausa global.';

create or replace view v_location_ranking_bayes with (security_invoker = true) as
with base as (
  select d.account, d.location, d.objetivo,
    sum(c.cost) gasto, sum(c.conversions) conv, sum(c.conv_value) valor
  from campaign c join campaign_dim d on d.account = c.account and d.campaign = c.campaign
  where d.location is not null and c.week_start > (select max(week_start) from campaign x where x.account = c.account) - 28
  group by 1,2,3),
grupo as (
  select account, objetivo, sum(gasto)/nullif(sum(conv),0) cpa_grupo, count(*) locales
  from base group by 1,2)
select b.account, b.location local, b.objetivo, b.objetivo grupo_par,
  round(b.gasto::numeric,2) gasto_4sem, round(b.conv::numeric,1) conv_4sem,
  round((b.gasto/nullif(b.conv,0))::numeric,2) cpa_crudo,
  -- Encogimiento hacia el CPA del grupo: con pocas conversiones el CPA crudo es
  -- ruido. Con k=10, un local con 10 conversiones pesa la mitad y el grupo la otra.
  round(((b.gasto + 10 * coalesce(g.cpa_grupo,0)) / nullif(b.conv + 10, 0))::numeric, 2) cpa_ajustado,
  g.locales en_el_grupo,
  case when b.conv < 5 then 'volumen bajo: el CPA crudo es ruido, mirar el ajustado'
       else 'volumen suficiente' end lectura
from base b join grupo g on g.account = b.account and g.objetivo = b.objetivo;
comment on view v_location_ranking_bayes is 'Ranking de locales con encogimiento hacia el CPA de su grupo de pares. El CPA crudo de un local con 3 conversiones es ruido; el ajustado lo corrige.';

create or replace view v_notas_fantasma with (security_invoker = true) as
select n.objeto, n.capa, left(n.usar_para, 80) usar_para,
  'Documentado en notas_de_objetos y NO EXISTE en el esquema. Un agente que lo consulte pierde la corrida. O se crea el objeto, o se borra la nota.' lectura
from notas_de_objetos n
where not exists (select 1 from pg_views v where v.schemaname='public' and v.viewname = n.objeto)
  and not exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname = n.objeto)
  and not exists (select 1 from information_schema.tables t where t.table_schema='public' and t.table_name = n.objeto);
comment on view v_notas_fantasma is 'Objetos documentados que no existen. Nacio de encontrar 4 vistas de cadena documentadas y nunca creadas.';

select 1;;
