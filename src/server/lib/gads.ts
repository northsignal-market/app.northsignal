/**
 * GOOGLE ADS API (GAQL) · 12 sep 2026
 * ----------------------------------------------------------------------------
 * Primer paso de la migración script → API. Los Google Ads Scripts agregan a
 * mano en JavaScript y ahí nacieron los bugs de extracción (tickets 12, 29,
 * 32, 42, 54). La API devuelve los mismos datos tipados y segmentados por
 * Google: campaña, grupo, keyword, término, valor de conversión y change_event
 * con fecha timestamp de verdad.
 *
 * Acceso: nivel "explorador" (feb 2026) — cuentas de producción, 2.880
 * operaciones/día, solo lectura de reportes. Sobra para 4 cuentas diarias.
 * REST v25 con fetch: sin dependencias nuevas en el bundle.
 *
 * REGLA: el rango de fechas SIEMPRE cerrado. Un filtro abierto en change_event
 * es rechazado por Google (así se rompió el semanal, ticket 32), y en métricas
 * suma días que maduran distinto entre corridas.
 */

const VERSION = 'v25';

const DEV_TOKEN = process.env.GADS_DEVELOPER_TOKEN || '';
const CLIENT_ID = process.env.GADS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GADS_CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.GADS_REFRESH_TOKEN || '';
const LOGIN_CID = (process.env.GADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');

export function gadsDisponible(): boolean {
  return !!(DEV_TOKEN && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

// El access token dura ~1 hora; se renueva con el refresh token y se cachea en memoria.
let _tok: { v: string; vence: number } | null = null;
async function accessToken(): Promise<string> {
  if (_tok && Date.now() < _tok.vence - 60000) return _tok.v;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token'
    })
  });
  const j: any = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`OAuth de Google: ${j.error_description || j.error || r.status}`);
  _tok = { v: j.access_token, vence: Date.now() + (j.expires_in || 3600) * 1000 };
  return _tok.v;
}

/**
 * Corre una consulta GAQL y devuelve todas las filas (pagina hasta agotar).
 * cid con o sin guiones. loginCid: undefined usa la MCC del env; null lo omite
 * (para cuentas que no cuelgan de la MCC, como FRESH_MONKEE si accede directo).
 */
export async function gadsSearch(cid: string, gaql: string, opts: { loginCid?: string | null } = {}): Promise<any[]> {
  const customer = cid.replace(/-/g, '');
  const login = opts.loginCid === null ? '' : (opts.loginCid || LOGIN_CID).replace(/-/g, '');
  const tok = await accessToken();
  const filas: any[] = [];
  let pageToken: string | undefined;
  do {
    const r = await fetch(`https://googleads.googleapis.com/${VERSION}/customers/${customer}/googleAds:search`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tok}`,
        'developer-token': DEV_TOKEN,
        ...(login ? { 'login-customer-id': login } : {}),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ query: gaql, ...(pageToken ? { pageToken } : {}) })
    });
    const j: any = await r.json();
    if (!r.ok) {
      const det = j?.error?.details?.[0]?.errors?.[0];
      throw new Error(`GAQL ${r.status}: ${det?.message || j?.error?.message || 'error desconocido'}${det?.location?.fieldPathElements ? ` · campo: ${JSON.stringify(det.location.fieldPathElements)}` : ''}`);
    }
    filas.push(...(j.results || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return filas;
}

/**
 * KEYWORD PLANNER · la demanda del mercado, no la nuestra.
 *
 * Es el único lugar donde Google nos dice cuán grande es la subasta. Sin esto,
 * el sistema no puede distinguir "cayeron las conversiones porque lo hicimos
 * mal" de "cayeron porque el mercado bajó" — la confusión más cara que existe
 * acá, porque le echa la culpa a la gestión de lo que es estacionalidad.
 *
 * Tres cosas que condicionan cómo se usa:
 *  - NO consume la cuota de operaciones (Google lo documenta explícitamente),
 *    así que las 2.880 op/día del nivel Explorer quedan intactas.
 *  - Los datos refrescan UNA VEZ POR MES: pedirlos a diario es gastar por nada.
 *  - El volumen es un promedio REDONDEADO y Google agrupa variantes cercanas.
 *    Es dato direccional de mercado; nunca entra a una métrica propia.
 *
 * Límites de la API: 10.000 keywords y 10 geos por request, 1 consulta/segundo.
 */
export async function keywordPlannerHistorico(cid: string, opts: {
  keywords: string[];
  geoTargets?: string[];      // constantes tipo 'geoTargetConstants/2152' (Chile)
  idioma?: string;            // 'languageConstants/1003' (español), 1001 alemán, 1000 inglés
  loginCid?: string | null;
}): Promise<Array<{ keyword: string; mes: string; busquedas: number; competencia: string | null; competenciaIndice: number | null; pujaBaja: number | null; pujaAlta: number | null }>> {
  const customer = cid.replace(/-/g, '');
  const login = opts.loginCid === null ? '' : (opts.loginCid || LOGIN_CID).replace(/-/g, '');
  const tok = await accessToken();
  // El tope es 10.000, pero se manda de a 1.000: un request gigante que falla
  // no dice cuál keyword lo rompió.
  const lotes: string[][] = [];
  for (let i = 0; i < opts.keywords.length; i += 1000) lotes.push(opts.keywords.slice(i, i + 1000));

  const salida: any[] = [];
  for (const lote of lotes) {
    const r = await fetch(`https://googleads.googleapis.com/${VERSION}/customers/${customer}:generateKeywordHistoricalMetrics`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tok}`,
        'developer-token': DEV_TOKEN,
        ...(login ? { 'login-customer-id': login } : {}),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        keywords: lote,
        ...(opts.geoTargets?.length ? { geoTargetConstants: opts.geoTargets.slice(0, 10) } : {}),
        ...(opts.idioma ? { language: opts.idioma } : {}),
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        historicalMetricsOptions: { includeAverageCpc: true },
      })
    });
    const j: any = await r.json();
    if (!r.ok) {
      const det = j?.error?.details?.[0]?.errors?.[0];
      throw new Error(`Keyword Planner ${r.status}: ${det?.message || j?.error?.message || 'error desconocido'}`);
    }
    for (const res of (j.results || [])) {
      const m = res.keywordMetrics || {};
      // La serie mensual es lo que importa: el "promedio" de Google esconde la
      // estacionalidad, que es justo lo que se quiere medir.
      for (const v of (m.monthlySearchVolumes || [])) {
        salida.push({
          keyword: res.text || res.searchQuery || '',
          mes: mesISO(v.year, v.month),
          busquedas: Number(v.monthlySearches || 0),
          competencia: m.competition || null,
          competenciaIndice: m.competitionIndex != null ? Number(m.competitionIndex) : null,
          pujaBaja: m.lowTopOfPageBidMicros != null ? Number(m.lowTopOfPageBidMicros) / 1e6 : null,
          pujaAlta: m.highTopOfPageBidMicros != null ? Number(m.highTopOfPageBidMicros) / 1e6 : null,
        });
      }
    }
    if (lotes.length > 1) await new Promise(s => setTimeout(s, 1100));  // 1 QPS
  }
  return salida;
}

