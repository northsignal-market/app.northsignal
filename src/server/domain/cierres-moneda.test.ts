/**
 * UN MONTO SIN SU MONEDA NO SE MUESTRA, Y DOS MONEDAS NO SE SUMAN.
 *
 * Encontrado el 14/9/2026 al preparar la conexión de GoHighLevel para BHI, ANTES
 * de que entrara el primer evento — que es el único momento en que este tipo de
 * cosa se arregla barato.
 *
 * BHI es la única de las cuatro cuentas donde la moneda de las etapas (`USD`, en
 * `funnel_stages`) no coincide con la de la cuenta (`CLP`). Y el camino del dato
 * perdía la unidad por el camino:
 *
 *   funnel_events        → tiene currency
 *   true_roas_events     → NO tenía
 *   cierres_sin_atribucion → NO tenía
 *   v_cierres_totales    → exponía `monto` pelado
 *   /api/cierres         → total = suma de todos los montos
 *   /api/.../mtd         → mtd_income = suma de todos los montos
 *
 * La app formatea la plata de BHI con la moneda de la CUENTA. Un cierre de
 * 5.599 USD iba a aparecer como **$5.599 CLP**: unas 950 veces menos de lo que
 * vale, y sin un solo síntoma. No se ve roto, se ve como una cifra.
 *
 * Lo que fija este control es la regla, no el número: sumar monedas distintas
 * produce un número que no existe, y cuando eso pasaría la respuesta correcta es
 * null con su motivo, no un total.
 */
import { describe, it, expect } from 'vitest';

/** La misma agregación que usan /api/cierres y el mtd, aislada para probarla. */
function totalizar(filas: { monto: number | string | null; currency?: string | null }[]) {
  const porMoneda = filas.reduce((acc: Record<string, number>, r) => {
    const m = r.currency || 'sin_moneda';
    acc[m] = (acc[m] || 0) + (Number(r.monto) || 0);
    return acc;
  }, {} as Record<string, number>);
  const monedas = Object.keys(porMoneda);
  const unaSola = monedas.length === 1 ? monedas[0] : null;
  return {
    totales: porMoneda,
    moneda: unaSola,
    total: unaSola ? porMoneda[unaSola] : null,
    aviso: unaSola || !monedas.length ? null : `Hay cierres en ${monedas.join(', ')}. No se suman entre sí.`,
  };
}

describe('los cierres no mezclan monedas', () => {
  // El caso de BHI: todo en USD. Hay total, y viene rotulado.
  it('con una sola moneda da el total, y dice cuál es', () => {
    const r = totalizar([
      { monto: 5599, currency: 'USD' },
      { monto: 1400, currency: 'USD' },
    ]);
    expect(r.total).toBe(6999);
    expect(r.moneda).toBe('USD');
    expect(r.aviso).toBeNull();
  });

  // El que importa: antes esto devolvía 5599 + 4500000 = 4505599, un número que
  // no existe en ninguna moneda, y la pantalla le ponía "$" de pesos.
  it('con dos monedas NO inventa un total', () => {
    const r = totalizar([
      { monto: 5599, currency: 'USD' },
      { monto: 4500000, currency: 'CLP' },
    ]);
    expect(r.total).toBeNull();
    expect(r.moneda).toBeNull();
    expect(r.totales).toEqual({ USD: 5599, CLP: 4500000 });
    expect(r.aviso).toMatch(/USD/);
    expect(r.aviso).toMatch(/CLP/);
  });

  // Una fila sin moneda es un hueco, y tiene que verse como hueco — no fundirse
  // con las que sí la tienen.
  it('un monto sin moneda no se mezcla con los que sí la traen', () => {
    const r = totalizar([
      { monto: 5599, currency: 'USD' },
      { monto: 100, currency: null },
    ]);
    expect(r.total).toBeNull();
    expect(r.totales.sin_moneda).toBe(100);
    expect(r.totales.USD).toBe(5599);
  });

  it('sin cierres no hay aviso ni total inventado: cero filas es cero filas', () => {
    const r = totalizar([]);
    expect(r.total).toBeNull();
    expect(r.aviso).toBeNull();
    expect(r.totales).toEqual({});
  });

  // La guarda no puede apagar el caso normal: las otras tres cuentas tienen la
  // moneda de las etapas alineada con la de la cuenta y tienen que seguir sumando.
  it('360, KAREDO y FRESH_MONKEE siguen dando su total de siempre', () => {
    expect(totalizar([{ monto: 1_000_000, currency: 'CLP' }, { monto: 500_000, currency: 'CLP' }]).total).toBe(1_500_000);
    expect(totalizar([{ monto: 200, currency: 'EUR' }]).total).toBe(200);
    expect(totalizar([{ monto: 88.4, currency: 'USD' }]).total).toBeCloseTo(88.4);
  });
});
