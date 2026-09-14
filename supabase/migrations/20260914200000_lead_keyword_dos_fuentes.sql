-- ---------------------------------------------------------------------------
-- LA KEYWORD DE CADA LEAD, CON LAS DOS FUENTES Y SU PROCEDENCIA.
--
-- Hay dos caminos para saber de qué keyword vino un lead, y ninguno alcanza solo:
--
--   GHL   el formulario escribe `contact.ad_keyword`. Llega a veces.
--   GOOGLE `clicks_keyword`, capturada de click_view. Llega siempre que haya
--          gclid, porque cubre TODOS los clics y no solo los que convirtieron.
--
-- Medido en BHI el 14/9/2026 sobre los 28 leads:
--
--   con gclid                      20
--   encontrados en clicks_keyword  20   (100%)
--   con keyword desde Google       20
--   con keyword desde GHL           9
--   coinciden                       9   <- las nueve, exactas
--   NO coinciden                    0
--   recuperadas por Google         11
--
-- Las dos fuentes no se contradicen en una sola, y Google rellena las once que
-- GHL no tenía: la cobertura pasa de 9/28 a 20/28. Los 8 sin gclid vienen con
-- medium "Manual" y source "CRM Workflows" — creados a mano, no clics pagos.
-- O sea que TODO LEAD PAGO TIENE SU KEYWORD.
--
-- Manda Google porque es el registro del propio buscador; el campo de GHL lo
-- escribe la landing y puede quedar viejo. Pero la discrepancia NO se resuelve en
-- silencio: `fuentes_en_desacuerdo` la deja a la vista. Hoy da cero, y si algún
-- día deja de dar cero es una señal, no un detalle.
-- ---------------------------------------------------------------------------

-- DROP y CREATE, no CREATE OR REPLACE.
--
-- `create or replace view` NO PUEDE cambiar la lista de columnas: solo agregar al
-- final. La version vieja de v_keyword_por_etapa tiene `con_gclid` donde esta
-- tiene `fuentes_en_desacuerdo`, asi que el REPLACE falla — y si las dos van en
-- el mismo lote, el rollback se lleva tambien a la que si habria funcionado.
-- Paso exactamente eso el 14/9/2026: quedaron las dos sin crear y la vista vieja
-- en su lugar, que es peor que un error visible porque la consulta sigue
-- andando y devuelve las columnas de antes.
drop view if exists public.v_keyword_por_etapa;
drop view if exists public.v_lead_keyword;

create view public.v_lead_keyword
with (security_invoker = true) as
select
  l.account,
  l.contact_id,
  l.etapa,
  l.estado,
  l.motivo_descarte,
  l.gclid,
  -- La keyword resuelta. Google primero; GHL como respaldo.
  coalesce(k.keyword, l.keyword)                       as keyword,
  case
    when k.keyword is not null then 'google'
    when l.keyword is not null then 'ghl'
    else null
  end                                                  as origen_keyword,
  -- Las dos fuentes dicen cosas distintas. Hoy: cero casos.
  (l.keyword is not null and k.keyword is not null
     and lower(l.keyword) <> lower(k.keyword))         as fuentes_en_desacuerdo,
  coalesce(k.concordancia, l.concordancia)             as concordancia,
  k.campana, k.grupo,
  -- POR QUÉ no se sabe la keyword. Tres huecos distintos, tres acciones opuestas:
  --   sin click id      -> el formulario o el tagging. La keyword no tiene que ver.
  --   clic no capturado -> no corrió la captura, o pasaron los 90 días de click_view.
  --   sin keyword       -> el clic existe y no vino de una keyword (PMax, Display).
  case
    when l.gclid is null and l.keyword is null then 'sin click id'
    when coalesce(k.keyword, l.keyword) is not null then 'atribuido'
    when k.gclid is null                        then 'clic no capturado'
    else                                             'sin keyword'
  end                                                  as estado_atribucion,
  l.monto, l.creado, l.ultimo_cambio_de_etapa
from public.ghl_leads l
left join public.clicks_keyword k
       on k.account = l.account and k.gclid = l.gclid;

comment on view public.v_lead_keyword is
  'Cada lead de GHL con la keyword que lo trajo, resuelta contra DOS fuentes: clicks_keyword (Google, manda) y el campo del formulario de GHL (respaldo). `origen_keyword` dice de cual salio y `fuentes_en_desacuerdo` marca si se contradicen — medido el 14/9/2026: 0 desacuerdos en 9 solapes. Mirar SIEMPRE estado_atribucion antes de concluir: "sin click id", "clic no capturado" y "sin keyword" son tres huecos con causas distintas y ninguno significa que la keyword no funcione.';


-- ---------------------------------------------------------------------------
-- QUÉ PRODUCE CADA KEYWORD, ahora con las dos fuentes.
--
-- Una keyword que trae diez leads y los diez se descartan por presupuesto NO es
-- una keyword mala: es una keyword que trae gente que no puede pagar, y eso se
-- arregla en el anuncio o en la landing, no pausandola. Esa distincion es todo
-- el punto de esta vista.
-- ---------------------------------------------------------------------------
create view public.v_keyword_por_etapa
with (security_invoker = true) as
select
  v.account,
  coalesce(v.keyword, '(sin keyword)')                                      as keyword,
  (v.keyword is null)                                                       as sin_keyword,
  min(v.origen_keyword)                                                     as origen,
  v.campana,
  count(*)                                                                  as leads,
  count(*) filter (where v.estado = 'ganado')                               as ganados,
  count(*) filter (where v.estado = 'descartado')                           as descartados,
  count(*) filter (where v.estado = 'en curso')                             as en_curso,
  -- NULL con cero leads, no 0%: misma decision que el CPA canonico.
  round(100.0 * count(*) filter (where v.estado = 'ganado')
        / nullif(count(*), 0), 1)                                           as pct_ganado,
  round(100.0 * count(*) filter (where v.estado = 'descartado')
        / nullif(count(*), 0), 1)                                           as pct_descartado,
  mode() within group (order by v.motivo_descarte)
    filter (where v.estado = 'descartado' and v.motivo_descarte is not null) as motivo_mas_comun,
  -- Un descarte sin motivo clasificado NO es un descarte sin motivo. Una keyword
  -- con todos sus descartes aca todavia no se puede juzgar.
  count(*) filter (where v.estado = 'descartado' and v.motivo_descarte is null) as descartados_sin_motivo,
  count(*) filter (where v.fuentes_en_desacuerdo)                           as fuentes_en_desacuerdo,
  min(v.creado)::date                                                       as primer_lead,
  max(v.creado)::date                                                       as ultimo_lead
from public.v_lead_keyword v
group by v.account, v.keyword, v.campana;

comment on view public.v_keyword_por_etapa is
  'Que produce cada keyword: cuantos leads trae y donde caen, con la keyword resuelta contra Google y GHL. Mirar `descartados_sin_motivo` antes de concluir. `sin_keyword` separa los leads cuya keyword no llego, que no son culpa de ninguna keyword.';
