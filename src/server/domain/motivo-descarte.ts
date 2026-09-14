/**
 * POR QUÉ SE CAE UN LEAD DE BHI.
 *
 * Las categorías salieron de LEER las nueve notas reales de los descartados el
 * 14/9/2026, no de suponerlas. La primera versión las suponía y falló: clasificó
 * 2 de 9, y las 2 mal.
 *
 * Lo que decían de verdad, y por qué importa:
 *
 *   "Pensó que nosotros hacíamos asesorías para bajar costos de Isapre."
 *   "Buscaba un seguro complementario de bajo costo."
 *   "Se decidió finalmente por un seguro complementario local."
 *   "Cotización de Seguro en viaje por 1 año enviada."
 *
 * Eso NO es presupuesto. Es gente que llegó buscando OTRO PRODUCTO — seguro
 * complementario local, asesoría de Isapre, seguro de viaje— cuando BHI vende
 * salud internacional. Mi versión anterior marcaba "bajo costo" como presupuesto,
 * y la diferencia cambia la acción entera:
 *
 *   presupuesto        -> el precio es el problema. Se ataca con financiamiento,
 *                         con planes de entrada, con otro mensaje de valor.
 *   producto equivocado -> el anuncio atrae la intención equivocada. Se ataca en
 *                         el copy y en la landing, no en el precio ni en el filtro.
 *
 * Y las dos se ven igual en un tablero: "descartado".
 *
 * OJO CON LA REGLA 3. `cuentas.reglas_dominio` de BHI afirma que los descartes
 * son "por preexistencias o presupuesto". En las nueve notas no aparece NI UNA
 * preexistencia y el presupuesto no es el bloqueo. La regla está escrita y los
 * datos no la sostienen — eso es un hallazgo, no un error de esta función.
 */

export type MotivoDescarte =
  | 'producto equivocado'
  | 'eligio competencia'
  | 'en decision'
  | 'proyecto postergado'
  | 'presupuesto'
  | 'preexistencia'
  | 'sin informacion';

/** El orden IMPORTA: gana el primero que pega. */
const REGLAS: [MotivoDescarte, RegExp][] = [
  // Buscaba otra cosa. Va PRIMERO porque "complementario de bajo costo" tiene la
  // palabra costo y se llevaría el match de presupuesto — y es lo que pasó.
  ['producto equivocado', /complementari|bajo costo|bajar costos?|asesor[íi]as? para|seguro en viaje|seguro de viaje|viaje por|pens[óo] que (nosotros|hac)/i],
  // Se fue con otro. Nombres de competidores vistos en las notas reales.
  ['eligio competencia', /se decidi[óo]|cigna|otro corredor|otro broker|con martin|est[áa] viendo .* con |competencia/i],
  // El proyecto se movió: no es el lead, es el calendario del cliente.
  ['proyecto postergado', /se corri[óo] el proyecto|postergad|m[áa]s adelante|pr[óo]ximo a[ñn]o|qued(amos|ó) conectad/i],
  // Todavía decidiendo. No es un descarte cerrado y conviene verlo aparte.
  ['en decision', /avisar[áa]|esperando que se decida|hoy se define|si lo toma|si toma la p[óo]liza|esperando (una )?cotizaci[óo]n/i],
  // Estos dos son los que la regla 3 afirma. Se dejan por si aparecen.
  ['preexistencia', /preexist|enfermedad previa|patolog[íi]a|diagnostic/i],
  ['presupuesto', /no puede pagar|no le alcanza|fuera de su presupuesto|muy caro|precio alto/i],
  ['sin informacion', /no tengo informaci[óo]n|sin datos|sin informaci[óo]n/i],
];

/** Saca el HTML: las notas de GHL vienen envueltas en <p style="...">. */
export function limpiar(nota: string | null | undefined): string {
  return String(nota ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El motivo, o null.
 *
 * NULL cuando ninguna regla pega, y eso NO es "sin motivo": es "no lo pudimos
 * clasificar". La vista los cuenta aparte (`descartados_sin_motivo`) justamente
 * para que una keyword con todos sus descartes ahí no se juzgue todavía.
 */
export function clasificarDescarte(nota: string | null | undefined): MotivoDescarte | null {
  const t = limpiar(nota);
  if (!t) return null;
  for (const [motivo, re] of REGLAS) if (re.test(t)) return motivo;
  return null;
}

/** El motivo de un contacto a partir de todas sus notas. Gana la primera que clasifica. */
export function motivoDeLasNotas(notas: (string | null | undefined)[]): MotivoDescarte | null {
  for (const n of notas) {
    const m = clasificarDescarte(n);
    if (m) return m;
  }
  return null;
}
