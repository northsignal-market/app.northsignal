/**
 * EL SONDEO DE GHL NO PUEDE FILTRAR DATOS DE UNA PERSONA.
 *
 * Los contactos de BHI son personas con seguro de salud en Chile y sus notas
 * dicen cosas como "descalificado por preexistencia". Eso es información médica
 * identificable. Un sondeo que vuelca respuestas crudas "para ver qué trae" deja
 * esos datos en un log, en un chat o en un ticket, y de ahí no vuelven.
 *
 * Por eso `formaDe()` emite nombres de campo y tipos, y `rutasDeClickId()`
 * devuelve la RUTA donde aparece un gclid, nunca el gclid.
 *
 * Este control es el más importante de los que escribí hoy, porque su falla no
 * se ve: un sondeo que filtra funciona perfecto y devuelve más información que
 * uno que no. El daño solo aparece después, y para entonces ya salió.
 */
import { describe, it, expect } from 'vitest';
import { formaDe, rutasDeClickId } from './ghl';

/** Un contacto como los que devuelve GHL, con todo lo que NO puede salir. */
const CONTACTO = {
  id: 'abc123',
  firstName: 'María José',
  lastName: 'Fernández',
  email: 'mariajose.fernandez@gmail.com',
  phone: '+56912345678',
  dateAdded: '2026-09-10T12:00:00Z',
  tags: ['preexistencia', 'ABC1'],
  customFields: [{ id: 'cf1', value: 'Cj0KCQjw8JPVBhD-ARIsAO691sEqoMxbykhe5SoGtnK4uqvTsKi3tN6' }],
  attributionSource: { gclid: 'CjwKCAjwqonVBhA4EiwA9wYJ3SYB-cKHnqPchNtnkxiotyL7cxED9FSl' },
  notes: [{ body: 'Descalificada por preexistencia: hipertensión diagnosticada en 2019.' }],
};

const PROHIBIDO = [
  'María José', 'Fernández', 'mariajose.fernandez@gmail.com', '+56912345678',
  'hipertensión', 'preexistencia', 'ABC1',
  'Cj0KCQjw8JPVBhD-ARIsAO691sEqoMxbykhe5SoGtnK4uqvTsKi3tN6',
  'CjwKCAjwqonVBhA4EiwA9wYJ3SYB-cKHnqPchNtnkxiotyL7cxED9FSl',
];

describe('formaDe no deja salir un solo contenido', () => {
  it('no emite ningún valor del contacto', () => {
    const salida = JSON.stringify(formaDe(CONTACTO));
    for (const secreto of PROHIBIDO) {
      expect(salida.includes(secreto), `se filtró: ${secreto}`).toBe(false);
    }
  });

  it('sí emite los nombres de campo, que es para lo que sirve', () => {
    const f = formaDe(CONTACTO) as any;
    expect(Object.keys(f)).toEqual(expect.arrayContaining(['id', 'email', 'attributionSource', 'customFields']));
    expect(f.email).toMatch(/^string\(\d+\)$/);   // el tipo y el largo, no el mail
    expect(f.dateAdded).toMatch(/^string\(\d+\)$/);
  });

  it('el cuerpo de una nota nunca sale, ni truncado', () => {
    const salida = JSON.stringify(formaDe({ notes: [{ body: 'Descalificada por preexistencia: hipertensión.' }] }));
    expect(salida).not.toMatch(/preexistencia|hipertensión|Descalificada/i);
  });

  it('no se cuelga ni explota con estructuras hondas o cíclicas', () => {
    const hondo: any = { a: { b: { c: { d: { e: { f: 'secreto profundo' } } } } } };
    expect(JSON.stringify(formaDe(hondo))).not.toContain('secreto profundo');
    const ciclico: any = { nombre: 'Ana' }; ciclico.yo = ciclico;
    expect(() => formaDe(ciclico)).not.toThrow();
    expect(JSON.stringify(formaDe(ciclico))).not.toContain('Ana');
  });

  it('un array largo no se vuelca entero: sale el conteo y la forma del primero', () => {
    const muchos = Array.from({ length: 500 }, (_, i) => ({ email: `persona${i}@mail.com` }));
    const salida = JSON.stringify(formaDe(muchos));
    expect(salida).toContain('array(500)');
    expect(salida).not.toContain('@mail.com');
  });
});

describe('rutasDeClickId devuelve rutas, no click ids', () => {
  it('encuentra dónde está el gclid sin decir cuál es', () => {
    const rutas = rutasDeClickId(CONTACTO);
    expect(rutas.join(' ')).toMatch(/attributionSource\.gclid/);
    for (const secreto of PROHIBIDO) {
      expect(rutas.join(' ').includes(secreto), `se filtró: ${secreto}`).toBe(false);
    }
  });

  it('lo encuentra aunque esté en un custom field con nombre que no dice nada', () => {
    const rutas = rutasDeClickId({ customFields: [{ id: 'cf1', value: 'CjwKCAjwqonVBhA4EiwA9wYJ3SYBcKHnqPchNtnkxiotyL7' }] });
    expect(rutas.length, 'no encontró el click id escondido en un custom field').toBeGreaterThan(0);
    expect(rutas[0]).toMatch(/customFields/);
  });

  // Un contacto sin gclid tiene que dar lista vacía, no una ruta inventada: esa
  // respuesta es la que decide si el problema es el formulario o la keyword.
  it('sin click id devuelve vacío, no una ruta cualquiera', () => {
    expect(rutasDeClickId({ id: 'abc', firstName: 'Ana', email: 'a@b.com' })).toEqual([]);
  });

  it('no confunde un texto largo cualquiera con un click id', () => {
    // Tiene espacios y puntuación: ningún gclid los tiene.
    expect(rutasDeClickId({ nota: 'La paciente consulto por un plan de salud y quedo en llamar la semana que viene.' })).toEqual([]);
  });
});
