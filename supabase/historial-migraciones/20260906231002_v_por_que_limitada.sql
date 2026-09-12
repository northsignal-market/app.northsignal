-- Por que una cuenta esta limitada por ranking: cual de los tres componentes del QS pesa mas, ponderado por gasto
create or replace view v_por_que_limitada as
with k as (
  select account, week_start, keyword, ad_group, cost, quality_score,
         case qs_expected_ctr when 'BELOW_AVERAGE' then 1 else 0 end as ctr_bajo,
         case qs_ad_relevance when 'BELOW_AVERAGE' then 1 else 0 end as rel_baja,
         case qs_landing_page when 'BELOW_AVERAGE' then 1 else 0 end as lp_baja
  from keywords where week_start = (select max(week_start) from keywords) and cost > 0 and quality_score is not null
),
agg as (
  select account, count(*) kws, sum(cost) gasto,
         round(sum(cost * ctr_bajo) / nullif(sum(cost), 0) * 100) pct_gasto_ctr_bajo,
         round(sum(cost * rel_baja) / nullif(sum(cost), 0) * 100) pct_gasto_rel_baja,
         round(sum(cost * lp_baja) / nullif(sum(cost), 0) * 100) pct_gasto_lp_baja,
         sum(ctr_bajo) n_ctr, sum(rel_baja) n_rel, sum(lp_baja) n_lp,
         round(avg(quality_score), 1) qs_promedio,
         round(sum(cost * quality_score) / nullif(sum(cost), 0), 1) qs_ponderado
  from k group by account
)
select a.*, h.veredicto as headroom,
  case
    when greatest(pct_gasto_ctr_bajo, pct_gasto_rel_baja, pct_gasto_lp_baja) < 15 then 'Los tres componentes estan en promedio o mejor. Si esta limitada por ranking, es por puja, no por calidad.'
    when pct_gasto_lp_baja = greatest(pct_gasto_ctr_bajo, pct_gasto_rel_baja, pct_gasto_lp_baja) then 'La landing pesa mas: ' || pct_gasto_lp_baja || '% del gasto va a keywords con experiencia de landing bajo el promedio (' || n_lp || ' de ' || kws || '). Es lo que solo el cliente puede cambiar.'
    when pct_gasto_rel_baja = greatest(pct_gasto_ctr_bajo, pct_gasto_rel_baja, pct_gasto_lp_baja) then 'La relevancia del anuncio pesa mas: ' || pct_gasto_rel_baja || '% del gasto va a keywords cuyo anuncio no las menciona (' || n_rel || ' de ' || kws || '). Se arregla con RSA que repitan la keyword.'
    else 'El CTR esperado pesa mas: ' || pct_gasto_ctr_bajo || '% del gasto va a keywords que Google espera que clickeen poco (' || n_ctr || ' de ' || kws || '). Titulares mas directos o concordancia mas cerrada.'
  end as por_que,
  (select coalesce(jsonb_agg(jsonb_build_object('keyword', keyword, 'grupo', ad_group, 'gasto', round(cost, 2), 'qs', quality_score, 'ctr', ctr_bajo = 1, 'rel', rel_baja = 1, 'lp', lp_baja = 1) order by cost desc), '[]')
   from (select * from k where k.account = a.account and (ctr_bajo + rel_baja + lp_baja) > 0 order by cost desc limit 8) x) as peores
from agg a left join v_headroom h on h.account = a.account;
comment on view v_por_que_limitada is 'Descompone "limitada por ranking" en su causa: CTR esperado, relevancia del anuncio o experiencia de landing, ponderado por gasto. Cada causa tiene un remedio distinto; la landing es la unica que depende del cliente.';
select account, qs_ponderado, pct_gasto_ctr_bajo, pct_gasto_rel_baja, pct_gasto_lp_baja, por_que from v_por_que_limitada;;
