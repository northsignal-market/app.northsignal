-- ================================================================
-- EVALUACIÓN DE CADA CORRIDA SEMANAL
-- ================================================================
-- Sin esto, no hay forma de saber si el sistema mejora o se degrada.
-- La practica establecida: chequeos deterministas cubren el 60-70% de la
-- evaluacion, un modelo juzga solo lo subjetivo, y cada fallo de produccion
-- se convierte en un caso de regresion.
--
-- El agente completa esta tabla al final de cada corrida, respondiendo una
-- lista fija de preguntas si/no que puede verificar contra lo que escribio.
-- No es autoevaluacion de calidad: es verificacion de cumplimiento.
-- ================================================================
create table if not exists run_quality (
  id bigserial primary key,
  account text not null,
  run_date date not null default current_date,
  semana_analizada date,
  -- Chequeos deterministas: si o no, verificables contra la salida
  brief_creado_o_actualizado boolean,
  handoff_escrito boolean,
  handoff_lineas int,
  fechas_explicitas boolean,             -- ninguna referencia relativa
  dias_provisionales_marcados boolean,
  accionables_nuevos int,
  accionables_con_naturaleza int,        -- deben coincidir con los nuevos
  accionables_con_causa_raiz int,
  accionables_con_verificar_fecha int,
  titulos_son_acciones boolean,          -- ningun "Revisar", "Evaluar", "Decidir"
  comentarios_respondidos int,
  comentarios_pendientes int,            -- los de Andres sin responder
  propagacion_ejecutada boolean,         -- reviso relacionados al cambiar estados
  operator_log_consultado boolean,
  cambios_detectados_consultado boolean,
  inferencias_en_bloqueado boolean,      -- ninguna inferencia nacio en Propuesto
  preguntas_a_andres int,                -- cuantas cosas dependen de el
  duplicado_evitado boolean,             -- detecto que la semana ya tenia brief
  -- Lo que solo un humano puede juzgar
  revision_humana text,                  -- Andres: OK / REVISAR / ERROR + nota
  revision_humana_fecha date,
  -- Diagnostico del propio agente
  que_fallo text,                        -- si algo no pudo hacer, que y por que
  tiempo_estimado_min int,
  created_at timestamptz default now()
);
create index if not exists idx_run_quality_acct on run_quality (account, run_date desc);
alter table run_quality enable row level security;

comment on table run_quality is 'Una fila por corrida semanal y cuenta. Chequeos deterministas que el agente verifica contra su propia salida al terminar. No mide calidad de analisis, mide cumplimiento del procedimiento: si cada campo obligatorio quedo escrito, si consulto lo que debia, si evito lo que debia evitar. revision_humana es el unico campo subjetivo y lo completa Andres.';


-- Puntaje de cumplimiento y tendencia
create or replace view v_run_scorecard as
select
  account, run_date, semana_analizada,
  -- Puntaje: cada chequeo vale 1, las cuentas comparan contra su objetivo
  (coalesce(brief_creado_o_actualizado::int,0)
   + coalesce(handoff_escrito::int,0)
   + coalesce((handoff_lineas between 1 and 5)::int,0)
   + coalesce(fechas_explicitas::int,0)
   + coalesce(dias_provisionales_marcados::int,0)
   + coalesce((accionables_con_naturaleza = accionables_nuevos)::int,0)
   + coalesce((accionables_con_causa_raiz = accionables_nuevos)::int,0)
   + coalesce((accionables_con_verificar_fecha = accionables_nuevos)::int,0)
   + coalesce(titulos_son_acciones::int,0)
   + coalesce((comentarios_pendientes = 0)::int,0)
   + coalesce(propagacion_ejecutada::int,0)
   + coalesce(operator_log_consultado::int,0)
   + coalesce(cambios_detectados_consultado::int,0)
   + coalesce(inferencias_en_bloqueado::int,0)
   + coalesce(duplicado_evitado::int,0)
  ) as puntos,
  15 as puntos_posibles,
  revision_humana,
  que_fallo,
  preguntas_a_andres,
  tiempo_estimado_min,
  -- Comparacion contra la corrida previa de la misma cuenta
  lag(run_date) over (partition by account order by run_date) as corrida_previa
from run_quality;

comment on view v_run_scorecard is 'Cumplimiento por corrida, sobre 15 chequeos deterministas. Una caida de puntaje entre corridas es una regresion: algo del prompt o del entorno cambio. La columna que_fallo es donde el agente explica que no pudo hacer, que es la entrada del proximo ajuste.';


-- Tendencia por cuenta
create or replace view v_run_tendencia as
select account,
       count(*) as corridas,
       round(avg(puntos::numeric / puntos_posibles * 100), 1) as cumplimiento_promedio_pct,
       min(puntos) as peor, max(puntos) as mejor,
       sum(coalesce(preguntas_a_andres,0)) as preguntas_acumuladas,
       count(*) filter (where revision_humana like 'ERROR%') as errores_marcados_por_andres
from v_run_scorecard group by account;

comment on view v_run_tendencia is 'Resumen por cuenta. Si cumplimiento_promedio baja entre semanas, revisar que cambio. Si preguntas_acumuladas es alto, hay datos que el sistema deberia tener y no tiene. Si errores_marcados_por_andres sube, el prompt necesita una regla nueva.';;
