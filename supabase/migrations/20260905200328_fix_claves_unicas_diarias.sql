-- El mismo termino de busqueda, el mismo dia y en el mismo grupo, puede
-- aparecer varias veces si lo activaron keywords distintas o con
-- concordancias distintas. La clave anterior los colapsaba y Postgres
-- rechazaba el lote entero: ON CONFLICT no puede tocar la misma fila
-- dos veces en un mismo comando.
drop index if exists uq_search_terms_daily;
create unique index uq_search_terms_daily
  on search_terms_daily (account, date, campaign, ad_group, search_term,
                         coalesce(match_type,''), coalesce(triggered_keyword,''));

-- Misma situacion posible en keywords: dos criterios con igual texto y
-- concordancia dentro del mismo grupo son raros pero validos.
drop index if exists uq_keywords_daily;
create unique index uq_keywords_daily
  on keywords_daily (account, date, campaign, ad_group, keyword, match_type,
                     coalesce(keyword_status,''));

-- Las acciones de conversion se segmentan por categoria: la misma accion
-- puede devolver mas de una fila por dia y campana.
drop index if exists uq_conv_actions_daily;
create unique index uq_conv_actions_daily
  on conversion_actions_daily (account, date, campaign, conversion_action,
                               coalesce(category,''));;
