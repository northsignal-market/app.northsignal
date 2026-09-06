/**
 * Cliente de Notion con cola.
 *
 * Notion limita a 3 requests/segundo por conexión, y el límite del
 * workspace es compartido entre TODAS las conexiones: la app y la tarea de
 * Cowork escriben contra el mismo presupuesto. El 6 sep tres escrituras se
 * bloquearon con 429 mientras las dos corrían a la vez.
 *
 * Reglas (developers.notion.com/reference/request-limits):
 *  - cola a 3 rps con p-queue: nunca se supera el promedio
 *  - reintentar SOLO 429 y 529, respetando Retry-After, con backoff y jitter
 *  - 500-504 solo si la operación es idempotente (GET): las escrituras no
 *  - límite de reintentos; el error final se registra, no se traga
 */
import { Client } from '@notionhq/client';
import PQueue from 'p-queue';

const notionKey = process.env.NOTION_API_KEY;
const raw = notionKey ? new Client({ auth: notionKey }) : null;

const queue = new PQueue({ intervalCap: 3, interval: 1000, carryoverConcurrencyCount: true, concurrency: 3 });
const MAX_RETRIES = 4;

async function conReintentos<T>(fn: () => Promise<T>, idempotente: boolean, etiqueta: string): Promise<T> {
  let intento = 0;
  while (true) {
    try {
      return await queue.add(fn) as T;
    } catch (e: any) {
      const status: number | undefined = e?.status ?? e?.response?.status;
      const code: string | undefined = e?.code;
      const retryAfter = Number(e?.headers?.['retry-after'] ?? e?.response?.headers?.['retry-after'] ?? 0);
      const esRateLimit = status === 429 || status === 529 || code === 'rate_limited' || code === 'service_overload';
      const esServidor = status !== undefined && status >= 500 && status <= 504;
      const reintentar = esRateLimit || (esServidor && idempotente);
      intento++;
      if (!reintentar || intento > MAX_RETRIES) {
        console.error(`[notion] ${etiqueta} falló tras ${intento} intento(s): ${status ?? code ?? e?.message}`);
        throw e;
      }
      const base = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** intento, 16000);
      await new Promise(r => setTimeout(r, base + Math.random() * 300));
    }
  }
}

/** Proxy sobre el cliente: cada llamada pasa por la cola y los reintentos. */
function envolver(cliente: Client): Client {
  const idempotentes = new Set(['retrieve', 'list', 'query', 'search']);
  const wrap = (obj: any, ruta: string[]): any => new Proxy(obj, {
    get(target, prop: string) {
      const v = target[prop];
      if (typeof v === 'function') {
        return (...args: any[]) => conReintentos(() => v.apply(target, args), idempotentes.has(prop), [...ruta, prop].join('.'));
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) return wrap(v, [...ruta, prop]);
      return v;
    }
  });
  return wrap(cliente, ['notion']);
}

export const notion: Client | null = raw ? envolver(raw) : null;
