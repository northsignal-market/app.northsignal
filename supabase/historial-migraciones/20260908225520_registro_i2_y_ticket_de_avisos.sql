insert into public.tickets (cuenta, tipo, titulo, descripcion, estado, creado_por) values
(null, 'mejora',
 'Las invariantes que NO bloquean no se le muestran a nadie al aprobar',
 'prevuelo() recorre verificar_invariantes y se queda solo con las que tienen bloquea=true; el endpoint de aprobar devuelve 409 con esos motivos. Las invariantes de aviso (bloquea=false) no aparecen en ningun lado del camino del boton. Hoy son cuatro: I2b_protegido_en_otro_alcance, I4_concordancia_keyword_principal, I4b_nucleo_a_exacta, I5_presupuesto_baja_brusca, I5_presupuesto_sube_brusca, I6_estructural_reciente. La de hoy es la mas concreta: I2b avisa que el termino esta protegido a nivel cuenta y convierte en otro grupo, y ese aviso existe justamente para que quien aprueba lo sepa. Un aviso que nadie ve es una leccion perdida con mas pasos. Propuesta: que el endpoint de aprobar devuelva los avisos junto con la accion creada y la app los muestre debajo del boton, sin frenar.',
 'abierto', 'claude-revision');

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'La invariante I2 bloqueaba una negativa de grupo correcta porque el termino figura en terminos_protegidos, que es una lista de cuenta sin columna de campana ni grupo.',
 'Antes de tocar la invariante, verificar si el defecto estaba en ella o en el dato que consume, y probar los cuatro casos que tiene que distinguir.',
 'El defecto no era el umbral sino la fuente: simular_negativa devuelve cifras numericas que SI respetan el alcance (0 a nivel grupo, 3 a nivel campana para el mismo termino) y un booleano bloquearia_conversiones que NO, porque se enciende con la lista de protegidos. I2 usaba el booleano como unico veredicto. Ahora usa las cifras para el bloqueo duro y degrada a aviso solo a nivel grupo y solo con 8 semanas de historia. Probado: bloquea en el grupo que convierte, bloquea a nivel campana, bloquea el nucleo, y deja pasar el grupo que nunca convirtio.',
 'Cuando un guardarrail bloquea algo que parece correcto, la pregunta no es si aflojarlo sino si su radio coincide con el de la evidencia. Casi siempre el defecto esta en el dato que consume, no en el umbral. Y antes de tocar una invariante hay que escribir los casos que tiene que seguir distinguiendo y correrlos despues: un guardarrail que se ajusta para que pase la conclusion de uno deja de ser un guardarrail. La salvaguarda de las 8 semanas es lo que separa las dos cosas: sin historia suficiente, un cero es falta de datos y se sigue bloqueando.',
 'acierto', 0.9, 1, 'claude');

select registrar_cambio(
 'I2 mide dentro del alcance de la negativa, no de la cuenta',
 'Una negativa de grupo correcta quedaba bloqueada por conversiones que ocurren en OTRO grupo. La causa: I2 usaba el booleano bloquearia_conversiones de simular_negativa como unico veredicto, y ese booleano se enciende con terminos_protegidos, que es una lista de cuenta sin campana ni grupo. Las cifras numericas de la misma simulacion si respetan el alcance, verificado con "iclick travel": 0 conversiones bloqueadas a nivel grupo en SEGURO EN EL EXTRANJERO, 3 a nivel campana. Ahora el bloqueo duro sale de las cifras y la lista de protegidos degrada a aviso I2b solo a nivel grupo y solo con 8 semanas o mas de capa semanal, porque sin historia un cero puede ser falta de datos. Lo que NO cambio: a nivel campana bloquea igual que antes, que es el caso que motivo la invariante. Probado contra cuatro casos antes y despues.',
 array['verificar_invariantes','prevuelo'],
 'fix-v98',
 'La definicion anterior esta en el historial de migraciones. Para revertir alcanza con volver a usar bloquearia_conversiones como veredicto unico en la rama de agregar_negativa; el resto de las invariantes quedo identico.'
) as registro;;
