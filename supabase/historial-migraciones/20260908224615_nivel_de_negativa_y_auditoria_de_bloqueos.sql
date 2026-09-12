-- BUG DE LOGICA encontrado el 8 sep 2026 al ir a ejecutar un accionable real.
--
-- Un termino NO se comporta igual en cada grupo, y el veredicto se calculaba mirando el
-- termino dentro de su grupo pero la ACCION se proponia a nivel campana. El radio de la
-- accion es mas grande que el de la evidencia.
-- Caso testigo: "iclick travel" en BHI. En SEGURO EN EL EXTRANJERO quemo 14.667 CLP en un
-- clic sin convertir; en SEGURO SALUD INTERNACIONAL convirtio 3 veces con 3.966. Una
-- negativa de campana apaga las dos. El accionable proponia exactamente eso.
--
-- Se agrega conflicto_entre_grupos y el veredicto pasa a decir el NIVEL, no solo la accion.

create or replace view public.v_terminos_sin_cobertura as
with st as (
  select s.account, s.campaign, s.ad_group, s.search_term, s.triggered_keyword,
         sum(s.conversions) as conv, sum(s.cost) as cost, sum(s.clicks) as clicks
    from search_terms s
   where s.week_start > current_date - 30 and s.cost > 0
   group by 1,2,3,4,5
),
grupo as (
  select account, campaign, ad_group,
         sum(cost) as cost_grupo, sum(conv) as conv_grupo,
         sum(cost) / nullif(sum(conv), 0) as cpa_grupo
    from st group by 1,2,3
),
-- El mismo termino en OTROS grupos de la MISMA campana. Es lo que decide el nivel.
otros as (
  select account, campaign, search_term,
         count(distinct ad_group) as grupos_del_termino,
         sum(conv) as conv_en_la_campana,
         string_agg(distinct ad_group, ' | ') filter (where conv > 0) as grupos_donde_convierte
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
                ') y ninguna keyword del grupo lo cubre.'
         when s.palabras_cubiertas = 0 and s.conv > 0
           then 'REVISAR: no esta cubierto pero convierte peor que el grupo.'
         when s.palabras_cubiertas = 0 and s.conv = 0 and s.cost > 0
              and o.grupos_del_termino > 1 and o.conv_en_la_campana > 0
           then 'NEGATIVA SOLO A NIVEL GRUPO: ' || round(s.cost::numeric) || ' de gasto en ' || s.clicks ||
                ' clic(s) sin convertir AQUI, pero el mismo termino convierte ' ||
                round(o.conv_en_la_campana::numeric,1) || ' vez(ces) en ' || o.grupos_donde_convierte ||
                '. A nivel campana apagas las dos: ponerla solo en ' || s.ad_group || '.'
         when s.palabras_cubiertas = 0 and s.conv = 0 and s.cost > 0
           then 'CANDIDATO A NEGATIVA (nivel campana o grupo): ' || round(s.cost::numeric) || ' de gasto en ' ||
                s.clicks || ' clic(s), cero conversiones, y no convierte en ningun otro grupo de la campana.'
         when s.palabras_cubiertas < s.palabras_del_termino and s.conv = 0 and s.cost > 0
           then 'REVISAR: cobertura parcial y sin conversiones.'
         else 'CUBIERTO: la keyword que lo disparo contiene el tema del termino.'
       end as veredicto,
       case
         when s.palabras_cubiertas = 0 and s.conv > 0 and (s.cost / nullif(s.conv,0)) < g.cpa_grupo then 'crear'
         when s.palabras_cubiertas = 0 and s.conv = 0 and s.cost > 0 then 'negativa'
         when s.palabras_cubiertas = 0 then 'revisar'
         else 'ok'
       end as accion,
       -- --- nuevas, al final ---
       (o.grupos_del_termino > 1 and o.conv_en_la_campana > 0 and s.conv = 0) as conflicto_entre_grupos,
       case
         when s.conv = 0 and o.grupos_del_termino > 1 and o.conv_en_la_campana > 0 then 'grupo'
         when s.conv = 0 then 'campana'
         else null
       end as nivel_recomendado,
       o.grupos_donde_convierte
  from solape s
  join grupo g on g.account = s.account and g.campaign = s.campaign and g.ad_group = s.ad_group
  join otros o on o.account = s.account and o.campaign = s.campaign and o.search_term = s.search_term
  left join campaign_dim d on d.account = s.account and d.campaign = s.campaign;

comment on view public.v_terminos_sin_cobertura is
  'Terminos cuyo tema ninguna keyword del grupo cubre, con el veredicto Y EL NIVEL de la accion. nivel_recomendado dice grupo cuando el mismo termino convierte en otro grupo de la campana: ahi una negativa de campana apaga tambien el lado que funciona. El radio de la accion tiene que ser el radio de la evidencia.';

-- AUDITORIA: negativas ya puestas a nivel campana que alcanzan terminos que convirtieron
-- en algun grupo. Es lo que habria cazado el caso de 360, donde el grupo se llama
-- "Industry 2 - BTL y Stands" y hay negativas de campana para stand, stands, feria y ferias.
-- CUIDADO al leerla: el cruce usa ILIKE, que aproxima la concordancia de Google pero no la
-- replica. Un negativo en amplia puede dar falso positivo por subcadena. Y las conversiones
-- son de los 90 dias: si la negativa se puso despues, no se estan perdiendo hoy, pero la
-- negativa esta cortando trafico de un tipo que si convertia. Verificar en pantalla.
create or replace view public.v_negativas_que_bloquean as
with st as (
  select account, campaign, ad_group, search_term,
         sum(conversions) conv, sum(cost) cost
    from search_terms where week_start > current_date - 90 and cost > 0
   group by 1,2,3,4
),
neg as (
  select distinct account, campaign, negative_keyword, match_type
    from negatives
   where level = 'campaign' and week_start = (select max(week_start) from negatives)
)
select n.account, n.campaign, n.negative_keyword, n.match_type,
       round(sum(s.cost)::numeric) as gasto_de_lo_bloqueado_90d,
       round(sum(s.conv)::numeric, 1) as conversiones_de_lo_bloqueado_90d,
       count(distinct s.ad_group) as grupos_afectados,
       string_agg(distinct s.ad_group, ' | ') as en_grupos,
       'Negativa a nivel CAMPANA que alcanza terminos que convirtieron en ' ||
       string_agg(distinct s.ad_group, ' | ') ||
       '. Si ese grupo tiene que servir esas busquedas, la negativa va a nivel grupo en los otros, no en la campana. Cruce por ILIKE: verificar en pantalla antes de tocar.' as lectura
  from neg n
  join st s on s.account = n.account and s.campaign = n.campaign
   and s.search_term ilike '%' || n.negative_keyword || '%'
   and s.conv > 0
 group by 1,2,3,4;

comment on view public.v_negativas_que_bloquean is
  'Negativas puestas a nivel campana que alcanzan terminos que convirtieron en algun grupo de esa campana. El cruce es por ILIKE y aproxima la concordancia de Google: da falsos positivos con negativas en amplia, hay que verificar en pantalla. Existe porque una negativa de campana tiene un radio mayor que la evidencia que la motivo.';;
