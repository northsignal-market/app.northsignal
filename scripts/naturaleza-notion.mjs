#!/usr/bin/env node
/**
 * NATURALEZA · informe y backfill de la base Accionables de Notion.
 *
 * Por qué existe
 * --------------
 * `v_tasa_acierto` —la métrica con la que el sistema se califica a sí mismo—
 * buckea por igualdad EXACTA:
 *
 *     naturaleza = 'Observacion'                     -> acierto_observaciones_pct
 *     naturaleza IN ('Inferencia','Hipotesis')       -> acierto_inferencias_pct
 *
 * Sin tildes. Los escritores de la app (pulso diario, anomalías) escriben así
 * (`server.ts`). **Pero los prompts de los agentes de Cowork dicen
 * "Naturaleza = Observación", con tilde**, y los dos corpus (`prompts/` y
 * `docs/prompts/out/`) mezclan las dos grafías. Un `select` de Notion crea la
 * opción nueva cuando le mandás una variante, así que pueden convivir
 * "Observacion" y "Observación" como opciones distintas — y la segunda **no cae
 * en ningún bucket**: el accionable desaparece de las dos tasas, sin error y sin
 * fila. Es el mismo modo de falla que el valor 'Dato'.
 *
 * Este script NO adivina. Primero cuenta lo que hay; recién después, y solo si
 * se lo pedís explícitamente, escribe.
 *
 * Uso
 * ---
 *   node scripts/naturaleza-notion.mjs                      # informe, no escribe
 *   node scripts/naturaleza-notion.mjs --normalizar         # dry-run del arreglo de tildes
 *   node scripts/naturaleza-notion.mjs --normalizar --aplicar
 *   node scripts/naturaleza-notion.mjs --completar=Observacion --aplicar
 *
 * `--normalizar` mapea las variantes con tilde al literal que la métrica lee.
 * Eso NO es inventar: es la misma clasificación, escrita como el consumidor la
 * espera.
 *
 * `--completar=<valor>` le pone `<valor>` a los que NO tienen nada. **Eso sí es
 * una decisión**, y por eso hay que nombrar el valor a mano: completar todo como
 * 'Observacion' es fabricar una clasificación que nadie hizo y meterla en la
 * métrica. Lo pide el flag para que quede en el historial de la terminal quién
 * lo decidió.
 *
 * Variables: NOTION_API_KEY (obligatoria) y NOTION_BASE_URL (opcional, para
 * apuntar a un Notion de mentira y probar el script sin tocar datos reales).
 */
import { Client } from '@notionhq/client';
import 'dotenv/config';

// El mismo id y la misma variable que usa la app (notionSchema.ts). No se importa
// ese módulo a propósito: lee process.env al evaluarse y arrastra media app.
const ACCIONABLES_DB = process.env.NOTION_ACCIONABLES_DB_ID || '373cde2b-d8c2-47e3-bc89-56c7d7c7e568';

// Lo que la métrica sabe leer. Cualquier otra cosa cae afuera de los dos buckets.
const CANONICOS = ['Observacion', 'Inferencia', 'Hipotesis'];
// 'Dato' existe en el enum de la app pero no cae en ningún bucket: se reporta aparte.
const FUERA_DE_METRICA = ['Dato'];

const sinTilde = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** El canónico al que corresponde un valor suelto, o null si no se puede saber. */
function canonicoDe(valor) {
  if (!valor) return null;
  const plano = sinTilde(valor).trim().toLowerCase();
  return CANONICOS.find(c => sinTilde(c).toLowerCase() === plano) || null;
}

function parsearArgs(argv) {
  const args = { informe: true, normalizar: false, aplicar: false, completar: null };
  for (const a of argv.slice(2)) {
    if (a === '--normalizar') args.normalizar = true;
    else if (a === '--aplicar') args.aplicar = true;
    else if (a.startsWith('--completar=')) args.completar = a.slice('--completar='.length);
    else { console.error(`Argumento desconocido: ${a}`); process.exit(2); }
  }
  if (args.completar && !CANONICOS.includes(args.completar)) {
    console.error(`--completar solo acepta ${CANONICOS.join(' | ')}. Recibí "${args.completar}".`);
    console.error('Si querés otro valor, es una decisión de producto: cambiá CANONICOS a conciencia.');
    process.exit(2);
  }
  return args;
}

