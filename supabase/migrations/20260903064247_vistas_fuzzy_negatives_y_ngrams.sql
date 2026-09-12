create extension if not exists fuzzystrmatch;

-- Detecta terminos que gastan y que se parecen a una negativa existente por
-- 1 o 2 caracteres. Resuelve el caso documentado en Karedo: la negativa decia
-- "gesetzlicher" y la keyword real era "gesetzliche", asi que no bloqueaba.
-- El filtro de longitud evita comparaciones inutiles entre frases muy distintas.
create or replace view v_fuzzy_negatives as
select
  st.account,
  st.week_start,
  st.search_term        as termino_con_gasto,
  n.negative_keyword    as negativa_similar,
  n.match_type          as concordancia_negativa,
  st.cost               as gasto_perdido,
  st.clicks,
  levenshtein(lower(st.search_term), lower(n.negative_keyword)) as letras_de_diferencia
from search_terms st
join negatives n
  on st.account = n.account
 and abs(length(st.search_term) - length(n.negative_keyword)) <= 2
where st.conversions = 0
  and st.cost > 0
  and levenshtein(lower(st.search_term), lower(n.negative_keyword)) between 1 and 2;

comment on view v_fuzzy_negatives is 'Terminos con gasto y sin conversion que difieren en 1 o 2 letras de una negativa ya cargada. Cada fila es una negativa que no esta bloqueando lo que deberia, casi siempre por singular/plural o declinacion. Aprendizaje ya documentado: en Karedo una negativa con "gesetzlicher" no bloqueaba "gesetzliche", y en 360 "cabina" no bloquea "cabinas".';

-- Descompone las frases de busqueda en palabras sueltas y suma el gasto por
-- palabra. Encuentra fugas que ningun termino individual revela porque el
-- gasto esta repartido entre decenas de frases distintas.
create or replace view v_ngrams_sin_conversion as
select
  account,
  week_start,
  palabra,
  count(distinct search_term) as terminos_distintos,
  round(sum(cost), 2)         as costo_total,
  sum(clicks)                 as clics_totales
from (
  select account, week_start, search_term, cost, clicks, conversions,
         regexp_split_to_table(lower(search_term), '\s+') as palabra
  from search_terms
  where cost > 0
) sub
where length(palabra) > 2
group by account, week_start, palabra
having sum(conversions) = 0 and count(distinct search_term) > 1
order by costo_total desc;

comment on view v_ngrams_sin_conversion is 'Palabras sueltas que aparecen en varios terminos de busqueda, acumulan gasto y no traen ninguna conversion. Encuentra fugas invisibles: ningun termino individual llama la atencion, pero la palabra suma. Candidatas a negativa amplia. El umbral de gasto se aplica al consultar, porque las monedas difieren entre cuentas.';;
