/**
 * LA MONEDA NO SE ADIVINA.
 *
 * El caso que dio origen a esto, encontrado el 14/9/2026 barriendo la misma clase
 * de bug que el centinela 'Unknown': la moneda de la ficha de un cliente salía de
 *
 *     Moneda de Notion || <substring del nombre contra los códigos> || 'CLP'
 *
 * `'FRESH MONKEE'.includes('FRESH_MONKEE')` es **false** por el guión bajo. O sea
 * que la ÚNICA de las cuatro cuentas que factura en dólares era justamente la que
 * no pegaba, y caía al final de la cadena: pesos chilenos, inventados.
 *
 * Estaba tapado por un SEGUNDO error —`Clientes.tsx` casaba el título de Notion
 * contra el código de cuenta, y para Fresh Monkee tampoco casaba, así que el valor
 * malo nunca llegaba a pantalla—. Dos errores que se cancelan es la peor forma de
 * "funciona": arreglás uno y el otro sale a la luz con la plata puesta.
 */
import { describe, it, expect } from 'vitest';
import { resolverCuentaDeFicha, monedaDeFicha, type CuentaMinima } from './ficha-cuenta';

const CUENTAS: CuentaMinima[] = [
  { account: '360', nombre_cliente: '360 Eventos', moneda: 'CLP', notion_ficha_id: 'aaaa-1111' },
  { account: 'BHI', nombre_cliente: 'BHI Seguros', moneda: 'CLP', notion_ficha_id: 'bbbb-2222' },
  { account: 'FRESH_MONKEE', nombre_cliente: 'Fresh Monkee', moneda: 'USD', notion_ficha_id: 'cccc-3333' },
  { account: 'KAREDO', nombre_cliente: 'Karedo', moneda: 'EUR', notion_ficha_id: null },
];

describe('resolverCuentaDeFicha', () => {
  it('el id de la ficha manda, y tolera que venga con o sin guiones', () => {
    expect(resolverCuentaDeFicha('cccc-3333', 'lo que sea', CUENTAS)?.account).toBe('FRESH_MONKEE');
    expect(resolverCuentaDeFicha('cccc3333', 'lo que sea', CUENTAS)?.account).toBe('FRESH_MONKEE');
  });

  // El caso original. Sin id, por nombre completo, y tiene que dar USD.
  it('Fresh Monkee resuelve por nombre aunque el código lleve guión bajo', () => {
    expect(resolverCuentaDeFicha(null, 'Fresh Monkee', CUENTAS)?.account).toBe('FRESH_MONKEE');
    expect(resolverCuentaDeFicha(null, '  fresh monkee  ', CUENTAS)?.account).toBe('FRESH_MONKEE');
  });

  it('no resuelve por substring: "Karedo Test" no es "Karedo"', () => {
    expect(resolverCuentaDeFicha(null, 'Karedo Test', CUENTAS)).toBeNull();
    expect(resolverCuentaDeFicha(null, 'Karedo', CUENTAS)?.account).toBe('KAREDO');
  });

  it('una ficha que no es de ninguna cuenta devuelve null, no la primera que pase', () => {
    expect(resolverCuentaDeFicha('zzzz-9999', 'Nueva Cuenta SA', CUENTAS)).toBeNull();
    expect(resolverCuentaDeFicha(null, 'Sin nombre', CUENTAS)).toBeNull();
    expect(resolverCuentaDeFicha(null, '', CUENTAS)).toBeNull();
  });
});

describe('monedaDeFicha', () => {
  it('manda la tabla de cuentas, no lo que diga Notion', () => {
    const fm = CUENTAS[2];
    expect(monedaDeFicha(fm, 'CLP').moneda).toBe('USD');
    expect(monedaDeFicha(fm, null).moneda).toBe('USD');
  });

  it('cuando las dos fuentes se contradicen, lo dice — no elige en silencio', () => {
    const r = monedaDeFicha(CUENTAS[2], 'CLP');
    expect(r.discrepancia).toMatch(/FRESH_MONKEE/);
    expect(r.discrepancia).toMatch(/CLP/);
    expect(r.discrepancia).toMatch(/USD/);
  });

  it('si coinciden no inventa una alerta', () => {
    expect(monedaDeFicha(CUENTAS[2], 'USD').discrepancia).toBeNull();
    expect(monedaDeFicha(CUENTAS[2], null).discrepancia).toBeNull();
  });

  // El corazón del asunto: sin cuenta resuelta, NULL. Nunca una moneda por defecto.
  it('sin cuenta y sin dato en Notion la respuesta es null, no una moneda cualquiera', () => {
    const r = monedaDeFicha(null, null);
    expect(r.moneda).toBeNull();
    expect(r.discrepancia).toBeNull();
  });

  it('sin cuenta pero con dato en Notion, usa el de Notion: es lo único que hay', () => {
    expect(monedaDeFicha(null, 'GBP').moneda).toBe('GBP');
  });
});

describe('el bug tal como ocurrió, de punta a punta', () => {
  it('una ficha "Fresh Monkee" sin Moneda en Notion da USD, y jamás CLP', () => {
    const cuenta = resolverCuentaDeFicha(null, 'Fresh Monkee', CUENTAS);
    const { moneda } = monedaDeFicha(cuenta, undefined);
    expect(moneda).toBe('USD');
    expect(moneda).not.toBe('CLP');
  });

  it('ninguna ficha de las cuatro cuentas termina en una moneda que no es la suya', () => {
    for (const c of CUENTAS) {
      const resuelta = resolverCuentaDeFicha(c.notion_ficha_id, c.nombre_cliente, CUENTAS);
      expect(monedaDeFicha(resuelta, undefined).moneda, `${c.account}`).toBe(c.moneda);
    }
  });
});
