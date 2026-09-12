-- AGRUPAR POR CAUSA, NO POR EVENTO. Hoy la capa de calidad devuelve 13 filas y 8 de las
-- violaciones son el mismo hecho: bugs que ya conocemos y que ya tienen ticket abierto.
-- Eso es ruido con forma de alerta, y el mecanismo de degradacion esta bien descrito:
-- filtrar ruido repetidamente desensibiliza, y el sistema termina condicionando a ignorar
-- justo las senales que existia para mostrar.
--
-- Tres reglas que salen de la practica de alertado:
--   1. Si quien la recibe no puede tomar una accion especifica, la alerta no deberia existir.
--   2. Agregar eventos relacionados en incidentes coherentes, no listar atomos.
--   3. Lo conocido va a un resumen, no a una notificacion. Una violacion cuyo ticket ya
--      esta abierto no es una alerta, es un estado.
-- La meta publicada: entre 70% y 80% de las alertas criticas tienen que provocar una accion
-- real. Por debajo del 50% hay demasiado ruido. Por eso se mide, mas abajo.

create table if not exists public.incidentes_atendidos (
  clave        text primary key,
  atendido_el  timestamptz not null default now(),
  que_se_hizo  text not null,
  atendido_por text
);

comment on table public.incidentes_atendidos is
  'Que se hizo con cada incidente. Existe para poder medir la tasa de accion: si menos de la mitad de lo que el tablero muestra termina en algo, el tablero es ruido prolijo y hay que podarlo, no mirarlo mas fuerte.';

create or replace view public.v_incidentes as
-- A. Relaciones de verdad violadas, agrupadas por relacion y no por cuenta.
with rel as (
  select r.nombre as causa,
         r.familia as clase,
         string_agg(distinct v.cuenta, ', ' order by v.cuenta) as cuentas,
         count(*) as eventos,
         (select string_agg(distinct ct.ticket_id::text, ', ')
            from controles_de_ticket ct join tickets t on t.id = ct.ticket_id
           where ct.relacion_id = r.id and t.estado = 'abierto') as tickets_abiertos,
         min(r.por_que_existe) as por_que
    from v_relaciones_violadas v
    join relaciones_verdad r on r.nombre = v.nombre
   group by r.id, r.nombre, r.familia
),
-- B. Drift semantico, agrupado por familia. Siete filas de "sin contrato" son una sola cosa.
drift as (
  select d.familia as causa, 'drift'::text as clase,
         string_agg(distinct d.objeto, ', ' order by d.objeto) as objetos,
         count(*) as eventos
    from v_drift_semantico d group by d.familia
)
select 'relacion' as origen,
       rel.causa,
       rel.clase,
       rel.eventos,
       rel.cuentas as donde,
       rel.tickets_abiertos,
       case when rel.tickets_abiertos is not null then 'seguimiento' else 'actuar' end as severidad,
       case when rel.tickets_abiertos is not null
            then 'Ya tiene ticket abierto (' || rel.tickets_abiertos || '). No es una alerta nueva: es el estado de un bug conocido. Va al resumen.'
            else 'Sin ticket. Nadie lo esta mirando: abrir uno o corregir.' end as que_hacer,
       md5('relacion|' || rel.causa || '|' || rel.cuentas) as clave,
       left(rel.por_que, 200) as contexto
  from rel
union all
select 'drift', drift.causa, drift.clase, drift.eventos, drift.objetos, null,
       case drift.causa
         when 'ventana_que_miente' then 'actuar'
         when 'tipo_que_miente'    then 'actuar'
         else 'informativo' end,
       case drift.causa
         when 'sin_contrato' then 'No hay accion inmediata: es un hueco, no una falla. Se cierra declarando contratos, empezando por las columnas que alguien cita en un brief.'
         when 'afirmacion_sin_contrato' then 'Declarar que condicion afirma exactamente cada booleano.'
         else 'Renombrar o corregir: un nombre que miente sobrevive a cualquier auditoria.' end,
       md5('drift|' || drift.causa),
       null
  from drift;

comment on view public.v_incidentes is
  'Un incidente es una causa, no un evento. Agrupa las senales de calidad por causa y las clasifica en actuar, seguimiento e informativo. Una violacion cuyo ticket ya esta abierto NO es una alerta: es un estado, y va al resumen. Sin esta separacion el tablero muestra el mismo hecho ocho veces y se deja de mirar.';

create or replace view public.v_para_actuar as
select i.* from v_incidentes i
 left join incidentes_atendidos a on a.clave = i.clave
 where i.severidad = 'actuar' and a.clave is null
 order by i.eventos desc;

comment on view public.v_para_actuar is
  'Lo unico que pide una accion ahora mismo. Si esta vista esta vacia, no hay nada que hacer con la calidad de datos hoy. Lo demas vive en v_incidentes y se mira cuando uno quiere, no cuando el sistema grita.';

create or replace view public.v_tasa_de_accion as
select count(*) filter (where a.clave is not null) as atendidos,
       count(*) as incidentes_que_pedian_accion,
       round(count(*) filter (where a.clave is not null)::numeric / nullif(count(*), 0) * 100, 1) as tasa_pct,
       case when count(*) = 0 then 'Sin incidentes que pidan accion.'
            when count(*) filter (where a.clave is not null)::numeric / count(*) < 0.5
              then 'Por debajo del 50%: hay demasiado ruido. Podar chequeos, no mirar mas fuerte.'
            when count(*) filter (where a.clave is not null)::numeric / count(*) < 0.7
              then 'Entre 50 y 70%: aceptable, con margen para podar.'
            else 'Arriba del 70%: el tablero esta diciendo cosas que se usan.' end as lectura
  from v_incidentes i
  left join incidentes_atendidos a on a.clave = i.clave
 where i.severidad = 'actuar';

comment on view public.v_tasa_de_accion is
  'Que porcentaje de lo que el tablero marca como accionable termina en una accion. Es la metrica que distingue un tablero de un ruido prolijo. La referencia publicada es 70 a 80%; por debajo de 50% el problema es el tablero, no la atencion de quien lo mira.';;
