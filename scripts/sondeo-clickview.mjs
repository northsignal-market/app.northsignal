/**
 * ¿Puede el token leer click_view?  SOLO LECTURA.
 *
 * click_view es el ÚNICO lugar donde Google dice qué keyword produjo un gclid.
 * Sin él, "de qué keyword vino este lead" no se puede contestar: se puede
 * inventar, que es peor. Este sistema ya se comió un "no tenés acceso" con
 * Keyword Planner (lección en CLAUDE.md), así que se pregunta antes de diseñar.
 *
 * Dos límites propios de click_view, que también se verifican acá:
 *   - exige UN SOLO DÍA por consulta (no acepta rangos)
 *   - guarda alrededor de 90 días hacia atrás
 */
import 'dotenv/config';
import { gadsSearch } from '../src/server/lib/gads.ts';

const MCC = (process.env.GADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');
if (!MCC) { console.error('Falta GADS_LOGIN_CUSTOMER_ID.'); process.exit(1); }

const hijos = await gadsSearch(MCC, `
  SELECT customer_client.id, customer_client.descriptive_name, customer_client.status, customer_client.manager
  FROM customer_client WHERE customer_client.level <= 2`);
const cuentas = hijos.map(r => r.customerClient).filter(c => c && !c.manager && c.status === 'ENABLED');
const buscada = (process.argv[2] || 'bhi').toLowerCase();
const cta = cuentas.find(c => String(c.descriptiveName).toLowerCase().includes(buscada));
if (!cta) { console.log('No encontré', buscada, '· hay:', cuentas.map(c => c.descriptiveName).join(', ')); process.exit(0); }
console.log(`\nCuenta: ${cta.descriptiveName} (${cta.id})`);

const dia = process.argv[3] || new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);

const pruebas = [
  ['click_view con keyword', `SELECT click_view.gclid, click_view.keyword_info.text, click_view.keyword,
                                     campaign.name, ad_group.name
                              FROM click_view WHERE segments.date = '${dia}' LIMIT 5`],
  ['click_view mínimo',      `SELECT click_view.gclid, campaign.name
                              FROM click_view WHERE segments.date = '${dia}' LIMIT 3`],
  ['rango en vez de un día', `SELECT click_view.gclid FROM click_view
                              WHERE segments.date BETWEEN '${dia}' AND '${dia}' LIMIT 3`],
];

for (const [nombre, gaql] of pruebas) {
  try {
    const r = await gadsSearch(String(cta.id), gaql);
    console.log(`\n[OK] ${nombre} · ${dia} → ${r.length} filas`);
    if (r.length) console.log(JSON.stringify(r[0], null, 1));
  } catch (e) {
    console.log(`\n[FALLA] ${nombre}: ${String(e?.message || e).slice(0, 300)}`);
  }
}
