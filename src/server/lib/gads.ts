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
