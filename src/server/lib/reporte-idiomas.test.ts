/**
 * El reporte al cliente sale en tres idiomas y ninguno puede quedar a medias.
 *
 * El 14/9/2026 se agregó alemán: KAREDO opera en mercado alemán con locale de-DE y
 * el tipo era binario `'es' | 'en'`. El riesgo de un diccionario de traducciones es
 * que alguien agregue una clave a uno y no a los otros: el PDF sale con `undefined`
 * donde va un encabezado, y eso llega a un cliente que paga.
 *
 * Este control compara las claves de los tres y falla si alguna no está en todos.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PDF = path.resolve(__dirname, 'reporte-pdf.tsx');
const SERVER = path.resolve(__dirname, '../../../server.ts');

/** Las claves de un objeto literal `xx: { a: '…', b: '…' }` dentro de un texto. */
function clavesDe(fuente: string, idioma: string): string[] {
  const i = fuente.indexOf(`  ${idioma}: { `);
  if (i < 0) return [];
  const fin = fuente.indexOf('\n', i);
  return [...fuente.slice(i, fin).matchAll(/([a-zA-Z_]+):\s*'/g)].map(m => m[1]);
}

describe('idiomas del reporte al cliente', () => {
  it('el PDF traduce las mismas claves en es, en y de', () => {
    const t = fs.readFileSync(PDF, 'utf8');
    const es = clavesDe(t, 'es'), en = clavesDe(t, 'en'), de = clavesDe(t, 'de');
    expect(es.length, 'no se encontró el diccionario `es` del PDF').toBeGreaterThan(5);
    for (const [nombre, claves] of [['en', en], ['de', de]] as const) {
      expect(claves.slice().sort(), `al diccionario "${nombre}" del PDF le faltan claves de "es"`)
        .toEqual(es.slice().sort());
    }
  });

  it('la página pública /r/:token traduce las mismas claves en los tres', () => {
    const t = fs.readFileSync(SERVER, 'utf8');
    const es = clavesDe(t, 'es'), en = clavesDe(t, 'en'), de = clavesDe(t, 'de');
    expect(es.length, 'no se encontró el diccionario `es` de la página pública').toBeGreaterThan(5);
    for (const [nombre, claves] of [['en', en], ['de', de]] as const) {
      expect(claves.slice().sort(), `al diccionario "${nombre}" de la página le faltan claves de "es"`)
        .toEqual(es.slice().sort());
    }
  });

  it('los tres idiomas existen también en el prompt que genera los bloques', () => {
    const t = fs.readFileSync(SERVER, 'utf8');
    const i = t.indexOf('const IDIOMAS_REPORTE');
    expect(i, 'no está IDIOMAS_REPORTE en server.ts').toBeGreaterThan(-1);
    const bloque = t.slice(i, t.indexOf('};', i));
    // Sin esto, un reporte en alemán saldría con el PDF traducido pero el TEXTO
    // escrito en castellano: la mitad más cara del reporte, en el idioma equivocado.
    for (const cod of ['es', 'en', 'de']) {
      expect(bloque.includes(`  ${cod}: {`), `IDIOMAS_REPORTE no tiene "${cod}"`).toBe(true);
    }
  });
});
