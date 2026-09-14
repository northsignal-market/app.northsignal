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
import { pedirJSON, motivoFallo, FalloRed } from './red';

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
