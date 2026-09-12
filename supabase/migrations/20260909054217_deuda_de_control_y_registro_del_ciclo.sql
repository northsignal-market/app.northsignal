update relaciones_verdad set
  mutante_sql = 'create or replace function metrica_conversiones(...) devolviendo el valor * 1.5, dentro de una transaccion con rollback. El mutante NO puede ser un dato: v_headroom y la funcion canonica leen la misma tabla y un cambio las mueve juntas. El mutante correcto es cambiar una de las dos definiciones, que es el drift que esta relacion existe para atrapar.',
  mutante_probado_el = current_date,
  mutante_resultado = 'mato_al_mutante'
 where nombre = 'headroom_usa_la_metrica_canonica';

-- LA DEUDA. La regla protege el futuro; esto mide el pasado.
create or replace view public.v_deuda_de_control as
select t.id, t.cuenta, t.tipo, left(t.titulo, 90) as titulo, t.estado,
       t.resuelto_el::date as cerrado_el, t.veces_reabierto,
       count(ct.relacion_id) as controles,
       count(*) filter (where r.mutante_resultado = 'mato_al_mutante') as controles_probados,
       case when count(ct.relacion_id) = 0
              then 'Cerrado sin control. Si vuelve, nadie se entera: es como se cerro el 37 y hubo que reabrirlo.'
            when count(*) filter (where r.mutante_resultado = 'mato_al_mutante') = 0
              then 'Tiene control pero sin mutante probado.'
            else 'Cubierto.' end as lectura
  from tickets t
  left join controles_de_ticket ct on ct.ticket_id = t.id
  left join relaciones_verdad r on r.id = ct.relacion_id
 where t.estado = 'resuelto' and t.tipo in ('bug','dato_incorrecto')
 group by t.id, t.cuenta, t.tipo, t.titulo, t.estado, t.resuelto_el, t.veces_reabierto
having count(*) filter (where r.mutante_resultado = 'mato_al_mutante') = 0
 order by t.veces_reabierto desc, t.id desc;

comment on view public.v_deuda_de_control is
  'Tickets ya cerrados que ningun control vigila. La regla del trigger protege el futuro; esta vista mide lo que se cerro antes de que la regla existiera. Ordenada por veces_reabierto: los que ya volvieron una vez son los que mas probable vuelvan.';

create or replace view public.v_tasa_de_reapertura as
select count(*) filter (where veces_reabierto > 0) as reabiertos,
       count(*) as cerrados_alguna_vez,
       round(count(*) filter (where veces_reabierto > 0)::numeric / nullif(count(*),0) * 100, 1) as tasa_pct,
       'La tasa de reapertura es la metrica que delata un proceso que cierra sin verificar. El ticket 37 se cerro marcado como resuelto sin estarlo y hubo que reabrirlo.'::text as lectura
  from tickets where estado = 'resuelto' or veces_reabierto > 0;

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'El sistema detectaba bien y cerraba mal: el ticket 37 estuvo marcado resuelto sin estarlo, y la relacion que vigila el 29 la ate a mano.',
 'Convertir la regla en trigger en vez de convencion: un ticket de bug no cierra sin un control que atrape su regreso, con mutante probado y con las tres preguntas del escape respondidas.',
 'Probado en cuatro casos. Sin control: rechaza. Sin auditoria: rechaza. Con todo en regla: acepta. Y el mutante de la relacion de headroom mato a su mutante en las 4 cuentas al cambiar la funcion canonica dentro de una transaccion.',
 'Un hallazgo no esta cerrado cuando se arregla, esta cerrado cuando existe un control que atrapa su regreso Y ese control demostro que puede fallar. Las tres preguntas van ANTES del cierre, no despues: habia un control que cubriera esto, si lo habia por que paso en verde, y que cambia para que no escape otra vez. Y hay un mutante que no puede ser un dato: cuando dos objetos leen la misma tabla, un cambio en el dato los mueve juntos y el control parece funcionar sin funcionar. Ahi el mutante tiene que cambiar una de las dos definiciones.',
 'acierto', 0.95, 1, 'claude');

select registrar_cambio(
 'Cierre del circulo: ningun bug se cierra sin un control con mutante probado',
 'Hasta hoy el sistema tenia deteccion en todos lados y el ciclo abierto en un punto: un hallazgo no producia el control que vigila que no vuelva. El ticket 37 se cerro sin estarlo. Ahora un trigger exige tres cosas para pasar un bug a resuelto: una relacion atada en controles_de_ticket, esa relacion con mutante_resultado en mato_al_mutante, y auditoria_de_escape respondida. Se agrego v_deuda_de_control para lo que se cerro antes de la regla, y v_tasa_de_reapertura, que es la metrica que delata un proceso que cierra sin verificar. De paso se corrigio mi propio linter: v_metricas_reescritas marcaba 9 objetos y los 9 eran falsos positivos, porque marcaba el patron sin medir si la tabla de origen tenia menos dias que los pedidos; ahora cruza contra v_retencion_tablas siguiendo el linaje y da cero. Y se agrego v_drift_semantico, que caza nombres que mienten en cuatro familias.',
 array['tickets','controles_de_ticket','relaciones_verdad','exigir_control_al_cerrar','v_deuda_de_control','v_tasa_de_reapertura','v_metricas_reescritas','v_drift_semantico','v_retencion_tablas'],
 'fix-v101',
 'El trigger se quita con drop trigger trg_exigir_control_al_cerrar. Las vistas nuevas son aditivas. La unica columna agregada a tickets con default es veces_reabierto, que se puede dropear.'
) as registro;;
