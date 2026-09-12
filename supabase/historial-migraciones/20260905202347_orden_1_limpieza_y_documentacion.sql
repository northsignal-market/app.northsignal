-- ================================================================
-- 1. ELIMINAR DUPLICADOS
-- ================================================================
-- Dos vistas hacen lo mismo que otras dos ya existentes. Peor: la version
-- duplicada de fuzzy no trae la columna de advertencia, asi que quien la
-- consulte podria bloquear un termino que en realidad es un usuario
-- escribiendo mal la marca. Caso real detectado: "koredo" contra "karedo".
drop view if exists v_alertas_fuzzy_negatives;
drop view if exists v_search_term_1grams;


-- ================================================================
-- 2. DOCUMENTAR LO QUE FALTABA
-- ================================================================
-- Un modelo que consulta esta base decide que usar leyendo estos comentarios.
-- Un objeto sin documentar es un objeto que se va a usar mal o no se va a usar.

comment on table adgroup is 'CAPA SEMANAL. Grupos de anuncios por semana. Para analisis diario usar adgroup_daily. No mezclar ambas en una misma suma.';
comment on table ads is 'CAPA SEMANAL. Anuncios con metricas de la semana. Solo los que tuvieron impresiones.';
comment on table audiences is 'CAPA SEMANAL. Audiencias a nivel campana y grupo, con su modificador de puja.';
comment on table budget is 'CAPA SEMANAL. Presupuesto y ritmo de gasto. Para diario usar budget_daily.';
comment on table device is 'CAPA SEMANAL. Rendimiento por dispositivo.';
comment on table geo is 'CAPA SEMANAL. Rendimiento por ubicacion, solo filas con clics.';
comment on table hour_day is 'CAPA SEMANAL. Rendimiento por dia de la semana y hora. Con la capa diaria disponible, v_serie_diaria da mejor lectura de patron semanal.';
comment on table landing_pages is 'CAPA SEMANAL. Rendimiento por URL de destino.';

comment on table adgroup_daily is 'CAPA DIARIA. Grupos por dia, ventana movil de 14 dias con correccion. Consultar via v_adgroup_daily para tener la marca de madurez.';
comment on table budget_daily is 'CAPA DIARIA. Presupuesto y gasto real por dia, con ritmo calculado.';

comment on table google_live_events is 'PULSO INTRADIA. Snapshot horario del gasto y las conversiones del dia EN CURSO, mas los cambios detectados. Es una serie de instantaneas acumulativas, no un agregado: dos filas del mismo dia contienen el mismo gasto medido en momentos distintos. NUNCA sumar spend_today; tomar el ultimo valor del dia. Para el gasto diario cerrado usar v_serie_diaria.';

comment on table actionables_memory is 'Memoria semantica de accionables historicos, con embeddings para busqueda por similitud. Sin usar todavia: no hay proceso que la llene.';
comment on table entity_states is 'Estado por entidad con cooldown, para evitar alertar dos veces sobre lo mismo. Sin usar todavia.';
comment on table pending_mutations is 'Cola de cambios a aplicar en Google Ads. Solo se ejecutan las filas con status APPROVED y approved_by no nulo. Nunca las PENDING.';

comment on view v_adgroup_daily is 'Grupos por dia con marca de madurez. Filtrar madurez = consolidado para conclusiones sobre conversiones.';
comment on view v_keywords_daily is 'Keywords con actividad diaria y motivo clasificado. Solo filas con impresiones: la ausencia de una keyword en una fecha significa cero actividad, no dato faltante.';
comment on view v_search_terms_daily is 'Terminos de busqueda por dia. Solo con impresiones. Para detectar terminos nuevos usar v_terminos_nuevos.';
comment on view v_conversiones_diarias is 'Conversiones primarias por dia y accion. No incluye secundarias a proposito.';;
