-- ============================================================================
-- EL PIPELINE MUESTRA LOS DOS NOMBRES, NO SOLO QUE "ESTÁ DECLARADA"
--
-- El panel decía `declarada · 168 USD` y eso es jerga nuestra: "declarada" es un
-- estado de funnel_stages, no algo que Andrés vea en GoHighLevel. Mirando el
-- panel al lado del CRM no hay forma de saber QUÉ significa, ni contra qué se
-- está declarando.
--
-- Y lo que hace falta ya está guardado: `funnel_stages` tiene los DOS nombres.
--
--     stage_name               el nombre en GoHighLevel    "Nuevo Lead"
--     google_conversion_action el nombre en Google Ads     "Envío de formulario"
--
-- Esa correspondencia es justo lo que costó encontrar hoy: la etapa se llamaba
-- "Envio de formulario" en funnel_stages y "Nuevo Lead" en GHL, no casaban, y el
-- webhook la habría mandado a SIN_MAPEO. Un panel que muestre los dos lados hace
-- visible el puente — y hace visible cuando falta.
--
-- Se agregan AL FINAL: `create or replace view` no puede insertar una columna en
-- el medio, solo agregar. Ya me comió una vez hoy.
-- ============================================================================

create or replace view public.v_ghl_pipeline
with (security_invoker = true) as
select
  e.account,
  e.pipeline,
  e.orden,
  e.etapa,
  (f.stage_name is not null)                                   as declarada,
  f.stage_value                                                as valor,
  f.currency                                                   as moneda,
  count(l.contact_id)                                          as leads,
  count(l.contact_id) filter (where l.estado = 'descartado')    as descartados,
  count(l.contact_id) filter (where l.estado = 'ganado')        as ganados,
  -- El otro lado del puente: como se llama esta etapa en Google Ads.
  f.google_conversion_action                                   as accion_en_google,
  count(l.contact_id) filter (where l.estado = 'en curso')      as en_curso,
  max(l.ultimo_cambio_de_etapa)                                as ultimo_movimiento
from public.ghl_pipeline_etapas e
left join public.funnel_stages f
       on f.account = e.account
      and f.source  = 'ghl_stage'
      and lower(translate(f.stage_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))
        = lower(translate(e.etapa,      'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))
left join public.ghl_leads l
       on l.account = e.account
      and lower(translate(coalesce(l.etapa,''), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))
        = lower(translate(e.etapa,             'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))
group by e.account, e.pipeline, e.orden, e.etapa,
         f.stage_name, f.stage_value, f.currency, f.google_conversion_action;

comment on view public.v_ghl_pipeline is
  'Las columnas del pipeline de GoHighLevel con los DOS nombres: el de GHL (etapa) y el de Google Ads (accion_en_google). Esa correspondencia es la que decide si el webhook entiende un evento: si la etapa no esta en funnel_stages, sus movimientos van a SIN_MAPEO. La comparacion de nombres ignora tildes y mayusculas, igual que el webhook.';
