/**
 * GOHIGHLEVEL · cliente de lectura, y un sondeo que no filtra.
 *
 * Hay dos caminos distintos hacia GHL y conviene no confundirlos:
 *
 *   - El WEBHOOK (`/api/webhooks/gohighlevel`) es GHL empujando un cambio de
 *     etapa. Ya existe y no necesita este archivo.
 *   - La API (esto) es nosotros tirando de datos que el webhook no manda: las
 *     notas del contacto y de dónde vino.
 *
 * El token vive SOLO en `process.env.GHL_API_TOKEN`. No se guarda en la base, no
 * se loguea, y ninguna función de acá lo devuelve.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ EL SONDEO DEVUELVE FORMAS Y NO VALORES
 *
 * Los contactos de BHI son personas con seguro de salud en Chile, y sus notas
 * dicen cosas como "descalificado por preexistencia". Eso es información médica
 * identificable. Un sondeo que vuelca respuestas crudas para "ver qué trae"
 * termina con esos datos en un log, en un chat o en un ticket — y una vez que
 * salieron, salieron.
 *
 * Así que `formaDe()` emite nombres de campo y TIPOS, nunca contenidos. Lo único
 * que sale con valor son cosas estructurales que no identifican a nadie: cuántos
 * hay, si un campo existe, y en qué RUTA aparece un gclid (la ruta, no el gclid).
 */

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

export function ghlDisponible(): boolean {
  return !!process.env.GHL_API_TOKEN;
}

export interface RespuestaGhl {
  ok: boolean;
  status: number | null;
  cuerpo?: any;
  error?: string;
}

/** Un GET a la API de GHL. Nunca lanza: el error es un dato, no una excepción. */
export async function ghlGet(ruta: string, params: Record<string, string> = {}): Promise<RespuestaGhl> {
  const token = process.env.GHL_API_TOKEN;
  if (!token) return { ok: false, status: null, error: 'GHL_API_TOKEN no configurado' };
  const url = new URL(BASE + ruta);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' },
    });
    const texto = await r.text();
    let cuerpo: any = null;
    try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = { _no_era_json: texto.slice(0, 200) }; }
    // El mensaje de error de GHL sí se devuelve: describe el problema (scope que
    // falta, versión, ruta inexistente) y no trae datos de nadie.
    if (!r.ok) return { ok: false, status: r.status, error: String(cuerpo?.message || cuerpo?.error || texto).slice(0, 300) };
    return { ok: true, status: r.status, cuerpo };
  } catch (e: any) {
    return { ok: false, status: null, error: String(e?.message || e).slice(0, 200) };
  }
}

/**
 * La FORMA de un valor: qué campos tiene y de qué tipo, sin un solo contenido.
 *
 * Las cadenas salen como `string(12)` —el tipo y el largo— porque el largo ayuda
 * a distinguir un id de un texto libre y no dice nada de la persona.
 */
export function formaDe(v: unknown, profundidad = 0): any {
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    if (!v.length) return 'array(0)';
    return { [`array(${v.length})`]: profundidad >= 3 ? '…' : formaDe(v[0], profundidad + 1) };
  }
  switch (typeof v) {
    case 'string':  return `string(${v.length})`;
    case 'number':  return 'number';
    case 'boolean': return 'boolean';
    case 'object': {
      if (profundidad >= 3) return '{…}';
      const out: Record<string, any> = {};
      for (const k of Object.keys(v as any).slice(0, 60)) out[k] = formaDe((v as any)[k], profundidad + 1);
      return out;
    }
    default: return typeof v;
  }
}

/** ¿Parece un click id de Google? Los gclid son largos y de un alfabeto acotado. */
function pareceClickId(s: string): boolean {
  return s.length >= 30 && /^[A-Za-z0-9_-]+$/.test(s);
}

/**
 * En qué RUTAS del objeto aparece algo que parece un click id.
 *
 * Devuelve las rutas, NUNCA los valores. Es la pregunta que decide todo el
 * diseño —¿el gclid llega en `attributionSource`, en un custom field, en ningún
 * lado?— y se puede contestar sin mirar un solo dato de una persona.
 */
export function rutasDeClickId(v: unknown, ruta = '', out: string[] = [], profundidad = 0): string[] {
  if (profundidad > 5 || out.length >= 12) return out;
  if (typeof v === 'string') {
    const clave = ruta.toLowerCase();
    if (/gclid|wbraid|gbraid|clickid/.test(clave) || pareceClickId(v)) out.push(ruta || '(raíz)');
    return out;
  }
  if (Array.isArray(v)) {
    v.slice(0, 5).forEach((x, i) => rutasDeClickId(x, `${ruta}[${i}]`, out, profundidad + 1));
    return out;
  }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v as any)) rutasDeClickId((v as any)[k], ruta ? `${ruta}.${k}` : k, out, profundidad + 1);
  }
  return out;
}
