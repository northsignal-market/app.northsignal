/**
 * LOS HUECOS DE LA ATRIBUCIÓN NO SE PUEDEN CONFUNDIR ENTRE SÍ.
 *
 * Saber de qué keyword vino un lead tiene cuatro respuestas posibles, y tres de
 * ellas son huecos con causas distintas que llevan a acciones OPUESTAS sobre la
 * misma keyword:
 *
 *   sin click id      → el formulario o el tagging. La keyword no tiene que ver.
 *   clic no capturado → la captura no corrió, o pasaron los 90 días de click_view.
 *                       Tampoco dice nada de la keyword.
 *   sin keyword       → el clic existe y no vino de una keyword (Display, PMax, DSA).
 *   atribuido         → se sabe cuál fue.
 *
 * Aplastar los tres primeros en "no sabemos" es cómo una keyword buena termina
 * pausada por un problema de tagging.
 *
 * Los datos de las pruebas son filas REALES de click_view de BHI (8829408394),
 * sondeadas el 14/9/2026: por eso el gclid es largo y feo y la keyword es
 * "best doctors".
 */
import { describe, it, expect } from 'vitest';
import { mapearClickView, coberturaPct, estadoAtribucion, type FilaClickView } from './atribucion-clic';

const FILA_REAL: FilaClickView = {
  campaign: { id: '24041721491', name: 'BHI_SEARCH_07-26' },
  adGroup: { id: '197149586814', name: 'BRANDED' },
  segments: { date: '2026-09-10', adNetworkType: 'SEARCH' },
  clickView: {
    gclid: 'CjwKCAjwqonVBhA4EiwA9wYJ3SYB-cKHnqPchNtnkxiotyL7cxED9FSlIS9xLxgKwb07zTk2dTHuIRoCPeUQAvD_BwE',
    keywordInfo: { matchType: 'EXACT', text: 'best doctors' },
  },
};

describe('mapearClickView', () => {
  it('trae la keyword, la concordancia y el resto tal como vino', () => {
    const r = mapearClickView(FILA_REAL, 'BHI', '2026-09-10')!;
    expect(r.keyword).toBe('best doctors');
    expect(r.concordancia).toBe('EXACT');
    expect(r.campana).toBe('BHI_SEARCH_07-26');
    expect(r.grupo).toBe('BRANDED');
    expect(r.campana_id).toBe('24041721491');
    expect(r.fecha).toBe('2026-09-10');
  });

  // El caso que importa: un clic sin keyword (Display, PMax, DSA) tiene que
  // guardar NULL, no '' ni un centinela de texto. Un 'sin keyword' guardado como
  // texto es indistinguible de una keyword real llamada así — y este repo ya se
  // comió a 'Unknown' viajando como si fuera una cuenta.
  it('un clic sin keyword guarda null, no un centinela', () => {
    const r = mapearClickView({ ...FILA_REAL, clickView: { gclid: 'abc' } }, 'BHI', '2026-09-10')!;
    expect(r.keyword).toBeNull();
    expect(r.concordancia).toBeNull();
    expect(r.gclid).toBe('abc');   // la fila EXISTE: eso es lo que dice que sí capturamos
  });

  it('una keyword vacía o de puros espacios también es null', () => {
    for (const texto of ['', '   ']) {
      const r = mapearClickView(
        { ...FILA_REAL, clickView: { gclid: 'abc', keywordInfo: { text: texto } } }, 'BHI', '2026-09-10')!;
      expect(r.keyword, `"${texto}" debería ser null`).toBeNull();
    }
  });

  it('sin gclid la fila se descarta: es la clave, no un campo más', () => {
    expect(mapearClickView({ ...FILA_REAL, clickView: {} }, 'BHI', '2026-09-10')).toBeNull();
    expect(mapearClickView({}, 'BHI', '2026-09-10')).toBeNull();
  });

  it('si Google no manda la fecha usa la del día pedido, no inventa otra', () => {
    const r = mapearClickView({ clickView: { gclid: 'x' } }, 'BHI', '2026-09-01')!;
    expect(r.fecha).toBe('2026-09-01');
  });
});

describe('coberturaPct', () => {
  // La misma decisión que el CPA canónico con cero conversiones.
  it('sin clics es null, NO 0%', () => {
    expect(coberturaPct(0, 0)).toBeNull();
  });

  it('con clics devuelve el porcentaje', () => {
    expect(coberturaPct(3, 3)).toBe(100);
    expect(coberturaPct(1, 4)).toBe(25);
  });

  // Lo medido en BHI el 14/9: los tres días dieron 100%.
  it('reproduce lo medido en BHI', () => {
    expect(coberturaPct(3, 3)).toBe(100);
    expect(coberturaPct(5, 5)).toBe(100);
    expect(coberturaPct(2, 2)).toBe(100);
  });
});

