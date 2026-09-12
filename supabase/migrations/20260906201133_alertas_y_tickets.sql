-- ================================================================
-- ALERTAS UNIFICADAS: una sola lista con nivel, accion y estado
-- ================================================================
-- Principio (SRE aplicado a marketing): si no hay una accion concreta,
-- no es alerta, es dato. Tres niveles: interrumpir (hoy), ticket (esta
-- semana), digest (se ve en la app, no avisa). Dos intervalos seguidos
-- antes de disparar. "Datos rotos" separado de "cuenta rota".
-- ================================================================
create table if not exists alertas (
  id bigserial primary key,
  account text,                                  -- null = sistema
  nivel text not null check (nivel in ('hoy','semana','digest')),
  tipo text not null,                            -- 'cambio_automatico' | 'primaria_sin_datos' | 'gasto_sin_conv' | 'pico_gasto' | 'datos_rotos' | 'cron_fallo' | 'anomalia' | 'plan_condicion'
  titulo text not null,
  detalle text,
  accion text,                                   -- que hacer, concreto
  origen text not null,                          -- 'centinela' | 'anomalias' | 'pulso' | 'watchdog' | 'integridad' | 'manual'
  entidad text,                                  -- campana/grupo/keyword
  fecha_dato date,
  estado text not null default 'abierta' check (estado in ('abierta','vista','resuelta','silenciada')),
  silenciada_hasta date,
  silenciada_por_que text,
  creada timestamptz default now(),
  vista_el timestamptz,
  resuelta_el timestamptz,
  dedupe_key text unique                         -- evita duplicar la misma alerta el mismo dia
);
create index if not exists idx_alertas_estado on alertas (estado, nivel, creada desc);
alter table alertas enable row level security;
revoke all on alertas from anon, authenticated;
comment on table alertas is 'Alertas unificadas del sistema. nivel hoy = interrumpe (mail); semana = se ve en Hoy, no avisa; digest = se ve en Sistema. dedupe_key evita repetir. silenciar registra por que y hasta cuando (suppression logged).';

-- Funcion para registrar sin duplicar
create or replace function alerta_registrar(p_account text, p_nivel text, p_tipo text, p_titulo text, p_detalle text, p_accion text, p_origen text, p_entidad text default null, p_fecha_dato date default current_date)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_key text; v_id bigint;
begin
  v_key := coalesce(p_account, 'SYS') || ':' || p_tipo || ':' || coalesce(p_entidad, '') || ':' || p_fecha_dato::text;
  -- Si esta silenciada y vigente, no se registra
  if exists (select 1 from alertas where dedupe_key like coalesce(p_account, 'SYS') || ':' || p_tipo || ':' || coalesce(p_entidad, '') || ':%' and estado = 'silenciada' and silenciada_hasta >= current_date) then return null; end if;
  insert into alertas (account, nivel, tipo, titulo, detalle, accion, origen, entidad, fecha_dato, dedupe_key)
  values (p_account, p_nivel, p_tipo, p_titulo, p_detalle, p_accion, p_origen, p_entidad, p_fecha_dato, v_key)
  on conflict (dedupe_key) do nothing returning id into v_id;
  return v_id;
end $$;
revoke execute on function alerta_registrar from anon, authenticated, public;

-- Vista: alertas abiertas por nivel, con conteo
create or replace view v_alertas_abiertas as
select a.*, case nivel when 'hoy' then 1 when 'semana' then 2 else 3 end as orden
from alertas a where estado in ('abierta','vista') order by orden, creada desc;

-- Alertas de datos rotos: desde v_data_health e integridad (las genera el cron de anomalias)
-- Alertas de cambio automatico: desde google_live_events AUTO_CHANGE
-- Alertas de plan: desde pulso_diario evidencia dias_seguidos >= 3

-- ================================================================
-- TICKETS: lo que Andres ve que no cuadra, para Claude
-- ================================================================
create table if not exists tickets (
  id bigserial primary key,
  creado timestamptz default now(),
  creado_por text default 'andres',
  tipo text not null default 'bug' check (tipo in ('bug','mejora','pregunta','dato_incorrecto')),
  titulo text not null,
  descripcion text,
  pagina text,                                   -- en que seccion de la app estaba
  cuenta text,                                   -- que cuenta tenia seleccionada
  contexto jsonb,                                -- url, viewport, ultimo error de consola si hay
  estado text not null default 'abierto' check (estado in ('abierto','en_curso','resuelto','descartado')),
  respuesta text,                                -- lo que Claude respondio/hizo
  resuelto_el timestamptz,
  resuelto_en_version text                       -- fix-vNN
);
create index if not exists idx_tickets_estado on tickets (estado, creado desc);
alter table tickets enable row level security;
revoke all on tickets from anon, authenticated;
comment on table tickets is 'Tickets que Andres crea desde la app cuando algo no cuadra. Claude los lee al inicio de cada sesion de trabajo (select * from tickets where estado = ''abierto'' order by creado) y responde en la columna respuesta. Es el canal de devolucion entre operador y constructor.';

select 'alertas y tickets' as ok;;
