/**
 * DE QUÉ KEYWORD VINO UN LEAD · las tres decisiones que se pueden torcer.
 *
 * Un gclid es una cadena opaca. `click_view` de Google es el único lugar que lo
 * ata a la keyword que lo produjo, y guarda ~90 días: lo que no se captura hoy se
 * pierde. Eso hace que los HUECOS de esta capa sean varios y distintos, y que
 * confundirlos lleve a decisiones opuestas sobre la misma keyword.
 *
 * Vive acá y no adentro del handler porque decide qué se muestra como "la keyword
 * que trajo este cliente", y eso tiene que poder probarse sin llamar a Google.
 */

/** Una fila de click_view, tal como la devuelve la API (camelCase). */
export interface FilaClickView {
  clickView?: {
    gclid?: string;
    keywordInfo?: { text?: string; matchType?: string };
  };
  campaign?: { id?: string | number; name?: string };
  adGroup?: { id?: string | number; name?: string };
  segments?: { date?: string; adNetworkType?: string };
}

export interface ClicCapturado {
  account: string;
  gclid: string;
  fecha: string;
  campana_id: string | null;
  campana: string | null;
  grupo_id: string | null;
  grupo: string | null;
  keyword: string | null;
  concordancia: string | null;
  red: string | null;
}

/**
 * Una fila de Google a una fila nuestra.
 *
 * `keyword: null` significa **"este clic no vino de una keyword"** —Display,
 * PMax, DSA— y NO "no lo capturamos". Lo que distingue las dos cosas es que la
 * fila EXISTA. Por eso acá nunca se pone `''` ni `'sin keyword'`: un centinela de
 * texto en esa columna se vuelve indistinguible de una keyword real llamada así,
 * y ya tuvimos ese problema con 'Unknown' viajando como si fuera una cuenta.
 */
export function mapearClickView(fila: FilaClickView, account: string, diaPedido: string): ClicCapturado | null {
  const gclid = fila.clickView?.gclid;
  if (!gclid) return null;   // sin gclid la fila no sirve para nada: es la clave
  const texto = (s: unknown) => {
    const v = String(s ?? '').trim();
    return v === '' ? null : v;
  };
  return {
    account,
    gclid,
    fecha: fila.segments?.date || diaPedido,
    campana_id: fila.campaign?.id != null ? String(fila.campaign.id) : null,
    campana: texto(fila.campaign?.name),
    grupo_id: fila.adGroup?.id != null ? String(fila.adGroup.id) : null,
    grupo: texto(fila.adGroup?.name),
    keyword: texto(fila.clickView?.keywordInfo?.text),
    concordancia: texto(fila.clickView?.keywordInfo?.matchType),
    red: texto(fila.segments?.adNetworkType),
  };
}

/**
 * Qué porcentaje de los clics reales pudimos traducir.
 *
 * NULL con cero clics, a propósito, y por la misma razón que el CPA canónico
 * devuelve NULL con cero conversiones: `0%` se lee "no capturamos nada, algo está
 * roto", y lo cierto puede ser "no hubo un solo clic ese día". Son dos
 * afirmaciones distintas y solo una de las dos es una falla.
 */
export function coberturaPct(capturados: number, clicsReales: number): number | null {
  if (!(clicsReales > 0)) return null;
  return +((100 * capturados) / clicsReales).toFixed(1);
}

export type EstadoAtribucion = 'sin click id' | 'clic no capturado' | 'sin keyword' | 'atribuido';

/**
 * En qué estado está la atribución de un lead. Espeja EXACTAMENTE el `case` de
 * `v_leads_por_keyword`; están duplicados a propósito y el test los compara, para
 * que la vista y la app no empiecen a contar cosas distintas con el mismo nombre.
 *
 * Los cuatro estados llevan a acciones opuestas:
 *   sin click id      → arreglar el formulario o el tagging. La keyword no tiene
 *                       nada que ver.
 *   clic no capturado → o la captura no corrió, o pasaron los 90 días. Tampoco
 *                       dice nada de la keyword.
 *   sin keyword       → el clic existe y no vino de una keyword. Es un dato.
 *   atribuido         → se sabe cuál fue.
 */
export function estadoAtribucion(
  clickId: string | null | undefined,
  clic: { keyword?: string | null } | null | undefined,
): EstadoAtribucion {
  if (!clickId) return 'sin click id';
  if (!clic) return 'clic no capturado';
  if (clic.keyword == null || clic.keyword === '') return 'sin keyword';
  return 'atribuido';
}
