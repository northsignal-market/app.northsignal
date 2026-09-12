-- 16 alertas del mismo tipo y el mismo dia son UN hecho, no 16. Fresh Monkee tenia
-- 16 avisos de AI Max, uno por campana, mas la alerta que ya lo resume. Verlas
-- sueltas tapa el resto: de 25 alertas abiertas, 16 eran la misma cosa.
create or replace view v_alertas_agrupadas with (security_invoker = true) as
select a.account, a.tipo, a.nivel, a.creada::date dia,
  count(*) cuantas,
  case when count(*) = 1 then max(a.titulo)
       else count(*) || ' entidades · ' || max(a.titulo) end titulo,
  case when count(*) = 1 then max(a.detalle)
       else left(string_agg(split_part(a.detalle, ' (', 1), ', ' order by a.detalle), 200) end detalle,
  min(a.id) id_representante,
  array_agg(a.id order by a.id) ids,
  case when count(*) >= 5 then 'Un solo hecho repetido en ' || count(*) || ' entidades: se resuelven juntas con resolver_grupo_alertas.' end lectura
from alertas a where a.estado = 'abierta' and coalesce(a.silenciada_hasta, '-infinity'::timestamptz) < now()
group by a.account, a.tipo, a.nivel, a.creada::date;
comment on view v_alertas_agrupadas is 'Alertas del mismo tipo, cuenta y dia agrupadas en una. Fresh Monkee tenia 16 de AI Max del mismo dia: es UN hecho en 16 campanas, y verlas sueltas tapa todo lo demas.';

create or replace function resolver_grupo_alertas(p_account text, p_tipo text, p_dia date)
returns int language sql security definer set search_path = public, pg_temp as $$
  with r as (update alertas set estado = 'resuelta', resuelta_el = now()
    where estado = 'abierta' and account = p_account and tipo = p_tipo and creada::date = p_dia returning 1)
  select count(*)::int from r;
$$;
revoke execute on function resolver_grupo_alertas from anon, authenticated;
comment on function resolver_grupo_alertas is 'Resuelve de una vez todas las alertas del mismo tipo, cuenta y dia. Cerrar 16 avisos del mismo hecho uno por uno es trabajo inventado.';

select account, tipo, cuantas, left(titulo, 70) titulo from v_alertas_agrupadas order by cuantas desc;;
