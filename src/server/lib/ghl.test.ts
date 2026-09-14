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
import { readFileSync } from 'fs';
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

/**
 * MIRAR, NO TOCAR · y que no sea una promesa.
 *
 * Andrés fue explícito: quiere que el sistema VEA GoHighLevel, no que edite.
 * GHL es el CRM donde su equipo trabaja todos los días; una escritura equivocada
 * acá no rompe un número, mueve una oportunidad real de un vendedor real.
 *
 * Una promesa en un comentario no sobrevive a la primera sesión apurada que
 * necesite "solo actualizar un campito". Por eso el control mira el ARCHIVO: si
 * aparece una función que escribe, falla, y quien la agregue tiene que venir a
 * discutirlo con Andrés en vez de deslizarla.
 *
 * Es la misma línea que ya sostiene el resto del sistema: la API de Google Ads
 * verifica todas las mañanas y NUNCA escribe; la única mano que escribe allá es
 * el ejecutor con acciones aprobadas.
 */
describe('el cliente de GHL no puede escribir', () => {
  const fuente = () => readFileSync(new URL('./ghl.ts', import.meta.url), 'utf8');
  /**
   * Solo el CÓDIGO, sin los comentarios.
   *
   * Es la segunda vez hoy que un control mío se come la documentación que explica
   * su propia regla: pasó igual con el del ancho fantasma, que leía el comentario
   * donde dice `overflow-y-auto` como si fuera una declaración. Acá el comentario
   * de ghl.ts dice «fija `method: 'GET'` explícito» y el control lo tomaba por una
   * asignación con basura al final.
   *
   * Un control que falla sobre su propia explicación no es estricto: está roto, y
   * el arreglo más probable es que alguien borre el comentario.
   */
  const codigo = () => fuente().split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

  it('no existe ninguna función de escritura exportada', () => {
    const exportadas = [...fuente().matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]);
    expect(exportadas.length, 'no se encontró ninguna exportación: el control está mirando mal').toBeGreaterThan(0);
    const escriben = exportadas.filter((n) => /post|put|patch|delete|crear|actualizar|borrar|escribir|enviar/i.test(n));
    expect(escriben, `estas funciones escriben o lo parecen: ${escriben.join(', ')}`).toEqual([]);
  });

  it('ningún fetch usa un método que no sea GET', () => {
    const metodos = [...codigo().matchAll(/method\s*:\s*['"`](\w+)['"`]/g)].map((m) => m[1].toUpperCase());
    expect(metodos.length, 'ningún fetch declara método: sin declararlo, un init podría colarse').toBeGreaterThan(0);
    expect(metodos.filter((m) => m !== 'GET')).toEqual([]);
  });

  it('el fetch fija el método en vez de heredarlo de un parámetro', () => {
    // `method: init?.method` o `...init` dejarían entrar un POST desde afuera.
    //
    // Sin lookahead a propósito: la primera versión de este control era
    // /method\s*:\s*(?!['"`]GET['"`])/ y fallaba sobre un archivo correcto. El
    // `\s*` RETROCEDE, así que el motor encuentra una posición donde consumió
    // cero espacios, el lookahead ve un espacio en vez de la comilla, falla, y el
    // negado da match. El archivo decía `method: 'GET'` y el control gritaba.
    // Acá se captura el lado derecho y se mira entero, que no se puede torcer.
    const asignaciones = [...codigo().matchAll(/method\s*:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
    expect(asignaciones.length, 'no se encontró ninguna asignación de método').toBeGreaterThan(0);
    const dinamicas = asignaciones.filter((rhs) => !/^['"`]GET['"`]$/.test(rhs));
    expect(dinamicas, `estos métodos no son un literal GET: ${dinamicas.join(' | ')}`).toEqual([]);
    expect(codigo(), 'un spread de init dejaría entrar cualquier método').not.toMatch(/\.\.\.init/);
  });
});

/**
 * UN UUID NO ES UN CLICK ID.
 *
 * El sondeo real de BHI (14/9/2026) señaló `pipelineStageId`, `pipelineStageUId`
 * y `relations[0].associationId` como lugares donde "aparece un click id". Son
 * identificadores internos de GoHighLevel. La heurística pedía 30+ caracteres del
 * alfabeto [A-Za-z0-9_-], y un UUID de 36 los cumple.
 *
 * Importa porque esta función contesta "¿dónde llega el gclid?", y de esa
 * respuesta depende si el problema de atribución es el formulario o la keyword.
 * Tres campos señalados de más mandan a revisar el lugar equivocado — y peor,
 * hacen PARECER que la atribución está resuelta cuando no llegó ningún gclid.
 */
describe('rutasDeClickId no confunde identificadores internos', () => {
  const UUIDS = [
    '253af773-84dd-4e0c-bf4f-81ca6b03eff1',
    '2f36bf61-f2dc-4195-9a3c-b2c36568195d',
    'fa820836-a640-4c17-bc5d-35373dd7bdd0',
  ];

  it('los UUID de GHL no se cuentan como click id', () => {
    for (const u of UUIDS) {
      expect(rutasDeClickId({ pipelineStageId: u }), `${u} no es un click id`).toEqual([]);
    }
  });

  // El caso exacto del sondeo: una oportunidad sin gclid, llena de UUIDs.
  it('una oportunidad sin gclid no señala ninguna ruta', () => {
    const oportunidad = {
      id: 'aBcD1234efGh5678ijKl',
      pipelineStageId: UUIDS[0],
      pipelineStageUId: UUIDS[1],
      relations: [{ associationId: UUIDS[2] }],
      lostReasonId: null,
      monetaryValue: 560,
    };
    expect(rutasDeClickId(oportunidad)).toEqual([]);
  });

  // Y no puede apagarse: un gclid de verdad se sigue encontrando.
  it('un gclid real se encuentra igual', () => {
    const gclid = 'Cj0KCQjw8JPVBhD-ARIsAO691sEqoMxbykhe_5SoGtnK4uqvTsKi3tN6_atiVmKNQJbIMjwQ_JTmne0aAmvBEALw_wcB';
    expect(rutasDeClickId({ attributions: [{ value: gclid }] }).length).toBeGreaterThan(0);
    // Aunque el campo se llame feo, por el nombre:
    expect(rutasDeClickId({ customFields: [{ gclid: 'corto' }] }).length).toBeGreaterThan(0);
  });
});
