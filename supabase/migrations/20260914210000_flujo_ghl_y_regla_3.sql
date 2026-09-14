-- ---------------------------------------------------------------------------
-- DOS AFIRMACIONES QUE LOS DATOS YA NO SOSTIENEN.
--
-- 1. EL FLUJO DE CIERRES. `estado_de_los_flujos()` decia: "ningun webhook
--    entrego nunca un evento. El agente busca ahi y no encuentra". El ESTADO
--    seguia siendo correcto —funnel_events sigue en cero porque el webhook no se
--    conecto— pero el consejo dejo de serlo: los leads de BHI SI entran, por la
--    API, y estan en ghl_leads con su keyword y su motivo de descarte.
--
--    Son dos caminos distintos y se separan en dos filas. Marcar el viejo como
--    VIVO habria sido mentir; dejar el consejo habria mandado a un agente a
--    decir "no hay datos" con 28 leads adelante. Las dos cosas son el mismo
--    error con distinto signo.
--
-- 2. LA REGLA 3 DE BHI. Afirmaba que los leads se descalifican "por
--    preexistencias o presupuesto: el filtro es el problema, no el trafico".
--    Leidas las nueve notas reales de los descartados el 14/9/2026: CERO
--    preexistencias, y el presupuesto no es el bloqueo.
--
--    Lo que hay es producto equivocado (buscaban complementario local, asesoria
--    de Isapre, seguro de viaje) y competencia (Cigna, otro broker). Confirmado
--    por una segunda fuente independiente: de los 15 terminos de busqueda que
--    entraron por "seguro internacional", siete son de OTRO producto — cinco de
--    viaje (iclick travel, chapka, mok travel assist, terrawind, schengen) y dos
--    de vida.
--
--    La regla vieja invertia la accion: mandaba a calificar mejor cuando lo que
--    hay que arreglar es el copy y la landing. Y la leen todos los agentes en
--    cada analisis de la cuenta.
--
--    Se deja escrito que la afirmacion anterior se midio y no se sostuvo, porque
--    un dia alguien la va a querer volver a poner.
-- ---------------------------------------------------------------------------

