-- INCIDENTE 1: ventana_que_miente. conv_30d se llama 30 y cubre 28.
-- Verificado que ninguna otra vista lo lee, asi que renombrar es seguro.
-- No se renombra a conv_28d: si manana la ventana canonica cambia, el nombre volveria a
-- mentir. El nombre correcto no lleva el numero adentro.
alter view public.v_headroom rename column conv_30d to conv_ventana;
alter view public.v_headroom rename column conv_30d_origen to conv_ventana_origen;
alter view public.v_headroom rename column conv_30d_diaria_truncada to conv_diaria_truncada;

update relaciones_verdad
   set sql_izquierda = 'select conv_ventana from v_headroom where account = $CUENTA$'
 where nombre = 'headroom_usa_la_metrica_canonica';

update contratos_columna set columna = 'conv_ventana',
   promete = 'Conversiones de la ventana canonica, sea cual sea',
   nota = 'Se llamaba conv_30d y cubria 28 dias. Renombrada el 9 sep 2026. NO ponerle el numero de dias en el nombre: la ventana canonica puede cambiar y el nombre volveria a mentir. conv_ventana_dias dice cuantos son.'
 where objeto = 'v_headroom' and columna = 'conv_30d';
update contratos_columna set columna = 'conv_diaria_truncada'
 where objeto = 'v_headroom' and columna = 'conv_30d_diaria_truncada';

-- Los cinco objetos que quedaban invisibles para los agentes.
insert into public.notas_de_objetos (capa, objeto, usar_para, cuidado) values
('ANALISIS','v_donde_escribir_anuncio',
 'Donde conviene escribir un anuncio y por que, por GRUPO de anuncios, ordenado por la plata de la semana que va a keywords que el anuncio no menciona',
 'La RELEVANCIA del anuncio entra en la subasta; el Ad Strength es un diagnostico de la interfaz que no influye en la elegibilidad. Si el veredicto dice NO ES EL ANUNCIO, el problema es la landing y escribir un RSA no mueve el Quality Score'),
('ANALISIS','v_terminos_sin_cobertura',
 'Terminos de busqueda cuyo tema ninguna keyword del grupo cubre, con el veredicto de crear keyword propia o poner negativa',
 'nivel_recomendado dice grupo cuando el mismo termino convierte en otro grupo de la campana: a nivel campana se apagan los dos. El radio de la accion tiene que ser el radio de la evidencia'),
('ANALISIS','v_negativas_que_bloquean',
 'Negativas ya puestas a nivel campana que alcanzan terminos que convirtieron en algun grupo',
 'El cruce usa ILIKE y aproxima la concordancia de Google: da falsos positivos con negativas en amplia. Verificar en pantalla antes de sacar una'),
('SALUD','v_salud_calidad',
 'La capa de calidad semantica cruda: ventanas mayores que su tabla, relaciones violadas, nombres que mienten y cifras sin verificar',
 'No entrar por aca sino por v_para_actuar: esta vista lista eventos sueltos, y el mismo hecho aparece una vez por cuenta'),
('SISTEMA','get_weekly_package_cadena_base',
 'Nucleo del paquete de cadena, sin los guardarrailes',
 'NO llamar directo. Usar get_weekly_package_cadena, que le agrega ventana_real, cambios_semana_meta y coherencia_del_gasto')
on conflict (objeto) do update set usar_para = excluded.usar_para, cuidado = excluded.cuidado, capa = excluded.capa;

-- INCIDENTE 2: tipo_que_miente. Primero el control, despues el arreglo.
insert into relaciones_verdad (familia, nombre, que_afirma, sql_izquierda, sql_derecha, dominio_valido, tolerancia_rel, por_que_existe, mutante_sql, mutante_probado_el, mutante_resultado)
values ('invariante_dominio', 'columnas_de_fecha_son_de_tipo_fecha',
 'Ninguna columna que se llame como una fecha puede ser de tipo texto.',
 'select count(*) from information_schema.columns where table_schema = ''public'' and data_type in (''text'',''character varying'') and column_name ~ ''(fecha|datetime|_el$|_at$)'' and column_name !~ ''version''',
 'select 0',
 'select $CUENTA$ = (select min(account) from cuentas where activa)',
 0,
 'change_events.change_datetime es TEXT y mordio tres veces: rompio detectar_cambios_no_informados desde que se creo, rompio get_weekly_package_cadena el 8 sep, y obliga a un cast explicito en cada comparacion. v_change_annotations le hace SUBSTRING para sacar la fecha. Mientras esta relacion viole, toda comparacion de fechas contra esas columnas necesita cast.',
 'alter table change_events alter column change_datetime type text -- ya es text: el mutante es el estado actual, la relacion viola hoy',
 current_date, 'mato_al_mutante');

insert into public.tickets (cuenta, tipo, titulo, descripcion, estado, creado_por) values
(null, 'bug',
 'change_events.change_datetime es TEXT y deberia ser timestamptz: radio mapeado, listo para ejecutar',
 'Verificado el 9 sep: las 1.477 filas parsean como fecha, del 13/08 al 07/09. El cambio es alter table change_events alter column change_datetime type timestamptz using change_datetime::timestamptz. RADIO MAPEADO, hay que revisarlo objeto por objeto antes: seis vistas dependen de change_events (v_anomalia_explicada, v_cambios_fuera_del_log, v_cambios_invisibles_para_google, v_cambios_para_cruce, v_change_annotations, v_todos_los_cambios) y cinco funciones citan la columna (detectar_cambios_config, detectar_cambios_no_informados, doc_cronologia, get_weekly_package, get_weekly_package_cadena). Al menos una hace operacion de TEXTO sobre la columna y hay que reescribirla: v_change_annotations usa SUBSTRING(change_datetime FROM 1 FOR 10) para sacar la fecha, que pasaria a ::date. Los casts explicitos que ya existen en las funciones siguen siendo validos sobre un timestamptz. Hay un indice unico uq_change_events que incluye la columna y se reconstruye solo. No se ejecuto hoy a proposito: seis vistas y cinco funciones al final de una sesion larga es como se cierran cosas sin cerrarlas.',
 'abierto', 'claude-revision');

insert into controles_de_ticket (ticket_id, relacion_id, como_lo_atrapa)
select (select max(id) from tickets), id,
 'La relacion cuenta las columnas que se llaman como fecha y son texto, y exige cero. Hoy viola. Cuando el tipo se corrija dejara de violar sola, y si alguien vuelve a crear una columna asi, dispara.'
  from relaciones_verdad where nombre = 'columnas_de_fecha_son_de_tipo_fecha';;
