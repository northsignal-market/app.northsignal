-- Tickets 32 y 42. change_events se reescribia entera en cada corrida.
-- Causa: pushToSupabase del script semanal acota el DELETE a la semana SOLO si la
-- tabla tiene columna week_start. change_events no la tiene, asi que el filtro
-- quedaba en ?account=eq.<cuenta>: borraba toda la historia de la cuenta y despues
-- insertaba unicamente la semana analizada. Por eso FRESH_MONKEE paso de tener
-- historia a tener UNA fila: la corrida encontro un cambio, borro todo, inserto uno.
-- Esta migracion habilita el lado Postgres del arreglo. El script pasa a upsert
-- (northsignal_semanal v11) y deja de borrar.
-- Verificado antes de crear: 111 filas, cero nulos en las tres columnas de la clave,
-- cero duplicados sobre la clave propuesta.

create unique index if not exists uq_change_events
  on public.change_events (account, change_datetime, resource_name, changed_field);

comment on index public.uq_change_events is
  'Clave natural para el upsert de change_events. Existe para que el script semanal pueda usar on_conflict + Prefer: resolution=merge-duplicates en vez de borrar por cuenta. NUNCA volver al DELETE por account: la tabla es un registro de eventos, no una foto. Tickets 32 y 42, 8 sep 2026.';;
