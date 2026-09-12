-- CUANDO CREAR UN GRUPO NUEVO, medido en vez de intuido.
--
-- La senal: un termino de busqueda cuyo tema NO esta cubierto por la keyword que lo
-- disparo. Se mide por solape de palabras: si ninguna palabra significativa del termino
-- aparece en su keyword, el grupo esta comprando algo que no declara.
--
-- La decision NO usa umbrales inventados. Compara el CPA del termino contra el CPA del
-- grupo que lo sirve:
--   convierte MEJOR que el grupo y no esta cubierto -> merece su propia keyword o grupo
--   no convierte y gasta                            -> candidato a negativa
--   convierte peor                                  -> se mira, no se decide solo
--
-- Lo que motivo esta vista, con numeros del 8 sep 2026:
--   FRESH_MONKEE no tiene grupo de marca. 297 terminos de marca, 1.850 USD, el 64% del
--   gasto, servidos desde "Protein Shake - Traffic" en 16 campanas por keywords como
--   "smoothie" y "whey protein". Donde la marca SI tiene keyword propia (BOGO50_Corporate)
--   el CPA es 2,64; por genericas es 6,15. La misma marca, 2,3 veces mas cara.
--   BHI gasto 71.880 CLP en CINCO clics sin una conversion, en terminos sin cobertura.

create or replace view public.v_terminos_sin_cobertura as
with st as (
  select s.account, s.campaign, s.ad_group, s.search_term, s.triggered_keyword,
         sum(s.conversions) as conv, sum(s.cost) as cost, sum(s.clicks) as clicks
    from search_terms s
   where s.week_start > current_date - 30 and s.cost > 0
   group by 1,2,3,4,5
),
grupo as (   -- referencia: como rinde el grupo que sirve el termino
  select account, campaign, ad_group,
         sum(cost) as cost_grupo, sum(conv) as conv_grupo,
         sum(cost) / nullif(sum(conv), 0) as cpa_grupo
    from st group by 1,2,3
),
solape as (
  select st.*,
         (select count(*) from unnest(string_to_array(lower(st.search_term), ' ')) w
           where length(w) > 3 and lower(coalesce(st.triggered_keyword,'')) like '%' || w || '%') as palabras_cubiertas,
         (select count(*) from unnest(string_to_array(lower(st.search_term), ' ')) w
           where length(w) > 3) as palabras_del_termino
    from st
)
select s.account,
       d.location,
       s.campaign,
       s.ad_group,
       s.search_term,
       s.triggered_keyword,
       round(s.cost::numeric) as gasto_30d,
       round(s.conv::numeric, 1) as conversiones_30d,
       s.clicks,
       round((s.cost / nullif(s.conv, 0))::numeric, 2) as cpa_del_termino,
       round(g.cpa_grupo::numeric, 2) as cpa_del_grupo,
       round((s.cost / nullif(s.clicks, 0))::numeric) as cpc_promedio,
       s.palabras_cubiertas,
       s.palabras_del_termino,
       case
         when s.palabras_del_termino = 0 then 'termino de una sola palabra corta: no se puede medir el solape'
         when s.palabras_cubiertas = 0 and s.conv > 0 and (s.cost / nullif(s.conv,0)) < g.cpa_grupo
           then 'MERECE SU PROPIO GRUPO O KEYWORD: convierte mejor que el grupo (' ||
                round((s.cost/nullif(s.conv,0))::numeric,2) || ' contra ' || round(g.cpa_grupo::numeric,2) ||
                ') y ninguna keyword del grupo lo cubre. Comprarlo por concordancia amplia paga de mas y hunde la relevancia.'
         when s.palabras_cubiertas = 0 and s.conv > 0
           then 'REVISAR: no esta cubierto pero convierte peor que el grupo. Puede ser keyword propia o puede no valer la pena.'
         when s.palabras_cubiertas = 0 and s.conv = 0 and s.cost > 0
           then 'CANDIDATO A NEGATIVA: ' || round(s.cost::numeric) || ' de gasto en ' || s.clicks ||
                ' clic(s), cero conversiones, y ninguna keyword del grupo lo cubre.'
         when s.palabras_cubiertas < s.palabras_del_termino and s.conv = 0 and s.cost > 0
           then 'REVISAR: cobertura parcial y sin conversiones.'
         else 'CUBIERTO: la keyword que lo disparo contiene el tema del termino.'
       end as veredicto,
       case
         when s.palabras_cubiertas = 0 and s.conv > 0 and (s.cost / nullif(s.conv,0)) < g.cpa_grupo then 'crear'
         when s.palabras_cubiertas = 0 and s.conv = 0 and s.cost > 0 then 'negativa'
         when s.palabras_cubiertas = 0 then 'revisar'
         else 'ok'
       end as accion
  from solape s
  join grupo g on g.account = s.account and g.campaign = s.campaign and g.ad_group = s.ad_group
  left join campaign_dim d on d.account = s.account and d.campaign = s.campaign;

comment on view public.v_terminos_sin_cobertura is
  'Terminos de busqueda cuyo tema no esta cubierto por la keyword que los disparo, con el veredicto de si merecen keyword o grupo propio, o si son candidatos a negativa. La decision compara el CPA del termino contra el CPA del grupo que lo sirve, sin umbrales inventados. Es la respuesta medida a cuando crear un grupo nuevo.';;
