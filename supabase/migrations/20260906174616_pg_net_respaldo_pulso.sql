-- Respaldo del pulso diario: si Vercel Cron no corrió a las 09:45 UTC, pg_net
-- dispara el endpoint a las 10:45. El endpoint es idempotente (unique account+fecha),
-- asi que si Vercel ya corrio, la segunda llamada no produce nada.
create extension if not exists pg_net with schema extensions;

-- El secreto del cron va en Vault, no en el SQL
create extension if not exists supabase_vault with schema vault;

create or replace function disparar_pulso_respaldo() returns bigint
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_secret text; v_url text; v_req bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  if v_secret is null or v_url is null then
    raise notice 'disparar_pulso_respaldo: faltan secretos cron_secret o app_url en Vault';
    return null;
  end if;
  -- Solo dispara si no hay pulso de ayer para alguna cuenta
  if (select count(*) from pulso_diario where fecha = current_date - 1) >= 3 then
    return null;
  end if;
  select net.http_post(
    url := v_url || '/api/cron/pulso-diario',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{"origen":"pg_net_respaldo"}'::jsonb,
    timeout_milliseconds := 280000
  ) into v_req;
  return v_req;
end $$;
revoke execute on function disparar_pulso_respaldo from anon, authenticated, public;
comment on function disparar_pulso_respaldo is 'Respaldo: llama a /api/cron/pulso-diario via pg_net si a las 10:45 UTC no hay pulso de ayer para las 3 cuentas. Secretos en Vault (cron_secret, app_url). Fire-and-forget: la respuesta queda en net._http_response.';

select cron.unschedule(jobid) from cron.job where jobname = 'pulso_respaldo';
select cron.schedule('pulso_respaldo', '45 10 * * *', $$select disparar_pulso_respaldo()$$);

-- Vista para ver si los respaldos corrieron y que respondieron
create or replace view v_respaldos_pg_net as
select id, created, status_code, left(content::text, 200) as respuesta, error_msg
from net._http_response order by created desc limit 20;
revoke all on v_respaldos_pg_net from anon, authenticated;

select jobname, schedule from cron.job where jobname = 'pulso_respaldo';;
