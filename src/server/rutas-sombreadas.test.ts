/**
 * Una ruta que otra ruta se come no falla: contesta cualquier cosa.
 *
 * El 14/9/2026 pasó DOS veces el mismo día, en dos capas distintas:
 *
 *  1. Vercel: el catch-all `/((?!api/|assets/).*)` se comía `/r/:token`, así que el
 *     link del reporte al cliente servía el index.html de la app.
 *  2. Express: `/api/alertas/:id/:accion`, declarada ANTES, se comía
 *     `/api/alertas/grupo/resolver`. Entraba con id="grupo" y el `.eq('id','grupo')`
 *     contra un bigint devolvía 500 en el botón "Resuelta" — con el endpoint
 *     correcto existiendo y sin poder alcanzarse nunca.
 *
 * Los dos son invisibles desde el código: la ruta está escrita, compila, y el test
 * de su handler pasaría. Solo se ven pidiendo la URL. Este control los busca
 * estáticamente: por cada ruta, pregunta si alguna declarada ANTES la captura.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SERVER = path.resolve(__dirname, '../../server.ts');

type Ruta = { metodo: string; patron: string; orden: number };

/** Las rutas que Express declara, en orden de declaración. */
function rutasDeclaradas(): Ruta[] {
  const t = fs.readFileSync(SERVER, 'utf8');
  const out: Ruta[] = [];
  let i = 0;
  for (const m of t.matchAll(/app\.(get|post|put|delete|all)\(\s*(?:\[\s*)?["'`]([^"'`]+)["'`]/g)) {
    out.push({ metodo: m[1], patron: m[2], orden: i++ });
  }
  return out;
}

/** Un patrón de Express a regex, respetando `:param(regex)` y `*`. */
function aRegex(patron: string): RegExp {
  let r = patron
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')          // literales
    .replace(/\\\(\\\\d\\\+\\\)/g, '')             // el `(\d+)` escapado de arriba
    .replace(/:([A-Za-z_]\w*)\(\\\\d\\\+\)/g, '(\\d+)')
    .replace(/:([A-Za-z_]\w*)/g, '[^/]+')
    .replace(/\\\*/g, '.*');
  return new RegExp(`^${r}$`);
}

/** Un ejemplo concreto de URL para una ruta: /api/alertas/grupo/resolver tal cual. */
function ejemplo(patron: string): string {
  return patron.replace(/:([A-Za-z_]\w*)\(\\\\d\+\)/g, '123').replace(/:([A-Za-z_]\w*)/g, 'x').replace(/\*/g, 'x');
}

describe('rutas de Express que se tapan entre sí', () => {
  it('ninguna ruta concreta es capturada por otra declarada antes', () => {
    const rutas = rutasDeclaradas();
    expect(rutas.length, 'no se encontró ninguna ruta en server.ts').toBeGreaterThan(20);

    const tapadas: string[] = [];
    for (const r of rutas) {
      // Solo interesan las que tienen tramos LITERALES donde otra pone un :param.
      if (!/\/[a-z-]+\/[a-z-]+/i.test(r.patron)) continue;
      const url = ejemplo(r.patron);
      if (url.includes(':')) continue;

      for (const otra of rutas) {
        if (otra.orden >= r.orden) break;                    // Express matchea por orden
        if (otra.metodo !== r.metodo && otra.metodo !== 'all') continue;
        if (otra.patron === r.patron) continue;
        if (!otra.patron.includes(':')) continue;            // una ruta literal no tapa nada
        if (aRegex(otra.patron).test(url)) {
          tapadas.push(`${r.metodo.toUpperCase()} ${r.patron} nunca se alcanza: la captura "${otra.patron}", declarada antes`);
          break;
        }
      }
    }
    expect(tapadas, 'Hay rutas declaradas que Express nunca va a ejecutar').toEqual([]);
  });
});
