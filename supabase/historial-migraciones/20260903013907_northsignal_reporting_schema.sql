create table if not exists campaign (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  status text, channel text, bid_strategy text, currency text, impressions numeric,
  clicks numeric, ctr numeric, avg_cpc numeric, avg_cpm numeric, cost numeric,
  conversions numeric, all_conversions numeric, conv_value numeric, cost_per_conv numeric,
  conv_rate numeric, roas numeric, impr_share numeric, top_impr_share numeric,
  abs_top_impr_share numeric, lost_is_budget numeric, lost_is_rank numeric,
  click_share numeric, run_ts text);
create index if not exists idx_campaign_acct on campaign (account, week_start);

create table if not exists adgroup (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  campaign_status text, ad_group text, ad_group_status text, ad_group_type text,
  currency text, impressions numeric, clicks numeric, ctr numeric, avg_cpc numeric,
  cost numeric, conversions numeric, all_conversions numeric, conv_value numeric,
  cost_per_conv numeric, conv_rate numeric, impr_share numeric, run_ts text);
create index if not exists idx_adgroup_acct on adgroup (account, week_start);

create table if not exists keywords (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  campaign_status text, ad_group text, ad_group_status text, criterion_id numeric,
  keyword text, match_type text, keyword_status text, serving_status text,
  approval_status text, final_url text, currency text, effective_cpc_bid numeric,
  bid_source text, est_first_page_cpc numeric, est_top_of_page_cpc numeric,
  est_first_position_cpc numeric, quality_score numeric, qs_ad_relevance numeric,
  qs_landing_page numeric, qs_expected_ctr numeric, impressions numeric, clicks numeric,
  ctr numeric, avg_cpc numeric, cost numeric, conversions numeric, all_conversions numeric,
  conv_value numeric, cost_per_conv numeric, conv_rate numeric, impr_share numeric,
  top_impr_share numeric, lost_is_rank numeric, run_ts text);
create index if not exists idx_keywords_acct on keywords (account, week_start);

create table if not exists bid_targets (
  id bigserial primary key, week_start date, week_end date, account text, level text,
  campaign text, ad_group text, status text, bid_strategy text, target_cpa numeric,
  target_roas numeric, target_source text, cpc_bid_or_budget numeric, currency text,
  run_ts text);
create index if not exists idx_bid_targets_acct on bid_targets (account, week_start);

create table if not exists simulations (
  id bigserial primary key, account text, campaign text, sim_type text,
  modification_method text, start_date date, end_date date, target_value numeric,
  est_conversions numeric, est_conv_value numeric, est_clicks numeric, est_cost numeric,
  est_impressions numeric, est_top_slot_impressions numeric, currency text, run_ts text);
create index if not exists idx_simulations_acct on simulations (account);

create table if not exists negatives (
  id bigserial primary key, week_start date, account text, level text, campaign text,
  ad_group text, negative_keyword text, match_type text, run_ts text);
create index if not exists idx_negatives_acct on negatives (account, week_start);

create table if not exists search_terms (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  ad_group text, search_term text, match_type text, triggered_keyword text, currency text,
  impressions numeric, clicks numeric, ctr numeric, avg_cpc numeric, cost numeric,
  conversions numeric, conv_value numeric, cost_per_conv numeric, run_ts text);
create index if not exists idx_search_terms_acct on search_terms (account, week_start);

create table if not exists ads (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  ad_group text, ad_id numeric, ad_type text, ad_strength text, status text, currency text,
  impressions numeric, clicks numeric, ctr numeric, avg_cpc numeric, cost numeric,
  conversions numeric, conv_value numeric, cost_per_conv numeric, run_ts text);
create index if not exists idx_ads_acct on ads (account, week_start);

create table if not exists rsa_assets (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  ad_group text, field_type text, performance_label text, asset_text text, currency text,
  impressions numeric, clicks numeric, ctr numeric, cost numeric, conversions numeric,
  run_ts text);
create index if not exists idx_rsa_assets_acct on rsa_assets (account, week_start);

create table if not exists conversion_actions (
  id bigserial primary key, week_start date, week_end date, account text, campaign text,
  conversion_action text, category text, currency text, conversions numeric,
  all_conversions numeric, conv_value numeric, all_conv_value numeric, run_ts text);
create index if not exists idx_conversion_actions_acct on conversion_actions (account, week_start);;
