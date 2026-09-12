create or replace function v_location_ranking_bayes(p_account text, p_semanas int default 4)
returns table (location text, nombre text, objetivo text, clics numeric, conv numeric, gasto numeric,
  tasa_cruda numeric, tasa_ajustada numeric, cpa_crudo numeric, cpa_ajustado numeric,
  evidencia text, puesto bigint, vs_mediana numeric, lectura text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with base as (
    select coalesce(v.location, '(sin local)') loc, l.nombre nom, v.objetivo obj,
           sum(v.clics)::numeric cl, sum(v.conversiones)::numeric cv, sum(v.gasto)::numeric g
    from v_por_location_semanal v left join locations l on l.account = v.account and l.codigo = v.location
    where v.account = p_account and v.week_start >= (select max(week_start) from campaign where account = p_account) - (p_semanas - 1) * 7
    group by 1, 2, 3
  ),
  prior as (select obj, (sum(cv) / nullif(sum(cl), 0))::numeric tasa_media, coalesce(var_samp(cv / nullif(cl, 0)), 0)::numeric varianza from base where cl > 0 group by obj),
  k as (select p.obj, p.tasa_media, greatest(30::numeric, least(500::numeric, case when p.varianza > 0 then p.tasa_media * (1 - p.tasa_media) / p.varianza else 200::numeric end)) k_clics from prior p),
  ajust as (select b.*, k.tasa_media, k.k_clics, ((b.cv + k.tasa_media * k.k_clics) / nullif(b.cl + k.k_clics, 0))::numeric tasa_aj from base b join k on k.obj = b.obj),
  med as (select obj, (percentile_cont(0.5) within group (order by tasa_aj))::numeric m from ajust group by obj)
  select a.loc, a.nom, a.obj, round(a.cl), round(a.cv, 1), round(a.g, 2),
    round(a.cv / nullif(a.cl, 0) * 100, 2), round(a.tasa_aj * 100, 2),
    round(a.g / nullif(a.cv, 0), 2), round(a.g / nullif(a.cl * a.tasa_aj, 0), 2),
    case when a.cl < a.k_clics * 0.3 then 'poca: la estimacion es casi el promedio de la cuenta'
         when a.cl < a.k_clics then 'media: la estimacion sigue tirando al promedio'
         else 'suficiente: el numero es del local' end,
    rank() over (partition by a.obj order by a.tasa_aj desc),
    round(a.tasa_aj / nullif(m.m, 0), 2),
    case when a.cl < a.k_clics * 0.3 then 'Sin evidencia suficiente para juzgarlo'
         when a.cv = 0 and a.cl >= a.k_clics then 'Cero conversiones con clics de sobra: revisar medicion antes que rendimiento'
         when a.tasa_aj > m.m * 1.4 then 'Rinde por encima del resto: candidato a escalar'
         when a.tasa_aj < m.m * 0.6 then 'Rinde por debajo del resto, ya ajustado por volumen'
         else 'En rango' end
  from ajust a join med m on m.obj = a.obj order by a.obj, 12;
$$;
comment on function v_location_ranking_bayes is 'Ranking de locales con encogimiento bayesiano empirico (James-Stein). Un local con poca evidencia se acerca al promedio de su objetivo en vez de aparecer primero o ultimo por azar. k_clics es la fuerza del prior, derivada de la varianza entre locales. Evita rankear ruido cuando cada local tiene menos de 30 conversiones al mes.';

create or replace function v_carteras_puja(p_account text, p_semanas int default 4)
returns table (grupo text, campanas int, lista text, clics numeric, conv numeric, gasto numeric, tasa numeric, cpa numeric, veredicto text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with base as (
    select campaign, objetivo, sum(clicks)::numeric cl, sum(conversions)::numeric cv, sum(cost)::numeric g
    from v_campana_resuelta where account = p_account and week_start >= (select max(week_start) from campaign where account = p_account) - (p_semanas - 1) * 7
    group by 1, 2 having sum(cost) > 0
  ),
  t as (select *, (cv / nullif(cl, 0))::numeric tasa from base),
  mediana as (select objetivo, (percentile_cont(0.5) within group (order by tasa))::numeric m from t where cl > 0 group by objetivo),
  clasif as (select t.*, case when t.cv = 0 and t.cl >= 100 then 'excluir_medicion_dudosa' when t.tasa >= m.m * 1.5 then 'alta' when t.tasa <= m.m * 0.5 then 'baja' else 'media' end tier from t join mediana m on m.objetivo = t.objetivo)
  select objetivo || ' - ' || tier, count(*)::int, left(string_agg(campaign, ', ' order by cv desc), 180),
    round(sum(cl)), round(sum(cv), 1), round(sum(g), 2),
    round(sum(cv) / nullif(sum(cl), 0) * 100, 2), round(sum(g) / nullif(sum(cv), 0), 2),
    case when tier = 'excluir_medicion_dudosa' then 'NO agrupar: cero conversiones con clics de sobra contamina la cartera entera'
         when sum(cv) >= 30 then 'Cartera viable: ' || round(sum(cv)) || ' conv/mes supera el umbral de 30'
         else 'Aun agrupadas no llegan a 30 conv/mes: dejar en Maximizar conversiones sin objetivo' end
  from clasif group by objetivo, tier order by objetivo, sum(g) desc;
$$;
comment on function v_carteras_puja is 'Agrupa campanas por objetivo y tramo de tasa de conversion para carteras de puja. El umbral de 30 conv/30 dias se cumple sobre la cartera, no sobre cada campana. No mezcla tasas dispares (Google pujaria mal en las dos) ni campanas con medicion dudosa (contaminan el pool).';

create or replace function v_geolift_pares(p_account text, p_min_semanas int default 8)
returns table (local_a text, local_b text, semanas int, correlacion numeric, gasto_a numeric, gasto_b numeric, apto text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with serie as (select coalesce(location, '(sin local)') loc, week_start, sum(conversiones)::numeric cv, sum(gasto)::numeric g from v_por_location_semanal where account = p_account group by 1, 2),
  pares as (select a.loc la, b.loc lb, count(*) n, corr(a.cv, b.cv)::numeric c, sum(a.g)::numeric ga, sum(b.g)::numeric gb
    from serie a join serie b on a.week_start = b.week_start and a.loc < b.loc group by a.loc, b.loc having count(*) >= p_min_semanas)
  select la, lb, n::int, round(c, 3), round(ga, 2), round(gb, 2),
    case when c >= 0.95 then 'Apto: correlacion sobre 0,95, el estandar de mercados pareados'
         when c >= 0.85 then 'Aceptable dentro de una canasta de control sintetico, no como par unico'
         else 'No apto' end
  from pares where c is not null and c >= 0.85 order by c desc limit 60;
$$;
comment on function v_geolift_pares is 'Pares de locales con series correlacionadas para armar el control sintetico de un test de incrementalidad. El estandar de mercados pareados pide 0,95; de 0,85 para arriba sirve dentro de una canasta ponderada. Requiere 8 semanas minimo, idealmente 26.';
select 'ok';;
