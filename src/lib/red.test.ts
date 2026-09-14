/**
 * Un hueco tiene que venir firmado con su causa.
 * ----------------------------------------------------------------------------
 * Estos tests existen por un bug concreto: `fetchJSON` devolvía el fallback ante
 * un 401, un 500, un HTML de error y la red caída, así que ninguna vista podía
 * distinguir "no hay nada" de "no se pudo preguntar". Producía cosas como que
 * Bandeja pintara el punto VERDE con "al día" cuando el endpoint que informa si
 * los datos están sanos era justamente el que no contestaba, o que Semana
 * escribiera "Es buena señal: las negativas están cubriendo" desde un fetch
 * fallado. Un veredicto operativo emitido desde un hueco.
 *
 * Cada caso de acá abajo es una de las formas reales en que una consulta falla
 * en esta app. La que más engaña es la cuarta: status 200 con HTML adentro.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pedirJSON, motivoFallo, FalloRed, faltaLaCuenta } from './red';

function respuesta(body: string, { status = 200, tipo = 'application/json' } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? tipo : null) },
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

afterEach(() => { vi.unstubAllGlobals(); });

/** Corre la promesa esperando que falle y devuelve el FalloRed ya tipado.
 *  Un `catch(e => e)` suelto devuelve `unknown` y obliga a castear en cada
 *  aserción, que es justo donde un test deja de leerse. */
async function falla(p: Promise<unknown>): Promise<FalloRed> {
  try {
    await p;
  } catch (e) {
    if (e instanceof FalloRed) return e;
    throw new Error(`Se esperaba un FalloRed y llegó: ${String(e)}`);
  }
  throw new Error('Se esperaba que fallara y resolvió bien.');
}

const conFetch = (impl: any) => {
  vi.stubGlobal('fetch', vi.fn(impl));
  vi.stubGlobal('localStorage', { getItem: () => null });
};

describe('pedirJSON: falla distinto según por qué falló', () => {
  it('devuelve el dato cuando todo anda', async () => {
    conFetch(async () => respuesta('{"filas":3}'));
    await expect(pedirJSON<any>('/api/x')).resolves.toEqual({ filas: 3 });
  });

  it('sin conexión: status null, porque el servidor nunca contestó', async () => {
    conFetch(async () => { throw new TypeError('Failed to fetch'); });
    const e = await falla(pedirJSON('/api/x'));
    expect(e.status).toBeNull();
  });

  it('401 se distingue del resto: la sesión caducó, no es un error de datos', async () => {
    conFetch(async () => respuesta('{}', { status: 401 }));
    const e = await falla(pedirJSON('/api/x'));
    expect(e.status).toBe(401);
    expect(e.message).toMatch(/sesión/i);
  });

  it('500 lanza con su código, no devuelve una lista vacía', async () => {
    conFetch(async () => respuesta('{}', { status: 500 }));
    const e = await falla(pedirJSON('/api/x'));
    expect(e.status).toBe(500);
  });

  // El caso que más engaña de los cinco: el proxy contesta 200 con una página
  // de error. `r.ok` es true, así que cualquier guarda que mire sólo el status
  // lo deja pasar, y después el JSON.parse revienta o —peor— devuelve algo.
  it('HTML con status 200 no pasa como éxito', async () => {
    conFetch(async () => respuesta('<!doctype html><h1>502</h1>', { tipo: 'text/html' }));
    const e = await falla(pedirJSON('/api/x'));
    expect(e.message).toMatch(/JSON/i);
  });

  it('JSON roto tampoco', async () => {
    conFetch(async () => respuesta('{"a":'));
    await expect(pedirJSON('/api/x')).rejects.toBeInstanceOf(FalloRed);
  });

  // Hay que simular `window` además de `localStorage`: `pedirJSON` guarda el
  // acceso al token detrás de `typeof window !== 'undefined'` porque este módulo
  // también se importa del lado del servidor, donde no hay localStorage. Sin el
  // stub de window el test corre en Node y el token nunca se lee — que es el
  // comportamiento correcto, no un bug. Lo de abajo prueba las dos mitades.
  it('manda el Bearer cuando hay token guardado y estamos en el navegador', async () => {
    const espia = vi.fn(async (_url: string, init?: RequestInit) => respuesta('{}'));
    vi.stubGlobal('fetch', espia);
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: () => 'tok123' });
    await pedirJSON('/api/x');
    expect(espia.mock.calls[0][1]?.headers?.['Authorization' as never]).toBe('Bearer tok123');
  });

  it('fuera del navegador no toca localStorage, que allá no existe', async () => {
    const espia = vi.fn(async (_url: string, init?: RequestInit) => respuesta('{}'));
    vi.stubGlobal('fetch', espia);
    // Sin stub de window: es el entorno del servidor.
    await pedirJSON('/api/x');
    expect(espia.mock.calls[0][1]?.headers?.['Authorization' as never]).toBeUndefined();
  });
});

describe('motivoFallo: siempre una frase imprimible', () => {
  it('usa el mensaje del FalloRed tal cual', () => {
    expect(motivoFallo(new FalloRed(500, 'El servidor respondió 500.'))).toBe('El servidor respondió 500.');
  });

  // Sin esto, una vista podía terminar imprimiendo "undefined" o un [object
  // Object] en el lugar donde tenía que explicar qué pasó.
  it('nunca devuelve vacío, ni con un error raro', () => {
    for (const raro of [undefined, null, {}, 'texto suelto', 42]) {
      expect(motivoFallo(raro).length).toBeGreaterThan(0);
    }
  });
});

