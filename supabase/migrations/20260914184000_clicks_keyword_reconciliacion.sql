-- ---------------------------------------------------------------------------
-- LO QUE SE MIDIÓ AL LLENAR clicks_keyword, PARA QUE NADIE LO "ARREGLE".
--
-- El relleno de 90 días terminó con 32.592 clics capturados. Al verificar la
-- cobertura aparecieron dos cosas que hay que dejar escritas, porque las dos se
-- ven como bugs y ninguna lo es.
--
-- 1. `campaign_daily` NO es el denominador de los clics de una cuenta.
--    No trae PERFORMANCE_MAX. Comparando contra esa tabla, Fresh Monkee daba
--    115,9% de cobertura — un imposible que delató el error. Con el total real
--    de Google (4.071, de los cuales 400 son PMax) la cobertura es 99,2%.
--    Si alguien necesita "cuántos clics tuvo la cuenta", la respuesta sale de la
--    API (`metrics.clicks` sobre `customer`), no de campaign_daily.
--
-- 2. `click_view` y `metrics.clicks` NO reconcilian a la unidad.
--    Medido del 2026-08-22 al 2026-09-13, capturado contra clics de Google:
--        360            217 clics,   8 invalidos, capturado  216   (-1)
--        BHI             79 clics,   5 invalidos, capturado   80   (+1)
--        FRESH_MONKEE  4071 clics, 445 invalidos, capturado 4040  (-31)
--        KAREDO        2594 clics,  94 invalidos, capturado 2600   (+6)
--    Dos por debajo, dos por encima, todas dentro de +/-1%, y todas por debajo
--    de clics+invalidos. Son dos superficies de reporte distintas: click_view es
--    un registro crudo y metrics.clicks un agregado con ajustes por clics
--    invalidos que Google aplica con retraso.
--
--    O sea: la cobertura correcta es ~99-101%, NO 100% exacto. Un control que
--    exija identidad entre las dos va a fallar siempre sin que nada este roto,
--    y un control que falla sin motivo es un control que se deja de mirar.
-- ---------------------------------------------------------------------------

comment on table public.clicks_keyword is
  'Traduccion gclid -> keyword/campana/grupo, capturada de click_view. Se captura a diario porque click_view solo guarda ~90 dias: lo que no se captura se pierde para siempre. '
  'Fila ausente = no capturado. Fila con keyword null = capturado y ese clic no vino de una keyword (Display, PMax, DSA). Las dos cosas NO son lo mismo. '
  'COBERTURA: ~99-101% contra metrics.clicks, medido 2026-08-22 a 2026-09-13 en las cuatro cuentas. click_view y metrics.clicks son superficies distintas y NO reconcilian a la unidad; esperar identidad es esperar una falla permanente. '
  'OJO: campaign_daily no sirve de denominador, no trae PERFORMANCE_MAX (dio 115,9% en FRESH_MONKEE). El denominador real sale de la API.';
