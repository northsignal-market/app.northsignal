-- DRIFT SEMANTICO: cuando cambia el SIGNIFICADO de una columna mientras el dato y el
-- esquema siguen bien. No lo detecta ninguno de los cinco pilares clasicos (frescura,
-- volumen, esquema, distribucion, linaje): los pasa todos y esta mal igual.
--
-- Este detector busca NOMBRES QUE MIENTEN, que es la forma en que el drift se manifiesta
-- en este sistema. Cuatro familias, todas sacadas de casos reales:
--   conv_30d que cubre 15 dias        -> el nombre promete una ventana que no tiene
--   change_datetime que es text       -> el nombre promete un tipo que no tiene
--   accion_valida que decia "parsea"  -> el booleano afirma algo que no verifica
--   latir(true) al disparar           -> el nombre afirma un efecto que no midio
--
-- La pieza que lo hace usable son los contratos: una columna declara que promete, y el
-- detector compara la promesa contra la realidad. Sin contrato no hay drift detectable,
-- solo sospecha.

create table if not exists public.contratos_columna (
  objeto        text not null,
  columna       text not null,
  promete       text not null,
  ventana_dias  int,
  tipo_semantico text,
  verificado_el date not null default current_date,
  nota          text,
  primary key (objeto, columna)
);

comment on table public.contratos_columna is
  'Que promete cada columna, declarado a mano. El detector compara la promesa contra la realidad medida. Una columna sin contrato no es sospechosa por si sola: es invisible, que es peor.';

create table if not exists public.drift_exento (
  patron  text primary key,
  por_que text not null
);

insert into public.drift_exento (patron, por_que) values
('%version%', 'desde_version y hasta_version son etiquetas de version, no fechas'),
('conversion_action', 'es el nombre de la accion, no un numero'),
('google_conversion_action', 'es un nombre'),
('valor_anterior', 'guarda valores heterogeneos de Google: numeros, estados y textos. Text es correcto.'),
('valor_nuevo', 'guarda valores heterogeneos de Google: numeros, estados y textos. Text es correcto.'),
('%_origen', 'declara de donde salio el dato, es texto a proposito'),
('%_direccion', 'sube, baja o cruza: es una etiqueta'),
('%_nota', 'texto libre a proposito')
on conflict (patron) do nothing;

create or replace view public.v_drift_semantico as
-- A. El nombre promete una VENTANA que el contrato desmiente.
select 'ventana_que_miente'::text as familia,
       c.objeto, c.columna,
       'El nombre dice ' || (regexp_match(c.columna, '([0-9]+)\s*d'))[1] || ' dias y el contrato declara ' ||
         c.ventana_dias || '.' as detalle,
       'Renombrar la columna o corregir la ventana. Un nombre que miente sobrevive a cualquier auditoria de "esta roto".'::text as que_hacer
  from contratos_columna c
 where c.columna ~ '[0-9]+d($|_)'
   and c.ventana_dias is not null
   and (regexp_match(c.columna, '([0-9]+)\s*d'))[1]::int <> c.ventana_dias

union all
-- B. El nombre promete una FECHA y la columna es texto.
select 'tipo_que_miente', ic.table_name, ic.column_name,
       'Se llama como una fecha y es ' || ic.data_type || '. Toda comparacion contra un timestamp falla o exige cast.',
       'Cambiar el tipo, o declarar el contrato con nota explicita y castear siempre.'
  from information_schema.columns ic
 where ic.table_schema = 'public'
   and ic.data_type in ('text','character varying')
   and ic.column_name ~ '(fecha|datetime|_el$|_at$)'
   and not exists (select 1 from drift_exento e where ic.column_name like e.patron)

union all
-- C. Booleano que afirma algo, sin contrato que diga QUE afirma.
select 'afirmacion_sin_contrato', ic.table_name, ic.column_name,
       'Booleano cuyo nombre afirma una condicion y no tiene contrato que diga que verifica exactamente.',
       'Declarar en contratos_columna que condicion afirma. accion_valida decia "el JSON parsea" y la app lo leia como "se puede ejecutar".'
  from information_schema.columns ic
 where ic.table_schema = 'public' and ic.data_type = 'boolean'
   and ic.column_name ~ '(valid|ok$|correct|complet|sano|listo|puede|habilit)'
   and not exists (select 1 from contratos_columna c where c.objeto = ic.table_name and c.columna = ic.column_name)

