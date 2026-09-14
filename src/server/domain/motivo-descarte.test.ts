/**
 * LOS MOTIVOS SALEN DE LAS NOTAS REALES, Y LA PRIMERA VERSIÓN ESTABA MAL.
 *
 * Las nueve notas de abajo son las nueve de verdad de los descartados de BHI,
 * leídas el 14/9/2026 con autorización de Andrés. Están acá porque un
 * clasificador probado contra ejemplos inventados clasifica ejemplos inventados.
 *
 * La versión anterior usaba una lista supuesta (preexistencia / presupuesto /
 * fuera de perfil / no contesta / no interesado) y acertó 2 de 9 — y las 2 mal:
 * marcó "buscaba un seguro complementario de bajo costo" como PRESUPUESTO.
 *
 * Esa confusión es la que este archivo existe para impedir, porque las dos
 * lecturas mandan a lugares opuestos:
 *
 *   presupuesto         -> el precio es el problema. Financiamiento, plan de
 *                          entrada, otro mensaje de valor.
 *   producto equivocado -> el anuncio atrae la intención equivocada. Copy y
 *                          landing. El precio no tiene nada que ver.
 *
 * Y en un tablero las dos se ven igual: "descartado".
 */
import { describe, it, expect } from 'vitest';
import { clasificarDescarte, motivoDeLasNotas, limpiar } from './motivo-descarte';

/** Las nueve notas reales, con el HTML tal como lo manda GHL. */
const REALES: [string, string | null][] = [
  ['<p style="margin:0px;">Cotización de Seguro en viaje por 1 año enviada.  Hoy se define si lo toma, compara con competencia.</p>', 'producto equivocado'],
  ['<p style="margin:0px;">Esperando que se decida por el Medical Care Pro.</p>', 'en decision'],
  ['<p style="margin:0px;">Empresa hija de SigdoKoppers, traen ejecutivos a las obras y los aseguran por 6 meses.  Se corrió el proyecto.  Pero quedamos conectadas.</p>', 'proyecto postergado'],
  ['<p style="margin:0px;">Se decidió finalmente por un seguro complementario local.</p>', 'producto equivocado'],
  ['<p style="margin:0px;">Avisará el 11 de Septiembre si toma la póliza o no, ya que está esperando una cotización de Cigna.</p>', 'eligio competencia'],
  ['<p style="margin:0px;">Pensó que nosotros hacíamos asesorías para bajar costos de Isapre.</p>', 'producto equivocado'],
  ['<p style="margin:0px;">está viendo seguro de salud + seguro de vida con martin doren</p>', 'eligio competencia'],
  ['<p style="margin:0px;">Buscaba un seguro complementario de bajo costo.</p>', 'producto equivocado'],
  ['<p style="margin:0px;">No tengo información de este lead.  </p>', 'sin informacion'],
];

describe('clasificarDescarte sobre las nueve notas reales', () => {
  it('clasifica las nueve, no dos', () => {
    const sinClasificar = REALES.filter(([nota]) => clasificarDescarte(nota) === null);
    expect(sinClasificar.map(([n]) => limpiar(n)), 'estas quedaron sin motivo').toEqual([]);
  });

  for (const [nota, esperado] of REALES) {
    it(`"${limpiar(nota).slice(0, 48)}…" → ${esperado}`, () => {
      expect(clasificarDescarte(nota)).toBe(esperado);
    });
  }
});

describe('la confusión que costó la primera versión', () => {
  // EL CASO. "bajo costo" tiene la palabra costo y se llevaba el match de
  // presupuesto. No es que no le alcanza: es que quería otro producto.
  it('"complementario de bajo costo" es producto equivocado, NO presupuesto', () => {
    expect(clasificarDescarte('Buscaba un seguro complementario de bajo costo.')).toBe('producto equivocado');
  });

  it('"bajar costos de Isapre" tampoco es presupuesto', () => {
    expect(clasificarDescarte('Pensó que nosotros hacíamos asesorías para bajar costos de Isapre.')).toBe('producto equivocado');
  });

  // Y el presupuesto de verdad sigue detectándose, si algún día aparece.
  it('un presupuesto real sí se marca como presupuesto', () => {
    expect(clasificarDescarte('Le interesaba pero está fuera de su presupuesto.')).toBe('presupuesto');
    expect(clasificarDescarte('Dijo que no puede pagar la prima mensual.')).toBe('presupuesto');
  });

  // La regla 3 de BHI afirma que los descartes son por preexistencias. En las
  // nueve notas no aparece ninguna. La categoría queda por si aparece.
  it('una preexistencia se marcaría, aunque hoy no haya ninguna', () => {
    expect(clasificarDescarte('Descalificado por preexistencia declarada.')).toBe('preexistencia');
    expect(REALES.filter(([n]) => clasificarDescarte(n) === 'preexistencia')).toEqual([]);
  });
});

describe('los bordes', () => {
  it('saca el HTML de GHL', () => {
    expect(limpiar('<p style="margin:0px; padding-left: 0px!important;">Hola&nbsp;mundo</p>')).toBe('Hola mundo');
  });

  it('una nota vacía o ausente es null, no un motivo cualquiera', () => {
    for (const v of ['', '   ', '<p></p>', null, undefined]) {
      expect(clasificarDescarte(v), `${JSON.stringify(v)}`).toBeNull();
    }
  });

  it('una nota que no habla de ningún motivo queda sin clasificar', () => {
    expect(clasificarDescarte('Llamé el martes a las 15hs.')).toBeNull();
  });

  it('con varias notas, gana la primera que clasifica', () => {
    expect(motivoDeLasNotas(['Llamé el martes.', 'Se decidió por Cigna.'])).toBe('eligio competencia');
    expect(motivoDeLasNotas(['Llamé el martes.', 'Dejé mensaje.'])).toBeNull();
    expect(motivoDeLasNotas([])).toBeNull();
  });
});
