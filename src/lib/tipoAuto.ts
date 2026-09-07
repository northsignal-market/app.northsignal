/**
 * Qué tipo de acción automática es un accionable, si alguna.
 * Compartido por el drawer (botón), la Bandeja (etiqueta) y el server (políticas).
 * Solo negativas y pausas: son reversibles. Todo lo demás devuelve null.
 */
export type TipoAuto = 'negativa_grupo' | 'negativa_campana' | 'pausar_keyword' | 'pausar_anuncio' | 'cambiar_concordancia';

export function detectarTipoAuto(titulo: string, comoHacerlo?: string | null): TipoAuto | null {
  const t = `${titulo} ${comoHacerlo || ''}`.toLowerCase();
  if (/negativ/.test(t)) return /nivel (de )?campa|a la campa|lista/.test(t) ? 'negativa_campana' : 'negativa_grupo';
  if ((/concordancia|match type/.test(t) && /cambiar|pasar|mover|a exacta|a frase|a amplia|to exact|to phrase/.test(t)) || /\bde (amplia|frase|exacta) a (amplia|frase|exacta)\b/.test(t)) return 'cambiar_concordancia';
  if (/\b\d+ (keywords|palabras clave|negativas|t[eé]rminos)\b/.test(t)) return null; // lote sin JSON: no hay lista que ejecutar
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
  // "Cambiar X de concordancia ..." / "Pausar X en ..." / "Agregar X como negativa"
  const c = titulo.match(/^(?:cambiar|pausar|desactivar|agregar|añadir|excluir)\s+(?:la\s+keyword\s+|la\s+palabra\s+clave\s+|el\s+término\s+|la\s+)?(.+?)\s+(?:de\s+(?:concordancia|amplia|frase|exacta)\b|en\s+(?:el\s+grupo|la\s+campaña|[A-Z0-9])|como\s+negativa|a\s+nivel|a\s+(?:exacta|frase|amplia)\b)/i);
  if (c) return c[1].trim();
  const k = titulo.match(/(?:keyword|término|termino|palabra clave|negativa)\s+(?:de\s+)?([a-z0-9äöüß][^,;:()]{2,60}?)(?:\s+(?:en|del|de la|a nivel|como)\b|$)/i);
  if (k) return k[1].trim();
  // Entidad con formato ruta (A > B > C > keyword) o campaña|grupo|keyword: el último tramo
  const e = String(entidad || '');
  if (e.includes(' > ')) return e.split(' > ').pop()!.trim();
  const partes = e.split('|').map(x => x.trim());
  return partes.length >= 3 ? partes[partes.length - 1] : '';
}

/** Concordancia destino de un título "de X a Y". Devuelve la última mencionada. */
export function concordanciaDestino(titulo: string): 'EXACT' | 'PHRASE' | 'BROAD' | null {
  const t = titulo.toLowerCase();
  const m = t.match(/\ba\s+(exacta|frase|amplia|exact|phrase|broad)\b/g);
  if (!m || !m.length) return null;
  const ult = m[m.length - 1].replace(/^a\s+/, '');
  return /exact/.test(ult) ? 'EXACT' : /frase|phrase/.test(ult) ? 'PHRASE' : 'BROAD';
}
