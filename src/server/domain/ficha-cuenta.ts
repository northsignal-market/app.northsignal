/**
 * De qué cuenta es esta ficha de Notion.
 *
 * Vive acá y no adentro del handler porque la respuesta decide **en qué moneda se
 * muestra la plata de un cliente**, y eso tiene que poder probarse sin levantar
 * Notion ni Supabase.
 *
 * Lo que había antes, en una línea:
 *
 *     p.properties.Moneda?.select?.name
 *       || [...monedaPorCuenta].find(([a]) => name.toUpperCase().includes(a))?.[1]
 *       || 'CLP'
 *
 * Dos fallas, y la segunda tapaba a la primera. Adivinaba la cuenta por substring
 * del título que alguien escribe a mano en Notion: `'FRESH MONKEE'.includes('FRESH_MONKEE')`
 * es **false** —el guión bajo—, así que la única cuenta en dólares no pegaba nunca
 * y caía al final de la cadena, que inventaba pesos chilenos. Una moneda inventada
 * no se ve rota en pantalla: se ve como una cifra.
 *
 * Acá no se adivina. Se resuelve por el id de la ficha —que `cuentas.notion_ficha_id`
 * guarda y es exacto— y, si no hay, por el nombre COMPLETO contra `nombre_cliente`.
 * Si ninguna de las dos resuelve, la respuesta es null: "no se puede saber con estos
 * datos" es una respuesta válida y preferible a una moneda inventada.
 */

export interface CuentaMinima {
  account: string;
  nombre_cliente?: string | null;
  moneda?: string | null;
  notion_ficha_id?: string | null;
}

/** Los ids de Notion aparecen con y sin guiones según por dónde vengan. */
const sinGuiones = (s: unknown): string => String(s ?? '').replace(/-/g, '');

/**
 * La cuenta de una ficha, o null si no se puede resolver.
 * El orden importa: el id es exacto, el nombre es una convención que alguien puede
 * cambiar en Notion sin avisarle a nadie.
 */
export function resolverCuentaDeFicha(
  fichaId: string | null | undefined,
  nombre: string | null | undefined,
  cuentas: CuentaMinima[],
): CuentaMinima | null {
  const id = sinGuiones(fichaId);
  if (id) {
    const porId = cuentas.find(c => c.notion_ficha_id && sinGuiones(c.notion_ficha_id) === id);
    if (porId) return porId;
  }
  const nm = String(nombre ?? '').toLowerCase().trim();
  if (!nm) return null;
  // Igualdad, no `includes`: "Karedo" y "Karedo Test" son dos cosas distintas, y
  // un substring las hace la misma.
  return cuentas.find(c => String(c.nombre_cliente ?? '').toLowerCase().trim() === nm) ?? null;
}

/**
 * La moneda a mostrar, y si las dos fuentes se contradicen.
 *
 * Manda `cuentas.moneda`: es la que usa todo el resto de la app para formatear, y
 * dos fuentes para el mismo hecho se despegan tarde o temprano. Cuando se despegan
 * hay que enterarse, no elegir en silencio — por eso vuelve `discrepancia` en vez
 * de solo el valor ganador.
 */
export function monedaDeFicha(
  cuenta: CuentaMinima | null,
  monedaEnNotion: string | null | undefined,
): { moneda: string | null; discrepancia: string | null } {
  const notion = monedaEnNotion || null;
  const tabla = cuenta?.moneda || null;
  const discrepancia = cuenta && notion && tabla && notion !== tabla
    ? `la ficha de ${cuenta.account} dice moneda ${notion} y cuentas dice ${tabla}. Manda cuentas.`
    : null;
  // Sin cuenta resuelta y sin valor en Notion: null. NUNCA una moneda por defecto.
  return { moneda: tabla ?? notion, discrepancia };
}
