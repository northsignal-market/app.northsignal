-- ================================================================
-- JERARQUÍA DE CAPAS
-- ================================================================
-- Seis pares de tablas contienen los mismos hechos con distinta granularidad:
--   campaign / campaign_daily
--   adgroup / adgroup_daily
--   keywords / keywords_daily
--   search_terms / search_terms_daily
--   budget / budget_daily
--   conversion_actions / conversion_actions_daily
--
-- El riesgo no es el espacio: es que un analisis consulte las dos y sume,
-- duplicando el gasto. Los comentarios de abajo marcan cual usar para que.

comment on table campaign is 'CAPA SEMANAL · una fila por campana y semana. Fuente de la mayoria de los briefs. NO sumar junto con campaign_daily: contienen los mismos hechos con distinta granularidad y sumarlas duplica el gasto. Verificado: la semana del 24 de agosto da 935,39 EUR en KAREDO por las dos vias.';

comment on table keywords is 'CAPA SEMANAL · inventario COMPLETO de keywords, incluidas las que no tuvieron impresiones. Esa es su diferencia con keywords_daily, que solo trae las que tuvieron actividad. Para saber que keywords EXISTEN, usar esta. Para saber que dia se movio una, usar la diaria.';

comment on table search_terms is 'CAPA SEMANAL · terminos de busqueda de la semana. Para detectar el dia en que aparecio un termino nuevo, usar search_terms_daily o v_terminos_nuevos.';

comment on table conversion_actions is 'CAPA SEMANAL · conversiones por accion. La diaria equivalente es conversion_actions_daily.';


-- ================================================================
-- PUNTO DE ENTRADA ÚNICO
-- ================================================================
-- Devuelve el mapa completo de la base: que hay, para que sirve y cual
-- es la capa correcta segun la pregunta. Es lo primero que deberia leer
-- cualquier analisis antes de consultar nada.
create or replace function diccionario_datos()
returns table (
  capa text,
  objeto text,
  usar_para text,
  cuidado text
)
language sql stable
set search_path = public, pg_temp
as $$
  select * from (values
    ('ENTRADA','get_weekly_package(cuenta)','Paquete completo del analisis semanal en una llamada: brief, estado de cuenta, alertas altas, tendencia 8 semanas, keywords con problema y cambios','Es el punto de partida. No consultar tablas sueltas antes de leer esto'),
    ('ENTRADA','get_view_data(vista,cuenta,...)','Datos, conteo y totales de cualquier vista de analisis, con filtros, orden y paginacion resueltos en Postgres','Solo acepta las 8 vistas de analisis'),
    ('ENTRADA','diccionario_datos()','Este mapa','Leerlo cuando haya dudas sobre que capa usar'),

    ('SEMANAL','weekly_brief','Totales de la semana ya comparados contra la previa, campanas, top keywords, terminos sin conversion, cambios y alertas','Capa pre-agregada por el script. Punto de partida del brief'),
    ('SEMANAL','account_state','Que existe hoy en la cuenta: campanas, grupos, targets, conteos, acciones de conversion','UNICA fuente de verdad sobre estructura. Si algo no esta aca, no existe'),
    ('SEMANAL','v_campaign_analisis / v_adgroup_analisis / v_keywords_analisis / v_search_terms_analisis','Rendimiento semanal por entidad','No exponen conv_value, all_conversions ni roas a proposito'),
    ('SEMANAL','keywords','Inventario COMPLETO, incluidas las sin impresiones','Para saber que keywords existen'),

    ('DIARIA','v_serie_diaria','Gasto, conversiones y CPA por dia y cuenta','Base del centro de mando y del patron por dia de semana'),
    ('DIARIA','v_campaign_daily / v_adgroup_daily','Rendimiento por dia y entidad, con marca de madurez','Filtrar madurez = consolidado antes de concluir sobre conversiones'),
    ('DIARIA','v_keywords_daily / v_search_terms_daily','Actividad diaria por keyword o termino','Solo filas con impresiones: ausencia = cero actividad, no dato faltante'),
    ('DIARIA','v_dia_con_cambios','Cada dia con su rendimiento y los cambios aplicados ese mismo dia','Responde si un movimiento lo causo un cambio propio o el mercado'),
    ('DIARIA','v_terminos_nuevos','Terminos que aparecieron en los ultimos 14 dias y cuanto gastaron','Un termino nuevo que ya gasto sin convertir es candidato a negativa'),
    ('DIARIA','v_keyword_tendencia','Acumulado por keyword con dias_con_actividad','Distingue gasto parejo de gasto concentrado en pocos dias'),

    ('INTRADIA','google_live_events','Pulso horario del dia EN CURSO y cambios detectados','NUNCA sumar spend_today: son instantaneas acumulativas del mismo dia. Tomar el ultimo valor'),

    ('NEGOCIO','true_roas_events','Montos reales de cierres con su identificador de clic','Fuente de verdad de negocio en 360 y BHI, por encima de las conversiones de Google'),
    ('NEGOCIO','cierres_sin_atribucion','Cierres reales sin identificador de clic','Son ingresos que existen pero no se pueden atribuir a una campana'),

    ('SALUD','v_data_health','Frescura y completitud por cuenta','Consultar SIEMPRE antes de analizar. Si no esta OK, los datos pueden ser viejos'),
    ('SALUD','v_integridad_datos','Cruza el gasto desde campana, grupo y keyword','Deben coincidir. Si no, hubo truncado en la extraccion'),
    ('SALUD','v_webhook_health','Estado de las integraciones entrantes','SIN ACTIVIDAD por dias suele significar webhook desactivado, no ausencia de novedades'),

    ('DIAGNOSTICO','v_fuzzy_negatives','Terminos que difieren 1-2 letras de una negativa existente','NUNCA aplicar en lote: puede ser un usuario escribiendo mal la marca'),
    ('DIAGNOSTICO','v_ngrams_sin_conversion','Palabras sueltas que acumulan gasto sin convertir','Candidatas a negativa amplia'),
    ('DIAGNOSTICO','v_keywords_atencion','Keywords activas con problema y motivo clasificado','Nombres exactos listos para copiar a un accionable')
  ) as t(capa, objeto, usar_para, cuidado);
$$;

comment on function diccionario_datos() is 'Mapa de la base: que objeto usar para cada pregunta y que trampas tiene cada uno. Consultar al inicio de cualquier analisis que no sea el flujo semanal estandar.';;
