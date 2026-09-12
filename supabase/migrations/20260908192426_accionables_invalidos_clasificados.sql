-- Ticket 38: marcaba como invalidos 9 accionables que correctamente NO llevan JSON
-- porque su verbo no es ejecutable. Tres cosas distintas se veian igual: sin JSON y
-- esta bien, sin JSON y deberia tenerlo, y JSON roto.
drop view if exists v_accionables_invalidos cascade;
create view v_accionables_invalidos with (security_invoker = true) as
with clas as (
  select a.account, a.notion_id, a.titulo, a.estado, (a.accion->>'verbo') verbo, a.accion_error,
    exists (select 1 from capacidades_ejecucion c where c.plataforma='google' and c.ejecutable
      and (a.titulo ~* c.verbo or coalesce(a.como_hacerlo,'') ~* c.verbo)) sugiere_verbo_ejecutable,
    a.accion is null sin_json,
    coalesce(a.accion_valida, false) json_valido,
    exists (select 1 from capacidades_ejecucion c where c.verbo = a.accion->>'verbo' and c.plataforma='google') verbo_conocido
  from accionables_espejo a
  where a.estado in ('Propuesto','Bloqueado','Aprobado','En curso'))
select account, notion_id, titulo, estado, verbo, accion_error,
  case
    when sin_json and not sugiere_verbo_ejecutable then 'sin_json_correcto'
    when sin_json then 'sin_json_y_deberia_tenerlo'
    when not json_valido then 'json_roto'
    when not verbo_conocido then 'verbo_desconocido'
    else 'ok' end clasificacion,
  case
    when sin_json and not sugiere_verbo_ejecutable
      then 'CORRECTO: no lleva Accion JSON porque su verbo no es ejecutable por script. No es un error y no hay nada que arreglar.'
    when sin_json
      then 'FALTA: el titulo sugiere un verbo que SI es ejecutable y el agente no dejo el JSON. Es trabajo manual evitable.'
    when not json_valido then 'ROTO: ' || coalesce(accion_error, 'el JSON no parsea')
    when not verbo_conocido then 'Verbo fuera del registro de capacidades: revisar si falta darlo de alta.'
    else 'Listo para ejecutar.' end lectura
from clas;
comment on view v_accionables_invalidos is 'Ticket 38. Distingue sin_json_correcto (el verbo no es ejecutable, no es error) de sin_json_y_deberia_tenerlo y json_roto. Antes los tres se veian igual y 9 accionables correctos figuraban como invalidos.';

select clasificacion, count(*) n, left(string_agg(distinct titulo, ' | '), 90) ejemplo
from v_accionables_invalidos group by 1 order by 2 desc;;
