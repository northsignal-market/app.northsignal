/**
 * Una ruta del servidor que el rewrite de Vercel se come no falla: devuelve 200.
 *
 * El 14/9/2026 se encontró en PRODUCCIÓN que `/r/:token` —la página del reporte que
 * se le manda al cliente— nunca llegaba al servidor. El catch-all
 * `/((?!api/|assets/).*)` la capturaba y Vercel servía el index.html de la SPA, que
 * no tiene ruta para `/r/`. O sea: el cliente abría su link y veía la app.
 *
 * Es el peor modo de falla de este sistema con otro disfraz — 200 OK, contenido
 * plausible, y nadie se entera. No lo atrapa ningún typecheck ni ningún test de la
 * app: solo se ve pidiendo la URL real.
 *
 * Este control compara las rutas que el servidor declara contra las reglas de
 * `vercel.json` y falla si alguna queda tapada.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const RAIZ = path.resolve(__dirname, '../..');
const SERVER = path.join(RAIZ, 'server.ts');
const VERCEL = path.join(RAIZ, 'vercel.json');

/** Las rutas que el Express declara y NO empiezan con /api. */
function rutasNoApi(): string[] {
  const t = fs.readFileSync(SERVER, 'utf8');
  return [...t.matchAll(/app\.(?:get|post|put|all|delete)\(\s*["'](\/[^"']*)["']/g)]
    .map(m => m[1])
    .filter(r => !r.startsWith('/api'));
}

/** Un path de ejemplo para una ruta de Express: /r/:token → /r/ejemplo */
const ejemploDe = (ruta: string) => ruta.replace(/:[^/]+/g, 'ejemplo').replace(/\*/g, 'ejemplo');

describe('rutas del servidor vs los rewrites de Vercel', () => {
  it('ninguna ruta del servidor cae en el catch-all que sirve la SPA', () => {
    const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
    const rewrites: { source: string; destination: string }[] = vercel.rewrites || [];
    expect(rewrites.length, 'vercel.json no declara rewrites').toBeGreaterThan(0);

    const tapadas: string[] = [];
    for (const ruta of rutasNoApi()) {
      const p = ejemploDe(ruta);
      // Vercel aplica la PRIMERA regla que matchea: se recorre en orden.
      const regla = rewrites.find(r => new RegExp(`^${r.source}$`).test(p));
      if (!regla) {
        tapadas.push(`${ruta} — ninguna regla la matchea (Vercel devolvería 404)`);
      } else if (regla.destination === '/index.html') {
        tapadas.push(`${ruta} — la captura "${regla.source}" y la manda al index.html de la SPA`);
      }
    }
    expect(tapadas, 'Hay rutas del servidor que Vercel no le entrega').toEqual([]);
  });

  it('los rewrites solo usan claves que Vercel acepta', () => {
    // El 14/9/2026 agregué un `_comentario` explicativo adentro de una regla de
    // rewrite. JSON no tiene comentarios y el esquema de Vercel no admite claves
    // extra: el deploy falló ANTES de construir, sin logs de build, y producción
    // se quedó dos commits atrás mostrando un estado viejo que parecía el último.
    // Un vercel.json inválido no rompe nada local —ni tsc, ni tests, ni build—:
    // se ve recién en el panel de Vercel, o no se ve.
    const PERMITIDAS = new Set(['source', 'destination', 'has', 'missing', 'statusCode', 'permanent']);
    const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
    const invalidas: string[] = [];
    for (const r of (vercel.rewrites || [])) {
      for (const k of Object.keys(r)) {
        if (!PERMITIDAS.has(k)) invalidas.push(`rewrite "${r.source}" tiene la clave "${k}"`);
      }
    }
    expect(invalidas, 'Vercel rechaza el vercel.json entero y el deploy falla sin logs').toEqual([]);
  });

  it('las rutas de la SPA siguen yendo al index.html', () => {
    const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
    const rewrites: { source: string; destination: string }[] = vercel.rewrites || [];
    // Si al excluir una ruta del catch-all se excluye de más, la app deja de cargar
    // en esas URLs. Estas son navegación normal y TIENEN que seguir cayendo al index.
    for (const p of ['/', '/bandeja', '/cuenta', '/datos', '/sistema', '/login']) {
      const regla = rewrites.find(r => new RegExp(`^${r.source}$`).test(p));
      expect(regla?.destination, `"${p}" dejó de servir la SPA`).toBe('/index.html');
    }
  });
});
