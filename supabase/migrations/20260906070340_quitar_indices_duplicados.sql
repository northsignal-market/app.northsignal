-- Ya existian con sufijo _fecha. Se quitan los que agregue con _acct_date.
drop index if exists idx_campaign_daily_acct_date;
drop index if exists idx_adgroup_daily_acct_date;
drop index if exists idx_keywords_daily_acct_date;
drop index if exists idx_search_terms_daily_acct_date;
drop index if exists idx_conv_daily_acct_date;
select count(*) as indices_daily from pg_indexes where tablename like '%_daily' and indexname like 'idx_%fecha';;
