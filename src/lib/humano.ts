/**
 * Traduce los veredictos de las vistas SQL, escritos para el contrato con
 * los prompts, a frases para el operador. Las vistas no cambian: son el
 * lenguaje común entre Supabase y las tareas. La app traduce al mostrar.
 */

const ZONAS: Record<string, string> = {
  'PROPONER': 'Hay evidencia para hacerlo',
  'REVISAR': 'Vale la pena mirarlo, pero falta algo',
  'NO PROPONER': 'Todavía no',
  'NO APLICA': 'No aplica a esta cuenta',
  'SIN DATOS': 'Sin datos aún',
};

/** "NO PROPONER · faltan días consolidados (9 de 28)." → { zona, texto } */
export function decision(texto: string | null | undefined): { zona: string; etiqueta: string; detalle: string; activa: boolean } {
  if (!texto) return { zona: '', etiqueta: '', detalle: '', activa: false };
  const m = texto.match(/^(PROPONER|REVISAR|NO PROPONER|NO APLICA|SIN DATOS)\s*·?\s*(.*)$/s);
  if (!m) return { zona: '', etiqueta: '', detalle: texto, activa: false };
  const zona = m[1];
  let detalle = m[2].trim();
  // Frases de sistema a frases de persona
  detalle = detalle
    .replace(/faltan días consolidados \((\d+) de (\d+)\)\.?/i, (_, a, b) => `hay ${a} días de datos firmes de los ${b} que hacen falta para decidir.`)
    .replace(/Mínimo (\d+)\/mes\.?/i, 'Se necesitan al menos $1 conversiones al mes.')
    .replace(/v_cpa_marginal/g, 'la curva de rendimiento')
    .replace(/\bconv\b/g, 'conversiones')
    .replace(/28d/g, '28 días')
    .replace(/×/g, ' veces')
    .replace(/Reversible\.?/i, 'Se puede deshacer.')
    .replace(/Evaluar con Andrés\.?/i, 'Decisión tuya.');
  return { zona, etiqueta: ZONAS[zona] || zona, detalle, activa: zona === 'PROPONER' || zona === 'REVISAR' };
}

/** Veredictos de headroom: "HEADROOM (…)" / "TECHO" / "LIMITADA POR RANKING" / "NO ESCALAR" / "INESTABLE" */
export function headroom(veredicto: string | null | undefined): { corto: string; largo: string } {
  const v = (veredicto || '').toUpperCase();
  if (v.startsWith('HEADROOM')) return { corto: 'Hay margen para escalar', largo: 'El siguiente escalón de presupuesto rinde parecido al actual. Subir de a 15 o 20% y medir dos semanas.' };
  if (v.startsWith('TECHO')) return { corto: 'Sin demanda por capturar', largo: 'La cuota de impresiones supera 90%. Más presupuesto no encuentra más búsquedas.' };
  if (v.startsWith('LIMITADA')) return { corto: 'Frenada por calidad, no por dinero', largo: 'La cuota perdida es por ranking. Subir presupuesto no ayuda; mejorar Quality Score sí.' };
  if (v.startsWith('NO ESCALAR')) return { corto: 'No escalar', largo: 'El CPA está sobre el máximo tolerable. Primero bajar el costo, después el volumen.' };
  if (v.startsWith('INESTABLE')) return { corto: 'Demasiado inestable para decidir', largo: 'Los últimos días varían demasiado entre sí. Esperar a que se asiente.' };
  if (v.startsWith('SIN DATOS') || v.startsWith('SIN OBJETIVO')) return { corto: 'Sin objetivo definido', largo: 'Falta el CPA máximo o el objetivo de conversiones en la cuenta.' };
  return { corto: veredicto || '', largo: '' };
}

/** Lectura de CPA marginal */
export function marginal(lectura: string | null | undefined): string {
  const l = (lectura || '').toUpperCase();
  if (l.startsWith('SATURADA')) return 'Saturada: cada conversión extra cuesta más del doble';
  if (l.startsWith('RENDIMIENTO')) return 'Rinde menos: la conversión extra cuesta 30% más';
  if (l.startsWith('HEADROOM')) return 'Rinde parecido: se puede subir';
  if (l.startsWith('SIN GANANCIA')) return 'Más gasto, mismas conversiones';
  if (l.startsWith('ACTUAL')) return 'Nivel actual';
  if (l.startsWith('PRIMER')) return 'Primer escalón';
  return lectura || '';
}

/** Nivel del pulso diario */
export function nivelPulso(n: string | null | undefined): { etiqueta: string; descripcion: string } {
  if (n === 'critico') return { etiqueta: 'Requiere acción hoy', descripcion: 'Algo cruzó un umbral que no espera al lunes.' };
  if (n === 'atencion') return { etiqueta: 'Para mirar el lunes', descripcion: 'Una condición del plan se viene cumpliendo o hay un hallazgo con peso.' };
  return { etiqueta: 'Día normal', descripcion: 'Nada fuera de lo esperado.' };
}

/** Naturaleza de un accionable */
export function naturaleza(n: string | null | undefined): string {
  if (n === 'Observacion') return 'Lo vio en los datos';
  if (n === 'Inferencia') return 'Lo dedujo';
  if (n === 'Hipotesis') return 'Es una explicación posible';
  return n || '';
}

/** Madurez del dato */
export function madurez(m: string | null | undefined): string {
  if (m === 'provisional') return 'Aún puede cambiar';
  if (m === 'madurando') return 'Casi firme';
  if (m === 'consolidado') return 'Firme';
  return m || '';
}
