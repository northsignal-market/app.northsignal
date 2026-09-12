update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'responde_al_inverso',
  mutante_sql = 'INVERSO: delete from negatives where account = ''360'' and level = ''campaign'' and week_start = (select max(week_start) from negatives) -- en transaccion. Probado 9 sep: paso a verde.'
 where nombre = 'ninguna_negativa_bloquea_conversiones';

update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'responde_al_inverso',
  mutante_sql = 'INVERSO: delete from conversion_actions where account = ''BHI'' -- en transaccion. Sin acciones no puede haber solapamiento entre acciones. Probado 9 sep: paso a verde.'
 where nombre = 'sin_doble_conteo_declarado';

update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'responde_al_inverso',
  mutante_sql = 'INVERSO: update campaign_daily set conversions = conversions + 3 where account = ''360'' -- en transaccion. OJO: hay que mutar campaign_daily, NO campaign. v_decision_estructural lee de la capa DIARIA. El primer intento muto campaign y la relacion no se movio, y parecia trabada cuando el equivocado era el mutante. Probado 9 sep con la fuente correcta: paso a verde.'
 where nombre = 'escalon_estructural_es_plausible';

-- El contrato de conv_28d declaraba la PROMESA, no la realidad. La vista misma dice
-- dias_28d = 12 mientras la columna se llama conv_28d: es el mismo caso que conv_30d de
-- v_headroom, y mi contrato lo tapaba en vez de exponerlo.
update contratos_columna
   set ventana_dias = null,
       promete = 'Conversiones de la ventana de 28 dias, PERO solo sobre los dias consolidados que existan',
       nota = 'DRIFT CONOCIDO, ticket 27: se llama conv_28d y hoy cubre 12 dias en 360. La propia vista lo dice en dias_28d, que ninguna rama del veredicto usa. Por eso declara saturada una campana sobre 6 conversiones. El contrato declaraba 28 por el nombre: declaraba la promesa, no la realidad, que es como un contrato tapa el drift en vez de exponerlo.'
 where objeto = 'v_decision_estructural' and columna = 'conv_28d';

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'La relacion escalon_estructural_es_plausible quedo trabada en rojo despues de sumarle 20 conversiones a campaign para 360.',
 'Antes de dar el control por roto, mirar de donde lee de verdad la vista que vigila, usando v_linaje.',
 'v_decision_estructural lee de campaign_daily, no de campaign. El control estaba bien; el mutante estaba mal. Mutando la capa diaria paso a verde. Es la segunda vez en el dia que muto la fuente equivocada.',
 'Cuando un mutante no mueve el control, la primera hipotesis no es que el control este roto: es que se muto la fuente equivocada. Verificar el linaje del objeto vigilado ANTES de declarar el control trabado, porque un control declarado roto se desactiva y un control desactivado no vigila nada. Y el corolario: escribir el mutante mirando el linaje, no la intuicion de que tabla alimenta que vista.',
 'error', 0.9, 1, 'claude');

select registrar_cambio(
 'Las catorce relaciones tienen control probado, en el sentido que corresponde a cada una',
 'Siete matan a su mutante y siete responden al inverso. La distincion importa porque la mayoria vigila bugs abiertos, o sea que ya estan en rojo, y a esas se las prueba arreglando el dato y confirmando que pasan a verde. Un caso quedo trabada y resulto que el mutante estaba mal: v_decision_estructural lee de campaign_daily y yo habia mutado campaign, segunda vez en el dia que muto la fuente equivocada. De paso se corrigio el contrato de conv_28d, que declaraba 28 dias porque asi se llama la columna cuando la propia vista informa 12 en dias_28d: el contrato declaraba la promesa en vez de la realidad, que es como un contrato tapa el drift en lugar de exponerlo.',
 array['relaciones_verdad','contratos_columna','lecciones'],
 'fix-v104',
 'Las marcas de mutante_resultado se revierten con un update a sin_probar.'
) as registro;;
