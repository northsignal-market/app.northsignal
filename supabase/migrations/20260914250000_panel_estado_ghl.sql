-- ============================================================================
-- EL ESTADO DE GOHIGHLEVEL, PARA MIRARLO SIN PREGUNTAR
--
-- Andrés quiere ver de un vistazo que BHI está conectado y en qué etapa está
-- cada lead. Tres decisiones de diseño, y las tres son para que el panel no
-- mienta:
--
-- 1. "CONECTADO" NO ES UNA COSA. Hay dos caminos y hoy están en estados
--    opuestos: la API tira leads cada hora (viva) y el webhook nunca recibió un
--    evento (muerto). Un solo semáforo verde los aplasta, y el que mire va a
--    creer que los cambios de etapa llegan al momento cuando llegan cada hora.
--
-- 2. NO HAY TIEMPO REAL, Y HAY QUE DECIRLO. La ingesta es horaria. Por eso el
--    panel expone `minutos_desde_la_ingesta` y no un punto verde: un dato de
--    hace 50 minutos presentado como "en vivo" es la clase de mentira verosímil
--    que este sistema existe para cazar.
--
-- 3. LAS ETAPAS SIN DECLARAR SON EL RIESGO. El pipeline tiene 10 columnas y
--    `funnel_stages` declara 4. Si el webhook se conecta hoy, seis de cada diez
--    movimientos caen en SIN_MAPEO — incluidos Descartado y Cerrado Perdido, que
--    son los que más le importan. Tienen que verse AUNQUE TENGAN CERO LEADS, y
--    por eso las etapas se guardan aparte en vez de derivarse de ghl_leads: una
--    etapa vacía no aparecería.
-- ============================================================================

create table if not exists public.ghl_pipeline_etapas (
  account      text        not null,
  pipeline     text        not null,
  orden        int         not null,
  etapa        text        not null,
  etapa_id     text,
  capturado_el timestamptz not null default now(),
  primary key (account, pipeline, etapa)
);

comment on table public.ghl_pipeline_etapas is
  'Las columnas del pipeline de GoHighLevel, tal como las devuelve la API. Se guardan para poder mostrar las etapas SIN LEADS, que son justo las que revelan el riesgo: una etapa que existe en GHL y no esta declarada en funnel_stages manda sus eventos a SIN_MAPEO. Derivarlas de ghl_leads no sirve: una etapa vacia no aparece.';

alter table public.ghl_pipeline_etapas enable row level security;
revoke all on public.ghl_pipeline_etapas from anon, authenticated;


-- ----------------------------------------------------------------------------
-- El pipeline, columna por columna, con lo que importa de cada una.
--
-- `declarada` cruza contra funnel_stages SIN TILDES ni mayusculas, que es como
-- compara el webhook (`normalizar` en routes/webhooks.ts). Si acá se comparara
-- distinto, el panel diría "declarada" sobre una etapa que el webhook manda a
-- SIN_MAPEO — el panel y el codigo contando cosas distintas con el mismo nombre.
-- ----------------------------------------------------------------------------
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
  count(l.contact_id) filter (where l.estado = 'ganado')        as ganados
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
group by e.account, e.pipeline, e.orden, e.etapa, f.stage_name, f.stage_value, f.currency;

comment on view public.v_ghl_pipeline is
  'Las columnas del pipeline con cuantos leads hay en cada una y si estan declaradas en funnel_stages. Una etapa con declarada=false manda sus eventos del webhook a SIN_MAPEO. La comparacion de nombres ignora tildes y mayusculas, igual que el webhook.';


-- ----------------------------------------------------------------------------
-- El estado de la conexión. Los DOS caminos, por separado.
-- ----------------------------------------------------------------------------
create or replace view public.v_ghl_estado
with (security_invoker = true) as
select
  c.account,
  c.ghl_location_id,
  -- CAMINO 1 · la API. Es el que hoy trae los datos.
  (select ultimo_ok from latidos where tarea = 'ghl_leads')                       as api_ultima_ingesta,
  (select round(extract(epoch from (now() - ultimo_ok)) / 60)
     from latidos where tarea = 'ghl_leads')                                      as api_minutos_desde,
  (select tolerancia from latidos where tarea = 'ghl_leads')                      as api_tolerancia,
  (select count(*) from ghl_leads l where l.account = c.account)                  as leads,
  -- CAMINO 2 · el webhook. Cero eventos = nunca se conectó. NO es "no hubo cambios".
  (select count(*) from webhook_events where source = 'gohighlevel')              as webhook_eventos,
  (select max(received_at) from webhook_events where source = 'gohighlevel')      as webhook_ultimo,
  -- Atribución, con el denominador correcto: los que tuvieron clic.
  (select count(*) from ghl_leads l where l.account = c.account and l.gclid is not null)          as con_click_id,
  (select count(*) from v_lead_keyword v where v.account = c.account and v.keyword is not null)    as con_keyword,
  -- Etapas del pipeline contra las declaradas: el riesgo de SIN_MAPEO.
  (select count(*) from v_ghl_pipeline p where p.account = c.account)                              as etapas_en_ghl,
  (select count(*) from v_ghl_pipeline p where p.account = c.account and p.declarada)              as etapas_declaradas,
  -- Descartes sin clasificar: un descarte sin motivo NO es un descarte sin motivo.
  (select count(*) from ghl_leads l where l.account = c.account and l.estado = 'descartado')       as descartados,
  (select count(*) from ghl_leads l where l.account = c.account and l.estado = 'descartado'
      and l.motivo_descarte is not null)                                                           as descartados_con_motivo
from public.cuentas c
where c.ghl_location_id is not null;

comment on view public.v_ghl_estado is
  'Estado de la conexion con GoHighLevel, con los DOS caminos separados: la API (viva, horaria) y el webhook (que puede no estar conectado). NO hay tiempo real: api_minutos_desde dice de cuando es el dato. Mirar etapas_en_ghl contra etapas_declaradas: la diferencia son eventos que el webhook mandaria a SIN_MAPEO.';
