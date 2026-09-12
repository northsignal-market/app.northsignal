-- Ticket 37 se dio por cerrado y NO lo esta. La correccion agrego transparencia
-- (v_headroom ahora expone dias_consolidados) pero no toco la logica del veredicto.
update public.tickets
   set estado = 'abierto',
       titulo = 'v_headroom emite "menos de 15 conv en 30d" usando conv_30d calculado sobre 8 dias, en las CUATRO cuentas',
       descripcion = descripcion || E'\n\n--- REABIERTO 8 sep 2026, por simulacion de corrida ---\n' ||
 'Se cerro agregando la columna dias_consolidados, pero el veredicto NO la usa. Medido hoy: ' ||
 'dias_consolidados = 8 en las cuatro cuentas, y el veredicto sigue diciendo "menos de 15 conv en 30d". ' ||
 'BHI: 10 conversiones en 8 dias, que extrapoladas a 30 son ~37, muy por encima del minimo de 15. ' ||
 '360: 8 conversiones en 8 dias, ~30 en 30. Los dos veredictos de NO ESCALAR por volumen son ' ||
 'probablemente falsos. Mostrar la ventana no es corregir el calculo: es el mismo patron de ' ||
 '"documentar algo no lo crea", aplicado esta vez al arreglo. ' ||
 'Arreglo: normalizar conv_30d por dias_consolidados antes de comparar contra el minimo, o cambiar ' ||
 'el texto del veredicto para que cite la ventana real en vez de "30d".',
       respuesta = null, resuelto_el = null
 where id = 37;

-- Ticket 40: el ticket nombraba solo KAREDO. Son dos cuentas.
update public.tickets
   set descripcion = descripcion || E'\n\n--- AMPLIADO 8 sep 2026, por simulacion de corrida ---\n' ||
 'No es solo KAREDO. v_headroom emite "LIMITADA POR RANKING: subir presupuesto no da volumen. ' ||
 'Mejorar QS, relevancia, landing" tambien en FRESH_MONKEE (lost_is_rank 41,7%). En KAREDO el QS ' ||
 'ponderado es 8,5, el mas alto de las cuatro cuentas, y 0% del gasto tiene problema de landing: ' ||
 'la restriccion es de puja, no de calidad. La receta sale sin mirar v_por_que_limitada. ' ||
 'Una advertencia sobre una cuenta es una hipotesis sobre el sistema: al correr la vista entera ' ||
 'aparecio la segunda.'
 where id = 40;

-- Ticket 27: sigue vivo y ahora con el numero al lado.
update public.tickets
   set descripcion = descripcion || E'\n\n--- VERIFICADO 8 sep 2026, por simulacion de corrida ---\n' ||
 'Sigue emitiendo. Hoy: "NO PROPONER, saturada: el siguiente escalon cuesta 2.1x el CPA promedio" ' ||
 'sobre 5 conversiones en 11 dias consolidados de 28. Un veredicto de saturacion sobre 5 ' ||
 'conversiones no lo aguanta ningun dato. La vista ya expone dias_28d = 11: el veredicto tampoco ' ||
 'lo usa, igual que el ticket 37. Misma familia, misma vista de al lado.'
 where id = 27;

