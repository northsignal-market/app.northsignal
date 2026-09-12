-- 1. AdsApp.campaigns() NO devuelve Performance Max ni Demand Gen. El ejecutor resuelve
--    TODA accion por ese iterador, asi que un pausar_campana sobre una PMax falla con
--    "Campana no encontrada", que se lee como un nombre mal escrito y no como un limite
--    de la herramienta. Las campanas de apertura de FRESH_MONKEE (GO, SO, GS) son PMax.
--    El diario ya usaba AdsApp.performanceMaxCampaigns() para leer fechas: el codigo lo
--    sabia en un lado y no en el otro.
update public.capacidades_ejecucion
   set requiere = requiere || ' | PERFORMANCE MAX Y DEMAND GEN: AdsApp.campaigns() no las devuelve, asi que hasta el ejecutor v7 esto falla con "Campana no encontrada". Verificar el canal antes de proponerlo.'
 where plataforma = 'google'
   and verbo in ('pausar_campana','reactivar_campana','cambiar_presupuesto','cambiar_estrategia_puja','cambiar_objetivo_puja')
   and requiere not like '%PERFORMANCE MAX%';

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Revision completa del codigo, los scripts y los prompts. Al reescribir v_primarias_solapadas hice la hipotesis de que solo cuentan las acciones con include_in_conversions=true.',
 'Antes de cambiar la vista, contrastar la hipotesis contra campaign.conversions de la misma ventana en las cuatro cuentas.',
 'La hipotesis era falsa y la verificacion la agarro antes de publicar: campaign.conversions de BHI da 48, identico a la suma de las cuatro acciones, no 20. Con el filtro de include_in_conversions FRESH_MONKEE habria dado 1 conversion en 90 dias.',
 'Los flags de conversion de config_snapshot NO predicen que entra en la columna Conversiones. primary_for_goal esta deprecado en la API y devuelve true en 22 acciones de FRESH_MONKEE, incluidas page_view, session_start y user_engagement; include_in_conversions da false en acciones que si suman, porque no contempla los objetivos personalizados a nivel campana. El unico contraste valido es empirico: sum(conversion_actions.conversions) contra campaign.conversions de la misma ventana. En las cuatro cuentas cuadran exactamente, asi que la columna Conversiones ES la suma de las acciones y el doble conteo entre acciones es real.',
 'error', 0.95, 1, 'claude'),
(null, current_date,
 'v_primarias_solapadas comparaba acciones con conversiones contra primarias declaradas, a nivel cuenta, y publicaba 2,17x para FRESH_MONKEE.',
 'Medir el solapamiento dentro de cada campana en vez de sobre la cuenta entera.',
 'FRESH_MONKEE paso de 2,17x sobre toda la cuenta a 1,59x sobre 6 campanas locales, con 1.895 conversiones de compra online declaradas explicitamente como no afectadas.',
 'El doble conteo entre acciones de conversion se mide POR CAMPANA, no por cuenta. Un clic pertenece a una campana: dos acciones que nunca comparten campana no pueden contar el mismo clic. En FRESH_MONKEE, Segment: Order Completed vive en 25 campanas y no comparte ninguna con las otras cuatro, asi que las de compra online estan limpias; el solapamiento real esta en 6 campanas locales donde conviven Store visits, Directions y Clicks to call. El factor de cuenta mezclaba las dos poblaciones y el guardarrail habria hecho desinflar un CPA que no estaba inflado.',
 'error', 0.95, 1, 'claude'),
(null, current_date,
 'El tablero decia "0 de 8 umbrales imposibles o apagados" mientras northsignal_semanal tenia FRESH_MONKEE con kwSpendNoConv en 0, usado para alertar en dos lugares.',
 'Hacer que la ausencia de declaracion sea un hallazgo y no un silencio, con una tabla de umbrales esperados por script.',
 'v_umbrales_inconsistentes paso de 0 filas a 16, todas NO DECLARA del script semanal.',
 'Un chequeo que solo puede mirar una de las tres copias del dato no es un chequeo. La comparacion existia y era correcta, pero solo el centinela llamaba a declarar_umbral, con p_script cableado, y solo 3 de los 6 umbrales tenian columna de referencia. Cero filas se leia como cero problemas. Cuando un valor vive en varias copias, el chequeo empieza por preguntar cuantas copias declararon, no por comparar las que si.',
 'error', 0.95, 1, 'claude');

insert into public.tickets (cuenta, tipo, titulo, descripcion, estado, creado_por) values
('FRESH_MONKEE', 'dato_incorrecto',
 'funnel_stages vacio en FRESH_MONKEE: 22 acciones marcadas primarias y ninguna declarada',
 'La cuenta no tiene ni una fila en funnel_stages, asi que v_primarias_solapadas la reporta como SIN DECLARAR y no puede decidir si el 1,59x de las 6 campanas locales es doble conteo real o dos hechos distintos. La foto del 8 sep muestra 22 acciones con primary_for_goal=true (flag deprecado, no confiable), entre ellas tres de page_view, session_start y user_engagement, y TRES acciones distintas de envio de formulario (Website (web) form_submit, Website (web) gtm.formSubmit, FM Franchise Subdomain Form Submit) que muy probablemente disparan sobre el mismo formulario. No se puede declarar desde la base sin inventar: hay que mirar en pantalla cual es primaria por objetivo de campana y que etapa mide cada una. Es la unica cuenta con reporte a 46 franquiciados.',
 'abierto', 'claude-revision'),
('FRESH_MONKEE', 'bug',
 'Store visits y Local actions - Directions conviven en 6 campanas locales y pueden contar el mismo clic',
 'Medido el 8 sep sobre 90 dias: en AR - Fayetteville, MA-SOUTHBOROUGH_2026-07_SO, MI_MILFORD_2026-06_SO, SC_GREENVILLE_2026-06_SO, TX - Austin y TX-Woodforest_2026-06_SO conviven Store visits, Local actions - Directions y Clicks to call. Alguien que hace clic, pide como llegar y despues visita el local genera las dos. Total en esas campanas 2.223,3 conversiones sobre una mayor de 1.394,3: factor hasta 1,59x. Las 1.895,3 conversiones de compra online estan en campanas de una sola accion y NO estan afectadas, asi que la regla 1 de la cuenta (ROAS solo sobre _OP) sigue valida. Depende del ticket de funnel_stages para decidir si es doble conteo o dos hechos distintos.',
 'abierto', 'claude-revision');;
