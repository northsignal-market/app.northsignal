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