describe('estadoAtribucion', () => {
  it('distingue los cuatro estados', () => {
    expect(estadoAtribucion(null, null)).toBe('sin click id');
    expect(estadoAtribucion('', null)).toBe('sin click id');
    expect(estadoAtribucion('gclid123', null)).toBe('clic no capturado');
    expect(estadoAtribucion('gclid123', { keyword: null })).toBe('sin keyword');
    expect(estadoAtribucion('gclid123', { keyword: 'best doctors' })).toBe('atribuido');
  });

  // Los tres huecos son distintos entre sí, y eso es justo lo que no se puede perder.
  it('los tres huecos no colapsan en uno solo', () => {
    const estados = new Set([
      estadoAtribucion(null, null),
      estadoAtribucion('g', null),
      estadoAtribucion('g', { keyword: null }),
    ]);
    expect(estados.size, 'los tres huecos tienen que seguir siendo tres').toBe(3);
  });

  // Este `case` está duplicado en v_leads_por_keyword (migración
  // 20260914150000). La duplicación es a propósito —la vista no puede importar
  // TypeScript— pero entonces hay que vigilar que no se despeguen: si alguien
  // toca uno de los dos, este test lo pone en evidencia.
  it('dice lo mismo que el case de v_leads_por_keyword', () => {
    const comoEnSql = (clickId: string | null, gclidEnTabla: string | null, keyword: string | null) =>
      clickId == null ? 'sin click id'
        : gclidEnTabla == null ? 'clic no capturado'
        : keyword == null ? 'sin keyword'
        : 'atribuido';
    const casos: [string | null, string | null, string | null][] = [
      [null, null, null],
      ['g', null, null],
      ['g', 'g', null],
      ['g', 'g', 'best doctors'],
    ];
    for (const [clickId, enTabla, kw] of casos) {
      expect(
        estadoAtribucion(clickId, enTabla == null ? null : { keyword: kw }),
        `desacuerdo con el SQL en ${JSON.stringify([clickId, enTabla, kw])}`,
      ).toBe(comoEnSql(clickId, enTabla, kw));
    }
  });
});

/**
 * LA VENTANA QUE SE PIDE TIENE QUE SER LA QUE SE RECORRE.
 *
 * El relleno de 90 días hacía una consulta de denominador POR DÍA: con 4 cuentas
 * eran 720 llamadas a Google en serie, y Vercel corta antes. Un relleno que se
 * parte a la mitad sin avisar deja la tabla incompleta, y una tabla incompleta se
 * lee igual que "esos clics no tuvieron keyword". Por eso la ventana es
 * chunkeable y se declara en la respuesta.
 *
 * Es la regla de CLAUDE.md —"la ventana que decís tiene que ser la que sumaste"—
 * aplicada a una captura en vez de a una métrica.
 */
describe('la ventana del relleno', () => {
  /** La misma resolución de ventana que usa /api/cron/clicks-keyword. */
  const ventana = (q: { desde?: any; hasta?: any; dias?: any }) => {
    const TOPE = 90;
    const n = (v: any, def: number) => Math.max(1, Math.min(TOPE, parseInt(String(v ?? '')) || def));
    const desde = q.desde != null ? n(q.desde, 1) : 1;
    const hasta = q.hasta != null ? n(q.hasta, desde) : q.dias != null ? n(q.dias, 1) : 1;
    const [dIni, dFin] = desde <= hasta ? [desde, hasta] : [hasta, desde];
    return { dIni, dFin, dias: dFin - dIni + 1 };
  };

  it('sin parámetros captura solo ayer, que es lo que hace el cron diario', () => {
    expect(ventana({})).toEqual({ dIni: 1, dFin: 1, dias: 1 });
  });

  it('dias=N sigue andando: son los N días previos', () => {
    expect(ventana({ dias: 30 })).toEqual({ dIni: 1, dFin: 30, dias: 30 });
  });

  it('desde/hasta define un tramo, para poder partir el relleno', () => {
    expect(ventana({ desde: 31, hasta: 60 })).toEqual({ dIni: 31, dFin: 60, dias: 30 });
  });

  it('los tramos del relleno cubren los 90 días sin huecos ni solapes', () => {
    const tramos = [ventana({ desde: 1, hasta: 30 }), ventana({ desde: 31, hasta: 60 }), ventana({ desde: 61, hasta: 90 })];
    expect(tramos.reduce((a, t) => a + t.dias, 0)).toBe(90);
    const dias = new Set<number>();
    for (const t of tramos) for (let i = t.dIni; i <= t.dFin; i++) dias.add(i);
    expect(dias.size, 'los tramos se solapan o dejan un hueco').toBe(90);
  });

  it('invertido se ordena solo, en vez de recorrer cero días en silencio', () => {
    expect(ventana({ desde: 60, hasta: 31 })).toEqual({ dIni: 31, dFin: 60, dias: 30 });
  });

  // click_view no guarda más de ~90 días: pedir 200 no trae más, y prometerlo
  // en la respuesta sería declarar una ventana que no se pudo recorrer.
  it('no se puede pedir más de lo que Google guarda', () => {
    expect(ventana({ dias: 500 }).dFin).toBe(90);
    expect(ventana({ desde: 999, hasta: 999 }).dFin).toBe(90);
  });

  it('basura en el parámetro cae al default, no a cero días', () => {
    expect(ventana({ dias: 'ayer' })).toEqual({ dIni: 1, dFin: 1, dias: 1 });
    expect(ventana({ desde: '', hasta: '' })).toEqual({ dIni: 1, dFin: 1, dias: 1 });
  });
});
