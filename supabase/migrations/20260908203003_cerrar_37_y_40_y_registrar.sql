update public.tickets set estado='resuelto', resuelto_el=now(), resuelto_en_version='fix-v97',
 respuesta =
 'RESUELTO 8 sep 2026. La ventana de volumen dejo de salir de la capa diaria (15 a 17 dias, ' ||
 'devueltos con la etiqueta "30d") y sale de la tabla SEMANAL, 4 semanas completas, 28 dias reales, ' ||
 'que es la fuente que las propias reglas del sistema mandan usar para retrospectiva. Efecto medido: ' ||
 'BHI 10 -> 27 (el NO ESCALAR era FALSO y ahora el veredicto es INESTABLE, que es la restriccion real), ' ||
 '360 8 -> 14 (el veredicto acertaba pero citando un numero que no era), KAREDO 51,5 -> 95,9, ' ||
 'FRESH_MONKEE 305,3 -> 926,1. El veredicto ahora cita la ventana real ("14.0 conv en 28 dias") en vez ' ||
 'de "30d", se agrego conv_30d_diaria_truncada para poder auditar cuanto subestimaba, y con menos de 3 ' ||
 'semanas completas la vista devuelve NO SE PUEDE SABER en vez de un veredicto. ' ||
 'Nota de disenio: dias_consolidados se calcula sobre la ventana de 14 dias y no sobre esta; mezclarlas ' ||
 'en un mismo veredicto era ademas un error de granularidad.'
 where id = 37;

update public.tickets set estado='resuelto', resuelto_el=now(), resuelto_en_version='fix-v97',
 respuesta =
 'RESUELTO 8 sep 2026. La rama de ranking ya no receta "mejorar QS, relevancia, landing" por defecto: ' ||
 'cruza el QS ponderado con el peso del peor componente y distingue tres casos. KAREDO ahora devuelve ' ||
 'POR PUJA con los numeros a la vista (QS ponderado 8,5, peor componente 16% del gasto) y dice ' ||
 'explicitamente que no hay que tocar calidad. FRESH_MONKEE, que tambien caia en esta rama y el ticket ' ||
 'no nombraba, devuelve POR CALIDAD con relevancia del anuncio al 79% del gasto, que coincide con lo ' ||
 'que la corrida mensual encontro por otro camino. Si no hay datos de QS, no receta nada. ' ||
 'La logica se calcula dentro de v_headroom y no llamando a v_por_que_limitada, porque esa vista ' ||
 'depende de v_headroom y seria un ciclo.'
 where id = 40;

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Arreglando el ticket 40 en v_headroom puse un corte duro en 15% para separar "la perdida es por puja" de "es por calidad", copiado de v_por_que_limitada.',
 'Correr la vista sobre las cuatro cuentas antes de darla por buena, en vez de confiar en que el criterio era razonable.',
 'KAREDO dio 16%: un punto del lado equivocado, con el QS ponderado mas alto de las cuatro (8,5). El veredicto volvia a recetar "mejorar la relevancia" justo en la cuenta que el ticket nombra como el caso donde la calidad esta bien. Se reemplazo por dos senales y tres bandas.',
 'Un umbral de un solo numero reproduce el bug que venia a arreglar cuando el caso testigo cae cerca del corte. Si una decision depende de un limite, hay que probarla contra los casos que motivaron el ticket ANTES de darla por buena, y si el caso testigo queda a un punto del borde, el limite esta mal elegido, no el caso. Dos senales cruzadas y una banda intermedia que no receta nada son mas honestas que un corte unico bien ubicado por casualidad.',
 'error', 0.9, 1, 'claude');

select registrar_cambio(
 'v_headroom: la ventana de volumen pasa a la tabla semanal y la rama de ranking distingue puja de calidad',
 'Los dos tickets rompian una decision hoy en las cuatro cuentas. (37) conv_30d sumaba la capa diaria entre current_date-30 y current_date-1 sobre una tabla de 15 a 17 dias, y el veredicto comparaba ese total contra el minimo de 15 conversiones EN 30 DIAS de Smart Bidding: el NO ESCALAR de BHI era falso, 10 contra 27 reales. Se habia dado por cerrado agregando la columna dias_consolidados, que el veredicto nunca uso: mostrar la ventana no es corregir el calculo. (40) la rama de ranking recetaba mejorar QS sin mirar el QS; afectaba a KAREDO y tambien a FRESH_MONKEE, que el ticket no nombraba. Lo que mas vale para el que siga: mi primer arreglo del 40 uso un corte duro en 15% y KAREDO dio 16%, o sea que reprodujo el bug adentro del arreglo. Un limite que decide algo hay que probarlo contra el caso que motivo el ticket antes de darlo por bueno.',
 array['v_headroom','v_por_que_limitada','v_proyeccion_escalamiento'],
 'fix-v97',
 'La definicion anterior esta en el historial de migraciones. Se conservaron las 25 columnas originales en su orden porque v_por_que_limitada y v_proyeccion_escalamiento dependen de ellas; las 6 nuevas van al final, asi que revertir es reemplazar la vista por la version previa sin tocar dependientes.'
) as registro;;
