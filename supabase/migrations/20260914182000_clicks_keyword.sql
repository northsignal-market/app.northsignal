-- ---------------------------------------------------------------------------
-- DE QUÉ KEYWORD VINO CADA LEAD
--
-- El webhook de GoHighLevel guarda el `gclid` de cada contacto, pero un gclid
-- solo no dice nada: es una cadena opaca. `click_view` de Google es el ÚNICO
-- lugar donde ese gclid se ata a la keyword que lo produjo, y tiene dos límites
-- que obligan a capturarlo TODOS LOS DÍAS:
--
--   * pide un solo día por consulta
--   * guarda alrededor de 90 días hacia atrás
--
-- Pasada esa ventana, ese gclid ya no se puede traducir nunca. Por eso esto es
-- una tabla propia y no una consulta al vuelo: lo que no se captura hoy se
-- pierde, y una junta que devuelve NULL por ventana vencida se lee igual que
-- "este clic no tuvo keyword", que es una afirmación completamente distinta.
--
-- Verificado contra BHI (8829408394) el 14/9/2026 antes de escribir esto:
--   2026-09-08  clicks 3   click_view 3   con keyword 3   cobertura 100%
--   2026-09-10  clicks 5   click_view 5   con keyword 5   cobertura 100%
--   2026-09-12  clicks 2   click_view 2   con keyword 2   cobertura 100%
-- ---------------------------------------------------------------------------

create table if not exists public.clicks_keyword (
  account       text        not null,
  gclid         text        not null,
  fecha         date        not null,
  campana_id    text,
  campana       text,
  grupo_id      text,
  grupo         text,
  -- NULL acá significa "este clic NO vino de una keyword" (Display, PMax, DSA),
  -- no "no lo capturamos". La diferencia entre las dos la da la EXISTENCIA de la
  -- fila: si el gclid no está en la tabla, no se capturó. Si está con keyword
  -- null, se capturó y no había keyword. Nunca hay que adivinar cuál de las dos.
  keyword       text,
  concordancia  text,
  red           text,
  capturado_el  timestamptz not null default now(),
  primary key (account, gclid)
);

comment on table public.clicks_keyword is
  'Traduccion gclid -> keyword/campana/grupo, capturada de click_view. Se captura a diario porque click_view solo guarda ~90 dias: lo que no se captura se pierde para siempre. Fila ausente = no capturado. Fila con keyword null = capturado y ese clic no vino de una keyword (Display, PMax, DSA). Las dos cosas NO son lo mismo.';

create index if not exists clicks_keyword_cuenta_fecha on public.clicks_keyword (account, fecha);
create index if not exists clicks_keyword_keyword on public.clicks_keyword (account, keyword) where keyword is not null;

alter table public.clicks_keyword enable row level security;
-- El servidor entra con service_role, que salta RLS. Sin politicas, nadie mas lee.
revoke all on public.clicks_keyword from anon, authenticated;


-- ---------------------------------------------------------------------------
-- El lead, con la keyword que lo trajo.
--
-- Tres estados distintos y NINGUNO se puede confundir con los otros, porque
-- llevan a decisiones opuestas sobre la misma keyword:
--
--   'sin click id'      el lead no trajo gclid. No es culpa de la keyword:
--                       es el formulario o el tagging. No se puede atribuir.
--   'clic no capturado' hay gclid pero no está en clicks_keyword. O la captura
--                       no corrió ese día, o el clic ya salió de los 90 días.
--                       NO quiere decir que no tuvo keyword.
--   'sin keyword'       capturado, y ese clic no vino de una keyword.
--   'atribuido'         se sabe, y está en `keyword`.
-- ---------------------------------------------------------------------------
create or replace view public.v_leads_por_keyword
with (security_invoker = true) as
select
  f.account,
  f.external_id,
  f.stage_order,
  f.stage_name,
  f.stage_value,
  f.currency,
  f.reached_at,
  f.click_id,
  f.click_id_type,
  k.keyword,
  k.concordancia,
  k.campana,
  k.grupo,
  k.fecha as fecha_del_clic,
  case
    when f.click_id is null                     then 'sin click id'
    when k.gclid is null                        then 'clic no capturado'
    when k.keyword is null                      then 'sin keyword'
    else 'atribuido'
  end as estado_atribucion
from public.funnel_events f
left join public.clicks_keyword k
       on k.account = f.account and k.gclid = f.click_id;

comment on view public.v_leads_por_keyword is
  'Cada lead con la keyword que lo trajo. Mirar SIEMPRE estado_atribucion antes de sacar conclusiones: "sin click id", "clic no capturado" y "sin keyword" son tres huecos distintos con causas distintas, y ninguno significa que la keyword no funcione.';
