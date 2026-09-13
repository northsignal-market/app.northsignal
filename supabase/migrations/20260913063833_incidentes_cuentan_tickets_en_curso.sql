-- Un ticket en_curso es precisamente alguien mirandolo: v_incidentes solo
-- contaba estado='abierto' y una relacion con su bug EN TRABAJO (tickets 47/48)
-- aparecia en v_para_actuar como "nadie lo esta mirando". Anotado en la
-- bitacora del 13/9 (pulse-total-v1, chequeo de cierre) como micro-fix.
create or replace view v_incidentes as
 WITH rel AS (
         SELECT r.nombre AS causa,
            r.familia AS clase,
            string_agg(DISTINCT v.cuenta, ', ' ORDER BY v.cuenta) AS cuentas,
            count(*) AS eventos,
            ( SELECT string_agg(DISTINCT ct.ticket_id::text, ', ')
                   FROM controles_de_ticket ct
                     JOIN tickets t ON t.id = ct.ticket_id
                  WHERE ct.relacion_id = r.id AND t.estado in ('abierto', 'en_curso')) AS tickets_abiertos,
            min(r.por_que_existe) AS por_que
           FROM v_relaciones_violadas v
             JOIN relaciones_verdad r ON r.nombre = v.nombre
          GROUP BY r.id, r.nombre, r.familia
        ), drift AS (
         SELECT d.familia AS causa,
            'drift'::text AS clase,
            string_agg(DISTINCT d.objeto, ', ' ORDER BY d.objeto) AS objetos,
            count(*) AS eventos
           FROM v_drift_semantico d
          GROUP BY d.familia
        )
 SELECT 'relacion'::text AS origen,
    rel.causa,
    rel.clase,
    rel.eventos,
    rel.cuentas AS donde,
    rel.tickets_abiertos,
        CASE
            WHEN rel.tickets_abiertos IS NOT NULL THEN 'seguimiento'::text
            ELSE 'actuar'::text
        END AS severidad,
        CASE
            WHEN rel.tickets_abiertos IS NOT NULL THEN ('Ya tiene ticket abierto o en curso ('::text || rel.tickets_abiertos) || '). No es una alerta nueva: es el estado de un bug conocido. Va al resumen.'::text
            ELSE 'Sin ticket. Nadie lo esta mirando: abrir uno o corregir.'::text
        END AS que_hacer,
    md5((('relacion|'::text || rel.causa) || '|'::text) || rel.cuentas) AS clave,
    "left"(rel.por_que, 200) AS contexto
   FROM rel
UNION ALL
 SELECT 'drift'::text AS origen,
    drift.causa,
    drift.clase,
    drift.eventos,
    drift.objetos AS donde,
    NULL::text AS tickets_abiertos,
        CASE drift.causa
            WHEN 'ventana_que_miente'::text THEN 'actuar'::text
            WHEN 'tipo_que_miente'::text THEN 'actuar'::text
            ELSE 'informativo'::text
        END AS severidad,
        CASE drift.causa
            WHEN 'sin_contrato'::text THEN 'No hay accion inmediata: es un hueco, no una falla. Se cierra declarando contratos, empezando por las columnas que alguien cita en un brief.'::text
            WHEN 'afirmacion_sin_contrato'::text THEN 'Declarar que condicion afirma exactamente cada booleano.'::text
            ELSE 'Renombrar o corregir: un nombre que miente sobrevive a cualquier auditoria.'::text
        END AS que_hacer,
    md5('drift|'::text || drift.causa) AS clave,
    NULL::text AS contexto
   FROM drift;

comment on view v_incidentes is 'Un incidente es una causa, no un evento. Agrupa las senales de calidad por causa y las clasifica en actuar, seguimiento e informativo. Una violacion cuyo ticket ya esta abierto o en curso NO es una alerta: es un estado de un bug conocido (en curso es precisamente alguien mirandolo), y va al resumen. Sin esta separacion el tablero muestra el mismo hecho ocho veces y se deja de mirar.';
