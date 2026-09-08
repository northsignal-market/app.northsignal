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

/** Respaldo mientras carga: las tres históricas, para que nada quede en blanco. */
const RESPALDO = ['KAREDO', 'BHI', '360'];

export function useCuentas() {
  const [cuentas, setCuentas] = useState<CuentaActiva[]>(_cache || []);
  useEffect(() => { let vivo = true; traer().then(c => { if (vivo) setCuentas(c); }); return () => { vivo = false; }; }, []);
  const nombres = cuentas.length ? cuentas.map(c => c.account) : RESPALDO;
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
