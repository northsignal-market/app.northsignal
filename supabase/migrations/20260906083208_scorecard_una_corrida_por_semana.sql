-- Las corridas repetidas sobre la misma semana (cinco el 6 sep) no deben inflar
-- la tendencia. v_run_scorecard muestra todas con una marca; v_run_tendencia
-- cuenta solo la ultima por (cuenta, semana).
drop view if exists v_run_tendencia;
drop view if exists v_run_scorecard;

create view v_run_scorecard as
select account, run_date, semana_analizada,
       coalesce(brief_creado_o_actualizado::int,0) + coalesce(handoff_escrito::int,0) + coalesce((handoff_lineas between 1 and 5)::int,0)
       + coalesce(fechas_explicitas::int,0) + coalesce(dias_provisionales_marcados::int,0)
       + coalesce((accionables_con_naturaleza = accionables_nuevos)::int,0) + coalesce((accionables_con_causa_raiz = accionables_nuevos)::int,0)
       + coalesce((accionables_con_verificar_fecha = accionables_nuevos)::int,0) + coalesce(titulos_son_acciones::int,0)
       + coalesce((comentarios_pendientes = 0)::int,0) + coalesce(propagacion_ejecutada::int,0) + coalesce(operator_log_consultado::int,0)
       + coalesce(cambios_detectados_consultado::int,0) + coalesce(inferencias_en_bloqueado::int,0) + coalesce(duplicado_evitado::int,0) as puntos,
       15 as puntos_posibles, revision_humana, que_fallo, preguntas_a_andres, tiempo_estimado_min,
       lag(run_date) over (partition by account order by run_date, id) as corrida_previa,
       -- Ultima corrida por semana analizada: la que cuenta para la tendencia
       row_number() over (partition by account, semana_analizada order by run_date desc, id desc) = 1 as es_ultima_de_la_semana,
       count(*) over (partition by account, semana_analizada) as corridas_sobre_esta_semana
from run_quality;
comment on view v_run_scorecard is 'Puntaje de cada corrida sobre 15. es_ultima_de_la_semana marca la corrida que cuenta para la tendencia; las repetidas sobre la misma semana (ej. cinco el 6 sep) se ven pero no pesan.';

create view v_run_tendencia as
select account, count(*) as semanas_evaluadas,
       round(avg(puntos)::numeric / 15 * 100, 1) as cumplimiento_promedio_pct,
       round((array_agg(puntos order by semana_analizada desc))[1]::numeric / 15 * 100, 1) as cumplimiento_ultima_pct,
       max(semana_analizada) as ultima_semana,
       sum(corridas_sobre_esta_semana) as corridas_totales
from v_run_scorecard where es_ultima_de_la_semana group by account;
comment on view v_run_tendencia is 'Cumplimiento por cuenta contando UNA corrida por semana analizada (la ultima). corridas_totales muestra cuantas hubo en realidad.';

select account, semanas_evaluadas, cumplimiento_promedio_pct, corridas_totales from v_run_tendencia;;
