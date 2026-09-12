-- Registro de cada corrida del script. Sin esto, no hay forma de distinguir
-- "la semana estuvo tranquila" de "el script no corrio".
create table if not exists run_log (
  id bigserial primary key,
  account text not null,
  week_start date,
  week_end date,
  tabla text not null,
  filas integer default 0,
  status text not null default 'OK' check (status in ('OK','ERROR','VACIO')),
  error_msg text,
  run_ts timestamptz default now()
);
create index if not exists idx_run_log_acct on run_log (account, run_ts desc);
alter table run_log enable row level security;

comment on table run_log is 'Una fila por cuenta, tabla y corrida del script de extraccion. Es la unica forma de saber si los datos que se estan mostrando son de esta semana o de la anterior.';


-- Salud de los datos por cuenta. Responde: cuando se actualizo, esta completo,
-- hay algo que revisar.
create or replace view v_data_health as
with ultima as (
  select account, max(run_ts) as ultimo_run
  from run_log group by account
),
detalle as (
  select r.account,
         u.ultimo_run,
         count(*) filter (where r.status = 'OK')     as tablas_ok,
         count(*) filter (where r.status = 'ERROR')  as tablas_error,
         count(*) filter (where r.status = 'VACIO')  as tablas_vacias,
         sum(r.filas)                                 as filas_totales,
         max(r.week_start)                            as semana_datos,
         string_agg(distinct r.tabla, ', ') filter (where r.status = 'ERROR') as tablas_con_error
  from run_log r
  join ultima u on u.account = r.account and r.run_ts = u.ultimo_run
  group by r.account, u.ultimo_run
)
select
  account,
  ultimo_run,
  semana_datos,
  round(extract(epoch from (now() - ultimo_run)) / 3600, 1) as horas_desde_actualizacion,
  tablas_ok,
  tablas_error,
  tablas_vacias,
  filas_totales,
  tablas_con_error,
  case
    when tablas_error > 0 then 'ERROR'
    when now() - ultimo_run > interval '8 days' then 'DESACTUALIZADO'
    when tablas_ok < 15 then 'INCOMPLETO'
    else 'OK'
  end as estado,
  case
    when tablas_error > 0 then 'Fallaron tablas en la ultima corrida: ' || coalesce(tablas_con_error,'')
    when now() - ultimo_run > interval '8 days' then 'El script no corre hace mas de 8 dias. Los datos mostrados son viejos.'
    when tablas_ok < 15 then 'La corrida escribio menos tablas de las esperadas.'
    else 'Datos completos y actualizados.'
  end as mensaje
from detalle;

comment on view v_data_health is 'Estado de frescura y completitud de los datos por cuenta. La app debe consultarla al cargar y mostrar una advertencia visible cuando el estado no sea OK. Un dashboard que muestra datos viejos sin avisar es peor que uno vacio.';


-- Verificacion de integridad: los totales de campana deben coincidir con los
-- de grupo y los de keyword. Si no coinciden, hubo truncado en algun lado.
create or replace view v_integridad_datos as
with c as (
  select account, week_start, round(sum(cost),2) as cost_campaign, sum(clicks) as clicks_campaign
  from campaign group by account, week_start
),
g as (
  select account, week_start, round(sum(cost),2) as cost_adgroup, sum(clicks) as clicks_adgroup
  from adgroup group by account, week_start
),
k as (
  select account, week_start, round(sum(cost),2) as cost_keywords, sum(clicks) as clicks_keywords
  from keywords group by account, week_start
)
select
  c.account, c.week_start,
  c.cost_campaign, g.cost_adgroup, k.cost_keywords,
  round(abs(c.cost_campaign - coalesce(g.cost_adgroup,0)), 2) as dif_campana_vs_grupo,
  round(abs(c.cost_campaign - coalesce(k.cost_keywords,0)), 2) as dif_campana_vs_keyword,
  case
    when abs(c.cost_campaign - coalesce(g.cost_adgroup,0)) > c.cost_campaign * 0.02
      then 'REVISAR: el gasto por grupo no cuadra con el de campana'
    when abs(c.cost_campaign - coalesce(k.cost_keywords,0)) > c.cost_campaign * 0.05
      then 'ATENCION: el gasto por keyword difiere mas del 5% del de campana'
    else 'OK'
  end as diagnostico
from c
left join g on g.account = c.account and g.week_start = c.week_start
left join k on k.account = c.account and k.week_start = c.week_start;

comment on view v_integridad_datos is 'Compara el gasto agregado por campana, grupo y keyword de la misma semana. Deberian coincidir. Una diferencia grande indica truncado en la extraccion o filas faltantes. Una diferencia chica entre campana y keyword es normal: campanas sin keywords, como Display o PMax, no aparecen en la tabla de keywords.';;
