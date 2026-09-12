-- Validacion del plan como funcion inmutable (los check no aceptan subqueries)
create or replace function plan_valido(p_ind jsonb, p_hip jsonb) returns boolean
language plpgsql immutable as $$
declare i jsonb; h jsonb;
begin
  if jsonb_typeof(p_ind) <> 'array' or jsonb_array_length(p_ind) < 1 or jsonb_array_length(p_ind) > 10 then return false; end if;
  for i in select * from jsonb_array_elements(p_ind) loop
    if not (i ? 'nombre' and i ? 'umbral' and i ? 'direccion' and i ? 'habilita') then return false; end if;
    if i->>'direccion' not in ('sube','baja','cruza') then return false; end if;
    if i->>'nombre' not in ('clics','conv_rate','impresiones','cpc','lost_is_budget','lost_is_rank','pct_terminos_nuevos','cpa_marginal','ctr','conversiones','gasto','conv_rate_grupo') then return false; end if;
  end loop;
  if jsonb_typeof(p_hip) <> 'array' or jsonb_array_length(p_hip) > 6 then return false; end if;
  for h in select * from jsonb_array_elements(p_hip) loop
    if not (h ? 'id' and h ? 'texto' and h ? 'evidencia_que_la_mueve') then return false; end if;
  end loop;
  return true;
end $$;

create table if not exists plan_semanal (
  id bigserial primary key,
  account text not null,
  semana date not null,
  escrito_el timestamptz default now(),
  escrito_por text default 'opus-5-semanal',
  indicadores jsonb not null,
  hipotesis jsonb not null default '[]',
  condiciones_escalamiento jsonb not null default '[]',
  contexto text,
  unique (account, semana),
  constraint plan_bien_formado check (plan_valido(indicadores, hipotesis))
);
create index if not exists idx_plan_acct_semana on plan_semanal (account, semana desc);
alter table plan_semanal enable row level security;
revoke all on plan_semanal from anon, authenticated;
comment on table plan_semanal is 'Plan que Opus 5 escribe el lunes para que Sonnet 5 vigile durante la semana. indicadores: [{nombre, umbral, direccion, habilita}]. hipotesis: [{id, texto, evidencia_que_la_mueve}]. plan_valido() rechaza un plan mal formado antes de que el diario lo lea.';

create or replace view v_leading_indicators_diarios as
with base as (
  select account, date,
         sum(clicks) as clics, sum(impressions) as impresiones, sum(cost) as gasto, sum(conversions) as conversiones,
         round(sum(cost) / nullif(sum(clicks), 0), 4) as cpc,
         round(sum(conversions) / nullif(sum(clicks), 0) * 100, 2) as conv_rate,
         round(sum(clicks)::numeric / nullif(sum(impressions), 0) * 100, 2) as ctr,
         round(sum(lost_is_budget * impressions) / nullif(sum(impressions), 0), 1) as lost_is_budget,
         round(sum(lost_is_rank * impressions) / nullif(sum(impressions), 0), 1) as lost_is_rank
  from campaign_daily group by account, date
),
terminos as (
  select s.account, s.date, count(*) filter (where p.primera = s.date) as terminos_nuevos, count(*) as terminos_total
  from search_terms_daily s
  join (select account, search_term, min(date) as primera from search_terms_daily group by 1, 2) p on p.account = s.account and p.search_term = s.search_term
  where s.clicks > 0 group by s.account, s.date
),
marginal as (select account, min(ratio_marginal_sobre_promedio) filter (where escalon > presupuesto_actual) as cpa_marginal_ratio from v_cpa_marginal group by account)
select b.account, b.date, madurez_dato(b.date) as madurez,
       b.clics, b.impresiones, b.gasto, b.conversiones, b.cpc, b.conv_rate, b.ctr, b.lost_is_budget, b.lost_is_rank,
       round(coalesce(t.terminos_nuevos, 0)::numeric / nullif(t.terminos_total, 0) * 100, 1) as pct_terminos_nuevos,
       m.cpa_marginal_ratio as cpa_marginal,
       round((regr_slope(b.clics, extract(epoch from b.date)) over w * 86400)::numeric, 2) as clics_tendencia_3d,
       round((regr_slope(b.conv_rate, extract(epoch from b.date)) over w * 86400)::numeric, 3) as conv_rate_tendencia_3d,
       round((regr_slope(b.cpc, extract(epoch from b.date)) over w * 86400)::numeric, 4) as cpc_tendencia_3d,
       round((regr_slope(b.lost_is_budget, extract(epoch from b.date)) over w * 86400)::numeric, 2) as lost_is_budget_tendencia_3d
