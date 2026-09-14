/**
 * NADIE ANULA LA VALIDACIÓN DE LA CUENTA.
 *
 * `useCuentaActiva` existe para una sola cosa: resolver la cuenta CONTRA LAS
 * CUENTAS REALES, y devolver null cuando no puede —mientras cargan, o si no hay
 * ninguna—. Es la regla de CLAUDE.md aplicada a la navegación: nunca adivines el
 * nombre de una entidad.
 *
 * Y sin embargo las cinco pantallas escribían:
 *
 *     const activeClient = useCuentaActiva(selectedClient) || selectedClient || '';
 *
 * Ese `|| selectedClient` cae al valor SIN VALIDAR justo cuando la validación
 * falló. Por ahí entró 'Unknown' —el centinela con que el servidor marca un
 * accionable de Notion cuya cuenta no pudo resolver (server.ts:96)— y salió en
 * catorce pedidos HTTP como si fuera una cuenta: `/api/plan?client=Unknown`,
 * `/api/pacing?client=Unknown`, `/api/mercado?client=Unknown`. Un "no sé" del
 * servidor, convertido en nombre propio por el camino de vuelta. Medido en el
 * navegador el 14/9/2026.
 *
 * El control es estático porque el bug es estático: está en cómo se escribe la
 * línea, no en lo que pasa al correrla. Un test de comportamiento no lo ve.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..');

function archivosFuente(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return archivosFuente(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('la cuenta activa siempre sale validada', () => {
  it('ninguna pantalla cae a un valor sin validar cuando useCuentaActiva dice que no sabe', () => {
    const culpables: string[] = [];
    for (const f of archivosFuente(SRC)) {
      const t = fs.readFileSync(f, 'utf8');
      t.split('\n').forEach((linea, i) => {
        if (!linea.includes('useCuentaActiva(')) return;
        // El único cierre admitido es `?? ''`: sin cuenta resuelta, cadena vacía,
        // y `pedirJSON` se encarga de no preguntar. Cualquier `||` detrás de la
        // llamada es un respaldo que no pasó por la lista de cuentas reales.
        if (/useCuentaActiva\([^)]*\)\s*\|\|/.test(linea)) {
          culpables.push(`${path.relative(SRC, f)}:${i + 1}  ${linea.trim()}`);
        }
      });
    }
    expect(
      culpables,
      'Estas líneas anulan la validación: si useCuentaActiva no pudo resolver, ' +
      'el `||` cae al valor crudo y la app pregunta por una cuenta que no existe.',
    ).toEqual([]);
  });

  it('el control mira donde tiene que mirar: encuentra las llamadas', () => {
    // Sin esto, un refactor que renombre el hook deja el test en verde para
    // siempre sobre cero archivos — un control que no puede fallar no es control.
    const conLlamada = archivosFuente(SRC).filter(f =>
      fs.readFileSync(f, 'utf8').includes('useCuentaActiva('),
    );
    expect(conLlamada.length, 'no se encontró ninguna llamada a useCuentaActiva').toBeGreaterThanOrEqual(5);
  });
});
