-- PostgREST resuelve on_conflict por nombre de columna, no puede apuntar a
-- un indice con expresiones. Por eso las columnas de la clave se vuelven
-- NOT NULL con default vacio y el indice queda sobre columnas simples.
-- Ademas, en Postgres dos NULL se consideran distintos entre si, asi que
-- una clave con columnas nulables no impediria duplicados.

alter table search_terms_daily
  alter column match_type set default '',
  alter column triggered_keyword set default '';
update search_terms_daily set match_type = coalesce(match_type,''),
                              triggered_keyword = coalesce(triggered_keyword,'');
alter table search_terms_daily
  alter column match_type set not null,
  alter column triggered_keyword set not null;

drop index if exists uq_search_terms_daily;
create unique index uq_search_terms_daily
  on search_terms_daily (account, date, campaign, ad_group, search_term,
                         match_type, triggered_keyword);

alter table keywords_daily alter column keyword_status set default '';
update keywords_daily set keyword_status = coalesce(keyword_status,'');
alter table keywords_daily alter column keyword_status set not null;

drop index if exists uq_keywords_daily;
create unique index uq_keywords_daily
  on keywords_daily (account, date, campaign, ad_group, keyword, match_type, keyword_status);

alter table conversion_actions_daily alter column category set default '';
update conversion_actions_daily set category = coalesce(category,'');
alter table conversion_actions_daily alter column category set not null;

drop index if exists uq_conv_actions_daily;
create unique index uq_conv_actions_daily
  on conversion_actions_daily (account, date, campaign, conversion_action, category);

notify pgrst, 'reload schema';;
