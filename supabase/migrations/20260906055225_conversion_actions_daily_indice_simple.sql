-- PostgREST necesita un indice unico sobre columnas planas para ON CONFLICT.
-- Un indice de expresion con coalesce() no sirve. ad_group pasa a NOT NULL
-- con default '' y el indice es sobre las columnas directas.
drop index if exists uq_conversion_actions_daily;
update conversion_actions_daily set ad_group = '' where ad_group is null;
alter table conversion_actions_daily alter column ad_group set default '';
alter table conversion_actions_daily alter column ad_group set not null;
create unique index uq_conversion_actions_daily on conversion_actions_daily (account, date, campaign, ad_group, conversion_action, category);

-- La vista por grupo: filtrar '' en vez de null
create or replace view v_conversiones_por_grupo as
select account, date, campaign, ad_group, conversion_action, category, conversions, madurez_dato(date) as madurez
from conversion_actions_daily where ad_group <> '';

-- Verificar que el resto de indices unicos coincide con CONFLICT_KEYS del script
select tablename, indexdef from pg_indexes
where tablename in ('campaign_daily','adgroup_daily','conversion_actions_daily','budget_daily','keywords_daily','search_terms_daily','config_snapshot')
  and indexdef like '%UNIQUE%' order by tablename;;
