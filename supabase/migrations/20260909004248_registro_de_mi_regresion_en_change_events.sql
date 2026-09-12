insert into public.tickets (cuenta, tipo, titulo, descripcion, estado, creado_por, respuesta) values
(null, 'bug',
 'REGRESION MIA: el semanal v11 rompio la extraccion de change_events en las cuatro cuentas',
 'Al arreglar los tickets 32 y 42 amplie la ventana de change_event de la semana a 30 dias y, al hacerlo, deje el filtro con un solo extremo: change_date_time >= fecha, sin techo. La API de Google lo rechaza con "The change_event request is missing filters on change_event.change_date_time or is filtering on change_event.change_date_time with an infinite range". Medido en run_log: a las 17:20 del 8 sep con la v10 corria OK (FRESH_MONKEE, 1 fila); a las 21:20 y 21:31, ya con la v11, ERROR en las cuatro cuentas. Lo encontraron los agentes semanales de 360, KAREDO y BHI la misma noche, por separado. Requisitos de la API para change_event, los tres a la vez: filtro con AMBOS extremos, rango no mayor a 30 dias, y LIMIT obligatorio.',
 'resuelto', 'claude-revision',
 'RESUELTO en el semanal v11 corregido: rango cerrado de 28 dias con ambos extremos, calculado en la zona horaria de la cuenta y no en UTC, porque el borde de 30 dias lo evalua Google en la zona de la cuenta. Queda pendiente DESPLEGAR el script: mientras no se despliegue, change_events sigue sin entrar.');

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Arreglando los tickets 32 y 42 amplie la ventana de change_event de una semana a 30 dias para que la tabla se autorreparara si se salteaba una corrida.',
 'Cambiar la consulta GAQL sin poder ejecutarla contra la API, verificando solo la sintaxis de JavaScript.',
 'Rompi la extraccion en las cuatro cuentas. Un filtro con un solo extremo es un rango infinito para la API de change_event y la rechaza entera. node --check pasa perfecto: el error no es de sintaxis. Lo encontraron tres agentes semanales esa misma noche, cada uno por su lado, y uno lo fecho exactamente en el despliegue.',
 'Verificar la sintaxis no es verificar el contrato. Un cambio en una consulta a una API externa que no se puede ejecutar desde donde se escribe queda sin probar, por mas que compile, y hay que decirlo al entregarlo en vez de darlo por bueno. Cuando el cambio amplia una ventana o afloja un filtro, la pregunta que faltaba era cual es el requisito de la API sobre ESE filtro: change_event exige los dos extremos, un rango de hasta 30 dias y LIMIT, las tres cosas a la vez. Y lo que salvo el dia no fue una auditoria sino tres agentes corriendo de verdad: la extraccion fallada aparecio en run_log con el error nombrado, que es exactamente para lo que existe ese log.',
 'error', 0.95, 1, 'claude'),
(null, current_date,
 'El pulso diario no escribio en las cuatro cuentas durante dos dias y ninguna alarma sono. pulso_respaldo figuraba con ultimo_ok en verde.',
 'Buscar por que la vigilancia no lo vio, en vez de solo arreglar el pulso.',
 'El cron hace perform disparar_pulso_respaldo(); perform latir(true). Ese latido se enciende porque el disparo no lanzo excepcion; el trabajo real ocurre en la app y ahi es donde falla. Se agrego la tarea pulso_diario, cuyo latido depende de que existan filas, y se la dio de alta con el ultimo dato real y no con now().',
 'Un latido que mide el disparo y no el efecto es peor que no tener latido: da por sana una tarea muerta. Toda vigilancia sobre algo asincrono tiene que verificar el resultado en una corrida posterior, no el envio. Y al dar de alta una tarea, sembrar ultimo_ok con now() la hace ver sana durante toda la tolerancia: se siembra con el ultimo dato real, o con null si nunca corrio.',
 'error', 0.95, 1, 'claude');

select registrar_cambio(
 'Arreglo de mi regresion en change_events y vigilancia del efecto del pulso',
 'Dos cosas, y la primera es mia. (1) El semanal v11 que entregue dejaba el filtro de change_event con un solo extremo al ampliar la ventana a 30 dias, y la API lo rechaza como rango infinito: rompio la extraccion en las cuatro cuentas entre las 17:20 y las 21:20 del 8 sep. Corregido a un rango cerrado de 28 dias en la zona horaria de la cuenta. Verificar la sintaxis no es verificar el contrato de una API que no puedo ejecutar desde donde escribo. (2) El pulso llevaba dos dias sin escribir y pulso_respaldo latia en verde porque ese latido mide el disparo y no el efecto. Se agrego verificar_pulso_del_dia y la tarea pulso_diario, dada de alta con el ultimo dato real y no con now().',
 array['latidos','verificar_pulso_del_dia','pulso_verificar','northsignal_semanal_v11'],
 'fix-v99',
 'El cron pulso_verificar se quita con cron.unschedule. La tarea pulso_diario se desactiva poniendo en_vigilancia en false. El script hay que desplegarlo a mano: mientras no se despliegue, change_events sigue rechazada por Google.');;
