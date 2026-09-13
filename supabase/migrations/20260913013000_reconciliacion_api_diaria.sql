-- La API de Google Ads pasa de arbitro a demanda a CONTRALOR DIARIO.
-- La sospecha demostro ser un mal gatillo: 58 conversiones perdidas en 18 semanas
-- pasaron meses sin que nadie dudara. Ahora un cron diario (10:50 UTC, despues de
-- la extraccion diaria ~10:30 y antes de las relaciones 11:10) compara lo que los
-- scripts escribieron contra la API y corrige con el dato bueno, sin esperar a nadie.
-- El endpoint vive en el server (/api/cron/reconciliar-api); aca van la tabla de
-- resultados y el disparo, con el mismo patron Vault + net.http_post del pulso.

create table if not exists public.reconciliaciones (
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

create index if not exists reconciliaciones_corrida_idx on public.reconciliaciones (corrida desc);
create index if not exists reconciliaciones_cuenta_idx on public.reconciliaciones (account, corrida desc);

comment on table public.reconciliaciones is
  'Resultado del contralor diario contra la API de Google Ads. limpio = todo coincidio; corregido = se escribio el dato de la API donde diferia; excedio_tope = divergencia masiva, se freno (bug, no maduracion); sin_base = la ventana no existe en la tabla (extraccion, no reconciliacion); error = la corrida fallo. Lo vigila la relacion api_reconcilia_a_diario.';

-- Disparo con el patron del pulso: secretos en Vault, net.http_post, timeout amplio.
create or replace function public.disparar_reconciliacion_api()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare v_secret text; v_url text; v_req bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  if v_secret is null or v_url is null then
    raise notice 'disparar_reconciliacion_api: faltan secretos cron_secret o app_url en Vault';
    return null;
  end if;
  select net.http_post(
    url := v_url || '/api/cron/reconciliar-api',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{"origen":"pg_cron"}'::jsonb,
    timeout_milliseconds := 280000
  ) into v_req;
  return v_req;
end $function$;

revoke execute on function public.disparar_reconciliacion_api() from public, anon, authenticated;
grant execute on function public.disparar_reconciliacion_api() to service_role;

-- 10:50 UTC diario. El latido de aca mide el DISPARO; el EFECTO lo mide la
-- relacion api_reconcilia_a_diario sobre la tabla reconciliaciones (leccion del
-- pulso_respaldo: un latido de disparo puede decir OK con cero filas escritas).
select cron.schedule(
  'reconciliacion_api',
  '50 10 * * *',
  $cron$do $latido$ begin perform disparar_reconciliacion_api(); perform latir('reconciliacion_api_disparo', true); exception when others then perform latir('reconciliacion_api_disparo', false, sqlerrm); end $latido$;$cron$
);
