-- TICKET 54 · change_events.change_datetime: TEXT → timestamptz
-- ENSAYADO COMPLETO en Supabase local el 12/9/2026 (supabase start + db reset con la línea de base).
-- El radio REAL, medido en el ensayo (el ticket mapeaba menos):
--   · 7 vistas (el ticket decía 6): + v_dia_con_cambios, que depende de v_change_annotations.
--   · 6 vistas hacían SUBSTRING sobre la columna (el ticket decía 1), algunas con alias c.
--   · doc_cronologia también hacía SUBSTRING y se reescribe (el ticket decía que ningún cast fallaba).
--   · Las otras 4 funciones del radio pasan sin tocar. El índice uq_change_events se reconstruye solo.
-- Zona horaria: el cast interpreta el reloj de pared original como hora de sesión (UTC en Supabase),
-- la decisión del plan del 9/9 se mantiene. El script de Google sigue insertando strings: castean solos.
-- v_change_annotations.fecha pasa de text a DATE: mata también el drift 'fecha es text' de esa vista.
begin;
drop view public.v_dia_con_cambios;
drop view public.v_anomalia_explicada;
drop view public.v_cambios_fuera_del_log;
drop view public.v_cambios_invisibles_para_google;
drop view public.v_cambios_para_cruce;
drop view public.v_change_annotations;
drop view public.v_todos_los_cambios;
alter table public.change_events alter column change_datetime type timestamptz using change_datetime::timestamptz;

create view public.v_anomalia_explicada with (security_invoker='on') as
 WITH cambios_dia AS (
         SELECT change_events.account,
            change_events.change_datetime::date AS fecha,
            min(to_char(change_events.change_datetime, 'HH24:MI'::text)) AS primera_hora,
            count(*) AS n,
            bool_or(change_events.client_type ~~ '%RECOMMENDATION%'::text OR change_events.client_type ~~ '%GOOGLE_FIRST_PARTY%'::text) AS automatico
           FROM change_events
          WHERE change_events.change_datetime IS NOT NULL
          GROUP BY change_events.account, (change_events.change_datetime::date)
        ), op_dia AS (
         SELECT operator_log.account,
            operator_log.fecha,
            min(operator_log.hora)::text AS primera_hora,
            count(*) AS n
           FROM operator_log
          GROUP BY operator_log.account, operator_log.fecha
        )
 SELECT a.account,
    a.date,
    a.severidad,
    a.metrica_anomala,
    a.gasto_direccion,
    a.cpa_direccion,
    a.gasto_z,
    a.cpa_z,
    a.gasto,
    a.gasto_baseline,
    a.cpa,
    a.cpa_baseline,
    a.gasto_vs_sem_prev_pct,
    a.cpa_vs_sem_prev_pct,
    ( SELECT c.campaign
           FROM campaign_daily c
          WHERE c.account = a.account AND c.date = a.date
          ORDER BY (abs(c.cost - (( SELECT avg(p.cost) AS avg
                   FROM campaign_daily p
                  WHERE p.account = c.account AND p.campaign = c.campaign AND p.date >= (a.date - 7) AND p.date <= (a.date - 1))))) DESC NULLS LAST
         LIMIT 1) AS campana_principal,
    COALESCE(cd.n, 0::bigint) AS cambios_ese_dia,
    cd.primera_hora AS hora_primer_cambio,
    COALESCE(cd.automatico, false) AS hubo_cambio_automatico,
    COALESCE(od.n, 0::bigint) AS cambios_operador_ese_dia,
        CASE
            WHEN cd.automatico THEN ('Cambio automático de Google ese día ('::text || cd.primera_hora) || ')'::text
            WHEN cd.n > 0 AND cd.primera_hora < '12:00'::text THEN ('Cambio propio a las '::text || cd.primera_hora) || ': puede explicar el día'::text
            WHEN cd.n > 0 AND cd.primera_hora >= '18:00'::text THEN ('Cambio propio a las '::text || cd.primera_hora) || ': demasiado tarde para causar el día. Más probable: reacción a lo que pasó'::text
            WHEN cd.n > 0 THEN ('Cambio propio a las '::text || cd.primera_hora) || ': explica parte del día, no todo'::text
            WHEN od.n > 0 THEN ('Andrés registró '::text || od.n) || ' cambio(s) en operator_log ese día. Ver el motivo ahí'::text
            WHEN a.gasto_vs_sem_prev_pct IS NOT NULL AND abs(a.gasto_vs_sem_prev_pct) < 25::numeric THEN 'Similar al mismo día de la semana previa: patrón semanal, no anomalía'::text
            ELSE 'Sin cambios registrados ese día. Siguiente paso: operator_log y v_cambios_detectados, no "fue el mercado"'::text
        END AS explicacion
   FROM v_anomalias_diarias a
     LEFT JOIN cambios_dia cd ON cd.account = a.account AND cd.fecha = a.date
     LEFT JOIN op_dia od ON od.account = a.account AND od.fecha = a.date
  WHERE a.severidad = ANY (ARRAY['media'::text, 'alta'::text, 'critica'::text]);
