-- La migracion 20260913013000 quiso crear "reconciliaciones" pero ese nombre YA
-- existia con otra semantica (reconciliacion de ACCIONABLES: reglas R1-R4 de
-- vencidos/duplicados, del cron reconciliar_diario). El IF NOT EXISTS fue un
-- no-op silencioso y los registros del contralor cayeron al catch. Dos dominios
-- distintos no comparten tabla: el contralor contra la API tiene la suya.
create table if not exists public.reconciliaciones_api (
  id bigint generated always as identity primary key,
  corrida timestamptz not null default now(),
  account text not null,
  capa text not null check (capa in ('diaria', 'semanal')),
  filas_comparadas integer not null default 0,
  filas_corregidas integer not null default 0,
  filas_insertadas integer not null default 0,
  faltantes_en_base integer not null default 0,
  max_divergencia_gasto numeric,
  max_divergencia_conv numeric,
  veredicto text not null check (veredicto in ('limpio', 'corregido', 'excedio_tope', 'sin_base', 'error')),
  detalle text
);

create index if not exists reconciliaciones_api_corrida_idx on public.reconciliaciones_api (corrida desc);
create index if not exists reconciliaciones_api_cuenta_idx on public.reconciliaciones_api (account, corrida desc);

comment on table public.reconciliaciones_api is
  'Resultado del contralor diario contra la API de Google Ads (cron 10:50 UTC -> /api/cron/reconciliar-api). limpio = todo coincidio; corregido = se escribio el dato de la API donde diferia; excedio_tope = divergencia masiva, se freno (bug, no maduracion); sin_base = la ventana no existe en la tabla (extraccion, no reconciliacion); error = la corrida fallo. Lo vigila la relacion api_reconcilia_a_diario. No confundir con "reconciliaciones", que reconcilia ACCIONABLES (reglas R1-R4).';
