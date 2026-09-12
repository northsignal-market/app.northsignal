-- Solo se guardan las entidades CON actividad ese dia. Una keyword sin
-- impresiones no tiene nada que reportar, y filtrar por impresiones lleva
-- el volumen de ~149.000 filas anuales a menos de 6.000 sin perder dato.
-- La ausencia de una keyword en un dia significa cero actividad, no dato
-- faltante: eso hay que tenerlo presente al calcular promedios.

create table if not exists keywords_daily (
  id bigserial primary key,
  account text not null,
  date date not null,
  campaign text not null,
  ad_group text not null,
  keyword text not null,
  match_type text not null,
  keyword_status text, serving_status text, currency text,
  quality_score numeric, qs_ad_relevance text, qs_landing_page text, qs_expected_ctr text,
  impressions numeric, clicks numeric, ctr numeric, avg_cpc numeric, cost numeric,
  conversions numeric, cost_per_conv numeric, conv_rate numeric,
  impr_share numeric, top_impr_share numeric, lost_is_rank numeric,
  run_ts timestamptz default now()
);
create unique index if not exists uq_keywords_daily
  on keywords_daily (account, date, campaign, ad_group, keyword, match_type);
create index if not exists idx_keywords_daily_fecha on keywords_daily (account, date desc);
create index if not exists idx_keywords_daily_kw on keywords_daily (account, keyword);
alter table keywords_daily enable row level security;

comment on table keywords_daily is 'Keywords con actividad diaria. Solo filas con impresiones > 0: la ausencia de una keyword en una fecha significa cero actividad ese dia, no dato faltante. Permite ver el dia exacto en que una keyword empezo a gastar sin convertir, en lugar de enterarse al cierre de la semana.';


create table if not exists search_terms_daily (
  id bigserial primary key,
  account text not null,
  date date not null,
  campaign text not null,
  ad_group text not null,
  search_term text not null,
  match_type text, triggered_keyword text, currency text,
  impressions numeric, clicks numeric, ctr numeric, avg_cpc numeric, cost numeric,
  conversions numeric, cost_per_conv numeric,
  run_ts timestamptz default now()
);
create unique index if not exists uq_search_terms_daily
  on search_terms_daily (account, date, campaign, ad_group, search_term);
create index if not exists idx_search_terms_daily_fecha on search_terms_daily (account, date desc);
create index if not exists idx_search_terms_daily_term on search_terms_daily (account, search_term);
alter table search_terms_daily enable row level security;

comment on table search_terms_daily is 'Terminos de busqueda por dia, solo con impresiones. Habilita detectar un termino nuevo el dia que aparece en lugar del lunes siguiente, y ver cuando empezo a gastar uno que no convierte.';


-- ================================================================
-- VISTAS
-- ================================================================

create or replace view v_keywords_daily as
select
  account, date, campaign, ad_group, keyword, match_type,
  keyword_status, serving_status, currency, quality_score,
  impressions, clicks, ctr, avg_cpc, cost,
  conversions, cost_per_conv, conv_rate, impr_share, top_impr_share, lost_is_rank,
  madurez_dato(date) as madurez,
  (current_date - date) as dias_transcurridos,
  case
    when conversions = 0 and cost > 0 then 'Gasta sin convertir'
    when quality_score <= 4 and cost > 0 then 'Quality Score bajo'
    else null
  end as motivo
from keywords_daily;


create or replace view v_search_terms_daily as
select
  account, date, campaign, ad_group, search_term, match_type, triggered_keyword,
  currency, impressions, clicks, ctr, avg_cpc, cost, conversions, cost_per_conv,
  madurez_dato(date) as madurez,
  (current_date - date) as dias_transcurridos,
  case when conversions = 0 and cost > 0 then 'Gasta sin convertir' else null end as clasificacion
from search_terms_daily;


-- Terminos que aparecen por primera vez. Es la vista que justifica la
-- granularidad diaria: un termino nuevo con gasto se ve el dia que surge,
-- no al cierre de la semana.
create or replace view v_terminos_nuevos as
with primera as (
  select account, search_term, min(date) as primera_aparicion
  from search_terms_daily group by account, search_term
)
select
  p.account, p.search_term, p.primera_aparicion,
  (current_date - p.primera_aparicion) as dias_desde_aparicion,
  round(sum(s.cost), 2) as gasto_acumulado,
  sum(s.clicks) as clics_acumulados,
  round(sum(s.conversions), 2) as conversiones_acumuladas
from primera p
join search_terms_daily s
  on s.account = p.account and s.search_term = p.search_term
where p.primera_aparicion >= current_date - 14
group by p.account, p.search_term, p.primera_aparicion
order by gasto_acumulado desc;

comment on view v_terminos_nuevos is 'Terminos que aparecieron por primera vez en los ultimos 14 dias, con su gasto acumulado desde entonces. Un termino nuevo que ya gasto sin convertir es candidato inmediato a negativa.';


-- Evolucion diaria de una keyword: detecta deterioro gradual, que es
-- justamente lo que ningun umbral fijo alcanza a ver porque cada dia
-- individual se ve normal.
create or replace view v_keyword_tendencia as
select
  account, keyword, campaign, ad_group, match_type,
  count(*) as dias_con_actividad,
  min(date) as primer_dia,
  max(date) as ultimo_dia,
  round(sum(cost), 2) as gasto_total,
  sum(clicks) as clics_total,
  round(sum(conversions), 2) as conversiones_total,
  round(sum(cost) / nullif(sum(conversions), 0), 2) as cpa_periodo,
  round(avg(quality_score), 1) as qs_promedio,
  round(avg(ctr), 2) as ctr_promedio
from keywords_daily
group by account, keyword, campaign, ad_group, match_type;

comment on view v_keyword_tendencia is 'Acumulado por keyword sobre el rango disponible. dias_con_actividad indica en cuantos dias tuvo impresiones: una keyword con gasto alto concentrado en pocos dias se comporta distinto de una con gasto parejo, y esa diferencia no se ve en el agregado semanal.';;
