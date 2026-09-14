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

/** Motivo propio, distinto de los dos que devuelve `limite_de_tasa` ('demasiados intentos
 *  fallidos' y 'limite de tasa'). Quien lo reciba sabe que no es que el visitante se pasó:
 *  es que no pudimos contar. Decirle "demasiados intentos" a Andrés cuando la base está
 *  caída lo manda a debuggear el lugar equivocado. */
export const MOTIVO_SIN_VERIFICAR = 'verificacion no disponible';

/** Corto a propósito: ante un hipo de la base queremos degradar el ritmo, no dejar a Andrés
 *  afuera quince minutos. Dos intentos por minuto no le molestan a un humano y le arruinan
 *  la tarde a una fuerza bruta. */
const ESPERA_SIN_VERIFICAR = 30;

export async function verificarLimite(
  supabase: any, clave: string, ruta: string, max = 20, ventanaMin = 15
): Promise<Veredicto> {
  // Sin cliente configurado no hay a quién preguntarle. Es el caso de desarrollo local
  // sin Supabase; en producción `supabase` nunca es null salvo que falten las variables,
  // y ese agujero se tapa en el arranque, no acá.
  if (!supabase) return { permitido: true };
  try {
    const { data, error } = await supabase.rpc('limite_de_tasa', {
      p_clave: clave, p_ruta: ruta, p_max: max, p_ventana: `${ventanaMin} minutes`
    });
    if (error) return sinVerificar(ruta, error.message || String(error));
    return {
      permitido: !!data?.permitido,
      motivo: data?.motivo,
      esperar: data?.esperar_segundos
    };
  } catch (e: any) {
    return sinVerificar(ruta, e?.message || String(e));
  }
}

/**
 * Falla CERRADO, y el motivo es el que decide todo lo demás.
 *
 * El argumento de siempre para fallar abierto —"si la base está caída la app no sirve
 * igual, cerrar no agrega seguridad"— acá es falso, y se puede comprobar leyendo
 * `src/server/auth/routes.ts`: `/login` compara contra `process.env.APP_ACCESS_TOKEN` y
 * **no toca Supabase**. O sea que con la base caída el login sigue andando perfecto y lo
 * único que se apaga es el contador. Fallar abierto ahí no es tolerancia a fallas: es
 * regalar intentos infinitos, sin registro, contra la única contraseña que abre los datos
 * de las cuatro cuentas.
 *
 * Y lo peor es que el atacante no tiene que esperar la caída: el modo de bypass clásico de
 * un limitador es voltear su almacén de contadores para desactivarlo. Fallar abierto
 * convierte "romper la base" en "romper la autenticación".
 *
 * Lo que cuesta cerrar: durante una caída de Supabase, Andrés entra a dos intentos por
 * minuto. Barato, porque todas las rutas de datos leen de Supabase — con la base caída ya
 * no iba a ver nada adentro.
 *
 * El log va por `error` a propósito. Antes esto se tragaba la excepción en silencio y un
 * limitador apagado se ve idéntico a uno que funciona: nadie se entera hasta que alguien
 * entra.
 */
function sinVerificar(ruta: string, detalle: string): Veredicto {
  console.error(
    `[limite] NO SE PUDO VERIFICAR el límite de ${ruta}: ${detalle}. ` +
    `Se cierra la puerta (espera ${ESPERA_SIN_VERIFICAR}s). Si esto se repite, el limitador ` +
    `está ciego y hay que mirar la base antes que cualquier otra cosa.`
  );
  return { permitido: false, motivo: MOTIVO_SIN_VERIFICAR, esperar: ESPERA_SIN_VERIFICAR };
}

export async function registrarIntento(
  supabase: any, clave: string, ruta: string, exito: boolean, detalle?: string
): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.rpc('registrar_intento', {
      p_clave: clave, p_ruta: ruta, p_exito: exito, p_detalle: detalle || null
    });
    if (error) throw error;
  } catch (e: any) {
    // Sigue sin romper el pedido —un login bueno no puede fallar porque no se pudo
    // anotar— pero ya no en silencio. Un intento fallido que no se escribe es un intento
    // que `limite_de_tasa` no cuenta: con los fallos perdiéndose, `n_fallos` queda en cero
    // y el bloqueo progresivo nunca arranca. El limitador se ve sano y no frena nada.
    console.error(
      `[limite] no se pudo registrar el intento ${exito ? 'exitoso' : 'FALLIDO'} en ${ruta}: ` +
      `${e?.message || String(e)}. Mientras esto pase, el bloqueo progresivo está ciego.`
    );
  }
}