insert into public.tickets (cuenta, tipo, titulo, descripcion, estado, creado_por) values
(null, 'bug',
 'get_weekly_package_cadena no tenia ninguno de los tres guardarrailes del paquete de cuenta unica',
 'RESUELTO en la misma sesion, se deja registrado porque la forma importa. Los tres guardarrailes ' ||
 'construidos el 8 de septiembre contra las tres fallas que se publicaron (ventana truncada, delta ' ||
 'sobre base mixta, change_events congelada) se agregaron SOLO a get_weekly_package. El paquete de ' ||
 'cadena no tenia ventana_real, ni coherencia_del_delta, ni cambios_semana_meta. FRESH_MONKEE es la ' ||
 'cuenta con 46 franquiciados y la ventana diaria mas corta de las cuatro (15 dias contra 17): la ' ||
 'trampa de "30 dias" muerde mas fuerte justo donde el guardarrail no habia llegado. Arreglado ' ||
 'envolviendo la funcion original (get_weekly_package_cadena_base) y agregando ventana_real, ' ||
 'cambios_semana_meta y coherencia_del_gasto, que reemplaza al delta de CPA porque en una cadena ' ||
 'con objetivos mezclados el CPA de cuenta no significa nada. Lo encontro una simulacion de corrida, ' ||
 'no una auditoria: la auditoria preguntaba si el objeto existe, no si tiene lo mismo que su hermano.',
 'resuelto', 'claude-simulacion');

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Simulacion de la corrida de las cuatro cuentas despues de aplicar los arreglos del dia.',
 'Correr el arranque completo tal como quedo escrito en los prompts, en vez de dar por buenos los arreglos.',
 'Aparecieron tres cosas que ninguna auditoria habia visto: el paquete de cadena sin ninguno de los tres guardarrailes nuevos, el ticket 37 dado por cerrado sin estarlo, y el ticket 40 afectando a dos cuentas y no a una. Ademas, el chequeo de coherencia que yo mismo acababa de escribir en los cuatro prompts citaba una clave (totales.previo) que no existe en ningun paquete.',
 'Un arreglo aplicado a una funcion no esta aplicado a su hermana. Cuando existen dos variantes de la misma cosa (paquete de cuenta unica y paquete de cadena, script del MCC y script de la cuenta, umbral en tres archivos), cada mejora hay que aplicarla a TODAS y verificar en TODAS, porque la auditoria pregunta si el objeto existe y no si tiene lo mismo que su par. Y una correccion que agrega transparencia no corrige el calculo: v_headroom ahora expone dias_consolidados y el veredicto sigue sin usarlo, que es "documentar algo no lo crea" aplicado al propio arreglo.',
 'error', 0.95, 1, 'claude');

select registrar_cambio(
 'Revision completa: 8 arreglos en la base, 10 scripts y 4 prompts reescritos, simulacion de corrida',
 'Causa raiz de cuatro tickets de extraccion, no sintomas: (29) keyword_status era mutable y estaba en la clave del upsert, con 14 dias de lookback duplicaba cada keyword al pausarse, 13,7% de gasto de mas en KAREDO, medido y deduplicado; (32 y 42) pushToSupabase acotaba el DELETE a la semana solo si la tabla tenia week_start y change_events no la tiene, asi que borraba la cuenta entera cada corrida; (30) config_snapshot no cubria ad_group. Ademas: la fecha de espera vivia en la puerta (prevuelo) y no en la cola, asi que cualquier fila que entrara por otro camino se ejecutaba igual; v_primarias_solapadas medía por cuenta y publicaba 2,17x para FRESH_MONKEE cuando las campanas de compra online estan limpias, lo que habria hecho desinflar un CPA sano; v_umbrales_inconsistentes no podia fallar porque solo el centinela declaraba y solo 3 de 6 umbrales tenian referencia; y el paquete de cadena no tenia ninguno de los tres guardarrailes nuevos. Lo que mas vale para el que siga: los flags de conversion de config_snapshot no predicen que entra en la columna Conversiones (primary_for_goal esta deprecado), el unico contraste valido es empirico contra campaign.conversions.',
 array['keywords_daily','change_events','acciones_aprobadas','v_acciones_pendientes','v_primarias_solapadas','v_salud_sistema','v_umbrales_inconsistentes','umbrales_esperados','get_weekly_package_cadena','capacidades_ejecucion'],
 'fix-v97 + scripts semanal v11, diario v5, ejecutor v7, centinela v13, briefing v8 + prompts 360 v10, BHI v10, KAREDO v13, FRESH_MONKEE v2',
 'Cada migracion es independiente y reversible: los indices unicos se recrean con la definicion anterior, las vistas tienen su version previa en el historial de migraciones, y la columna no_ejecutar_antes_de se puede dropear sin afectar nada mas. Lo unico NO reversible es el borrado de las 26 filas duplicadas de keywords_daily, que eran duplicados exactos salvo conversiones sin madurar.'
) as registro;;