union all
-- D. Tabla critica sin contratos: no hay drift detectable porque no hay promesa.
select 'sin_contrato', t.tabla, '(toda la tabla)',
       t.sin_contrato || ' de ' || t.total || ' columnas no declaran que prometen.',
       'Sin contrato el drift es invisible. Empezar por las columnas que alguien cita en un brief.'
  from (
    select ic.table_name as tabla, count(*) as total,
           count(*) filter (where not exists (
             select 1 from contratos_columna c where c.objeto = ic.table_name and c.columna = ic.column_name)) as sin_contrato
      from information_schema.columns ic
     where ic.table_schema = 'public'
       and ic.table_name in ('campaign','campaign_daily','keywords','keywords_daily','change_events',
                             'conversion_actions','acciones_aprobadas','accionables_espejo','latidos','cuentas')
     group by 1) t
 where t.sin_contrato = t.total;

comment on view public.v_drift_semantico is
  'Nombres que mienten: la forma en que el drift semantico se manifiesta en este sistema. Compara lo que el nombre promete contra lo que el contrato declara y contra el tipo real. Familia sin_contrato no es una falla, es un hueco: sin promesa declarada el drift es indetectable.';

-- Los contratos de lo que ya sabemos, empezando por el que yo mismo rompi ayer.
insert into public.contratos_columna (objeto, columna, promete, ventana_dias, tipo_semantico, nota) values
('v_headroom','conv_30d','Conversiones de la ventana de volumen', 28, 'numero',
 'DRIFT CONOCIDO: se llama 30d y cubre 28 dias, 4 semanas completas de la tabla semanal. El 8 sep se corrigio el calculo (antes sumaba 15 dias de la capa diaria y lo llamaba 30d) pero NO el nombre. conv_30d_origen dice la verdad; el nombre no.'),
('v_headroom','conv_30d_diaria_truncada','Lo que devolvia la version vieja, para auditar cuanto subestimaba', null, 'numero', null),
('v_ventana_real','dias_en_30d','Dias que REALMENTE hay en la capa diaria dentro de los ultimos 30', null, 'numero',
 'El nombre es correcto: mide cuantos dias hay dentro de 30, no afirma que sean 30.'),
('v_decision_estructural','conv_28d','Conversiones de 28 dias', 28, 'numero', null),
('v_decision_estructural','dias_28d','Dias reales dentro de la ventana de 28', null, 'numero', null),
('change_events','change_datetime','Momento del cambio segun Google', null, 'texto_con_forma_de_fecha',
 'TRAMPA: es TEXT, no timestamp. Toda comparacion de fechas necesita ::timestamptz explicito. Rompio detectar_cambios_no_informados desde que se creo, y el paquete de cadena el 8 sep.'),
('accionables_espejo','accion_valida','Que el accionable se puede EJECUTAR de un clic', null, 'booleano',
 'Antes significaba "el JSON parsea" y la app lo leia como ejecutable: mostraba 17 botones y 14 fallaban. Desde el 8 sep un trigger la pone en false si el verbo no es ejecutable.'),
('latidos','ultimo_ok','Ultima vez que la tarea PRODUJO su efecto', null, 'timestamp',
 'pulso_respaldo latia OK midiendo el disparo y no el efecto: el pulso estuvo muerto dos dias en verde. Sembrar este campo con now() al dar de alta una tarea la hace ver sana durante toda la tolerancia.'),
('cifras_publicadas','sql_origen','La consulta EXACTA que produjo la cifra, una sentencia, un valor', null, 'sql',
 'No es una descripcion ni la lista de objetos consultados. Si no se puede escribir, el numero no esta listo para publicarse.')
on conflict (objeto, columna) do nothing;;
