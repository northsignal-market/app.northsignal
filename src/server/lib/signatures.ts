/**
 * Verificacion de firmas de webhooks, en tiempo constante.
 *
 * Por que importa el tiempo constante: comparar dos secretos con !== corta al
 * primer caracter distinto. El tiempo que tarda la respuesta revela cuantos
 * caracteres acerto quien prueba, y con eso el secreto se adivina de a uno.
 * timingSafeEqual siempre tarda lo mismo.
 */
import * as crypto from 'crypto';

export function verifyHmacSha256(secret: string, signature: string, payload: Buffer): boolean {
  if (!secret || !signature || !payload) return false;
  try {
    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const hashBuf = Buffer.from(hash, 'utf8');
    if (sigBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, hashBuf);
  } catch (e) {
    return false;
  }
}

/** Compara dos cadenas en tiempo constante. Para tokens de tipo Bearer. */
export function comparacionSegura(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'utf8'), bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}