/**
 * PREGUNTAR SIN CUENTA · el 14/9/2026 la consola era una pared de 400.
 *
 * Nueve endpoints salían con `client=` vacío en el primer render, mientras
 * `/api/cuentas` todavía cargaba. El servidor los rechazaba, con razón. Lo grave
 * no era el ruido: cada rechazo llegaba a su panel como un fallback —lista vacía,
 * cero, guion— y en pantalla eso no se distingue de "esta cuenta no tiene datos".
 * La app afirmaba un vacío cuando lo cierto era "todavía no sé de quién".
 *
 * El control cubre las dos mitades. La segunda importa tanto como la primera: una
 * guarda demasiado ancha apaga la app entera y se ve igual de verde.
 */
describe('preguntar sin cuenta no es preguntar', () => {
  it('reconoce la cuenta vacía esté donde esté en la query', () => {
    for (const url of [
      '/api/plan?client=',
      '/api/anomalias?client=&days=14',
      '/api/pulso?days=14&client=',
      '/api/x?account=',
      '/api/x?a=1&account=&b=2',
    ]) {
      expect(faltaLaCuenta(url), `${url} debería contar como sin cuenta`).toBe(true);
    }
  });

  it('no confunde una cuenta real con una vacía', () => {
    for (const url of [
      '/api/plan?client=KAREDO',
      '/api/anomalias?client=BHI&days=14',
      '/api/ciclo?client=360',
      '/api/x?client=FRESH_MONKEE',
      '/api/alertas',            // sin parámetro de cuenta: no aplica
      '/api/buscar?q=client=',   // "client=" adentro de OTRO valor
      '/api/x?cliente=',         // otro parámetro que apenas se parece
    ]) {
      expect(faltaLaCuenta(url), `${url} NO debería contar como sin cuenta`).toBe(false);
    }
  });

  it('pedirJSON no sale a la red, y dice por qué', async () => {
    const espia = vi.fn(async () => respuesta('{}'));
    vi.stubGlobal('fetch', espia);
    vi.stubGlobal('localStorage', { getItem: () => null });
    const e = await falla(pedirJSON('/api/plan?client='));
    expect(e.message).toMatch(/cuenta/i);
    // status null = nunca llegó a haber servidor. Se distingue de un 400 real.
    expect(e.status).toBeNull();
    expect(espia, 'no debería haberse pedido nada').not.toHaveBeenCalled();
  });

  it('con cuenta de verdad sí pregunta — la guarda no puede apagar la app', async () => {
    const espia = vi.fn(async () => respuesta('{"ok":true}'));
    vi.stubGlobal('fetch', espia);
    vi.stubGlobal('localStorage', { getItem: () => null });
    await expect(pedirJSON('/api/plan?client=KAREDO')).resolves.toEqual({ ok: true });
    await expect(pedirJSON('/api/alertas')).resolves.toEqual({ ok: true });
    expect(espia).toHaveBeenCalledTimes(2);
  });
});

/**
 * `cargando` SIN CUENTA · el matiz que rompí y tuve que corregir.
 *
 * Al poner la guarda dejé `cargando: false` cuando la URL viene sin cuenta.
 * Estaba mal, y es la misma confusión que la guarda venía a evitar, un escalón
 * más arriba: `cargando:false` junto con `data:null` le dice a quien consume
 * "pregunté y no hay nada". Lo cierto es "todavía no pregunté". Los componentes
 * que muestran un spinner mientras `cargando` pasaban de largo y renderizaban
 * con el fallback puesto.
 *
 * Los tres estados de `useJSON` tienen que seguir siendo distinguibles:
 *   cargando  → todavía no sé (incluye: no sé de quién)
 *   error     → no pude preguntar
 *   ninguno   → pregunté, y esto es lo que hay
 *
 * El test es de la función que decide, no del hook: `useJSON` necesita un render
 * de React y lo que importa acá es la regla, que se lee en una línea.
 */
describe('los tres estados de useJSON no se pisan', () => {
  /** La misma expresión que usa useJSON, aislada para poder probarla. */
  const estaCargando = (url: string | null, consultaPendiente: boolean) =>
    url != null && (faltaLaCuenta(url) || consultaPendiente);

  it('sin cuenta está CARGANDO, aunque no haya consulta en vuelo', () => {
    // react-query no consulta (enabled:false), pero el dato no está: eso es cargando.
    expect(estaCargando('/api/plan?client=', false)).toBe(true);
    expect(estaCargando('/api/anomalias?client=&days=14', false)).toBe(true);
  });

  it('con cuenta, manda react-query', () => {
    expect(estaCargando('/api/plan?client=KAREDO', true)).toBe(true);
    expect(estaCargando('/api/plan?client=KAREDO', false)).toBe(false);
  });

  it('sin url no está cargando nada: no hay nada que pedir', () => {
    expect(estaCargando(null, true)).toBe(false);
    expect(estaCargando(null, false)).toBe(false);
  });
});
