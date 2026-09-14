-- ---------------------------------------------------------------------------
-- DE QUÉ KEYWORD VIENE CADA LEAD, Y DÓNDE SE CAE.
--
-- Todo lo de acá salió de sondear la cuenta real de BHI el 14/9/2026. Tres cosas
-- que cambiaron el diseño y conviene que queden escritas:
--
-- 1. GHL YA CAPTURA LA KEYWORD. El formulario escribe tres campos
--    personalizados: contact.google_click_id, contact.ad_keyword y
--    contact.ad_match_type. Para un LEAD no hace falta cruzar contra click_view.
--    (clicks_keyword sigue sirviendo y para otra cosa: cubre los 32.592 clics,
--    no solo los ~20 que se volvieron lead.)
--
-- 2. EL DESCARTE ES UNA ETAPA, NO UN ESTADO. Los 10 descartados tienen
--    status='open', parados en la columna "Descartado". Un filtro por
--    status='lost' devuelve CERO. Por eso `estado` se deriva de la etapa.
--
-- 3. lostReasonId ESTÁ VACÍO EN LOS 10. El campo existe, nadie lo usa, y los
--    endpoints de catálogo de motivos dan 404. El porqué del descarte está en
--    las notas, y se guarda CLASIFICADO: `motivo_descarte` con una etiqueta de
--    lista cerrada, nunca el texto. Son datos de salud de personas
--    identificables y no entran a esta base.
-- ---------------------------------------------------------------------------

create table if not exists public.ghl_leads (
  account                 text        not null,
  contact_id              text        not null,
  opportunity_id          text,
  -- El nombre de la columna en GHL. NULL si el id de etapa no se pudo resolver:
  -- eso es "no sabemos en qué columna está", no "no está en ninguna".
  etapa                   text,
  -- Derivado de la etapa, no del status. Ver punto 2 de arriba.
  estado                  text        not null check (estado in ('en curso','ganado','descartado')),
  gclid                   text,
  -- La keyword segun GHL (campo del formulario). Puede diferir de la que dice
  -- click_view para el mismo gclid: son dos fuentes y hay que poder compararlas,
  -- no elegir una en silencio.
  keyword                 text,
  concordancia            text,
  monto                   numeric,
  creado                  timestamptz,
  ultimo_cambio_de_etapa  timestamptz,
  -- Etiqueta de lista cerrada. NUNCA el texto de la nota.
  motivo_descarte         text,
  capturado_el            timestamptz not null default now(),
  primary key (account, contact_id)
);

comment on table public.ghl_leads is
  'Leads de GoHighLevel con su keyword de origen y su etapa. SOLO LECTURA desde GHL: este sistema nunca escribe en el CRM. `estado` sale de la ETAPA y no del status, porque en BHI los descartados tienen status=open. `motivo_descarte` es una etiqueta de lista cerrada: el texto de las notas NO se guarda, son datos de salud identificables.';

create index if not exists ghl_leads_keyword on public.ghl_leads (account, keyword) where keyword is not null;
create index if not exists ghl_leads_estado on public.ghl_leads (account, estado);
create index if not exists ghl_leads_gclid on public.ghl_leads (account, gclid) where gclid is not null;

alter table public.ghl_leads enable row level security;
revoke all on public.ghl_leads from anon, authenticated;


-- ---------------------------------------------------------------------------
-- EL CRUCE: qué produce cada keyword, etapa por etapa.
--
-- Es lo que Andrés pidió — "afinar campañas, anuncios y keywords según de dónde
-- viene cada etapa". Una keyword que trae diez leads y los diez se descartan por
-- presupuesto NO es una keyword mala: es una keyword que trae gente que no puede
-- pagar, y eso se arregla en el anuncio o en la landing, no pausándola.
--
-- `sin_keyword` se cuenta aparte a propósito. Meterlo en el total haría parecer
-- que las keywords rinden peor de lo que rinden.
-- ---------------------------------------------------------------------------
create or replace view public.v_keyword_por_etapa
with (security_invoker = true) as
select
  l.account,
  coalesce(l.keyword, '(sin keyword)')                                   as keyword,
  (l.keyword is null)                                                    as sin_keyword,
  count(*)                                                               as leads,
  count(*) filter (where l.estado = 'ganado')                            as ganados,
  count(*) filter (where l.estado = 'descartado')                        as descartados,
  count(*) filter (where l.estado = 'en curso')                          as en_curso,
  -- NULL con cero leads, no 0%: la misma decisión que el CPA canónico.
  round(100.0 * count(*) filter (where l.estado = 'ganado')
        / nullif(count(*), 0), 1)                                        as pct_ganado,
  round(100.0 * count(*) filter (where l.estado = 'descartado')
        / nullif(count(*), 0), 1)                                        as pct_descartado,
  -- El motivo que más aparece entre los descartados de esta keyword.
  mode() within group (order by l.motivo_descarte)
    filter (where l.estado = 'descartado' and l.motivo_descarte is not null) as motivo_mas_comun,
  count(*) filter (where l.estado = 'descartado' and l.motivo_descarte is null) as descartados_sin_motivo,
  count(*) filter (where l.gclid is not null)                            as con_gclid,
  min(l.creado)::date                                                    as primer_lead,
  max(l.creado)::date                                                    as ultimo_lead
from public.ghl_leads l
group by l.account, l.keyword;

comment on view public.v_keyword_por_etapa is
  'Que produce cada keyword: cuantos leads trae y donde caen. Mirar `descartados_sin_motivo` antes de concluir: un motivo que no se pudo clasificar no es "sin motivo", y una keyword con todos sus descartes sin clasificar todavia no se puede juzgar. `sin_keyword` separa los leads cuya keyword no llego, que no son culpa de ninguna keyword.';
