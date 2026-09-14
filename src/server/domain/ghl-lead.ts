/**
 * UN LEAD DE GOHIGHLEVEL, CON DE DÓNDE VINO Y DÓNDE QUEDÓ.
 *
 * Todo lo de acá salió de sondear la cuenta real de BHI el 14/9/2026, no de
 * recordar la documentación de GHL. Lo que se descubrió y por qué importa:
 *
 * 1. GHL YA CAPTURA LA KEYWORD. Hay tres campos personalizados puestos por el
 *    formulario: `contact.google_click_id`, `contact.ad_keyword` y
 *    `contact.ad_match_type`. O sea que para un lead no hace falta cruzar contra
 *    click_view: la keyword viene con él. (click_view sigue sirviendo, y para
 *    otra cosa: cubre TODOS los clics, no solo los que se volvieron lead.)
 *
 * 2. LOS CAMPOS SE LEEN POR ID, NUNCA POR POSICIÓN. El gclid aparecía en
 *    `customFields[2].value` en unos contactos y en `[3]` en otros. Leerlo por
 *    índice funciona hoy y empieza a leer OTRO campo el día que alguien agregue
 *    uno en GHL — en silencio, atribuyendo el clic equivocado al lead
 *    equivocado. Por eso todo acá pasa por `valorDeCampo(contacto, id)`.
 *
 * 3. EL DESCARTE ES UNA ETAPA, NO UN ESTADO. Los 10 descartados están en
 *    `status: 'open'`, parados en la columna "Descartado". Buscarlos por
 *    `status: 'lost'` devuelve CERO. Un filtro por estado los pierde a todos.
 */

/** Los ids de los campos del formulario de BHI, medidos en la cuenta real. */
export const CAMPOS_BHI = {
  gclid: 'XNYn6LB1z6srM1Ba1sZp',       // contact.google_click_id
  keyword: 'bpOCzQuY8wRgUTity222',      // contact.ad_keyword
  concordancia: 'PBkgT6J0y3Q9glKvUcPT', // contact.ad_match_type
} as const;

export interface CampoGhl { id?: string; value?: unknown; fieldValue?: unknown }

/**
 * El valor de un campo personalizado, por ID.
 *
 * Devuelve null —no ''— cuando el campo no está o vino vacío. La diferencia
 * importa aguas abajo: `null` es "este lead no trae keyword" y `''` sería una
 * keyword llamada cadena vacía, que después agrupa con todas las demás vacías
 * como si fueran la misma.
 */
export function valorDeCampo(campos: CampoGhl[] | null | undefined, id: string): string | null {
  if (!Array.isArray(campos)) return null;
  const c = campos.find((x) => x?.id === id);
  const v = c?.value ?? c?.fieldValue;
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export type EstadoLead = 'en curso' | 'ganado' | 'descartado';

/**
 * Dónde quedó el lead.
 *
 * Mira la ETAPA primero, porque en BHI el descarte vive ahí: los descartados
 * tienen `status: 'open'`. Confiar en `status` los cuenta como en curso, y ese
 * es justo el error que haría parecer que no se cae nadie.
 */
export function estadoDelLead(etapa: string | null | undefined, status: string | null | undefined): EstadoLead {
  const e = String(etapa ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/descart|perdid|no calific/.test(e)) return 'descartado';
  if (String(status ?? '').toLowerCase() === 'won' || /cliente activo/.test(e)) return 'ganado';
  if (String(status ?? '').toLowerCase() === 'lost') return 'descartado';
  return 'en curso';
}

export interface LeadGhl {
  account: string;
  contact_id: string;
  opportunity_id: string | null;
  etapa: string | null;
  estado: EstadoLead;
  gclid: string | null;
  keyword: string | null;
  concordancia: string | null;
  monto: number | null;
  creado: string | null;
  ultimo_cambio_de_etapa: string | null;
}

/**
 * Arma el lead a partir de la oportunidad y su contacto.
 *
 * `contacto` puede venir null: la oportunidad trae un `contact` embebido pero sin
 * los campos personalizados. En ese caso gclid y keyword van null —"no lo
 * sabemos"— y NO se rellenan con nada. Un lead sin keyword y un lead cuya
 * keyword no pudimos leer son dos cosas distintas, y las dos se ven igual si se
 * las tapa con un valor por defecto.
 */
export function armarLead(
  oportunidad: any,
  contacto: any | null,
  nombreEtapa: (id: unknown) => string | null,
  account = 'BHI',
): LeadGhl | null {
  const contactId = oportunidad?.contactId ?? contacto?.id;
  if (!contactId) return null;
  const etapa = nombreEtapa(oportunidad?.pipelineStageId);
  const campos = contacto?.customFields as CampoGhl[] | undefined;
  return {
    account,
    contact_id: String(contactId),
    opportunity_id: oportunidad?.id ? String(oportunidad.id) : null,
    etapa,
    estado: estadoDelLead(etapa, oportunidad?.status),
    gclid: valorDeCampo(campos, CAMPOS_BHI.gclid),
    keyword: valorDeCampo(campos, CAMPOS_BHI.keyword),
    concordancia: valorDeCampo(campos, CAMPOS_BHI.concordancia),
    monto: typeof oportunidad?.monetaryValue === 'number' ? oportunidad.monetaryValue : null,
    creado: oportunidad?.createdAt ?? contacto?.dateAdded ?? null,
    ultimo_cambio_de_etapa: oportunidad?.lastStageChangeAt ?? null,
  };
}
