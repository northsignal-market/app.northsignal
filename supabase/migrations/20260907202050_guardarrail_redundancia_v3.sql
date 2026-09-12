-- ================================================================
-- El guardarrail de redundancia tenia rotas SUS DOS RAMAS de novedad:
--   google: el centinela reingesta los mismos change_events en cada corrida
--     (90 filas para 28 eventos reales en Karedo). created_at siempre es nuevo,
--     asi que google_nuevo era true siempre. Se mide por event_date, que es
--     CUANDO PASO el cambio, no cuando lo leimos.
--   extraccion: la tolerancia de 5 horas por husos hacia que una extraccion de
--     las 16:08 siguiera contando como nueva a las 20:02. Se compara contra el
--     maximo run_ts conocido en la corrida anterior, no contra su hora.
-- Sin esto ninguna corrida podia marcarse redundante NUNCA, y cinco disparos del
-- mismo dia llegaban hasta el final para descubrir que no habia nada nuevo.
-- ================================================================
alter table run_quality add column if not exists ultimo_evento_visto timestamptz;
alter table run_quality add column if not exists ultima_extraccion_vista timestamptz;
comment on column run_quality.ultimo_evento_visto is 'Maximo event_date de google_live_events al momento de la corrida. Se compara contra esto, no contra created_at, porque el centinela reingesta los mismos eventos.';

create or replace function corrida_redundante(p_account text) returns jsonb
language sql stable set search_path to 'public','pg_temp' as $function$
  with ult as (
    select semana_analizada, created_at, foto_leida, ultimo_evento_visto, ultima_extraccion_vista
    from run_quality where account = p_account
      and coalesce(que_fallo, '') not ilike 'redundante%' and coalesce(que_fallo, '') not ilike 'semana cerrada no disponible%'
    order by created_at desc limit 1
  ),
  datos as (select max(date) diaria, (select max(week_start) from campaign where account = p_account) semanal from campaign_daily where account = p_account),
  ahora as (
    select (select max(event_date) from google_live_events g where g.account = p_account and g.event_type in ('USER_CHANGE','AUTO_CHANGE') and coalesce(g.client_type,'') <> 'AI_MAX_SETTING') ev,
           (select max(run_ts) from run_log r where r.account = p_account and upper(r.status) = 'OK') ex
  ),
  nuevo as (
    select exists (select 1 from pulso_diario p, ult where p.account = p_account and p.created_at > ult.created_at) as pulso_nuevo,
           exists (select 1 from operator_log o, ult where o.account = p_account and o.created_at > ult.created_at) as operador_nuevo,
           -- Por event_date: un evento reingestado tiene el mismo event_date, asi que no cuenta
           (select ev from ahora) is not null and (
             (select ultimo_evento_visto from ult) is null and (select created_at from ult) is null
             or (select ev from ahora) > coalesce((select ultimo_evento_visto from ult), '-infinity'::timestamptz)
           ) and (select ultimo_evento_visto from ult) is not null as google_nuevo,
           -- Por run_ts absoluto: si es el mismo run_ts que la corrida anterior ya vio, no es nuevo
           (select ex from ahora) is not null
             and (select ex from ahora) > coalesce((select ultima_extraccion_vista from ult), '-infinity'::timestamptz)
             and (select ultima_extraccion_vista from ult) is not null as extraccion_nueva,
           -- Respaldo para corridas viejas que no guardaron los marcadores: la ventana de 5 horas
           (select ultimo_evento_visto from ult) is null as sin_marcadores
  ),
  lunes as (select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date as este_lunes)
  select jsonb_build_object(
    'ultima_corrida', (select created_at from ult), 'semana_analizada', (select semana_analizada from ult),
    'semana_disponible', (select semanal from datos), 'diaria_hasta', (select diaria from datos),
    'semana_a_analizar', (select este_lunes - 7 from lunes),
    'semana_cerrada_disponible', (select semanal from datos) >= (select este_lunes - 7 from lunes) and (select diaria from datos) >= (select este_lunes - 1 from lunes),
    'hubo_corrida_hoy', coalesce((select created_at::date = current_date from ult), false),
    'marcadores_para_la_proxima', jsonb_build_object('ultimo_evento_visto', (select ev from ahora), 'ultima_extraccion_vista', (select ex from ahora)),
    'hay_datos_nuevos', coalesce((select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva or sin_marcadores from nuevo), true),
    'detalle', (select jsonb_build_object('pulso', pulso_nuevo, 'operador', operador_nuevo, 'google', google_nuevo, 'extraccion', extraccion_nueva, 'primera_corrida_con_marcadores', sin_marcadores) from nuevo),
    'como_registrar', 'Al escribir la fila en run_quality, copiá marcadores_para_la_proxima en ultimo_evento_visto y ultima_extraccion_vista. Sin eso la proxima corrida no puede saber que ya viste.',
    'redundante', coalesce((select created_at::date = current_date from ult), false)
      and not coalesce((select pulso_nuevo or operador_nuevo or google_nuevo or extraccion_nueva or sin_marcadores from nuevo), true)
  );
$function$;
-- Sembrar los marcadores en la ultima corrida real de cada cuenta
update run_quality r set
  ultimo_evento_visto = (select max(event_date) from google_live_events g where g.account = r.account and g.event_type in ('USER_CHANGE','AUTO_CHANGE') and coalesce(g.client_type,'') <> 'AI_MAX_SETTING'),
  ultima_extraccion_vista = (select max(run_ts) from run_log l where l.account = r.account and upper(l.status) = 'OK')
where r.id in (select distinct on (account) id from run_quality where coalesce(que_fallo,'') not ilike 'redundante%' order by account, created_at desc);
select account, (corrida_redundante(account))->>'redundante' redundante, (corrida_redundante(account))->'detalle' detalle
from cuentas where activa order by account;;
