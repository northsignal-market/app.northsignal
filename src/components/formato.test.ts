/**
 * Cero no es lo mismo que "no hay dato".
 * ----------------------------------------------------------------------------
 * Este es EL modo de falla declarado del sistema: producir números verosímiles
 * y equivocados. Se manifestó dos veces en dos días, las dos por un `|| 0`:
 *
 *  - El panel Integridad leía cuatro columnas que la vista nunca tuvo y las
 *    convertía en ceros. La tabla mostraba "0 filas" en las cuatro cuentas y
 *    parecía un dato: era un hueco.
 *  - El switcher pintaba una cuenta como elegida mientras el store estaba
 *    vacío, así que Datos consultaba con `client=` y mostraba cuatro ceros.
 *
 * Los formateadores son la última línea antes de la pantalla. Si acá un null
 * sale como "$0", ninguna capa de más arriba puede arreglarlo: el operador ve
 * un cero medido donde no se midió nada.
 */
import { describe, it, expect } from 'vitest';
import { fmtMoneda, fmtMonedaCorta, fmtNum, fmtFechaCorta, hoyLocal } from './ui';

describe('fmtMoneda distingue el cero medido del dato ausente', () => {
  it('null y undefined salen como raya, nunca como cero', () => {
    expect(fmtMoneda(null, 'CLP')).toBe('—');
    expect(fmtMoneda(undefined, 'USD')).toBe('—');
  });

  it('NaN también: un cálculo que no dio número no es cero', () => {
    expect(fmtMoneda(NaN, 'EUR')).toBe('—');
    expect(fmtMoneda(0 / 0, 'USD')).toBe('—');
  });

  it('el cero de verdad SÍ se imprime, y se ve distinto de la raya', () => {
    expect(fmtMoneda(0, 'USD')).not.toBe('—');
    expect(fmtMoneda(0, 'USD')).toMatch(/0/);
  });

  // CLP sin decimales, USD y EUR con dos. Un CPA de 34.338 pesos con dos
  // decimales es ruido; medio centavo de dólar no existe pero medio dólar sí.
  it('los decimales salen de la moneda, no de un default', () => {
    expect(fmtMoneda(1234.56, 'CLP')).not.toMatch(/,\d\d\b/);
    expect(fmtMoneda(1234.5, 'USD')).toMatch(/,50|\.50/);
  });

  it('cada moneda con su símbolo: Fresh Monkee llegó a mostrarse en pesos', () => {
    expect(fmtMoneda(100, 'USD')).toMatch(/US\$/);
    expect(fmtMoneda(100, 'EUR')).toMatch(/€/);
  });
});

describe('fmtNum y fmtMonedaCorta: la misma regla', () => {
  it('ausente es raya en las dos', () => {
    expect(fmtNum(null)).toBe('—');
    expect(fmtNum(undefined)).toBe('—');
    expect(fmtNum(NaN)).toBe('—');
    expect(fmtMonedaCorta(null, 'USD')).toBe('—');
  });

  it('cero se imprime', () => {
    expect(fmtNum(0)).toBe('0');
  });

  it('los cortes de magnitud no inventan precisión', () => {
    expect(fmtMonedaCorta(1_500_000, 'CLP')).toMatch(/M/);
    expect(fmtMonedaCorta(45_000, 'CLP')).toMatch(/mil/);
  });
});

describe('fmtFechaCorta no corre la fecha un día', () => {
  // `new Date('2026-09-12')` la interpreta en UTC y en Buenos Aires devuelve el
  // 11. En una app que juzga días —"el gasto de ayer ya es definitivo"— correr
  // la fecha un día cambia de qué día se está hablando.
  it('lee el string, no lo pasa por Date', () => {
    expect(fmtFechaCorta('2026-09-12')).toBe('12 sep');
    expect(fmtFechaCorta('2026-01-01')).toBe('1 ene');
    expect(fmtFechaCorta('2026-12-31')).toBe('31 dic');
  });

  it('sin fecha, raya', () => {
    expect(fmtFechaCorta(null)).toBe('—');
    expect(fmtFechaCorta('')).toBe('—');
  });
});

describe('hoyLocal usa el día del operador, no UTC', () => {
  it('devuelve AAAA-MM-DD con ceros a la izquierda', () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('el offset mueve días de verdad, cruzando meses', () => {
    const hoy = new Date(hoyLocal() + 'T12:00:00').getTime();
    const hace17 = new Date(hoyLocal(-17) + 'T12:00:00').getTime();
    expect(Math.round((hoy - hace17) / 864e5)).toBe(17);
  });
});
