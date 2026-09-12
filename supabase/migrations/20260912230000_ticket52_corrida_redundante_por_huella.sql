-- Ticket 52: corrida_redundante daba hay_datos_nuevos=true todos los dias porque
-- extraccion_nueva miraba run_log (el script diario deja un OK diario aunque no
-- gane nada para la semana analizada) y search_terms se reingesta identica con
-- run_ts nuevo. La tercera corrida de BHI del 09/09 se gasto en nada por esto.
-- El veredicto pasa a compararse por HUELLA DE CONTENIDO de la semana analizada.
-- La huella la calcula huella_semana_datos() y la escribe un trigger en
-- run_quality: el protocolo se autoimpone, no depende de que el agente la copie.
-- Fail-open: filas viejas sin huella siguen tratandose como "hay datos nuevos".

create or replace function public.huella_semana_datos(p_account text, p_semana date)
returns text
language sql
stable
set search_path to 'public', 'pg_temp'
as $huella$
  select md5(
    coalesce((select string_agg(campaign || '|' || conversions || '|' || cost || '|' || coalesce(conv_value, 0), ';' order by campaign)
              from campaign where account = p_account and week_start = p_semana), 'sin-semanal') || '§' ||
    coalesce((select count(*)::text || '|' || sum(cost)::text || '|' || sum(conversions)::text
              from campaign_daily where account = p_account and date between p_semana and p_semana + 6), 'sin-diaria') || '§' ||
    coalesce((select count(*)::text || '|' || sum(cost)::text || '|' || sum(conversions)::text
              from search_terms where account = p_account and week_start = p_semana), 'sin-terminos') || '§' ||
    coalesce((select count(*)::text || '|' || sum(conversions)::text || '|' || sum(conv_value)::text
              from conversion_actions where account = p_account and week_start = p_semana), 'sin-acciones')
  );
$huella$;

revoke execute on function public.huella_semana_datos(text, date) from public, anon, authenticated;
grant execute on function public.huella_semana_datos(text, date) to service_role;

alter table public.run_quality add column if not exists huella_semana text;

create or replace function public.run_quality_completar_huella()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $trg$
begin
  if new.huella_semana is null and new.semana_analizada is not null and new.account is not null then
    new.huella_semana := huella_semana_datos(new.account, new.semana_analizada);
  end if;
  return new;
end $trg$;

drop trigger if exists trg_run_quality_huella on public.run_quality;
create trigger trg_run_quality_huella
before insert on public.run_quality
for each row execute function public.run_quality_completar_huella();

create or replace function public.corrida_redundante(p_account text)
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with ult as (
    select semana_analizada, created_at, foto_leida, ultimo_evento_visto, ultima_extraccion_vista, huella_semana
    from run_quality where account = p_account
      and coalesce(que_fallo, '') not ilike 'redundante%' and coalesce(que_fallo, '') not ilike 'semana cerrada no disponible%'
    order by created_at desc limit 1
  ),
  datos as (select max(date) diaria, (select max(week_start) from campaign where account = p_account) semanal from campaign_daily where account = p_account),
  ahora as (
    select (select max(event_date) from google_live_events g where g.account = p_account and g.event_type in ('USER_CHANGE','AUTO_CHANGE') and coalesce(g.client_type,'') <> 'AI_MAX_SETTING') ev,
           (select max(run_ts) from run_log r where r.account = p_account and upper(r.status) = 'OK') ex
  ),
  lunes as (select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date as este_lunes),
  -- Ticket 52: "datos nuevos de extraccion" ya no es "run_log tiene un OK mas
  -- nuevo" (el script diario deja uno todos los dias aunque la semana analizada
  -- no cambie, y search_terms se reingesta identica con run_ts nuevo). Ahora es
  -- "la huella de contenido de la semana a analizar cambio desde la ultima
  -- corrida". La huella vieja la dejo el trigger de run_quality.
  nuevo as (
    select exists (select 1 from pulso_diario p, ult where p.account = p_account and p.created_at > ult.created_at) as pulso_nuevo,
           exists (select 1 from operator_log o, ult where o.account = p_account and o.created_at > ult.created_at) as operador_nuevo,
           (select ev from ahora) > coalesce((select ultimo_evento_visto from ult), '-infinity'::timestamptz) as google_nuevo,
           huella_semana_datos(p_account, (select este_lunes - 7 from lunes)) is distinct from (select huella_semana from ult) as extraccion_nueva,
           (select huella_semana from ult) is null as sin_marcadores
  )
  select jsonb_build_object(
    'ultima_corrida', (select created_at from ult), 'semana_analizada', (select semana_analizada from ult),
    'semana_disponible', (select semanal from datos), 'diaria_hasta', (select diaria from datos),
    'semana_a_analizar', (select este_lunes - 7 from lunes),
    'semana_cerrada_disponible', (select semanal from datos) >= (select este_lunes - 7 from lunes) and (select diaria from datos) >= (select este_lunes - 1 from lunes),
    'hubo_corrida_hoy', coalesce((select created_at::date = current_date from ult), false),
    'misma_semana_ya_analizada', coalesce((select semana_analizada from ult) = (select este_lunes - 7 from lunes), false),
    'marcadores_para_la_proxima', jsonb_build_object(
      'ultimo_evento_visto', (select ev from ahora),
      'ultima_extraccion_vista', (select ex from ahora),
      'huella_semana', huella_semana_datos(p_account, (select este_lunes - 7 from lunes))),
    'hay_datos_nuevos', coalesce((select pulso_nuevo or operador_nuevo or coalesce(google_nuevo, false) or coalesce(extraccion_nueva, false) or sin_marcadores from nuevo), true),
    'detalle', (select jsonb_build_object('pulso', pulso_nuevo, 'operador', operador_nuevo, 'google', coalesce(google_nuevo, false), 'extraccion', coalesce(extraccion_nueva, false), 'primera_corrida_con_marcadores', sin_marcadores) from nuevo),
    'como_registrar', 'Al escribir la fila en run_quality, copia ultimo_evento_visto y ultima_extraccion_vista de marcadores_para_la_proxima. La huella_semana se completa sola con un trigger; no hace falta copiarla.',
    'redundante', coalesce((select semana_analizada from ult) = (select este_lunes - 7 from lunes), false)
      and not coalesce((select pulso_nuevo or operador_nuevo or coalesce(google_nuevo, false) or coalesce(extraccion_nueva, false) or sin_marcadores from nuevo), true),
    'por_que', case
      when not coalesce((select semana_analizada from ult) = (select este_lunes - 7 from lunes), false)
        then 'La semana ' || (select este_lunes - 7 from lunes) || ' todavia no se analizo. Corre.'
      when coalesce((select pulso_nuevo or operador_nuevo or coalesce(google_nuevo, false) or coalesce(extraccion_nueva, false) or sin_marcadores from nuevo), true)
        then 'La semana ya se analizo pero llegaron datos nuevos desde entonces (huella de contenido distinta, evento de Google, pulso u operador). Corre y decilo en el brief.'
      else 'La semana ' || (select este_lunes - 7 from lunes) || ' ya se analizo el ' ||
        (select created_at::date from ult) || ' y su contenido tiene la misma huella: reingestar lo mismo con run_ts nuevo ya no cuenta como dato nuevo. Registra redundante y para.' end
  );
$function$;
