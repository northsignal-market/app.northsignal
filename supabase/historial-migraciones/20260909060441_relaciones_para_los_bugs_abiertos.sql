-- Primero la relacion que lo atrapa, despues el arreglo. Cuatro de los doce bugs abiertos
-- ya tienen detector construido: lo que faltaba era registrarlo como relacion y atarlo,
-- para que el ticket no pueda cerrarse sin que algo vigile su regreso.
--
-- Patron nuevo: cuando la afirmacion es booleana, el lado izquierdo es la condicion casteada
-- a entero y el derecho es 1. Asi el corredor de igualdad sirve para invariantes que no son
-- una comparacion de dos magnitudes.

insert into relaciones_verdad (familia, nombre, que_afirma, sql_izquierda, sql_derecha, dominio_valido, tolerancia_rel, por_que_existe) values

('invariante_dominio', 'change_events_tiene_datos_recientes',
 'change_events tiene que tener al menos un cambio de los ultimos 8 dias.',
 'select (max(change_datetime::date) > current_date - 8)::int from change_events where account = $CUENTA$',
 'select 1',
 'select exists (select 1 from cuentas where account = $CUENTA$ and activa)',
 0,
 'Tickets 32 y 42. La tabla se reescribia entera en cada corrida y despues la API rechazo la consulta por rango infinito. Mientras esto viole, "no hay registro de cambio" significa "no lo puedo confirmar", no "no hubo cambio", y ninguna corrida deberia citar change_events como evidencia de ausencia.'),

('invariante_dominio', 'ninguna_negativa_bloquea_conversiones',
 'Ninguna negativa de campana puede alcanzar terminos que convirtieron en algun grupo.',
 'select count(*) from v_negativas_que_bloquean where account = $CUENTA$ and conversiones_de_lo_bloqueado_90d >= 1',
 'select 0',
 null, 0,
 'Tickets 47 y 48. En 360 hay negativas de campana en amplia para stand, stands, feria y ferias mientras el grupo se llama "Industry 2 - BTL y Stands". El radio de la negativa era mayor que el de la evidencia que la motivo. Ojo: el cruce de la vista usa ILIKE y aproxima la concordancia de Google, asi que una violacion pide verificacion en pantalla antes de tocar.'),

('invariante_dominio', 'config_snapshot_cubre_los_tres_niveles',
 'La foto de configuracion tiene que cubrir campana, grupo y accion de conversion.',
 'select count(distinct entity_type) from config_snapshot where account = $CUENTA$ and snapshot_date = (select max(snapshot_date) from config_snapshot)',
 'select 3',
 'select exists (select 1 from config_snapshot where account = $CUENTA$)',
 0,
 'Ticket 30. Sin el nivel de grupo, un cambio de targetCpaMicros se ve en el historial de Google y no se puede contrastar contra ningun estado. Es lo que bloqueaba la lectura de H7 de KAREDO el 21. Se arregla desplegando el diario v5, que ya trae el bloque de ad_group.'),

('invariante_dominio', 'pulso_al_dia_en_la_cuenta',
 'Cada cuenta activa tiene que tener pulso de ayer o de hoy.',
 'select (count(*) > 0)::int from pulso_diario where account = $CUENTA$ and fecha >= current_date - 1',
 'select 1',
 null, 0,
 'Ticket 51. El pulso estuvo muerto dos dias en las cuatro cuentas y pulso_respaldo latia en verde porque medía el disparo y no el efecto. Esta relacion mide el efecto por cuenta, que es lo unico que importa.');

insert into controles_de_ticket (ticket_id, relacion_id, como_lo_atrapa)
select t.id, r.id, c.como
  from (values
    (32, 'change_events_tiene_datos_recientes', 'Si la extraccion vuelve a fallar o a borrar la historia, el dato mas nuevo se aleja de 8 dias y la relacion dispara.'),
    (42, 'change_events_tiene_datos_recientes', 'Si el script vuelve a reescribir la tabla entera en vez de acumular, el dato mas nuevo queda solo de la semana extraida y eventualmente envejece.'),
    (47, 'ninguna_negativa_bloquea_conversiones', 'Si vuelve a cargarse una negativa de campana que alcanza terminos que convirtieron, la vista la lista y la relacion dispara.'),
    (48, 'ninguna_negativa_bloquea_conversiones', 'Mismo control: el radio de la negativa vuelve a superar el de su evidencia.'),
    (30, 'config_snapshot_cubre_los_tres_niveles', 'Si el diario deja de fotografiar el nivel de grupo, la cuenta de tipos de entidad baja de 3 y la relacion dispara.'),
    (51, 'pulso_al_dia_en_la_cuenta', 'Si el pulso vuelve a fallar del lado de la app, la cuenta se queda sin fila de ayer y la relacion dispara. Mide el efecto, no el disparo.')
  ) c(tid, rnombre, como)
  join tickets t on t.id = c.tid
  join relaciones_verdad r on r.nombre = c.rnombre
on conflict do nothing;;
