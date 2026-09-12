-- El backfill 20260912220500 escribió conv_rate como ratio (0.0341) en las filas que
-- actualizó, pero la convención de la tabla es porcentaje (3.41), como lo escribe el
-- script semanal. Se corrigen solo las filas con la huella exacta de la fórmula errónea
-- (conv_rate = round(conversions/clicks, 4)); las filas del script no se tocan.
update campaign
set conv_rate = round(conversions / clicks * 100, 2)
where week_start between '2026-06-15' and '2026-08-31'
  and account in ('FRESH_MONKEE', 'KAREDO', 'BHI')
  and clicks > 0 and conversions > 0
  and conv_rate = round(conversions / clicks, 4)
  and conv_rate <> round(conversions / clicks * 100, 2);
