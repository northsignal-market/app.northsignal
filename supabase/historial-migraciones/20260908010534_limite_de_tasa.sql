-- ============================================================
-- LIMITE DE TASA EN POSTGRES
-- ============================================================
-- Por que en Postgres y no en Redis: el consejo estandar es Redis porque en
-- serverless la memoria no persiste entre instancias. Pero eso supone volumen.
-- Nosotros tenemos 6 conexiones de 60 y un solo usuario humano: el costo de
-- una fila por intento es despreciable, y evita sumar un servicio, dos variables
-- de entorno y una cosa mas que puede caerse.
--
-- Por que ADEMAS del WAF de Vercel: los contadores del WAF se cuentan POR REGION.
-- Un cliente que golpea varias regiones a la vez puede superar el limite en
-- agregado. Para el login eso alcanza para intentar fuerza bruta. El WAF corta
-- el ruido masivo; esto corta lo dirigido.
-- ============================================================
create table if not exists intentos (
  id bigserial primary key,
  cuando timestamptz not null default now(),
  clave text not null,          -- ip, o ip+ruta
  ruta text not null,
  exito boolean not null default false,
  detalle text
);
alter table intentos enable row level security; revoke all on intentos from anon, authenticated;
create index if not exists ix_intentos_clave on intentos (clave, ruta, cuando desc);
comment on table intentos is 'Intentos contra rutas sensibles, para limite de tasa y bloqueo por fuerza bruta. Se limpia sola: las filas de mas de 24 horas se borran en el mantenimiento.';

-- Devuelve si se permite, y si no, cuanto falta. Una sola ida a la base.
create or replace function limite_de_tasa(
  p_clave text, p_ruta text, p_max int default 10, p_ventana interval default interval '15 minutes')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare n int; n_fallos int; espera int;
begin
  select count(*), count(*) filter (where not exito) into n, n_fallos
  from intentos where clave = p_clave and ruta = p_ruta and cuando > now() - p_ventana;

  -- Bloqueo progresivo por fallos: 5 fallos seguidos y la espera se estira.
  -- Contra fuerza bruta esto importa mas que el limite general.
  if n_fallos >= 5 then
    select greatest(0, extract(epoch from (max(cuando) + (interval '1 minute' * least(60, power(2, n_fallos - 4))) - now()))::int)
    into espera from intentos where clave = p_clave and ruta = p_ruta and not exito and cuando > now() - p_ventana;
    if espera > 0 then
      return jsonb_build_object('permitido', false, 'motivo', 'demasiados intentos fallidos',
        'esperar_segundos', espera, 'fallos', n_fallos);
    end if;
  end if;

  if n >= p_max then
    return jsonb_build_object('permitido', false, 'motivo', 'limite de tasa',
      'esperar_segundos', greatest(1, extract(epoch from (
        (select min(cuando) from intentos where clave = p_clave and ruta = p_ruta and cuando > now() - p_ventana)
        + p_ventana - now()))::int),
      'intentos', n, 'maximo', p_max);
  end if;
  return jsonb_build_object('permitido', true, 'intentos', n, 'maximo', p_max);
end $$;
revoke execute on function limite_de_tasa from anon, authenticated;

create or replace function registrar_intento(p_clave text, p_ruta text, p_exito boolean default false, p_detalle text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into intentos (clave, ruta, exito, detalle) values (p_clave, p_ruta, p_exito, p_detalle);
  -- Al acertar se limpia el historial de esa clave: no se castiga a quien ya entro
  delete from intentos where p_exito and clave = p_clave and ruta = p_ruta and not exito;
$$;
revoke execute on function registrar_intento from anon, authenticated;

-- Quien esta golpeando. Para saber si algo raro pasa.
create or replace view v_intentos_sospechosos with (security_invoker = true) as
select clave, ruta, count(*) intentos, count(*) filter (where not exito) fallos,
  min(cuando) desde, max(cuando) hasta,
  case when count(*) filter (where not exito) >= 10 then 'posible fuerza bruta'
       when count(*) >= 100 then 'volumen alto'
       else 'normal' end lectura
from intentos where cuando > now() - interval '24 hours'
group by clave, ruta having count(*) filter (where not exito) >= 5 or count(*) >= 60;

select (limite_de_tasa('1.2.3.4', '/login'))->>'permitido' permitido_de_entrada;;
