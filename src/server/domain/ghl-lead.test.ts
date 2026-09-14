/**
 * EL LEAD DE GHL, CON SUS TRES TRAMPAS.
 *
 * Las tres salieron de sondear la cuenta real de BHI el 14/9/2026, y las tres son
 * del tipo que anda perfecto hasta que deja de andar en silencio.
 *
 *   1. El campo se lee por ID, no por posición. El gclid estaba en
 *      customFields[2] en unos contactos y en [3] en otros.
 *   2. El descarte es una ETAPA: los 10 descartados tienen status 'open'.
 *      Filtrar por status='lost' devuelve CERO.
 *   3. Un campo ausente es null, no ''. Si no, todos los vacíos agrupan juntos
 *      como si fueran una misma keyword.
 */
import { describe, it, expect } from 'vitest';
import { valorDeCampo, estadoDelLead, armarLead, CAMPOS_BHI } from './ghl-lead';

/** Los campos tal como vinieron del sondeo, con el gclid en posición 2. */
const CAMPOS = [
  { id: 'Cxo9rbLaxtgkoYKxbaIM', value: 'Isapre' },
  { id: 'EE9IRPlkr7tJNrJSo50F', value: 'Plan familiar' },
  { id: CAMPOS_BHI.gclid, value: 'Cj0KCQjw8JPVBhD-ARIsAO691sEqoMxbykhe_5SoGtnK4uqvTsKi3tN6_atiVmKNQJb' },
  { id: CAMPOS_BHI.keyword, value: 'best doctors' },
  { id: CAMPOS_BHI.concordancia, value: 'EXACT' },
];

const ETAPAS: Record<string, string> = {
  'aaa': 'Nuevo Lead', 'bbb': 'Descartado', 'ccc': 'Cliente Activo', 'ddd': 'Cerrado Perdido',
};
const nombreEtapa = (id: unknown) => ETAPAS[String(id)] ?? null;

describe('valorDeCampo lee por id, no por posición', () => {
  it('encuentra la keyword esté en la posición que esté', () => {
    expect(valorDeCampo(CAMPOS, CAMPOS_BHI.keyword)).toBe('best doctors');
    // El mismo campo, movido al principio: tiene que dar lo mismo.
    const alReves = [...CAMPOS].reverse();
    expect(valorDeCampo(alReves, CAMPOS_BHI.keyword)).toBe('best doctors');
  });

  // El caso concreto que destapó esto: agregan un campo nuevo en GHL y todos los
  // índices se corren. Por id no pasa nada; por posición se leería otro campo.
  it('sobrevive a que agreguen un campo nuevo adelante', () => {
    const conUnoNuevo = [{ id: 'nuevo123', value: 'lo que sea' }, ...CAMPOS];
    expect(valorDeCampo(conUnoNuevo, CAMPOS_BHI.gclid)).toMatch(/^Cj0K/);
    expect(valorDeCampo(conUnoNuevo, CAMPOS_BHI.keyword)).toBe('best doctors');
  });

  it('un campo ausente o vacío es null, nunca cadena vacía', () => {
    expect(valorDeCampo(CAMPOS, 'no-existe')).toBeNull();
    expect(valorDeCampo([{ id: 'x', value: '' }], 'x')).toBeNull();
    expect(valorDeCampo([{ id: 'x', value: '   ' }], 'x')).toBeNull();
    expect(valorDeCampo(null, CAMPOS_BHI.gclid)).toBeNull();
    expect(valorDeCampo(undefined, CAMPOS_BHI.gclid)).toBeNull();
  });
});

describe('estadoDelLead mira la etapa, no el status', () => {
  // EL CASO QUE IMPORTA. Los 10 descartados de BHI tienen status 'open'.
  it('un descartado con status open se cuenta como descartado', () => {
    expect(estadoDelLead('Descartado', 'open')).toBe('descartado');
    expect(estadoDelLead('Cerrado Perdido', 'open')).toBe('descartado');
  });

  it('las otras etapas siguen siendo en curso', () => {
    for (const e of ['Nuevo Lead', 'Intento de Contacto', 'Contactado', 'Asesoría Agendada',
                     'Asesoría Realizada', 'En Seguimiento', 'Proceso Iniciado']) {
      expect(estadoDelLead(e, 'open'), e).toBe('en curso');
    }
  });

  it('cliente activo y won son ganado', () => {
    expect(estadoDelLead('Cliente Activo', 'open')).toBe('ganado');
    expect(estadoDelLead('Asesoría Realizada', 'won')).toBe('ganado');
  });

  it('las tildes y mayúsculas no cambian el veredicto', () => {
    expect(estadoDelLead('DESCARTADO', 'open')).toBe('descartado');
    expect(estadoDelLead('descartado', 'open')).toBe('descartado');
  });

  it('sin etapa ni status no inventa: queda en curso, que es el default honesto', () => {
    expect(estadoDelLead(null, null)).toBe('en curso');
  });
});

describe('armarLead', () => {
  const OPORTUNIDAD = {
    id: 'op123', contactId: 'ct456', pipelineStageId: 'bbb', status: 'open',
    monetaryValue: 168, createdAt: '2026-09-01T10:00:00Z', lastStageChangeAt: '2026-09-10T12:00:00Z',
  };

  it('arma el lead completo con la keyword y el estado correctos', () => {
    const l = armarLead(OPORTUNIDAD, { id: 'ct456', customFields: CAMPOS }, nombreEtapa)!;
    expect(l.keyword).toBe('best doctors');
    expect(l.concordancia).toBe('EXACT');
    expect(l.etapa).toBe('Descartado');
    expect(l.estado).toBe('descartado');   // status era 'open'
    expect(l.monto).toBe(168);
  });

  // Sin el contacto no hay campos personalizados. Eso NO se rellena con nada:
  // "no trae keyword" y "no pudimos leer la keyword" son cosas distintas.
  it('sin contacto, gclid y keyword van null en vez de un valor por defecto', () => {
    const l = armarLead(OPORTUNIDAD, null, nombreEtapa)!;
    expect(l.gclid).toBeNull();
    expect(l.keyword).toBeNull();
    expect(l.etapa).toBe('Descartado');    // la etapa sí se sabe: viene de la oportunidad
    expect(l.estado).toBe('descartado');
  });

  it('una etapa que no está en el diccionario da null, no un id crudo', () => {
    const l = armarLead({ ...OPORTUNIDAD, pipelineStageId: 'zzz' }, null, nombreEtapa)!;
    expect(l.etapa).toBeNull();
  });

  it('sin contactId no hay lead: es la clave', () => {
    expect(armarLead({ id: 'op1' }, null, nombreEtapa)).toBeNull();
  });
});