async function traerTodos(notion, dbId) {
  const paginas = [];
  let cursor;
  do {
    const r = await notion.databases.query({ database_id: dbId, page_size: 100, start_cursor: cursor });
    paginas.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return paginas;
}

async function main() {
  const args = parsearArgs(process.argv);

  if (!process.env.NOTION_API_KEY) {
    console.error('Falta NOTION_API_KEY. Sin eso no hay nada que contar.');
    process.exit(1);
  }
  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
    ...(process.env.NOTION_BASE_URL ? { baseUrl: process.env.NOTION_BASE_URL } : {}),
  });

  const paginas = await traerTodos(notion, ACCIONABLES_DB);

  // ── Informe. Siempre corre, aunque después se escriba. ──
  const porValor = new Map();
  for (const p of paginas) {
    const v = p.properties?.Naturaleza?.select?.name ?? null;
    const clave = v === null ? '(sin valor)' : v;
    if (!porValor.has(clave)) porValor.set(clave, []);
    porValor.get(clave).push(p);
  }

  console.log(`\nAccionables leídos: ${paginas.length}\n`);
  console.log('Naturaleza, por valor EXACTO tal como está en Notion:');
  console.log('  (el código de escape muestra la tilde: una grafía distinta es un valor distinto)\n');
  const filas = [...porValor.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [valor, pgs] of filas) {
    const canon = canonicoDe(valor);
    let veredicto;
    if (valor === '(sin valor)') veredicto = 'FUERA de las dos tasas (no clasificado)';
    else if (CANONICOS.includes(valor)) veredicto = 'OK: la métrica lo lee';
    else if (FUERA_DE_METRICA.includes(valor)) veredicto = 'FUERA de las dos tasas (valor sin bucket)';
    else if (canon) veredicto = `FUERA de las dos tasas -> se normaliza a "${canon}"`;
    else veredicto = 'FUERA de las dos tasas (valor desconocido, NO se toca)';
    const escapado = valor === '(sin valor)' ? valor : JSON.stringify(valor);
    console.log(`  ${String(pgs.length).padStart(4)}  ${escapado.padEnd(20)} ${veredicto}`);
  }

  const invisibles = filas
    .filter(([v]) => v === '(sin valor)' || (!CANONICOS.includes(v)))
    .reduce((n, [, pgs]) => n + pgs.length, 0);
  console.log(`\n  -> ${invisibles} de ${paginas.length} no entran en ninguna de las dos tasas de acierto.`);

  // ── Escrituras, solo si se pidieron ──
  const aEscribir = [];

  if (args.normalizar) {
    for (const [valor, pgs] of filas) {
      if (valor === '(sin valor)' || CANONICOS.includes(valor)) continue;
      const canon = canonicoDe(valor);
      if (!canon) continue;   // desconocido: no se adivina
      for (const p of pgs) aEscribir.push({ id: p.id, de: valor, a: canon, motivo: 'normalizar' });
    }
  }

  if (args.completar) {
    for (const p of porValor.get('(sin valor)') || []) {
      aEscribir.push({ id: p.id, de: '(sin valor)', a: args.completar, motivo: 'completar' });
    }
  }

  if (!args.normalizar && !args.completar) {
    console.log('\nSolo informe. Para arreglar las tildes: --normalizar (agregá --aplicar para escribir).');
    console.log('Para completar los vacíos hay que nombrar el valor: --completar=Observacion');
    console.log('Ojo: completar vacíos es DECIDIR una clasificación que nadie hizo.\n');
    return;
  }

  console.log(`\nCambios a hacer: ${aEscribir.length}`);
  const resumen = new Map();
  for (const c of aEscribir) {
    const k = `${c.de} -> ${c.a} (${c.motivo})`;
    resumen.set(k, (resumen.get(k) || 0) + 1);
  }
  for (const [k, n] of resumen) console.log(`  ${String(n).padStart(4)}  ${k}`);

  if (!args.aplicar) {
    console.log('\nDRY-RUN: no se escribió nada. Agregá --aplicar para hacerlo.\n');
    return;
  }

  console.log('\nEscribiendo…');
  let ok = 0;
  const fallos = [];
  for (const c of aEscribir) {
    try {
      await notion.pages.update({ page_id: c.id, properties: { Naturaleza: { select: { name: c.a } } } });
      ok++;
    } catch (e) {
      fallos.push({ id: c.id, error: e?.message || String(e) });
    }
    // Notion limita a 3 req/s. Sin esto la corrida muere a mitad de camino y deja
    // la base a medio normalizar, que es peor que no haber empezado.
    await new Promise(r => setTimeout(r, 350));
  }
  console.log(`\nListo: ${ok} escritos, ${fallos.length} fallaron.`);
  if (fallos.length) {
    console.log('Los que fallaron (se pueden reintentar corriendo el script de nuevo):');
    for (const f of fallos.slice(0, 20)) console.log(`  ${f.id}: ${f.error}`);
  }
}

main().catch(e => { console.error('\nFalló:', e?.message || e); process.exit(1); });
