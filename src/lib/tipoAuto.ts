/**
 * Qué tipo de acción automática es un accionable, si alguna.
 * Compartido por el drawer (botón), la Bandeja (etiqueta) y el server (políticas).
 * Solo negativas y pausas: son reversibles. Todo lo demás devuelve null.
 */
export type TipoAuto = 'negativa_grupo' | 'negativa_campana' | 'pausar_keyword' | 'pausar_anuncio';

export function detectarTipoAuto(titulo: string, comoHacerlo?: string | null): TipoAuto | null {
  const t = `${titulo} ${comoHacerlo || ''}`.toLowerCase();
  if (/negativ/.test(t)) return /nivel (de )?campa|a la campa|lista/.test(t) ? 'negativa_campana' : 'negativa_grupo';
  if (/pausar|pausa\b|desactivar/.test(t)) {
    if (/anuncio|rsa\b|\bad\b/.test(t)) return 'pausar_anuncio';
    if (/grupo de anuncios|ad group|campa[ñn]a completa|toda la campa/.test(t)) return null; // grupos y campañas no se pausan solos
    return 'pausar_keyword';
  }
  return null;
}

/** Extrae la keyword o término del título: entre comillas, o tras "keyword"/"término", o la entidad. */
export function extraerKeyword(titulo: string, entidad?: string | null): string {
  const m = titulo.match(/["“'‘\[]([^"”'’\]]+)["”'’\]]/);
  if (m) return m[1].trim();
  const k = titulo.match(/(?:keyword|término|termino|palabra clave|negativa)\s+(?:de\s+)?([a-z0-9äöüß][^,;:()]{2,60}?)(?:\s+(?:en|del|de la|a nivel|como)\b|$)/i);
  if (k) return k[1].trim();
  const partes = String(entidad || '').split('|').map(x => x.trim());
  return partes[2] || '';
}
