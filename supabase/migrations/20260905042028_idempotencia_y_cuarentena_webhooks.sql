-- 1. CUARENTENA / BITACORA CRUDA DE WEBHOOKS
-- Principio: guardar los registros defectuosos en cuarentena en lugar de
-- descartarlos en silencio. Si un webhook llega con una forma inesperada,
-- queda aca y se puede reprocesar, en vez de perderse.
create table if not exists webhook_events (
  id bigserial primary key,
  source text not null,                    -- 'asana' | 'gohighlevel'
  external_id text,                        -- id del evento en el origen, para deduplicar
  payload jsonb not null,
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','PROCESSED','QUARANTINED','FAILED')),
  error_msg text,
  processed_at timestamptz,
  received_at timestamptz default now()
);
create index if not exists idx_webhook_events_source on webhook_events (source, received_at desc);
create index if not exists idx_webhook_events_status on webhook_events (status) where status <> 'PROCESSED';
create unique index if not exists uq_webhook_events_ext on webhook_events (source, external_id)
  where external_id is not null;
alter table webhook_events enable row level security;

comment on table webhook_events is 'Bitacora cruda de todo webhook entrante, antes de procesarlo. Sirve para tres cosas: deduplicar por external_id, poner en cuarentena lo que no se pudo interpretar en lugar de descartarlo, y reprocesar sin pedirle al origen que reenvie. status QUARANTINED significa que llego pero no se entendio: requiere revision.';


-- 2. IDEMPOTENCIA EN LOS MONTOS DE NEGOCIO
-- Asana y GoHighLevel reenvian eventos ante fallo o timeout. Sin una clave
-- unica, cada reenvio duplicaria el monto: la fuente de verdad del negocio
-- quedaria inflada sin que nadie lo note.
alter table true_roas_events
  add column if not exists source text default 'asana',
  add column if not exists external_id text;

create unique index if not exists uq_true_roas_dedupe
  on true_roas_events (client, gclid, external_id)
  where external_id is not null;

comment on table true_roas_events is 'Montos reales de negocio, la fuente de verdad que reemplaza a las conversiones de Google en 360 (valor inflado por regla 1,5x) y BHI (el pipeline vive en GoHighLevel). external_id + client + gclid forman la clave de deduplicacion: usar upsert con onConflict, nunca insert directo.';
comment on column true_roas_events.external_id is 'ID del objeto en el sistema de origen: gid de la tarea de Asana, id de la oportunidad de GHL. Es lo que hace idempotente la escritura.';


-- 3. SALUD DE LAS INTEGRACIONES
-- Un webhook que dejo de llegar no produce ningun error: simplemente no pasa
-- nada. Los eventos faltantes son mas peligrosos que los fallidos porque no
-- disparan alarmas.
create or replace view v_webhook_health as
with ultimos as (
  select source,
         max(received_at) as ultimo_evento,
         count(*) filter (where received_at > now() - interval '7 days') as eventos_7d,
         count(*) filter (where status = 'QUARANTINED') as en_cuarentena,
         count(*) filter (where status = 'FAILED') as fallidos
  from webhook_events group by source
)
select
  source,
  ultimo_evento,
  round(extract(epoch from (now() - ultimo_evento)) / 3600, 1) as horas_sin_eventos,
  eventos_7d,
  en_cuarentena,
  fallidos,
  case
    when fallidos > 0 then 'ERROR'
    when en_cuarentena > 0 then 'REVISAR'
    when now() - ultimo_evento > interval '7 days' then 'SIN ACTIVIDAD'
    else 'OK'
  end as estado
from ultimos;

comment on view v_webhook_health is 'Estado de las integraciones entrantes. SIN ACTIVIDAD durante mas de 7 dias en un webhook que deberia recibir eventos casi siempre significa que se desactivo del lado del proveedor, no que no haya novedades.';;