from base b
left join terminos t on t.account = b.account and t.date = b.date
left join marginal m on m.account = b.account
window w as (partition by b.account order by b.date rows between 2 preceding and current row)
order by b.account, b.date;
comment on view v_leading_indicators_diarios is 'Drivers que se mueven antes que el CPA, por cuenta y dia, con tendencia de 3 dias. El diario los lee contra el plan.';

alter table pulso_diario add column if not exists plan_id bigint references plan_semanal(id);
alter table pulso_diario add column if not exists evidencia jsonb;
alter table pulso_diario add column if not exists hallazgos jsonb;
alter table pulso_diario add column if not exists hipotesis_movidas jsonb;
alter table pulso_diario alter column modelo set default 'claude-sonnet-5';

create or replace view v_correlacion_leading_lagging as
with li as (select * from v_leading_indicators_diarios where madurez = 'consolidado'),
pares as (
  select a.account, ind.nombre, lag_dias.n as lag_dias, corr(ind.valor, b.conversiones) as r, count(*) as n_pares
  from li a
  cross join lateral (values ('clics', a.clics::numeric), ('conv_rate', a.conv_rate), ('impresiones', a.impresiones::numeric), ('cpc', a.cpc), ('ctr', a.ctr), ('lost_is_budget', a.lost_is_budget), ('lost_is_rank', a.lost_is_rank), ('pct_terminos_nuevos', a.pct_terminos_nuevos)) as ind(nombre, valor)
  cross join lateral (values (0), (1), (2), (3), (5), (7)) as lag_dias(n)
  join li b on b.account = a.account and b.date = a.date + lag_dias.n
  where ind.valor is not null group by a.account, ind.nombre, lag_dias.n
)
select account, nombre as indicador, lag_dias, round(r::numeric, 3) as correlacion, n_pares,
       case when n_pares < 14 then 'INSUFICIENTE: menos de 14 pares' when abs(r) >= 0.5 then 'PREDICE: |r| >= 0,5' when abs(r) >= 0.3 then 'DEBIL: |r| entre 0,3 y 0,5' else 'NO PREDICE: |r| < 0,3. Sacar del plan.' end as veredicto
from pares order by account, nombre, lag_dias;
comment on view v_correlacion_leading_lagging is 'Correlacion entre cada leading y conversiones a N dias. Con 14+ pares es legible. Si no predice, el semanal lo saca del plan.';

create table if not exists filtro_umbrales (clave text primary key, valor numeric not null, descripcion text, actualizado timestamptz default now());
insert into filtro_umbrales (clave, valor, descripcion) values
  ('confianza_minima', 0.7, 'Confianza minima (0-1) para pasar a accionable'),
  ('severidad_minima', 2, 'Severidad minima: 1=baja, 2=media, 3=alta, 4=critica'),
  ('max_accionables_dia_cuenta', 1, 'Maximo de accionables por cuenta y dia'),
  ('dias_seguidos_para_atencion', 2, 'Dias seguidos cumpliendo una condicion del plan para pasar de normal a atencion')
on conflict (clave) do nothing;
alter table filtro_umbrales enable row level security;
revoke all on filtro_umbrales from anon, authenticated;

create or replace function filtrar_hallazgos_a_accionables(p_account text, p_fecha date) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_conf numeric; v_sev numeric; v_max int; v_out jsonb;
begin
  select valor into v_conf from filtro_umbrales where clave = 'confianza_minima';
  select valor into v_sev from filtro_umbrales where clave = 'severidad_minima';
  select valor into v_max from filtro_umbrales where clave = 'max_accionables_dia_cuenta';
  select coalesce(jsonb_agg(h), '[]') into v_out from (
    select h from pulso_diario p, jsonb_array_elements(p.hallazgos) h
    where p.account = p_account and p.fecha = p_fecha
      and (h->>'confianza')::numeric >= v_conf
      and (case h->>'severidad' when 'baja' then 1 when 'media' then 2 when 'alta' then 3 when 'critica' then 4 else 0 end) >= v_sev
      and (h ? 'entidad') and length(coalesce(h->>'evidencia_texto', '')) > 40
    order by (case h->>'severidad' when 'critica' then 4 when 'alta' then 3 when 'media' then 2 else 1 end) desc, (h->>'confianza')::numeric desc
    limit v_max
  ) x;
  return v_out;