;

create view public.v_cambios_fuera_del_log with (security_invoker='on') as
 SELECT account,
    entity_type,
    entity_name,
    detectado_entre,
    detectado_hasta,
    campos_cambiados
   FROM v_cambios_detectados d
  WHERE NOT (EXISTS ( SELECT 1
           FROM change_events c
          WHERE c.account = d.account AND c.change_datetime::date >= d.detectado_entre AND c.change_datetime::date <= d.detectado_hasta AND c.resource_type = upper(d.entity_type)));
;

create view public.v_cambios_invisibles_para_google with (security_invoker='on') as
 SELECT id,
    account,
    fecha,
    hora,
    que_cambio,
    donde,
    valor_anterior,
    valor_nuevo,
    por_que,
    accionable_notion_id,
    created_at
   FROM operator_log o
  WHERE NOT (EXISTS ( SELECT 1
           FROM change_events c
          WHERE c.account = o.account AND c.change_datetime::date = o.fecha));
;

create view public.v_cambios_para_cruce with (security_invoker='on') as
 SELECT account,
    change_datetime::date AS fecha,
    to_char(change_datetime, 'HH24:MI:SS'::text) AS hora,
    resource_type,
    operation,
    entity_name,
    campaign_name,
    ad_group_name,
    changed_field,
    old_value,
    new_value,
    user_email,
    client_type ~~ '%RECOMMENDATION%'::text OR client_type ~~ '%GOOGLE_FIRST_PARTY%'::text AS automatico,
        CASE
            WHEN changed_field = 'status'::text AND new_value = 'PAUSED'::text THEN ((('Pauso '::text || lower(resource_type)) || ' "'::text) || COALESCE(entity_name, '?'::text)) || '"'::text
            WHEN changed_field = 'status'::text AND new_value = 'ENABLED'::text THEN ((('Activo '::text || lower(resource_type)) || ' "'::text) || COALESCE(entity_name, '?'::text)) || '"'::text
            WHEN operation = 'CREATE'::text THEN ((('Creo '::text || lower(resource_type)) || ' "'::text) || COALESCE(entity_name, new_value, '?'::text)) || '"'::text
            WHEN operation = 'REMOVE'::text THEN ((('Elimino '::text || lower(resource_type)) || ' "'::text) || COALESCE(entity_name, '?'::text)) || '"'::text
            WHEN changed_field ~~ '%target_cpa%'::text OR changed_field ~~ '%targetCpa%'::text THEN (((('Cambio tCPA de "'::text || COALESCE(entity_name, '?'::text)) || '": '::text) || COALESCE(old_value, '?'::text)) || ' -> '::text) || COALESCE(new_value, '?'::text)
            WHEN changed_field ~~ '%budget%'::text OR changed_field ~~ '%amount%'::text THEN (((('Cambio presupuesto de "'::text || COALESCE(entity_name, '?'::text)) || '": '::text) || COALESCE(old_value, '?'::text)) || ' -> '::text) || COALESCE(new_value, '?'::text)
            ELSE (((('Modifico '::text || COALESCE(changed_field, '(campo no registrado)'::text)) || ' de "'::text) || COALESCE(entity_name, '?'::text)) || '"'::text) ||
            CASE
                WHEN old_value IS NOT NULL OR new_value IS NOT NULL THEN ((': '::text || COALESCE(old_value, '?'::text)) || ' -> '::text) || COALESCE(new_value, '?'::text)
                ELSE ''::text
            END
        END AS descripcion
   FROM change_events
  WHERE change_datetime IS NOT NULL;
