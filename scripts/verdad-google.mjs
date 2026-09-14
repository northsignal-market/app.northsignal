#!/usr/bin/env -S npx tsx
/**
 * LA VERDAD DE GOOGLE · lo que la API dice, para todas las cuentas del MCC.
 *
 * Por qué existe
 * --------------
 * Cuando un número de la app no coincide con Google, hay tres sospechosos y se
 * ven igual: la extracción no trajo el dato, la vista lo filtró, o la pantalla lo
 * leyó mal. Este script fija el primer punto de la cadena —qué dice Google— para
 * que los otros dos se puedan descartar contra algo firme en vez de contra la
 * interfaz de Google Ads, que hay que leer a mano cuenta por cuenta.
 *
 * NO toca la base ni Notion: solo necesita las credenciales `GADS_*` del .env, y
 * hace puros SELECT de GAQL. Nunca escribe en Google Ads.
 *
 * Uso
 * ---
 *   npx tsx scripts/verdad-google.mjs                       # últimos 13 días cerrados
 *   npx tsx scripts/verdad-google.mjs 2026-09-01 2026-09-13
 *
 * Desglosa por estado de campaña a propósito: el gasto que NO está en ENABLED es
 * exactamente el que `v_serie_diaria` borraba del reporte al cliente antes del
 * arreglo de §3.6 (`campaign.status` no está segmentado por fecha: Google estampa
 * el estado de HOY en la fila de cada día).
 */
import 'dotenv/config';
import { gadsSearch } from '../src/server/lib/gads.ts';

const MCC = (process.env.GADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');
if (!MCC) { console.error('Falta GADS_LOGIN_CUSTOMER_ID en el .env.'); process.exit(1); }

const hoy = new Date();
const ayer = new Date(hoy.getTime() - 864e5);
const iso = (d) => d.toISOString().slice(0, 10);
const DESDE = process.argv[2] || iso(new Date(ayer.getTime() - 12 * 864e5));
const HASTA = process.argv[3] || iso(ayer);

const fmt = (n, d = 2) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

console.log(`\nAPI de Google Ads · ${DESDE} a ${HASTA}\n`);

// Las cuentas se le piden a Google: no se adivina ningún CID.
const hijos = await gadsSearch(MCC, `
  SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
         customer_client.time_zone, customer_client.status, customer_client.manager
  FROM customer_client WHERE customer_client.level <= 2`);

const cuentas = hijos.map(r => r.customerClient)
  .filter(c => c && !c.manager && c.status === 'ENABLED')
  .sort((a, b) => String(a.descriptiveName).localeCompare(String(b.descriptiveName)));

console.log(`Cuentas activas bajo el MCC ${MCC}: ${cuentas.length}\n`);

for (const c of cuentas) {
  const cid = String(c.id);
  let filas;
  try {
    // Sin filtro de estado: es lo que suma la pantalla de Vista general de Google.
    filas = await gadsSearch(cid, `
      SELECT campaign.name, campaign.status, metrics.cost_micros, metrics.clicks, metrics.conversions
      FROM campaign WHERE segments.date BETWEEN '${DESDE}' AND '${HASTA}'`, { loginCid: MCC });
  } catch (e) {
    console.log(`── ${c.descriptiveName} (cid ${cid}) · NO SE PUDO CONSULTAR: ${e?.message || e}\n`);
    continue;
  }

  let costo = 0, clics = 0, conv = 0;
  const porEstado = {};
  for (const f of filas) {
    const cm = Number(f.metrics?.costMicros || 0) / 1e6;
    costo += cm; clics += Number(f.metrics?.clicks || 0); conv += Number(f.metrics?.conversions || 0);
    const st = f.campaign?.status || '?';
    porEstado[st] = porEstado[st] || { costo: 0, campanas: new Set() };
    porEstado[st].costo += cm;
    porEstado[st].campanas.add(f.campaign?.name);
  }

  console.log(`── ${c.descriptiveName}   cid ${cid} · ${c.currencyCode} · ${c.timeZone}`);
  console.log(`   TOTAL: ${fmt(costo)} ${c.currencyCode}  ·  ${clics} clics  ·  ${fmt(conv)} conv`);
  for (const [st, v] of Object.entries(porEstado).sort((a, b) => b[1].costo - a[1].costo)) {
    const aviso = st === 'ENABLED' ? '' : '  <<< fuera de ENABLED';
    console.log(`     ${st.padEnd(9)} ${fmt(v.costo).padStart(12)} ${c.currencyCode}  ·  ${v.campanas.size} campaña(s)${aviso}`);
  }
  console.log();
}

console.log('Para comparar contra la app, corré el SQL de docs/ o pegá estos números\n' +
            'en la consulta 2 del diagnóstico. La diferencia, si existe, está entre\n' +
            'campaign_daily y esto.\n');
