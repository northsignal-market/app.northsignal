create or replace view v_fuzzy_negatives as
select distinct on (st.account, st.search_term, n.negative_keyword)
  st.account,
  st.week_start,
  st.search_term        as termino_con_gasto,
  n.negative_keyword    as negativa_similar,
  n.match_type          as concordancia_negativa,
  st.cost               as gasto_perdido,
  st.clicks,
  levenshtein(lower(st.search_term), lower(n.negative_keyword)) as letras_de_diferencia,
  'REVISAR A MANO: una diferencia de 1-2 letras puede ser un error de tipeo del usuario sobre tu propia marca, que es trafico bueno, o una fuga real. No aplicar sin verificar.' as advertencia
from search_terms st
join negatives n
  on st.account = n.account
 and abs(length(st.search_term) - length(n.negative_keyword)) <= 2
where st.conversions = 0
  and st.cost > 0
  and levenshtein(lower(st.search_term), lower(n.negative_keyword)) between 1 and 2
order by st.account, st.search_term, n.negative_keyword, st.cost desc;

comment on view v_fuzzy_negatives is 'Terminos con gasto y sin conversion que difieren en 1 o 2 letras de una negativa ya cargada. NUNCA aplicar automaticamente: una diferencia de una letra puede ser un usuario escribiendo mal tu propia marca, que es trafico que queres. Ejemplo real detectado: "koredo" contra la negativa "karedo". Bloquearlo seria perder trafico de marca. Requiere revision humana siempre.';;
