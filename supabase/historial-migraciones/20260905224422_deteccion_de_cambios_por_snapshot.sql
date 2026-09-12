-- ================================================================
-- DETECCIÓN DE CAMBIOS POR SNAPSHOT
-- ================================================================
-- change_event de Google Ads NO registra cambios en acciones de conversion:
-- su lista de recursos cubre anuncios, grupos, keywords, campanas,
-- presupuestos, criterios y assets, y ahi termina. Un cambio como "pasar
-- Asesoria Agendada de primaria a secundaria" no aparece nunca.
--
-- La solucion no es exportar mas del log, es dejar de depender de el:
-- el script diario toma una foto de la configuracion cada manana, y
-- Postgres compara con la de ayer. Lo que cambio, cambio, lo haya
-- registrado Google o no.
-- ================================================================

create table if not exists config_snapshot (
  id bigserial primary key,
  account text not null,
  snapshot_date date not null,
  entity_type text not null,       -- 'conversion_action' | 'campaign' | 'account'
  entity_name text not null,
  config jsonb not null,           -- la configuracion completa
  config_hash text not null,       -- md5 del jsonb, para comparar rapido
  run_ts timestamptz default now()
);
create unique index if not exists uq_config_snapshot
  on config_snapshot (account, snapshot_date, entity_type, entity_name);
create index if not exists idx_config_snapshot_lookup
  on config_snapshot (account, entity_type, entity_name, snapshot_date desc);
alter table config_snapshot enable row level security;

comment on table config_snapshot is 'Foto diaria de la configuracion de cada entidad. La comparacion entre dias consecutivos detecta cambios que change_event no registra, en particular los de acciones de conversion. Es la fuente de verdad sobre QUE cambio; operator_log sigue siendo la fuente sobre POR QUE.';


-- Diff automatico: cada entidad cuya configuracion de hoy difiere de la de
-- su snapshot anterior. Compara contra el ultimo snapshot disponible, no
-- contra "ayer", para tolerar dias sin corrida.
create or replace view v_cambios_detectados as
with ordenado as (
  select *,
         lag(config) over (partition by account, entity_type, entity_name order by snapshot_date) as config_previa,
         lag(config_hash) over (partition by account, entity_type, entity_name order by snapshot_date) as hash_previo,
         lag(snapshot_date) over (partition by account, entity_type, entity_name order by snapshot_date) as fecha_previa
  from config_snapshot
)
select
  account, entity_type, entity_name,
  fecha_previa as detectado_entre,
  snapshot_date as detectado_hasta,
  -- Solo las claves cuyo valor cambio
  (select jsonb_object_agg(k, jsonb_build_object('antes', config_previa->k, 'despues', config->k))
   from jsonb_object_keys(config) k
   where config_previa->k is distinct from config->k) as campos_cambiados
from ordenado
where hash_previo is not null and hash_previo <> config_hash;

comment on view v_cambios_detectados is 'Cambios de configuracion detectados por diferencia entre snapshots diarios. Cubre lo que change_event no ve. detectado_entre y detectado_hasta acotan la ventana: el cambio ocurrio en algun momento entre esas dos fechas. campos_cambiados trae solo las claves que difieren, con valor anterior y posterior.';


-- Cambios que change_event NO registro: la lista que realmente importa,
-- porque son los que un analisis basado en el log oficial se pierde.
create or replace view v_cambios_fuera_del_log as
select d.*
from v_cambios_detectados d
where not exists (
  select 1 from change_events c
  where c.account = d.account
    and substring(c.change_datetime from 1 for 10)::date between d.detectado_entre and d.detectado_hasta
    and c.resource_type = upper(d.entity_type)
);

comment on view v_cambios_fuera_del_log is 'Cambios detectados por snapshot que change_event no tiene. Cualquier discrepancia entre "lo que dice el registro" y "lo que muestra la cuenta" se explica mirando aca ANTES de inferir bugs o fuentes fantasma.';


-- La vista unificada ahora tiene tres fuentes
create or replace view v_todos_los_cambios as
select account, fecha, hora, 'operador' as fuente, coalesce(donde,'sin ambito') as ambito,
       que_cambio as detalle, valor_anterior, valor_nuevo, por_que, false as automatico
from operator_log
union all
select account, substring(change_datetime from 1 for 10)::date, substring(change_datetime from 12 for 8)::time,
       'change_events', resource_type, coalesce(changed_field,'(campo no registrado)'),
       old_value, new_value, null,
       (client_type like '%RECOMMENDATION%' or client_type like '%GOOGLE_FIRST_PARTY%')
from change_events where change_datetime is not null
union all
select account, detectado_hasta, null, 'snapshot', entity_type,
       entity_name || ' · ' || (select string_agg(k, ', ') from jsonb_object_keys(campos_cambiados) k),
       campos_cambiados::text, null,
       'Detectado por diferencia entre snapshots del ' || detectado_entre || ' y el ' || detectado_hasta,
       false
from v_cambios_detectados;

comment on view v_todos_los_cambios is 'Tres fuentes en una lista: change_events (lo que Google registra), snapshot (lo que se detecta por diferencia, incluyendo conversiones), y operador (lo que Andres anota con su motivo). Si algo esta en snapshot y no en change_events, es normal: Google no registra todo.';;