end $$;
revoke execute on function filtrar_hallazgos_a_accionables from anon, authenticated, public;
comment on function filtrar_hallazgos_a_accionables is 'Filtro determinista de hallazgos a accionables. Umbrales en filtro_umbrales. El modelo detecta; esto decide.';

create or replace function get_pulso_input(p_account text, p_fecha date default current_date - 1) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'cuenta', p_account, 'fecha_analizada', p_fecha,
    'plan', (select jsonb_build_object('id', id, 'semana', semana, 'contexto', contexto, 'indicadores', indicadores, 'hipotesis', hipotesis, 'condiciones_escalamiento', condiciones_escalamiento) from plan_semanal where account = p_account and semana <= p_fecha order by semana desc limit 1),
    'leading_7d', (select coalesce(jsonb_agg(to_jsonb(l) - 'account' order by date), '[]') from v_leading_indicators_diarios l where account = p_account and date between p_fecha - 6 and p_fecha),
    'serie_7d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'gasto', gasto, 'clics', clics, 'conv', conversiones, 'cpa', cpa, 'madurez', madurez) order by date), '[]') from v_serie_diaria where account = p_account and date between p_fecha - 6 and p_fecha),
    'anomalias_2d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'sev', severidad, 'metrica', metrica_anomala, 'explicacion', explicacion)), '[]') from v_anomalia_explicada where account = p_account and date between p_fecha - 1 and p_fecha),
    'conv_por_grupo_3d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'grupo', ad_group, 'conv', conv) order by date, ad_group), '[]') from (select date, ad_group, sum(conversions) conv from v_conversiones_por_grupo where account = p_account and date between p_fecha - 2 and p_fecha group by 1, 2) g),
    'grupos_ayer', (select coalesce(jsonb_agg(jsonb_build_object('grupo', ad_group, 'clics', clicks, 'gasto', round(cost, 2), 'conv', conversions, 'conv_rate', round(conversions / nullif(clicks, 0) * 100, 1)) order by cost desc), '[]') from adgroup_daily where account = p_account and date = p_fecha and cost > 0),
    'cambios_detectados', (select coalesce(jsonb_agg(jsonb_build_object('entidad', entity_name, 'tipo', entity_type, 'campos', campos_cambiados)), '[]') from v_cambios_detectados where account = p_account and detectado_hasta >= p_fecha),
    'operator_log_2d', (select coalesce(jsonb_agg(jsonb_build_object('d', fecha, 'que', left(que_cambio, 200), 'donde', donde) order by fecha desc), '[]') from operator_log where account = p_account and fecha >= p_fecha - 1),
    'cambios_google_ayer', (select coalesce(jsonb_agg(jsonb_build_object('entidad', entity_name, 'tipo', event_type, 'quien', user_email)), '[]') from google_live_events where account = p_account and event_type in ('USER_CHANGE','AUTO_CHANGE') and event_date::date = p_fecha),
    'terminos_nuevos_con_gasto', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'kw', keyword_disparadora, 'grupo', ad_group, 'gasto', gasto_acumulado, 'conv', conversiones_acumuladas) order by gasto_acumulado desc), '[]') from (select * from v_terminos_nuevos where account = p_account and primera_aparicion = p_fecha and gasto_acumulado > 0 limit 10) t),
    'pulsos_previos_3d', (select coalesce(jsonb_agg(jsonb_build_object('d', fecha, 'nivel', nivel, 'hallazgo', hallazgo_principal, 'evidencia', evidencia) order by fecha desc), '[]') from pulso_diario where account = p_account and fecha between p_fecha - 3 and p_fecha - 1),
    'reflexiones_recientes', (select coalesce(jsonb_agg(que_haria_distinto order by run_date desc), '[]') from (select que_haria_distinto, run_date from reflexiones where account = p_account order by run_date desc limit 5) r),
    'objetivos', (select jsonb_build_object('cpa_max', cpa_maximo, 'conv_mes', conversiones_mes_objetivo, 'provisional', cpa_maximo_origen = 'historico') from account_targets where account = p_account)
  );
$$;
select 'ok';;
