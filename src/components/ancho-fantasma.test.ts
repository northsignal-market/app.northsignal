/**
 * EL ANCHO FANTASMA NO VUELVE.
 *
 * El 14/9/2026 la app tenía una barra de scroll horizontal que sobraba y que
 * molestaba al scrollear en vertical. Costó tres rondas encontrarla, y las dos
 * primeras arreglé cosas reales pero equivocadas, porque medía
 * `document.scrollWidth` — que por diseño NUNCA podía verla: `body` tiene
 * `overflow-x: hidden`, así que el desborde de un hijo no llega al documento.
 *
 * La causa: por el spec de CSS, **si un eje no es `visible`, el otro se computa
 * `auto`**. Un contenedor con solo `overflow-y-auto` es, sin que nadie lo pidiera,
 * un contenedor de scroll HORIZONTAL. Cualquier cosa que se pase de ancho le
 * cuelga una barra abajo. En este caso era el tooltip `Pista`: 280px, posición
 * absoluta, `hidden` — y `visibility: hidden` **sigue generando caja y sigue
 * contando para el overflow**.
 *
 * Este control es estático porque el arreglo es estático: son dos declaraciones
 * de clase en el marco de la app. Si alguien las saca —limpiando clases que
 * "no hacen nada", que es exactamente cómo se ven— el ancho fantasma vuelve y no
 * hay medición de página que lo muestre.
 *
 * No cubre los otros ~14 contenedores con `overflow-y-auto`: barridos en el
 * navegador el 14/9 sobre las cinco pantallas, ninguno desbordaba, y el único con
 * scroll horizontal real (la tira de pestañas de Datos) lo declara a propósito.
 * La trampa ahí sigue latente, pero latente no es lo mismo que roto, y un control
 * que falla sin que nada esté mal es cómo mueren las alertas.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..');

/** Los dos contenedores del marco: por acá pasa todo lo que se ve. */
const MARCO = [
  { archivo: 'App.tsx', que: 'el <main> de la app' },
  { archivo: 'components/Cuenta.tsx', que: 'el área de scroll de Cuenta' },
];

describe('los contenedores del marco declaran su eje horizontal', () => {
  for (const { archivo, que } of MARCO) {
    it(`${que} (${archivo}) nunca scrollea de costado`, () => {
      const t = fs.readFileSync(path.join(SRC, archivo), 'utf8');
      // Solo líneas con `className=`: el comentario que explica esta misma regla
      // menciona `overflow-y-auto`, y la primera versión de este control se lo comió
      // como si fuera una declaración. Un control que falla sobre su propia
      // documentación no es estricto, está roto.
      const lineas = t.split('\n')
        .map((l, i) => ({ l, n: i + 1 }))
        .filter(({ l }) => /className=/.test(l) && /overflow-y-auto/.test(l));

      expect(lineas.length, `no se encontró ningún overflow-y-auto en ${archivo}`).toBeGreaterThan(0);

      const sinEje = lineas.filter(({ l }) => !/overflow-x-(clip|hidden|auto|scroll)/.test(l));
      expect(
        sinEje.map(({ l, n }) => `${archivo}:${n}  ${l.trim()}`),
        'Un overflow-y-auto sin eje x declarado ES un contenedor de scroll horizontal: ' +
        'el spec computa el otro eje como `auto`. Escribí overflow-x-clip (no scrollea) ' +
        'u overflow-x-auto (scrollea a propósito), pero escribilo.',
      ).toEqual([]);
    });
  }

  it('la razón queda escrita donde se lee, no solo en el historial', () => {
    // Sin el porqué, la clase se ve decorativa y la próxima limpieza se la lleva.
    const app = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');
    expect(app).toMatch(/overflow-x-clip`? va EXPLÍCITO/i);
  });
});
