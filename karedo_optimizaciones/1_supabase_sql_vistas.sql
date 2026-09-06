-- 1. Habilitar extensión para comparar similitud de textos (Distancia de Levenshtein)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 2. Vista de Fuzzy Match (Caza-errores ortográficos)
-- Compara términos de búsqueda que gastaron dinero y no convirtieron, 
-- contra tu lista de palabras negativas. Si hay 1 o 2 letras de diferencia, te avisa.
CREATE OR REPLACE VIEW v_alertas_fuzzy_negatives AS
SELECT
    st.account,
    st.week_start,
    st.search_term AS termino_con_gasto,
    n.negative_keyword AS negativa_similar,
    st.cost AS gasto_perdido,
    st.clicks,
    levenshtein(st.search_term, n.negative_keyword) AS letras_de_diferencia
FROM search_terms st
JOIN negatives n ON st.account = n.account
WHERE st.conversions = 0
  AND st.cost > 0
  -- Solo términos que difieren en 1 o 2 caracteres (errores de tipeo/gramática)
  AND levenshtein(lower(st.search_term), lower(n.negative_keyword)) BETWEEN 1 AND 2;

-- 3. Vista de N-Grams (Palabras sueltas invisibles)
-- Rompe las frases de búsqueda en palabras individuales y suma cuánto gasta cada palabra aislada.
CREATE OR REPLACE VIEW v_search_term_1grams AS
SELECT
    account,
    week_start,
    palabra,
    COUNT(DISTINCT search_term) AS cantidad_terminos_distintos,
    SUM(cost) AS costo_total,
    SUM(clicks) AS clics_totales,
    SUM(conversions) AS conversiones_totales
FROM (
    SELECT
        account,
        week_start,
        search_term,
        cost,
        clicks,
        conversions,
        -- Esto divide la frase en palabras sueltas
        regexp_split_to_table(lower(search_term), '\s+') AS palabra
    FROM search_terms
    WHERE cost > 0
) sub
GROUP BY account, week_start, palabra
-- Filtro: Mostrar solo palabras que en total han gastado más de 15 EUR sin traer ni 1 conversión
HAVING SUM(conversions) = 0 AND SUM(cost) > 15
ORDER BY costo_total DESC;
