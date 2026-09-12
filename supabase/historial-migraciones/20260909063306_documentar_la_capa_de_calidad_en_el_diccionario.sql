-- Las funciones nuevas NO van en el prompt. El modo de falla mas comun de un sistema de
-- agentes es un conjunto de herramientas inflado: si un ingeniero humano no puede decir con
-- certeza cual usar en cada situacion, un agente tampoco. Y hay context rot: a mas tokens en
-- la ventana, peor recuerda el modelo lo que tiene adelante.
-- El patron correcto es el de esquema justo a tiempo: un catalogo liviano y consultable con
-- todos los nombres y una descripcion corta, y en el prompt solo lo que CAMBIA el
-- comportamiento. Ese catalogo ya existe y se llama diccionario_datos(): faltaba cargarlo.

insert into public.notas_de_objetos (capa, objeto, usar_para, cuidado) values

('ENTRADA','v_para_actuar',
 'Lo unico de la capa de calidad que pide una accion AHORA. Si esta vacia, no hay nada que hacer con la calidad de datos hoy',
 'Es la puerta de entrada, no v_incidentes. Lo demas es seguimiento de bugs con ticket abierto o huecos informativos: se mira cuando uno quiere, no cuando el sistema grita'),
('ENTRADA','v_incidentes',
 'Todas las senales de calidad agrupadas POR CAUSA, con severidad actuar, seguimiento o informativo',
 'Un incidente es una causa, no un evento. Una violacion cuyo ticket ya esta abierto NO es alerta: es estado, y aparece como seguimiento'),

('METRICA','ventana_metrica',
 'La ventana REAL de una cuenta: desde, hasta, dias, semanas y un flag honesta. Tipos: semanal_4, diaria_real, trimestre',
 'honesta=false significa que no hay historia suficiente para sostener un veredicto. NUNCA escribir current_date - N a mano: aparece en v_metricas_reescritas'),
('METRICA','metrica_conversiones',
 'Conversiones de la cuenta en la ventana canonica, desde la tabla semanal',
 'La fuente es campaign, NO la suma de conversion_actions: en BHI eso da 2,4x por doble conteo entre acciones'),
('METRICA','metrica_gasto','Gasto de la cuenta en la ventana canonica','El gasto de ayer ya es definitivo; las conversiones no'),
('METRICA','metrica_cpa','Costo por conversion de la cuenta en la ventana canonica',
 'Devuelve NULL con cero conversiones A PROPOSITO: un CPA sobre cero no es infinito, es desconocido. En FRESH_MONKEE el CPA de cuenta no significa nada porque mezcla objetivos'),
('METRICA','metricas','Catalogo de las metricas canonicas con su ventana, fuente, unidad y trampa',
 'revisada_el es frescura de la DEFINICION: una metrica sin revisar tambien envejece'),
('CALIDAD','v_metricas_reescritas',
 'Vistas que piden una ventana MAYOR que la que su tabla de origen tiene realmente',
 'Mide, no marca patrones: cruza la ventana pedida contra v_retencion_tablas siguiendo el linaje. La version anterior marcaba 9 objetos y los 9 eran falsos positivos'),
('CALIDAD','v_retencion_tablas','Cuantos dias tiene REALMENTE cada tabla de hechos',
 'Las diarias tienen 17 dias, las semanales 91. Es el dato que convierte cualquier veredicto sobre ventanas en algo verificable'),

('VERDAD','cifras_publicadas',
 'Toda cifra que sale a un brief, con el SQL EXACTO que la produjo',
 'sql_origen tiene que ser una sola sentencia que devuelva un solo valor. Si no se puede escribir, ese numero no esta listo para publicarse'),
('VERDAD','verificar_cifras',
 'Recalcula cada cifra publicada desde su propio SQL y devuelve cuantas coinciden, difieren o no son reproducibles',
 'Es determinista, sin modelo, y NO ve el brief. Un verificador que ve el relato valida coherencia interna en vez de verdad. no_reproducible no es un error: suele significar que cambio una vista abajo'),
('VERDAD','v_cifras_sospechosas','Cifras publicadas que no se reproducen desde su fuente','Si aparece una, corregir el brief antes de cerrar la corrida'),
('VERDAD','relaciones_verdad',
 'Las relaciones que tienen que cumplirse pase lo que pase: conservacion, monotonia, equivalencia e invariantes de dominio',
 'dominio_valido decide si la relacion APLICA. no_aplicaba NO es una falla: es la relacion diciendo que su dominio no se cumple aca'),
('VERDAD','correr_relaciones','Corre todas las relaciones activas sobre todas las cuentas activas',
 'Cuatro veredictos: cumple, viola, no_aplicaba y error. Confundir no_aplicaba con viola es como mueren las alertas'),
('VERDAD','v_relaciones_violadas','Las relaciones que hoy no se cumplen, con los dos valores y la diferencia',
 'Si una esta violada, cualquier cifra que dependa de ella es sospechosa antes de mirarla'),
('VERDAD','probar_mutantes','Corre cada relacion contra su propio mutante en transaccion y revierte',
 'Solo toma mutantes de datos. Los que exigen cambiar una definicion se prueban a mano. Una relacion que no mata a su mutante no es un control, es una esperanza'),

('SEMANTICA','v_drift_semantico','Nombres que mienten: ventana, tipo o afirmacion que no coinciden con lo que la columna hace',
 'La familia sin_contrato no es una falla, es un hueco: sin promesa declarada el drift es indetectable'),
('SEMANTICA','contratos_columna','Que promete cada columna: ventana en dias, tipo semantico y la trampa',
 'Sin contrato una columna no es sospechosa, es invisible, que es peor'),
('SEMANTICA','v_linaje','Grafo de dependencias entre objetos, leido del catalogo de Postgres',
 'Es a nivel objeto. Para saber COMO se transforma cada columna hace falta parsear el SQL, esto no lo hace'),
('SEMANTICA','que_publique_con',
 'Dado un objeto que resulto estar mal, devuelve las cifras ya publicadas que salieron de el o de cualquier vista que lo use',
 'Es la pregunta que el 8 de septiembre no se pudo responder cuando aparecieron numeros equivocados ya copiados a briefs'),

('CICLO','v_tickets_sin_control','Bugs abiertos que hoy no podrian cerrarse porque nada vigila que vuelvan',
 'Es la cola real de trabajo, y el orden es al reves del intuitivo: primero la relacion que lo atrapa, despues el arreglo'),
('CICLO','v_deuda_de_control','Tickets ya cerrados que ningun control vigila',
 'La regla del trigger protege el futuro; esto mide lo que se cerro antes. Ordenado por veces_reabierto'),
('CICLO','controles_de_ticket','Que relacion vigila que un ticket no vuelva',
 'Sin esta fila un ticket de bug NO puede pasar a resuelto: lo bloquea un trigger'),
('CICLO','v_tasa_de_reapertura','Porcentaje de tickets que hubo que reabrir',
 'Es la metrica que delata un proceso que cierra sin verificar. El 37 se cerro marcado como resuelto sin estarlo'),
('CICLO','v_tasa_de_accion','Que porcentaje de lo accionable termina en una accion real',
 'La referencia es 70 a 80%. Por debajo de 50% el problema es el tablero, no la atencion: se podan chequeos, no se mira mas fuerte')

on conflict (objeto) do update
  set usar_para = excluded.usar_para, cuidado = excluded.cuidado, capa = excluded.capa;;
