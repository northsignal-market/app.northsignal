-- ================================================================
-- RETENCIÓN DEL PULSO INTRADÍA
-- ================================================================
-- El centinela corre cada hora (Google Ads Scripts no ofrece un intervalo
-- intermedio entre horario y diario). Son 24 snapshots por dia y por cuenta:
-- unas 26.000 filas al ano solo de METRICS.
--
-- Ese detalle solo sirve mientras el dia esta abierto. Una vez que el script
-- diario trae el dia cerrado y corregido, los snapshots dejan de aportar.

create or replace function limpiar_pulso_intradia()
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  n_borradas int;
begin
  -- Las metricas horarias mas viejas que 3 dias ya estan cubiertas por
  -- campaign_daily, que ademas trae el dato corregido.
  delete from google_live_events
  where event_type = 'METRICS'
    and event_date < now() - interval '3 days';
  get diagnostics n_borradas = row_count;

  -- Los cambios se conservan 90 dias: son el historial que permite
  -- explicar por que se movio una metrica meses despues.
  delete from google_live_events
  where event_type in ('USER_CHANGE','AUTO_CHANGE')
    and event_date < now() - interval '90 days';

  return 'Snapshots de metricas borrados: ' || n_borradas;
end;
$$;

comment on function limpiar_pulso_intradia() is 'Borra snapshots horarios de mas de 3 dias, que ya estan cubiertos por la capa diaria con el dato corregido. Los cambios se conservan 90 dias. Ejecutar semanalmente.';


-- ================================================================
-- LECTURA CORRECTA DEL PULSO
-- ================================================================
-- Sin esta vista, la trampa es sumar spend_today entre snapshots del mismo
-- dia. Cada fila trae el acumulado del dia hasta ese momento, asi que sumar
-- 24 filas multiplica el gasto por 24.
create or replace view v_pulso_hoy as
select distinct on (account)
  account,
  spend_today as gasto_hasta_ahora,
  conversions_today as conversiones_hasta_ahora,
  event_date as medido_a_las,
  round(extract(epoch from (now() - event_date)) / 60) as minutos_desde_medicion
from google_live_events
where event_type = 'METRICS'
  and event_date > now() - interval '24 hours'
order by account, event_date desc;

comment on view v_pulso_hoy is 'Ultimo snapshot de cada cuenta del dia en curso. Usar esta vista en lugar de consultar google_live_events directamente: cada fila de esa tabla es un acumulado, y sumarlas multiplica el gasto por la cantidad de mediciones.';


-- Cambios recientes, legibles, sin el ruido de los snapshots de metricas
create or replace view v_cambios_recientes as
select
  account,
  event_date,
  case when event_type = 'AUTO_CHANGE' then 'Google (automatico)' else coalesce(user_email,'usuario') end as quien,
  entity_name as que_cambio,
  client_type,
  (event_type = 'AUTO_CHANGE') as requiere_revision
from google_live_events
where event_type in ('USER_CHANGE','AUTO_CHANGE')
order by event_date desc;

comment on view v_cambios_recientes is 'Cambios detectados por el centinela, sin los snapshots de metricas. requiere_revision marca los aplicados por Google: en BHI eso es un asunto de cumplimiento legal, no de rendimiento.';;