/** Google devuelve el mes como enum ('SEPTEMBER'); acá se vuelve fecha real. */
function mesISO(year: string | number, month: string): string {
  const MESES: Record<string, number> = {
    JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
    JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
  };
  const m = MESES[String(month).toUpperCase()] || 1;
  return `${year}-${String(m).padStart(2, '0')}-01`;
}

/**
 * Las consultas de la extracción, con rango cerrado [desde, hasta] en YYYY-MM-DD.
 * Espejan lo que hoy cargan los scripts, más lo que los scripts NO traen:
 * top/abs_top impression share (ticket 12) y conversions_value (ROAS).
 * Si un nombre de campo está mal, la API lo dice en el error y se corrige acá:
 * para eso existe el endpoint de prueba.
 */
export function consultasGaql(desde: string, hasta: string): Record<string, string> {
  const M = 'metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value';
  const RANGO = `segments.date BETWEEN '${desde}' AND '${hasta}'`;
  return {
    campanas: `SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ${M}, metrics.search_impression_share, metrics.search_budget_lost_impression_share FROM campaign WHERE ${RANGO} AND campaign.status IN ('ENABLED','PAUSED')`,
    grupos: `SELECT segments.date, campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group.status, ${M}, metrics.search_top_impression_share, metrics.search_absolute_top_impression_share FROM ad_group WHERE ${RANGO} AND ad_group.status != 'REMOVED'`,
    keywords: `SELECT segments.date, campaign.name, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ${M}, metrics.search_top_impression_share, metrics.search_absolute_top_impression_share FROM keyword_view WHERE ${RANGO}`,
    terminos: `SELECT segments.date, campaign.name, ad_group.name, search_term_view.search_term, search_term_view.status, segments.keyword.info.text, ${M} FROM search_term_view WHERE ${RANGO}`,
    // change_event exige rango cerrado ≤ 30 días y LIMIT explícito. La fecha es timestamp real: el ticket 54 muere acá.
    cambios: `SELECT change_event.change_date_time, change_event.change_resource_type, change_event.client_type, change_event.user_email, change_event.changed_fields, campaign.name FROM change_event WHERE change_event.change_date_time >= '${desde}' AND change_event.change_date_time <= '${hasta} 23:59:59' ORDER BY change_event.change_date_time DESC LIMIT 10000`,
  };
}
