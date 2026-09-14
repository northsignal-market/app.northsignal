/**
 * RED · una sola forma de pedir JSON, y una sola forma de contar que falló.
 * ----------------------------------------------------------------------------
 * Vive en lib/ y no en components/ui.tsx porque `useCuentas` también lo necesita
 * y un hook de lib importando un módulo de componentes cierra un ciclo.
 *
 * El problema que resuelve: `fetchJSON` devuelve el fallback ante un 401, un
 * 500, un HTML de error o la red caída, y quien consume no puede distinguir
 * "no hay nada" de "no se pudo preguntar". Los dos casos se ven igual — una
 * lista vacía — y llevan a conclusiones opuestas: el primero es un veredicto,
 * el segundo es un hueco. Acá el hueco viene firmado con su causa.
 */

/** Falla de una consulta, con el motivo ya escrito para mostrarle a Andrés.
 *  `status` es null cuando la petición nunca llegó al servidor (red caída). */
export class FalloRed extends Error {
  constructor(public readonly status: number | null, mensaje: string) {
    super(mensaje);
    this.name = 'FalloRed';
  }
}

/** El motivo, en una frase que se puede imprimir tal cual en pantalla. */
export function motivoFallo(e: unknown): string {
  if (e instanceof FalloRed) return e.message;
  const m = (e as any)?.message;
  return m ? `Falló la consulta: ${m}` : 'Falló la consulta por un motivo desconocido.';
}

/** fetch → JSON que LANZA cuando algo sale mal, en vez de tapar la falla con un
 *  valor plausible. Es la base de `fetchJSON` (que sigue devolviendo fallback)
 *  y de `useJSON` (que ahora expone el error además del fallback). */
/** Una URL que lleva `client=` (o `account=`) VACÍO no es una consulta: es una
 *  pregunta mal formada. Se da mientras `/api/cuentas` carga, porque hasta que
 *  llega la lista la cuenta activa es '' —el sistema no inventa una cuenta, y eso
 *  está bien— pero preguntar igual sí era un error. */
export function faltaLaCuenta(url: string): boolean {
  return /[?&](client|account)=(&|$)/.test(url);
}

export async function pedirJSON<T>(url: string, init?: RequestInit): Promise<T> {
  // Preguntar sin cuenta devolvía 400 y ese 400 llegaba a la pantalla como un
  // vacío: nueve paneles afirmando "no hay datos" cuando lo cierto era "todavía
  // no sé de quién". Se corta acá, antes de la red, y el hueco viene firmado.
  if (faltaLaCuenta(url)) throw new FalloRed(null, 'Todavía no hay cuenta seleccionada.');
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  let r: Response;
  try {
    r = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    // Sin respuesta no hay status: el servidor nunca contestó.
    throw new FalloRed(null, 'Sin conexión con el servidor.');
  }
  if (r.status === 401) throw new FalloRed(401, 'La sesión caducó: volvé a entrar.');
  if (!r.ok) throw new FalloRed(r.status, `El servidor respondió ${r.status}.`);
  // Un HTML de error con status 200 es el caso que más engaña: parece éxito.
  if (!r.headers.get('content-type')?.includes('application/json')) {
    throw new FalloRed(r.status, 'El servidor no respondió JSON.');
  }
  try {
    return (await r.json()) as T;
  } catch {
    throw new FalloRed(r.status, 'La respuesta llegó incompleta o rota.');
  }
}
