-- Ticket 29. keyword_status es un atributo MUTABLE y estaba en la clave unica.
-- El diario reextrae 14 dias en cada corrida y Google devuelve los dias historicos
-- con el estado ACTUAL de la keyword. Al pausarse una keyword, esos 14 dias vuelven
-- con PAUSED, no coinciden con las filas en ENABLED y se insertan al lado en vez de
-- actualizarlas. Resultado: la keyword se cuenta dos veces por dia.
-- Medido antes del arreglo: 26 grupos duplicados, todos en KAREDO, todos por cambio
-- de estado, 335,92 EUR de mas sobre 2.449,42 = 13,7%.
-- La columna se sigue guardando; deja de ser parte de la identidad de la fila.

-- 1. Quedarse con la extraccion mas reciente de cada (cuenta, dia, campana, grupo, keyword, concordancia).
--    La mas nueva es la correcta: mismas impresiones y costo, conversiones ya maduradas.
with ranked as (
  select id,
         row_number() over (
           partition by account, date, campaign, ad_group, keyword, match_type
           order by run_ts desc nulls last, id desc
         ) as rn
  from keywords_daily
)
delete from keywords_daily k
using ranked r
where k.id = r.id and r.rn > 1;

-- 2. La clave natural, sin el atributo mutable.
drop index if exists uq_keywords_daily;
create unique index uq_keywords_daily
  on public.keywords_daily (account, date, campaign, ad_group, keyword, match_type);

comment on index public.uq_keywords_daily is
  'Clave natural de keywords_daily. NO agregar keyword_status ni serving_status: son atributos mutables y Google devuelve los dias historicos con el estado actual, asi que al cambiar el estado el upsert inserta en vez de actualizar y el gasto se duplica. Ticket 29, 8 sep 2026.';;
