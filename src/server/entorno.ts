/**
 * En qué entorno corre esto.
 *
 * El problema que resuelve: `npm run dev` apunta a la misma base que producción,
 * porque SUPABASE_URL es una sola. Eso significa que probar algo en local escribe
 * en la base real. Y en el peor caso: aprobar una acción desde local la encola en
 * `acciones_aprobadas`, y el ejecutor la aplica en la cuenta del cliente dentro de
 * la hora siguiente. Sin que nadie lo haya querido.
 *
 * Mientras no haya una base separada, la protección es esta: en local, todo lo que
 * escribe hacia afuera queda en modo simulación. Se puede leer todo, probar la
 * interfaz, y ver qué haría cada acción. Lo que no se puede es que salga.
 */

export type Entorno = 'produccion' | 'local' | 'rama';

export function entornoActual(): Entorno {
  // Vercel pone VERCEL_ENV: production, preview o development
  const v = process.env.VERCEL_ENV;
  if (v === 'production') return 'produccion';
  if (v === 'preview') return 'rama';
  if (v) return 'local';
  // Sin VERCEL_ENV estamos fuera de Vercel: máquina de Andrés
  return process.env.NODE_ENV === 'production' && process.env.FORZAR_PRODUCCION === 'true'
    ? 'produccion' : 'local';
}

export const esProduccion = () => entornoActual() === 'produccion';

/**
 * Si una escritura que sale del sistema puede ejecutarse de verdad.
 * Cubre: encolar acciones para Google Ads, escribir en Notion, enviar reportes.
 */
export function puedeEscribirAfuera(): { permitido: boolean; motivo?: string } {
  if (esProduccion()) return { permitido: true };
  return {
    permitido: false,
    motivo: `Estás en entorno "${entornoActual()}" y esto escribe hacia afuera. ` +
      `Queda en modo simulación: ves qué haría, pero no sale. ` +
      `Si de verdad querés ejecutar contra la cuenta real, hacelo desde la app desplegada.`
  };
}

/** Para mostrar en la interfaz de qué entorno se trata. */
export function banda(): { entorno: Entorno; color: string; texto: string } | null {
  const e = entornoActual();
  if (e === 'produccion') return null;
  return e === 'rama'
    ? { entorno: e, color: '#b45309', texto: 'RAMA DE PRUEBA · las acciones no se ejecutan' }
    : { entorno: e, color: '#b42318', texto: 'LOCAL contra la base REAL · las acciones no se ejecutan' };
}
