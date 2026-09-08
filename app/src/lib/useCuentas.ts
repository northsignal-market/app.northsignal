/**
 * Las cuentas activas, desde la base. Un solo lugar.
 *
 * Antes cada componente tenía su propia lista fija ['KAREDO','BHI','360'], y
 * cuando entró Fresh Monkee hubo que corregirlas una por una según iban
 * apareciendo: el selector, la Bandeja, el asistente. Con este hook, sumar un
 * cliente es una fila en `cuentas` y nada más.
 */
import { useEffect, useState } from 'react';

export interface CuentaActiva {
  account: string;
  nombre_cliente?: string | null;
  moneda?: string | null;
  perfil_analisis?: string | null;
  presupuesto_diario?: number | null;
  zona_horaria?: string | null;
  locale?: string | null;
}

let _cache: CuentaActiva[] | null = null;
let _enVuelo: Promise<CuentaActiva[]> | null = null;

async function traer(): Promise<CuentaActiva[]> {
  if (_cache) return _cache;
  if (!_enVuelo) {
    _enVuelo = fetch('/api/cuentas', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then((d: any) => { _cache = Array.isArray(d) ? d : []; return _cache!; })
      .catch(() => [])
      .finally(() => { _enVuelo = null; });
  }
  return _enVuelo;
}

// SIN respaldo cableado. Antes eran las tres históricas "para que nada quede en
// blanco", y el resultado fue que Fresh Monkee desapareció del selector durante
// días sin que nada avisara: la lista se veía completa y no lo estaba.
// Mientras carga, vacío; si falla, vacío y la pantalla lo dice.

export function useCuentas() {
  const [cuentas, setCuentas] = useState<CuentaActiva[]>(_cache || []);
  useEffect(() => { let vivo = true; traer().then(c => { if (vivo) setCuentas(c); }); return () => { vivo = false; }; }, []);
  const nombres = cuentas.map(c => c.account);
  return {
    cuentas,
    nombres,
    moneda: (acc: string) => cuentas.find(c => c.account === acc)?.moneda || (acc === 'KAREDO' ? 'EUR' : acc === 'FRESH_MONKEE' ? 'USD' : 'CLP'),
    perfil: (acc: string) => cuentas.find(c => c.account === acc)?.perfil_analisis || 'negocio_unico',
    presupuesto: (acc: string) => cuentas.find(c => c.account === acc)?.presupuesto_diario ?? null,
  /** Zona horaria de la cuenta. Fresh Monkee opera en Nueva York y Karedo en Berlín:
      mostrar todo en Santiago corre las fechas y hace ilegible un análisis por horario. */
  zona: (acc: string) => cuentas.find(c => c.account === acc)?.zona_horaria
    || (acc === 'KAREDO' ? 'Europe/Berlin' : acc === 'FRESH_MONKEE' ? 'America/New_York' : 'America/Santiago'),
  /** Locale para formatear fechas y números de esa cuenta. */
  locale: (acc: string) => cuentas.find(c => c.account === acc)?.locale
    || (acc === 'KAREDO' ? 'de-DE' : acc === 'FRESH_MONKEE' ? 'en-US' : 'es-CL'),
    nombreCliente: (acc: string) => cuentas.find(c => c.account === acc)?.nombre_cliente || acc,
  };
}

/**
 * Aviso al usuario, sin bloquear la pantalla.
 *
 * Reemplaza a alert(), que congela la interfaz, no se puede estilar, y en algunos
 * navegadores se silencia sin que el usuario se entere de que hubo un error.
 */
export function avisar(mensaje: string, tipo: 'ok' | 'error' | 'info' = 'ok', titulo?: string) {
  try {
    // Import diferido para no acoplar el hook al store.
    const store = (window as any).__northsignalStore;
    if (store?.getState) { store.getState().addNotification({ message: mensaje, tipo, title: titulo }); return; }
  } catch { /* cae al alert de abajo */ }
  // Respaldo: si el store no está montado todavía, mejor un alert que un silencio.
  if (typeof window !== 'undefined') window.alert(mensaje);
}

/**
 * La cuenta activa, resuelta contra las cuentas reales.
 *
 * Antes cada sección tenía su propio valor por defecto cableado: Briefs, Clientes,
 * Hoy y Semana caían en '360'; Cuenta caía en 'KAREDO'; Ayuda decía 'Karedo'. Si no
 * había cuenta elegida, cada pantalla mostraba una cuenta distinta y el header no
 * coincidía con lo que se veía abajo.
 *
 * Ahora hay un solo criterio: la elegida si existe de verdad, y si no la primera
 * de la lista. Devuelve null mientras las cuentas cargan, para que una pantalla
 * pueda esperar en vez de mostrar datos de la cuenta equivocada.
 */
export function useCuentaActiva(seleccionada?: string | null): string | null {
  const { nombres, cuentas } = useCuentas();
  if (!cuentas.length) return null;
  if (seleccionada && nombres.includes(seleccionada)) return seleccionada;
  return nombres[0] ?? null;
}
