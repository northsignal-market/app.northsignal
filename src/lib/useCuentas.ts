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
    nombreCliente: (acc: string) => cuentas.find(c => c.account === acc)?.nombre_cliente || acc,
  };
}
