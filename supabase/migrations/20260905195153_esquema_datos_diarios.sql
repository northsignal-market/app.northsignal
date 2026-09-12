-- ================================================================
-- CAPA DIARIA
-- ================================================================
-- Desde el 1 de junio de 2026 Google Ads retiene datos granulares
-- (diarios, semanales, por hora) solo 37 meses. Este esquema es el
-- archivo permanente: lo que no se guarde aca, se pierde.
--
-- Los datos NO son finales el dia que cierran: costo y conversiones
-- fluctuan varios dias por latencia de procesamiento y ajustes de
-- atribucion. Por eso el script reextrae una ventana movil y hace
-- upsert; las claves unicas de abajo son lo que hace posible esa
-- correccion sin duplicar.
-- ================================================================

create table if not exists campaign_daily (
  id bigserial primary key,
  account text not null,
  date date not null,
  campaign text not null,
  status text, channel text, bid_strategy text, currency text,
  impressions numeric, clicks numeric, ctr numeric,
  avg_cpc numeric, avg_cpm numeric, cost numeric,
  conversions numeric, cost_per_conv numeric, conv_rate numeric,
  impr_share numeric, top_impr_share numeric, abs_top_impr_share numeric,
  lost_is_budget numeric, lost_is_rank numeric, click_share numeric,
  run_ts timestamptz default now()
);
create unique index if not exists uq_campaign_daily
  on campaign_daily (account, date, campaign);
create index if not exists idx_campaign_daily_fecha
  on campaign_daily (account, date desc);
alter table campaign_daily enable row level security;

comment on table campaign_daily is 'Rendimiento diario por campana. Se reextrae en ventana movil de 14 dias con upsert sobre (account, date, campaign): los dias recientes se corrigen solos a medida que Google asienta conversiones y ajusta atribucion. No expone conv_value, all_conversions ni roas, igual que la capa semanal.';


create table if not exists adgroup_daily (
  id bigserial primary key,
  account text not null,
  date date not null,
  campaign text not null,
  ad_group text not null,
  campaign_status text, ad_group_status text, currency text,
  impressions numeric, clicks numeric, ctr numeric, avg_cpc numeric,
  cost numeric, conversions numeric, cost_per_conv numeric,
  conv_rate numeric, impr_share numeric,
  run_ts timestamptz default now()
);
create unique index if not exists uq_adgroup_daily
  on adgroup_daily (account, date, campaign, ad_group);
create index if not exists idx_adgroup_daily_fecha
  on adgroup_daily (account, date desc);
alter table adgroup_daily enable row level security;


create table if not exists conversion_actions_daily (
  id bigserial primary key,
  account text not null,
  date date not null,
  campaign text not null,
  conversion_action text not null,
  category text, currency text,
  conversions numeric,
  run_ts timestamptz default now()
);
create unique index if not exists uq_conv_actions_daily
  on conversion_actions_daily (account, date, campaign, conversion_action);
create index if not exists idx_conv_actions_daily_fecha
  on conversion_actions_daily (account, date desc);
alter table conversion_actions_daily enable row level security;

comment on table conversion_actions_daily is 'Conversiones diarias desglosadas por accion. Solo primarias: all_conversions se omite deliberadamente porque en 360 infla 2,5 veces al sumar clics a WhatsApp, mail y llamadas.';


create table if not exists budget_daily (
  id bigserial primary key,
  account text not null,
  date date not null,
  campaign text not null,
  daily_budget numeric, actual_cost numeric, pacing_pct numeric,
  delivery_method text, currency text, lost_is_budget numeric,
  run_ts timestamptz default now()
);
create unique index if not exists uq_budget_daily
  on budget_daily (account, date, campaign);
alter table budget_daily enable row level security;;