;

create view public.v_change_annotations with (security_invoker='on') as
 SELECT account,
    change_datetime::date AS fecha,
    count(*) AS cantidad_cambios,
    bool_or(client_type ~~ '%RECOMMENDATION%'::text) AS incluye_auto_google,
    string_agg(DISTINCT resource_type, ', '::text) AS recursos_tocados,
    string_agg(DISTINCT changed_field, ', '::text) AS campos_tocados
   FROM change_events
  WHERE change_datetime IS NOT NULL
  GROUP BY account, (change_datetime::date);
;

create view public.v_todos_los_cambios with (security_invoker='on') as
 SELECT operator_log.account,
    operator_log.fecha,
    operator_log.hora,
    'operador'::text AS fuente,
    COALESCE(operator_log.donde, 'sin ambito'::text) AS ambito,
    operator_log.que_cambio AS detalle,
    operator_log.valor_anterior,
    operator_log.valor_nuevo,
    operator_log.por_que,
    false AS automatico
   FROM operator_log
UNION ALL
 SELECT change_events.account,
    change_events.change_datetime::date AS fecha,
    change_events.change_datetime::time without time zone AS hora,
    'change_events'::text AS fuente,
    change_events.resource_type AS ambito,
    COALESCE(change_events.changed_field, '(campo no registrado)'::text) AS detalle,
    change_events.old_value AS valor_anterior,
    change_events.new_value AS valor_nuevo,
    NULL::text AS por_que,
    change_events.client_type ~~ '%RECOMMENDATION%'::text OR change_events.client_type ~~ '%GOOGLE_FIRST_PARTY%'::text AS automatico
   FROM change_events
  WHERE change_events.change_datetime IS NOT NULL
UNION ALL
 SELECT v_cambios_detectados.account,
    v_cambios_detectados.detectado_hasta AS fecha,
    NULL::time without time zone AS hora,
    'snapshot'::text AS fuente,
    v_cambios_detectados.entity_type AS ambito,
    (v_cambios_detectados.entity_name || ' · '::text) || (( SELECT string_agg(k.k, ', '::text) AS string_agg
           FROM jsonb_object_keys(v_cambios_detectados.campos_cambiados) k(k))) AS detalle,
    v_cambios_detectados.campos_cambiados::text AS valor_anterior,
    NULL::text AS valor_nuevo,
    (('Detectado por diferencia entre snapshots del '::text || v_cambios_detectados.detectado_entre) || ' y el '::text) || v_cambios_detectados.detectado_hasta AS por_que,
    false AS automatico
   FROM v_cambios_detectados;
;

create view public.v_dia_con_cambios with (security_invoker='on') as
 SELECT s.account,
    s.date,
    s.gasto,
    s.conversiones,
    s.cpa,
    s.ctr,
    s.madurez,
    COALESCE(c.cantidad_cambios, 0::bigint) AS cambios_ese_dia,
    COALESCE(c.incluye_auto_google, false) AS hubo_cambio_automatico,
    c.campos_tocados,
    lag(s.cpa) OVER (PARTITION BY s.account ORDER BY s.date) AS cpa_dia_previo,
    round(s.cpa - lag(s.cpa) OVER (PARTITION BY s.account ORDER BY s.date), 2) AS delta_cpa
   FROM v_serie_diaria s
     LEFT JOIN v_change_annotations c ON c.account = s.account AND c.fecha = s.date;
;

CREATE OR REPLACE FUNCTION public.doc_cronologia(p_account text, p_dias integer DEFAULT 60)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with ev as (
    select fecha as f, 'Andrés: ' || left(que_cambio, 160) || coalesce(' (' || donde || ')', '') as txt from operator_log where account = p_account and fecha >= current_date - p_dias
    union all
    select (change_datetime)::date,
           'Google Ads: ' || coalesce(entity_name, resource_type) || ' · ' || coalesce(changed_field, operation) || coalesce(': ' || left(old_value, 30) || ' → ' || left(new_value, 30), '') ||
           case when client_type like '%RECOMMENDATION%' then ' **[AUTO]**' else '' end
    from change_events where account = p_account and (change_datetime)::date >= current_date - p_dias
  )
  select string_agg(format('**%s** — %s', f, txt), E'\n' order by f desc) from (select * from ev order by f desc limit 40) x;
$function$

;
commit;
