-- Cada transicion de etapa de cada lead, con el valor de la etapa.
-- Es lo que se sube a Google como conversion offline: no solo el cierre,
-- cada paso. Asi Smart Bidding recibe senal graduada y frecuente.
create table if not exists funnel_events (
  id bigserial primary key,
  account text not null,
  external_id text not null,           -- gid Asana, id GHL
  lead_name text,
  stage_order int not null,
  stage_name text not null,
  stage_value numeric,                 -- valor de la etapa al momento del evento
  currency text,
  click_id text,                       -- gclid o gbraid
  click_id_type text check (click_id_type in ('gclid','gbraid','wbraid')),
  reached_at timestamptz not null,     -- cuando llego a la etapa
  uploaded_to_google boolean default false,
  uploaded_at timestamptz,
  source text not null,                -- 'make' | 'webhook' | 'manual'
  created_at timestamptz default now(),
  unique (account, external_id, stage_order)
);
create index if not exists idx_funnel_events_pending on funnel_events (account, uploaded_to_google) where not uploaded_to_google;
create index if not exists idx_funnel_events_lead on funnel_events (account, external_id);
alter table funnel_events enable row level security;

comment on table funnel_events is 'Una fila por lead y etapa alcanzada. Es la cola de subida a Google Ads: uploaded_to_google = false son los pendientes. La clave unica evita subir dos veces la misma etapa del mismo lead. El valor se congela al momento del evento: si despues cambia la escalera, los eventos viejos conservan el valor con el que se subieron.';


-- Vista: que hay pendiente de subir
create or replace view v_pendientes_subir_google as
select f.account, f.external_id, f.lead_name, f.stage_name, f.stage_value, f.currency,
       f.click_id, f.click_id_type, f.reached_at,
       s.google_conversion_action,
       case when f.click_id is null then 'SIN CLICK ID: no se puede atribuir'
            when s.google_conversion_action is null then 'SIN ACCION EN GOOGLE: crear primero'
            else 'LISTO' end as estado
from funnel_events f
join funnel_stages s on s.account = f.account and s.stage_order = f.stage_order
where not f.uploaded_to_google
order by f.reached_at;

comment on view v_pendientes_subir_google is 'Eventos de funnel que todavia no se subieron a Google. LISTO = tiene click id y la accion existe. Los otros dos estados explican por que no se puede.';


-- Vista: win rates reales calculados desde los eventos
-- (reemplaza los estimados cuando haya suficiente historial)
create or replace view v_win_rates_reales as
with por_lead as (
  select account, external_id, max(stage_order) as etapa_max
  from funnel_events group by account, external_id
),
por_etapa as (
  select s.account, s.stage_order, s.stage_name,
         count(distinct e.external_id) as llegaron,
         count(distinct e.external_id) filter (where p.etapa_max = (select max(stage_order) from funnel_stages x where x.account = s.account)) as cerraron
  from funnel_stages s
  left join funnel_events e on e.account = s.account and e.stage_order >= s.stage_order
  left join por_lead p on p.account = e.account and p.external_id = e.external_id
  group by s.account, s.stage_order, s.stage_name
)
select account, stage_order, stage_name, llegaron, cerraron,
       case when llegaron >= 10 then round(cerraron::numeric / llegaron, 3) end as win_rate_real,
       case when llegaron >= 10 then 'calculado' else 'insuficiente (' || llegaron || ' leads, minimo 10)' end as confianza
from por_etapa order by account, stage_order;

comment on view v_win_rates_reales is 'Tasa de cierre real desde cada etapa, calculada de funnel_events. Con menos de 10 leads por etapa no se calcula. Cuando hay suficientes, reemplaza los estimados de funnel_stages: actualizar win_rate_to_close y cambiar win_rate_origen a calculado.';;
