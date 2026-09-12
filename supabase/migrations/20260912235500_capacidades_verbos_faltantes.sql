-- Cinco verbos del estandar de accionables no tenian fila en capacidades_ejecucion,
-- asi que el trigger marcar_ejecutabilidad_real() los marcaba "Verbo desconocido":
-- confunde, porque son conocidos, solo que van a mano. Quedan registrados con su
-- motivo real, ejecutable=false. Idempotente gracias al indice unico (verbo, plataforma).
insert into public.capacidades_ejecucion (verbo, plataforma, ejecutable, riesgo, requiere, por_que_no)
values
  ('cambiar_conversion', 'google', false, 'alto', null,
   'Las acciones de conversion no estan en AdsApp. Se cambian en Objetivos > Conversiones, a mano o con la API.'),
  ('cambiar_puja', 'google', false, 'medio', null,
   'Verbo ambiguo (legado del estandar v1). Decir QUE puja se toca: cambiar_cpc_keyword o cambiar_objetivo_puja, que si son ejecutables.'),
  ('crear_keyword', 'google', false, 'medio', null,
   'Sin rama probada en el ejecutor. El camino probado es cambiar_concordancia, que crea la keyword nueva y pausa la vieja. Para crear una suelta, a mano.'),
  ('cambiar_programacion', 'google', false, 'medio', null,
   'AdsApp lee los ad schedules pero no hay rama en el ejecutor ni caso probado. A mano en Google Ads.'),
  ('desactivar_automatizacion', 'google', false, 'alto', null,
   'Las recomendaciones auto-aplicadas se desactivan en la interfaz de Google Ads (Recomendaciones > Aplicar automaticamente). A mano.')
on conflict (verbo, plataforma) do nothing;
