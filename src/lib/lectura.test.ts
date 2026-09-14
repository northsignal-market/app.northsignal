/**
 * EL PLAN SIN SEÑALES NO TIRA LA PANTALLA ABAJO.
 *
 * El 14/9/2026, lunes, a las 6 de la mañana, la pantalla Cuenta entera dejó de
 * renderizar: "Cannot read properties of null (reading 'filter')".
 *
 * Causa: `plan_lectura()` arma `senales` con `json_agg(...)`, y **json_agg sobre
 * cero filas devuelve NULL, no `[]`**. Al arrancar la semana del 14 las cuatro
 * cuentas pasaron a `estado: 'sin_senal'` con `senales: null` a la vez, y
 * `leerPlan` hacía `pl.senales.filter(...)` con `pl` no nulo pero `senales` sí.
 *
 * La bomba estaba armada desde que existe la función: solo hacía falta el primer
 * lunes con el plan vacío. Y el tipo declaraba `SenalLectura[]`, así que ni el
 * compilador ni quien leía el código tenían por qué sospechar.
 *
 * Cuidado con leer el NULL como "cero señales": el payload real de ese día traía
 * `total_senales: 5` junto a `senales: null`. Son cinco señales cuyo estado
 * todavía no se puede decir (`evaluables_totales: 0`, día 1). El `?? []` evita el
 * crash y no miente en pantalla —el veredicto de `sin_senal` sale de `pl.estado`,
 * no de la lista— pero la raíz sigue en SQL, y NO es `coalesce(json_agg, '[]')`:
 * eso afirmaría cero. Es el join que se come las cinco cuando no hay pulso que
 * cruzar.
 */
import { describe, it, expect } from 'vitest';
import { leerPlan } from './lectura';

/** Un plan como el que devolvió la base el 14/9: real, vigente, y sin señales. */
const planSinSenales: any = {
  semana: '2026-09-14',
  estado: 'sin_senal',
  senales: null,                  // <- json_agg sobre cero filas
  senales_encendidas_hoy: 0,
  senales_persistentes: 0,
  senales_sin_dato_hoy: 0,
  total_senales: 0,
  senales_sin_cruce: 0,
  evaluables_totales: 0,
};

describe('leerPlan con el plan recién arrancado', () => {
  // El caso exacto del 14/9. Sin la guarda, esto es la pantalla Cuenta caída.
  it('no explota cuando senales viene null', () => {
    expect(() => leerPlan(planSinSenales, '2026-09-14')).not.toThrow();
  });

  // Y sobre todo: que NO afirme que no hay señales. Con total_senales 5 y cero
  // evaluaciones, lo único cierto es que todavía no se sabe.
  it('dice que todavía no sabe, no que no hay señales', () => {
    const r = leerPlan({ ...planSinSenales, total_senales: 5 }, '2026-09-14') as any;
    expect(r).not.toBeNull();
    expect(r.veredicto).toMatch(/todav[ií]a|recién empieza/i);
    expect(r.veredicto).not.toMatch(/ninguna de las/i);
  });

  // Se leen igual PORQUE en este estado la lista no se usa, no porque null sea []. 
  it('senales null y senales [] dan la misma lectura en estado sin_senal', () => {
    const conNull = leerPlan({ ...planSinSenales, senales: null }, '2026-09-14');
    const conVacio = leerPlan({ ...planSinSenales, senales: [] }, '2026-09-14');
    expect(conNull).toEqual(conVacio);
  });

  // La guarda no puede tapar el caso con datos: si hay señales, se leen.
  it('con señales de verdad sigue distinguiendo las encendidas', () => {
    const conSenales: any = {
      ...planSinSenales,
      estado: 'atencion',
      total_senales: 2,
      senales_encendidas_hoy: 1,
      senales_persistentes: 1,
      evaluables_totales: 4,
      senales: [
        { nombre: 'CPA fuera de rango', grupo: 'costo', hoy: 'encendida', racha: 3 },
        { nombre: 'CTR estable', grupo: 'anuncio', hoy: 'apagada', racha: 0 },
      ],
    };
    const r = leerPlan(conSenales, '2026-09-14') as any;
    expect(r).not.toBeNull();
    expect(r.veredicto).toMatch(/atenci/i);
  });

  // Lo que ya andaba y no se puede romper al arreglar lo de arriba.
  it('sin plan sigue devolviendo null: eso no es un vacío, es que no hay plan', () => {
    expect(leerPlan(null, '2026-09-14')).toBeNull();
  });

  it('una semana ya terminada se declara vencida, con o sin señales', () => {
    const r = leerPlan(planSinSenales, '2026-09-30') as any;
    expect(r).not.toBeNull();
    expect(JSON.stringify(r)).toMatch(/vencid/i);
  });
});
