/**
 * Los actores del sistema: quién hace qué. Son los compañeros de trabajo de Andrés.
 * Cada uno tiene nombre, inicial y un tono dentro de la paleta.
 */
export const ACTORES: Record<string, { nombre: string; inicial: string; que_hace: string }> = {
  semanal: { nombre: 'Tarea semanal', inicial: 'S', que_hace: 'Analiza la semana cada lunes' },
  pulso: { nombre: 'Análisis diario', inicial: 'D', que_hace: 'Lee el día anterior cada mañana' },
  mensual: { nombre: 'Revisión mensual', inicial: 'M', que_hace: 'Mira tres meses el primer lunes' },
  reconciliador: { nombre: 'Reconciliador', inicial: 'R', que_hace: 'Cierra lo vencido y marca duplicados' },
  politica: { nombre: 'Política automática', inicial: 'A', que_hace: 'Ejecuta lo que vos autorizaste sin preguntar' },
  invariante: { nombre: 'Invariantes', inicial: 'I', que_hace: 'Reglas que no se negocian' },
  anomalias: { nombre: 'Detector de anomalías', inicial: 'N', que_hace: 'Desvíos estadísticos' },
  claude: { nombre: 'Claude', inicial: 'C', que_hace: 'Construye y responde tickets' },
  script: { nombre: 'Script de Google Ads', inicial: 'G', que_hace: 'Ejecuta en la cuenta' },
  sistema: { nombre: 'Sistema', inicial: '·', que_hace: '' },
  agente: { nombre: 'Un agente', inicial: '?', que_hace: '' },
  andres: { nombre: 'Vos', inicial: 'Y', que_hace: '' },
};

export const VERBOS_HUMANOS: Record<string, string> = {
  comento: 'comentó en', edito: 'editó', propuso: 'propuso', respondio: 'respondió', ejecuto: 'ejecutó', fallo: 'falló al ejecutar', alerto: 'avisó',
};

export function actorDe(id?: string | null) { return ACTORES[id || 'agente'] || ACTORES.agente; }

/** "hace 3 min", "hace 2 h", "ayer", "lun 7" */
export function haceCuanto(iso: string): string {
  const t = new Date(iso).getTime(); const d = Date.now() - t;
  if (isNaN(t)) return '';
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), dias = Math.floor(h / 24);
  if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`; if (h < 24) return `hace ${h} h`;
  if (dias === 1) return 'ayer'; if (dias < 7) return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
}

/** Separa el prefijo [ACTOR fecha] del cuerpo de un comentario. */
export function parsearComentario(texto: string): { actor: string; fecha?: string; cuerpo: string } {
  const m = texto.match(/^\[([^\]]*)\]\s*/);
  if (!m) return { actor: 'notion', cuerpo: texto };
  const dentro = m[1];
  const fecha = (dentro.match(/\d{4}-\d{2}-\d{2}|\d{1,2} de [a-z]+(?: de \d{4})?/i) || [])[0];
  const p = dentro.toUpperCase();
  const actor = /^ANDRES/.test(p) ? 'andres' : /TAREA SEMANAL|^SEMANAL|^V\b/.test(p) ? 'semanal' : /^PULSO/.test(p) ? 'pulso' : /MENSUAL/.test(p) ? 'mensual'
    : /^RECONCILIADOR/.test(p) ? 'reconciliador' : /^POL/.test(p) ? 'politica' : /^INVARIANTE/.test(p) ? 'invariante' : /^ANOMAL/.test(p) ? 'anomalias' : /^CLAUDE/.test(p) ? 'claude' : /^APP/.test(p) ? 'sistema' : 'agente';
  return { actor, fecha, cuerpo: texto.slice(m[0].length) };
}
