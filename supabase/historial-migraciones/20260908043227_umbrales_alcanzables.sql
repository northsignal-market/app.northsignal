-- ============================================================
-- ¿UN UMBRAL PUEDE DISPARARSE ALGUNA VEZ?
-- ============================================================
-- Un umbral en cero no alerta nunca. Uno demasiado alto tampoco, y ademas se ve
-- bien configurado. BHI tenia el umbral de "gasto sin conversion" en 40.000 CLP
-- cuando su maximo diario es 32.550: imposible de alcanzar. Tuvo 12 de 16 dias
-- sin conversion y nunca pudo avisar.
--
-- Esto contrasta cada umbral contra lo que la cuenta realmente hace.
-- ============================================================
create or replace function v_umbrales_alcanzables()
returns table (account text, umbral text, valor numeric, referencia numeric, veredicto text, lectura text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with r as (
    select d.account,
      max(g) gasto_max_dia,
      round(percentile_cont(0.6) within group (order by g))::numeric gasto_tipico,
      round(avg(g))::numeric gasto_promedio
    from (select account, date, sum(cost) g from campaign_daily where date >= current_date - 30 group by 1,2) d
    group by d.account)
  select c.account, 'sin_conv_min_gasto', c.sin_conv_min_gasto, r.gasto_max_dia,
    case when coalesce(c.sin_conv_min_gasto, 0) = 0 then 'APAGADO'
         when c.sin_conv_min_gasto > r.gasto_max_dia then 'IMPOSIBLE'
         when c.sin_conv_min_gasto < r.gasto_promedio * 0.3 then 'DEMASIADO BAJO'
         else 'OK' end,
    case when coalesce(c.sin_conv_min_gasto, 0) = 0 then 'Umbral en cero: nunca avisa por gasto sin conversion.'
         when c.sin_conv_min_gasto > r.gasto_max_dia then 'El umbral (' || c.sin_conv_min_gasto || ') es mayor que el gasto maximo de un dia (' || round(r.gasto_max_dia) || '): no puede dispararse nunca.'
         when c.sin_conv_min_gasto < r.gasto_promedio * 0.3 then 'El umbral es menos de un tercio del gasto diario promedio: va a avisar casi todos los dias y se vuelve ruido.'
         else 'Alcanzable y con margen.' end
  from cuentas c join r on r.account = c.account where c.activa
  union all
  select c.account, 'pico_de_gasto', round(c.presupuesto_diario * c.pico_gasto_factor), r.gasto_max_dia,
    case when c.presupuesto_diario * c.pico_gasto_factor > r.gasto_max_dia * 2 then 'IMPOSIBLE'
         when c.presupuesto_diario * c.pico_gasto_factor < r.gasto_tipico then 'DEMASIADO BAJO'
         else 'OK' end,
    case when c.presupuesto_diario * c.pico_gasto_factor > r.gasto_max_dia * 2 then 'El umbral de pico esta al doble del maximo historico: no va a disparar.'
         when c.presupuesto_diario * c.pico_gasto_factor < r.gasto_tipico then 'El umbral de pico esta por debajo de un dia tipico: va a avisar constantemente.'
         else 'Alcanzable: el maximo de 30 dias fue ' || round(r.gasto_max_dia) || ' contra un umbral de ' || round(c.presupuesto_diario * c.pico_gasto_factor) || '.' end
  from cuentas c join r on r.account = c.account where c.activa;
$$;
comment on function v_umbrales_alcanzables is 'Contrasta cada umbral de alerta contra lo que la cuenta realmente gasta. Un umbral mayor que el gasto maximo de un dia no puede dispararse nunca, y se ve igual de bien configurado que uno correcto.';

select account, umbral, valor, veredicto, left(lectura, 90) lectura from v_umbrales_alcanzables() order by account, umbral;;
