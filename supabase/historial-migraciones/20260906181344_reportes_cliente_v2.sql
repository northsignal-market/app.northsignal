create table if not exists reportes_cliente (
  id bigserial primary key,
  account text not null references cuentas(account),
  periodo_desde date not null, periodo_hasta date not null,
  tipo text not null default 'semanal' check (tipo in ('semanal', 'mensual')),
  idioma text not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'aprobado', 'enviado', 'descartado')),
  resumen_ejecutivo text not null, que_cambiamos text, que_sigue text,
  metricas jsonb not null, serie jsonb, campanas jsonb,
  brief_notion_id text, escrito_por text default 'opus-5-semanal',
  pdf_path text, pdf_bytes int,
  creado timestamptz default now(), aprobado_el timestamptz, aprobado_por text, editado boolean default false,
  enviado_el timestamptz, enviado_a text[],
  unique (account, periodo_desde, tipo)
);
create index if not exists idx_reportes_acct_estado on reportes_cliente (account, estado, periodo_desde desc);
alter table reportes_cliente enable row level security;
revoke all on reportes_cliente from anon, authenticated;
comment on table reportes_cliente is 'Reportes al cliente: borrador (cron) -> aprobado (Andres en la app) -> enviado. Un minuto por cliente por periodo.';

insert into storage.buckets (id, name, public) values ('reportes', 'reportes', false) on conflict (id) do nothing;

create or replace function get_reporte_datos(p_account text, p_desde date, p_hasta date) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  with act as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde and p_hasta),
  ant as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde - (p_hasta - p_desde + 1) and p_desde - 1),
  is_act as (select round(sum(impr_share * impressions) / nullif(sum(impressions), 0), 1) impr_share from campaign_daily where account = p_account and date between p_desde and p_hasta),
  camp as (select * from jsonb_to_recordset(((get_entidades('campaign', p_account, p_desde, p_hasta))::jsonb)->'data') as x(campaign text, cost numeric, conversions numeric, cost_per_conv numeric, ctr numeric)),
  grp as (select * from jsonb_to_recordset(((get_entidades('adgroup', p_account, p_desde, p_hasta))::jsonb)->'data') as x(ad_group text, campaign text, cost numeric, conversions numeric, cost_per_conv numeric))
  select jsonb_build_object(
    'metricas', jsonb_build_object(
      'cost', jsonb_build_object('actual', round(a.cost, 2), 'anterior', round(n.cost, 2)),
      'conversions', jsonb_build_object('actual', round(a.conversions, 1), 'anterior', round(n.conversions, 1)),
      'cpa', jsonb_build_object('actual', round(a.cost / nullif(a.conversions, 0), 2), 'anterior', round(n.cost / nullif(n.conversions, 0), 2)),
      'ctr', jsonb_build_object('actual', round(a.clicks::numeric / nullif(a.impressions, 0) * 100, 2), 'anterior', round(n.clicks::numeric / nullif(n.impressions, 0) * 100, 2)),
      'clicks', jsonb_build_object('actual', a.clicks, 'anterior', n.clicks),
      'impr_share', jsonb_build_object('actual', i.impr_share, 'anterior', null)),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'conv', conversiones, 'cpa', cpa, 'gasto', gasto, 'madurez', madurez) order by date), '[]') from v_serie_diaria where account = p_account and date between p_hasta - 13 and p_hasta),
    'campanas', (select coalesce(jsonb_agg(jsonb_build_object('nombre', campaign, 'gasto', cost, 'conv', conversions, 'cpa', cost_per_conv, 'ctr', ctr) order by cost desc), '[]') from camp where cost > 0),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', ad_group, 'campana', campaign, 'gasto', cost, 'conv', conversions, 'cpa', cost_per_conv) order by cost desc), '[]') from (select * from grp where cost > 0 order by cost desc limit 12) g),
    'accionables_ejecutados', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'ejecutado', ejecutado_el, 'veredicto', veredicto, 'variacion', variacion_pct) order by ejecutado_el desc), '[]') from v_impacto_accionables where account = p_account and ejecutado_el between p_desde - 14 and p_hasta)
  ) from act a, ant n, is_act i;
$$;
revoke execute on function get_reporte_datos from anon, authenticated;
select (get_reporte_datos('KAREDO', '2026-08-24', '2026-08-30'))->'metricas'->'cpa' as cpa, jsonb_array_length((get_reporte_datos('KAREDO', '2026-08-24', '2026-08-30'))->'campanas') as campanas_con_gasto;;
