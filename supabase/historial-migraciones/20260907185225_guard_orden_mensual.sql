-- ================================================================
-- GUARD DE ORDEN PARA LA REVISION MENSUAL
-- La mensual lee el estado de cada cuenta. Si corre antes que las semanales
-- del dia, lee un estado viejo: el brief de BHI de septiembre nacio con el
-- triple conteo de conversiones porque la mensual corrio a las 02:24 UTC y la
-- semanal de BHI a las 11:45, nueve horas despues.
-- ================================================================
create or replace function mensual_puede_correr() returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  with lunes as (select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date l),
  semana_a_analizar as (select l - 7 s from lunes),
  activas as (select account, nombre_cliente from cuentas where activa),
  -- ¿Cada cuenta activa corrio su semanal sobre la semana que toca?
  semanales as (
    select a.account,
      (select max(r.created_at) from run_quality r where r.account = a.account
         and r.semana_analizada = (select s from semana_a_analizar)
         and coalesce(r.que_fallo, '') not ilike 'redundante%'
         and coalesce(r.que_fallo, '') not ilike 'semana cerrada no disponible%') corrio,
      (select count(*) from campaign c where c.account = a.account) filas
    from activas a
  ),
  mensual as (
    select max(created_at) ultima from run_quality where account = 'MENSUAL'
      and coalesce(que_fallo, '') not ilike 'redundante%'
  ),
  pendientes as (select account from semanales where corrio is null and filas > 0)
  select jsonb_build_object(
    'semana_a_analizar', (select s from semana_a_analizar),
    'cuentas_activas', (select count(*) from activas),
    'semanales_hechas', (select count(*) from semanales where corrio is not null),
    'semanales_pendientes', (select coalesce(jsonb_agg(account), '[]') from pendientes),
    'detalle', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'corrio', corrio, 'semanas_de_historia', (select count(distinct week_start) from campaign c where c.account = semanales.account))), '[]') from semanales),
    'ultima_mensual_real', (select ultima from mensual),
    'ya_corrio_este_mes', coalesce((select date_trunc('month', ultima) = date_trunc('month', current_date) from mensual), false),
    'es_primer_lunes', extract(dow from current_date) = 1 and extract(day from current_date) <= 7,
    'puede_correr', not exists (select 1 from pendientes)
      and not coalesce((select date_trunc('month', ultima) = date_trunc('month', current_date) from mensual), false),
    'motivo', case
      when coalesce((select date_trunc('month', ultima) = date_trunc('month', current_date) from mensual), false)
        then 'Ya hubo una revision mensual real este mes el ' || (select ultima::date from mensual) || '. Registrar redundante y parar.'
      when exists (select 1 from pendientes)
        then 'Faltan las semanales de: ' || (select string_agg(account, ', ') from pendientes) || '. La mensual lee el estado de cada cuenta: si corre antes, lee un estado viejo. Esperar y reintentar.'
      else 'Puede correr: todas las semanales de la semana ' || (select s from semana_a_analizar) || ' ya pasaron y no hubo mensual este mes.' end
  );
$$;
comment on function mensual_puede_correr is 'Guard de orden y de redundancia para la revision mensual. Verifica que TODAS las cuentas activas hayan corrido su semanal sobre la semana que toca antes de dejar correr la mensual, y que no haya habido una mensual real este mes. Nacio del caso del 7 de septiembre de 2026: la mensual corrio a las 02:24 UTC y la semanal de BHI a las 11:45, asi que el brief mensual de BHI se escribio con el triple conteo de conversiones que la semanal corrigio despues.';
select mensual_puede_correr();;
