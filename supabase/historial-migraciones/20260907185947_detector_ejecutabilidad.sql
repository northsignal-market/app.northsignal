-- Clasificador: dado el titulo de un accionable, ¿que verbo ejecutable parece?
-- No adivina la entidad (eso esta prohibido); solo detecta que el accionable
-- PODRIA ejecutarse y no se ofrecio, para que el agente lo complete.
create or replace function verbo_probable(p_titulo text, p_por_que text default '') returns text
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_titulo ~* '(agregar|añadir|sumar|crear).{0,30}negativ'                         then 'agregar_negativa'
    when p_titulo ~* '(quitar|sacar|eliminar|revisar|remover).{0,30}negativ'              then 'quitar_negativa'
    when p_titulo ~* 'pausar.{0,40}(keyword|palabra|termino)'                             then 'pausar_keyword'
    when p_titulo ~* '(reactivar|habilitar|activar).{0,40}(keyword|palabra)'              then 'reactivar_keyword'
    when p_titulo ~* 'pausar.{0,30}anuncio'                                               then 'pausar_anuncio'
    when p_titulo ~* 'pausar.{0,30}(grupo|ad group)'                                      then 'pausar_grupo'
    when p_titulo ~* 'pausar.{0,30}campa'                                                 then 'pausar_campana'
    when p_titulo ~* '(cambiar|pasar|ajustar).{0,40}concordancia'                         then 'cambiar_concordancia'
    when p_titulo ~* '(cambiar|pasar).{0,50}(estrategia de puja|maximizar (conversion|valor)|puja de|a maximizar)' then 'cambiar_estrategia_puja'
    when p_titulo ~* '(subir|bajar|quitar|ajustar|cambiar).{0,30}(tcpa|troas|cpa objetivo|roas objetivo|objetivo de (cpa|roas))' then 'cambiar_objetivo_puja'
    when p_titulo ~* '(subir|bajar|ajustar|cambiar).{0,30}presupuesto'                    then 'cambiar_presupuesto'
    else null end;
$$;
comment on function verbo_probable is 'Detecta si el titulo de un accionable describe algo que un script SI puede ejecutar. No adivina la entidad, solo el verbo: sirve para avisar que falta el Accion JSON, nunca para construirlo solo.';

-- La vista que hacia falta: accionables que se podrian ejecutar y no se ofrecen
create or replace view v_ejecucion_perdida with (security_invoker = true) as
select e.account, e.notion_id, e.titulo, e.estado, e.prioridad,
  verbo_probable(e.titulo, e.por_que) verbo_sugerido,
  c.riesgo, c.requiere, c.metodo,
  'Este accionable describe un cambio que un script SI puede hacer (' || c.metodo || '), pero no tiene Accion JSON, asi que no aparece el boton de ejecutar y hay que hacerlo a mano.' lectura
from accionables_espejo e
join capacidades_ejecucion c on c.verbo = verbo_probable(e.titulo, e.por_que) and c.ejecutable
where e.estado in ('Propuesto','Aprobado','En curso') and not coalesce(e.accion_valida, false)
  and coalesce(e.reemplazado_por, '') = '';

-- Alerta diaria: si hay trabajo manual que podria ser automatico, avisar
create or replace function alertas_ejecucion_perdida() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0; r record;
begin
  for r in select account, count(*) c, string_agg(distinct verbo_sugerido, ', ') verbos, string_agg(left(titulo, 60), ' | ') titulos from v_ejecucion_perdida group by account loop
    if exists (select 1 from alertas where account = r.account and tipo = 'ejecucion_perdida' and estado = 'abierta') then continue; end if;
    perform alerta_registrar(r.account, 'semana', 'ejecucion_perdida',
      r.c || ' accionable(s) de ' || r.account || ' se podrian ejecutar solos y estan como trabajo manual',
      'Verbos detectados: ' || r.verbos || '. Accionables: ' || left(r.titulos, 400) || '. Un script de Google Ads puede hacer estos cambios, pero el accionable no trae Accion JSON, asi que no aparece el boton de ejecutar.',
      'Abrir cada accionable y completar el Accion JSON con la entidad exacta resuelta contra la base. Nunca adivinar el nombre de la keyword o la campana desde el titulo.',
      'capacidades', null, current_date);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function alertas_ejecucion_perdida from anon, authenticated, public;
select cron.unschedule(jobid) from cron.job where jobname = 'ejecucion_perdida';
select cron.schedule('ejecucion_perdida', '40 9 * * *', $$select alertas_ejecucion_perdida()$$);
select account, titulo, verbo_sugerido, riesgo from v_ejecucion_perdida order by account;;
