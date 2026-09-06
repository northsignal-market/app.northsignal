/**
 * Sesiones sin estado.
 *
 * Un Map en memoria no sobrevive en serverless: cada request puede caer en
 * una instancia distinta con el Map vacío, y el login duraría un segundo.
 * El token lleva su propia expiración y una firma HMAC con SESSION_SECRET.
 * Verificar es recalcular la firma: no hace falta guardar nada.
 *
 * Formato: <expiresMs>.<nonce>.<hmac>
 */
import * as crypto from 'crypto';

const SECRET = () => process.env.SESSION_SECRET || process.env.APP_ACCESS_TOKEN || '';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET()).update(payload).digest('hex');
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${expires}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !SECRET()) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expires, nonce, sig] = parts;
  const expected = sign(`${expires}.${nonce}`);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(expires) > Date.now();
}