create or replace function public.estado_de_los_flujos()
 returns table(flujo text, cuentas text, quien_escribe text, estado text, ultimo_dato text, lectura text)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select 'Extraccion semanal de Google', 'las 4', 'northsignal_semanal en Google Ads, lunes 07:00',
    case when (select max(week_start) from campaign) >= current_date - 14 then 'VIVO' else 'CORTADO' end,
    (select max(week_start)::text from campaign),
    'Es la base de todo el analisis. Si se corta, ningun agente puede juzgar una semana.'
  union all
  select 'Extraccion diaria', 'las 4', 'northsignal_diario en Google Ads, 06:00',
    case when (select max(date) from campaign_daily) >= current_date - 2 then 'VIVO' else 'CORTADO' end,
    (select max(date)::text from campaign_daily),
    'Alimenta el pulso y las anomalias. Los ultimos 2 dias son provisionales.'
  union all
  select 'Centinela intradia', 'las 4', 'centinela en Google Ads, cada 4 horas',
    case when (select max(created_at) from google_live_events) > now() - interval '8 hours' then 'VIVO' else 'CORTADO' end,
    (select max(created_at)::text from google_live_events),
    'Detecta picos de gasto y cambios que Google aplica solo.'
  union all
  select 'Espejo de accionables', 'las 4', 'cron de novedades cada 30 minutos, desde Notion',
    case when (select max(sincronizado) from accionables_espejo) > now() - interval '2 hours' then 'VIVO' else 'CORTADO' end,
    (select max(sincronizado)::text from accionables_espejo),
    'Sin esto la app muestra accionables viejos y el pre-vuelo decide sobre datos desactualizados.'
  union all
  select 'Ejecucion en Google Ads', 'las 4', 'ejecutor en Google Ads, cada hora',
    case when exists (select 1 from acciones_aprobadas where estado='ejecutada' and aprobada_el > now() - interval '30 days')
      then 'VIVO' else 'SIN USO RECIENTE' end,
    (select max(aprobada_el)::text from acciones_aprobadas where estado='ejecutada'),
    'Lee v_acciones_pendientes. Si no hay ejecuciones, puede ser que no haya nada que ejecutar, no que este roto.'
  union all
  select 'Cierres reales del negocio (webhook)', 'BHI (GoHighLevel), 360 (Asana)', 'webhooks a /api/webhooks',
    case when (select count(*) from funnel_events) > 0 then 'VIVO' else 'NUNCA RECIBIO NADA' end,
    coalesce((select max(created_at)::text from funnel_events), 'ningun evento'),
    'Sigue sin conectarse: ningun webhook entrego un evento, asi que v_cierres_totales y v_win_rates_reales estan vacias. NO es que no hubo cierres. OJO: esto ya NO significa que no se sepa nada de BHI — los leads de GoHighLevel entran por la API (ver el flujo siguiente) y estan en ghl_leads con su keyword y su motivo de descarte. Son dos caminos distintos y este es el que falta.'
  union all
  select 'Leads de GoHighLevel (API)', 'BHI', 'cron ghl-leads, lee la API de GHL (nunca escribe)',
    case when (select count(*) from ghl_leads) > 0 then 'VIVO' else 'NUNCA RECIBIO NADA' end,
    coalesce((select max(capturado_el)::text from ghl_leads), 'ninguna corrida'),
    'De donde vino cada lead y donde quedo. Se consulta con v_keyword_por_etapa: leads, ganados, descartados y POR QUE. Una conversion de Google es un formulario llenado, no un negocio; esta vista dice que paso despues. Mirar descartados_sin_motivo antes de concluir, y el volumen: con menos de 100 leads ninguna diferencia entre keywords es significativa.'
  union all
  select 'Notas entre Andres y los agentes', 'las 4', 'el asistente de la app escribe, el agente lee al empezar',
    case when exists (select 1 from notas_para_agentes) then 'VIVO' else 'sin uso todavia' end,
    (select max(creada)::text from notas_para_agentes),
    'Pendientes: ' || (select count(*)::text from v_notas_pendientes) || '. Se leen al EMPEZAR la corrida.'
  union all
  select 'Memoria semantica', 'las 4', 'cron 06:50 calcula embeddings de lecciones y reflexiones',
    case when not exists (select 1 from v_memoria_pendiente) then 'VIVO' else 'CON PENDIENTES' end,
    (select max(fecha)::text from memoria),
    'parecido_a la consulta. Excluye lo que esta en cuarentena.';
$function$;


-- La regla 3, corregida con lo medido.
update public.cuentas
   set reglas_dominio = replace(
         reglas_dominio,
         '3. Leads buen perfil (ABC1), descalificados por preexistencias o presupuesto: el filtro es el problema, no el trafico.',
         '3. Los descartes NO son por preexistencias ni por presupuesto: medido el 14/9/2026 sobre las nueve notas reales de los descartados, cero preexistencias y el presupuesto no es el bloqueo. Son PRODUCTO EQUIVOCADO (buscaban complementario local, asesoria para bajar Isapre, seguro de viaje) y COMPETENCIA (Cigna, otro broker). Confirmado por segunda fuente: de los 15 terminos que entraron por "seguro internacional", siete son de otro producto — cinco de viaje y dos de vida. O sea que el problema NO es el filtro: el anuncio atrae la intencion equivocada, y se arregla en el copy y en la landing. Consultar v_keyword_por_etapa antes de recomendar sobre una keyword. La afirmacion anterior ("el filtro es el problema, no el trafico") se midio y no se sostuvo.')
 where account = 'BHI'
   and reglas_dominio like '%descalificados por preexistencias o presupuesto%';
