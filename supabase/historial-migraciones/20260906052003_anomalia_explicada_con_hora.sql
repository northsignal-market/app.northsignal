-- La tarea de BHI del 6 sep detecto que la vista atribuia el derrumbe del
-- viernes 28 al cambio de las 21:17: razonaba por dia, no por hora. Un cambio
-- a las 21:17 no explica 21 horas previas de gasto bajo. Ahora la explicacion
-- considera la hora del primer cambio del dia.
drop view if exists v_anomalia_explicada;
create view v_anomalia_explicada as
with cambios_dia as (
  select account, substring(change_datetime from 1 for 10)::date as fecha,
         min(substring(change_datetime from 12 for 5)) as primera_hora,
         count(*) as n,
         bool_or(client_type like '%RECOMMENDATION%' or client_type like '%GOOGLE_FIRST_PARTY%') as automatico
  from change_events where change_datetime is not null
  group by account, substring(change_datetime from 1 for 10)::date
),
op_dia as (
  select account, fecha, min(hora)::text as primera_hora, count(*) as n
  from operator_log group by account, fecha
)
select
  a.account, a.date, a.severidad, a.metrica_anomala, a.gasto_direccion, a.cpa_direccion,
  a.gasto_z, a.cpa_z, a.gasto, a.gasto_baseline, a.cpa, a.cpa_baseline,
  a.gasto_vs_sem_prev_pct, a.cpa_vs_sem_prev_pct,
  (select c.campaign from campaign_daily c
   where c.account = a.account and c.date = a.date
   order by abs(c.cost - (select avg(p.cost) from campaign_daily p
                          where p.account=c.account and p.campaign=c.campaign and p.date between a.date-7 and a.date-1)) desc nulls last
   limit 1) as campana_principal,
  coalesce(cd.n, 0) as cambios_ese_dia,
  cd.primera_hora as hora_primer_cambio,
  coalesce(cd.automatico, false) as hubo_cambio_automatico,
  coalesce(od.n, 0) as cambios_operador_ese_dia,
  case
    -- Cambio automatico de Google: causa probable sin importar hora
    when cd.automatico then 'Cambio automático de Google ese día (' || cd.primera_hora || ')'
    -- Cambio propio TEMPRANO (antes de las 12): puede explicar el dia entero
    when cd.n > 0 and cd.primera_hora < '12:00' then 'Cambio propio a las ' || cd.primera_hora || ': puede explicar el día'
    -- Cambio propio TARDE (despues de las 18): NO explica el dia, mas probable que sea reaccion
    when cd.n > 0 and cd.primera_hora >= '18:00' then 'Cambio propio a las ' || cd.primera_hora || ': demasiado tarde para causar el día. Más probable: reacción a lo que pasó'
    when cd.n > 0 then 'Cambio propio a las ' || cd.primera_hora || ': explica parte del día, no todo'
    -- Registro del operador sin change_event
    when od.n > 0 then 'Andrés registró ' || od.n || ' cambio(s) en operator_log ese día. Ver el motivo ahí'
    -- Patron semanal
    when a.gasto_vs_sem_prev_pct is not null and abs(a.gasto_vs_sem_prev_pct) < 25 then 'Similar al mismo día de la semana previa: patrón semanal, no anomalía'
    else 'Sin cambios registrados ese día. Siguiente paso: operator_log y v_cambios_detectados, no "fue el mercado"'
  end as explicacion
from v_anomalias_diarias a
left join cambios_dia cd on cd.account = a.account and cd.fecha = a.date
left join op_dia od on od.account = a.account and od.fecha = a.date
where a.severidad in ('media','alta','critica');

comment on view v_anomalia_explicada is 'Dias anomalos con explicacion que considera la HORA del primer cambio. Un cambio despues de las 18:00 no puede causar el dia: es mas probable reaccion. Detectado por la tarea de BHI el 6 sep 2026. Si dice "sin cambios registrados", el siguiente paso es operator_log y v_cambios_detectados.';

select account, to_char(date,'Dy DD') dia, severidad, hora_primer_cambio, explicacion from v_anomalia_explicada where account='BHI' order by date;;
