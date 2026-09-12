-- La fecha de espera se hacia cumplir en la PUERTA (prevuelo, al aprobar) y no en la
-- COLA. acciones_aprobadas no tenia la fecha y v_acciones_pendientes solo filtraba por
-- estado='pendiente', asi que el ejecutor tomaba todo lo que estuviera ahi. Cualquier
-- fila que entrara por otro camino (SQL a mano, una integracion futura, Meta), o una
-- fecha agregada en Notion DESPUES de aprobar, se ejecutaba igual dentro de la hora.
-- Es el mismo movimiento que se hizo cuando la condicion paso de la prosa al JSON:
-- bajarla un nivel, de algo que hay que acordarse a algo que la estructura impide.

alter table public.acciones_aprobadas
  add column if not exists no_ejecutar_antes_de date;

comment on column public.acciones_aprobadas.no_ejecutar_antes_de is
  'Copiada del accionable al aprobar. v_acciones_pendientes no entrega la fila hasta esta fecha. Es la red por si la accion entra por un camino que no pasa por prevuelo().';

-- Backfill: las pendientes que ya estan encoladas y tienen fecha en su accionable.
update public.acciones_aprobadas a
   set no_ejecutar_antes_de = nullif(e.accion->'parametros'->>'no_ejecutar_antes_de','')::date
  from public.accionables_espejo e
 where e.notion_id = a.notion_id
   and a.estado = 'pendiente'
   and a.no_ejecutar_antes_de is null
   and nullif(e.accion->'parametros'->>'no_ejecutar_antes_de','') is not null;

create or replace view public.v_acciones_pendientes as
  select id, account, tipo, campana, grupo, keyword, match_type, ad_id, modo,
         match_type_destino, keywords, nivel, estrategia_destino,
         valor_actual, valor_nuevo, etiqueta
    from public.acciones_aprobadas
   where estado = 'pendiente'
     and (no_ejecutar_antes_de is null or no_ejecutar_antes_de <= current_date)
   order by aprobada_el;

comment on view public.v_acciones_pendientes is
  'Lo que el ejecutor toma en cada corrida. Filtra por no_ejecutar_antes_de: una accion con fecha futura queda encolada y no se entrega. No sacar ese filtro; la fecha en el JSON del accionable sola no alcanza porque el ejecutor no lee el accionable.';;
