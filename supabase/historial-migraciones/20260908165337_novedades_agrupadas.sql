-- Mismo patron que las alertas: 16 novedades de AI Max y 14 ediciones del agente
-- semanal son DOS hechos, no 30. El patron disruptivo es siempre el mismo: un
-- evento por entidad cuando el hecho es uno solo.
create or replace view v_novedades_agrupadas with (security_invoker = true) as
select coalesce(n.account, '(sistema)') cuenta, n.tipo, coalesce(n.actor, n.autor, 'sistema') actor,
  n.creada::date dia,
  count(*) cuantas,
  case when count(*) = 1 then max(n.titulo)
       else count(*) || ' · ' || coalesce(max(n.verbo), n.tipo) || ' en ' || count(*) || ' entidades' end titulo,
  case when count(*) = 1 then max(n.texto)
       else left(string_agg(distinct coalesce(n.objeto_titulo, n.titulo), ', '), 220) end detalle,
  min(n.id) id_representante,
  array_agg(n.id order by n.id) ids,
  max(n.creada) ultima
from v_novedades n
group by coalesce(n.account, '(sistema)'), n.tipo, coalesce(n.actor, n.autor, 'sistema'), n.creada::date
order by max(n.creada) desc;
comment on view v_novedades_agrupadas is 'Novedades del mismo tipo, actor, cuenta y dia agrupadas. Habia 32 sin leer y eran DOS hechos: AI Max en 16 campanas y el agente semanal editando 14 accionables. Un evento por entidad cuando el hecho es uno solo es el patron que mas satura la bandeja.';

create or replace function marcar_grupo_leido(p_cuenta text, p_tipo text, p_actor text, p_dia date)
returns int language sql security definer set search_path = public, pg_temp as $$
  with r as (update novedades set leida_el = now()
    where leida_el is null and coalesce(account,'(sistema)') = p_cuenta and tipo = p_tipo
      and coalesce(actor, autor, 'sistema') = p_actor and creada::date = p_dia returning 1)
  select count(*)::int from r;
$$;
revoke execute on function marcar_grupo_leido from anon, authenticated;
comment on function marcar_grupo_leido is 'Marca leidas de una vez todas las novedades del mismo hecho. Cerrar 16 avisos identicos uno por uno es trabajo inventado.';

select cuenta, tipo, actor, cuantas, left(titulo, 60) titulo from v_novedades_agrupadas;;
