/**
 * Límite de tasa contra Postgres.
 *
 * Por qué no en memoria: el `Map` que había acá no persiste entre instancias de
 * Vercel. Cada arranque en frío lo reinicia, y dos instancias tienen mapas
 * distintos. Contra fuerza bruta eso es decorativo: basta con caer en instancias
 * distintas para nunca acumular intentos.
 *
 * Por qué Postgres y no Redis: el consejo estándar es Redis porque supone volumen.
 * Nosotros tenemos 6 conexiones de 60 y un usuario humano. Una fila por intento no
 * se nota, y evita sumar un servicio más que puede caerse.
 *
 * Esto es la segunda capa. La primera es el WAF de Vercel, que corta en el borde
 * antes de que la función corra. Hacen falta las dos porque los contadores del WAF
 * se cuentan por región, y un cliente que golpea varias a la vez puede pasar el
 * límite en agregado.
 */
import type { Request } from 'express';

export function ipDe(req: Request): string {
  // Vercel pone la IP real acá. req.ip sería la del borde.
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'desconocida';
}

export interface Veredicto { permitido: boolean; motivo?: string; esperar?: number }

export async function verificarLimite(
  supabase: any, clave: string, ruta: string, max = 20, ventanaMin = 15
): Promise<Veredicto> {
  if (!supabase) return { permitido: true };
  try {
    const { data, error } = await supabase.rpc('limite_de_tasa', {
      p_clave: clave, p_ruta: ruta, p_max: max, p_ventana: `${ventanaMin} minutes`
    });
    if (error) return { permitido: true };   // si la base falla, no se bloquea al usuario
    return {
      permitido: !!data?.permitido,
      motivo: data?.motivo,
      esperar: data?.esperar_segundos
    };
  } catch { return { permitido: true }; }
}

export async function registrarIntento(
  supabase: any, clave: string, ruta: string, exito: boolean, detalle?: string
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc('registrar_intento', {
      p_clave: clave, p_ruta: ruta, p_exito: exito, p_detalle: detalle || null
    });
  } catch { /* registrar no puede romper el pedido */ }
}
