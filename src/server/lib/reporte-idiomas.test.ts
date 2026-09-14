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

  it('las tres superficies del reporte usan las claves que el SQL sí produce', () => {
    // §7.1 se arregló dos veces porque estaba en dos lugares y la segunda no se
    // vio: el mensaje de Slack Y la página pública /r/:token leían `gasto` y
    // `conversiones`, que `get_reporte_datos` nunca construyó. Al cliente le
    // llegaba "Spend —  Conversions —  CPA 45,39 €": solo salían las dos claves
    // que por casualidad se llaman igual en los dos lados.
    //
    // Las canónicas se leen del SQL, no de una lista copiada: si la función
    // cambia, este control lo ve.
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/20260914180000_el_reporte_declara_la_ventana_que_sumo.sql'), 'utf8');
    const i = sql.indexOf("'metricas', jsonb_build_object(");
    expect(i, 'no encontré el bloque de métricas de get_reporte_datos').toBeGreaterThan(-1);
    const bloque = sql.slice(i, sql.indexOf("'serie',", i));
    const canonicas = new Set([...bloque.matchAll(/'([a-z_]+)', jsonb_build_object\('actual'/g)].map(m => m[1]));
    expect(canonicas.size, 'no se extrajo ninguna clave del SQL').toBeGreaterThan(3);

    // Los nombres viejos que ya causaron el bug. Ninguna superficie puede leerlos.
    const PROHIBIDAS = ['gasto', 'conversiones', 'clics', 'cuota_impresiones'];
    const server = fs.readFileSync(SERVER, 'utf8');
    const culpables: string[] = [];
    for (const mala of PROHIBIDAS) {
      // Solo donde se lee del objeto de métricas del reporte.
      if (new RegExp(`metricas\\?\\.\\[?'?${mala}\\b`).test(server)) culpables.push(`server.ts lee metricas.${mala}`);
      if (new RegExp(`m\\.${mala}\\?\\.actual`).test(server)) culpables.push(`server.ts lee m.${mala}.actual`);
    }
    expect(culpables, 'una superficie del reporte lee una clave que get_reporte_datos no produce').toEqual([]);

    // Y las que el PDF pide tienen que estar entre las canónicas.
    const pdf = fs.readFileSync(PDF, 'utf8');
    const mOrden = pdf.match(/const orden = \[([^\]]+)\]/);
    expect(mOrden, 'no encontré la lista `orden` del PDF').toBeTruthy();
    for (const k of [...mOrden![1].matchAll(/'([a-z_]+)'/g)].map(x => x[1])) {
      expect(canonicas.has(k), `el PDF pide "${k}" y get_reporte_datos no lo produce`).toBe(true);
    }
  });
});
