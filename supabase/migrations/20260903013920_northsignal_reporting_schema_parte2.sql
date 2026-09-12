create table if not exists device (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  device text, currency text, impressions numeric, clicks numeric, ctr numeric,
  avg_cpc numeric, cost numeric, conversions numeric, conv_value numeric,
  cost_per_conv numeric, conv_rate numeric, run_ts text);
create index if not exists idx_device_acct on device (account, week_start);

create table if not exists hour_day (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  day_of_week text, hour numeric, currency text, impressions numeric, clicks numeric,
  ctr numeric, cost numeric, conversions numeric, conv_value numeric,
  cost_per_conv numeric, run_ts text);
create index if not exists idx_hour_day_acct on hour_day (account, week_start);

create table if not exists geo (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  location text, location_type text, currency text, impressions numeric, clicks numeric,
  ctr numeric, cost numeric, conversions numeric, conv_value numeric,
  cost_per_conv numeric, run_ts text);
create index if not exists idx_geo_acct on geo (account, week_start);

create table if not exists landing_pages (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  landing_page text, currency text, impressions numeric, clicks numeric, ctr numeric,
  cost numeric, conversions numeric, conv_value numeric, cost_per_conv numeric,
  run_ts text);
create index if not exists idx_landing_pages_acct on landing_pages (account, week_start);

create table if not exists audiences (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  ad_group text, audience text, type text, bid_modifier numeric, currency text,
  impressions numeric, clicks numeric, ctr numeric, cost numeric, conversions numeric,
  conv_value numeric, run_ts text);
create index if not exists idx_audiences_acct on audiences (account, week_start);

create table if not exists budget (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  daily_budget numeric, expected_week numeric, actual_cost numeric, pacing_pct numeric,
  delivery_method text, currency text, lost_is_budget numeric, run_ts text);
create index if not exists idx_budget_acct on budget (account, week_start);

create table if not exists change_events (
  id bigserial primary key, change_datetime text, account text, user_email text,
  client_type text, resource_type text, operation text, changed_field text,
  old_value text, new_value text, campaign text, ad_group text, run_ts text);
create index if not exists idx_change_events_acct on change_events (account);

create table if not exists weekly_brief (
  id bigserial primary key, account text, week_start date, week_end date, section text,
  item text, detail text, value text, prev_value text, delta_pct text, note text,
  run_ts text);
create index if not exists idx_weekly_brief_acct on weekly_brief (account, week_start);

create table if not exists account_state (
  id bigserial primary key, account text, section text, item text, value text,
  detail text, run_ts text);
create index if not exists idx_account_state_acct on account_state (account);

create table if not exists alerts (
  id bigserial primary key, week_start date, week_end date, account text, severity text,
  type text, entity text, detail text, value text, threshold text, run_ts text);
create index if not exists idx_alerts_acct on alerts (account, week_start);;
