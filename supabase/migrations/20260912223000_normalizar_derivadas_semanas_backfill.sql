-- Cierra el ciclo de los backfills de maduración: en las 18 semanas tocadas quedaron
-- filas donde el primer backfill cambió conversions pero las derivadas siguieron
-- calculadas sobre el valor viejo (el guard de hoy las salteó porque la tupla
-- conversions/all_conversions/conv_value ya coincidía con la API).
-- Se recalculan cost_per_conv, conv_rate (porcentaje) y roas desde las columnas
-- almacenadas, solo donde se desvían más que el redondeo. Las semanas no tocadas
-- conservan la procedencia pura del script y no se tocan.
update campaign set
  cost_per_conv = case when conversions > 0 then round(cost / conversions, 2) else 0 end,
  conv_rate     = case when clicks > 0 then round(conversions / clicks * 100, 2) else 0 end,
  roas          = case when cost > 0 then round(conv_value / cost, 2) else 0 end
where week_start between '2026-06-15' and '2026-08-31'
  and account in ('FRESH_MONKEE', 'KAREDO', 'BHI')
  and ( abs(cost_per_conv - case when conversions > 0 then round(cost / conversions, 2) else 0 end) > 0.011
     or abs(conv_rate     - case when clicks > 0 then round(conversions / clicks * 100, 2) else 0 end) > 0.011
     or abs(roas          - case when cost > 0 then round(conv_value / cost, 2) else 0 end) > 0.011 );
