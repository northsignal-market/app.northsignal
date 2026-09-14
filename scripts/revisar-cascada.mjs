#!/usr/bin/env node
/**
 * REVISAR CASCADA · el control de la familia de bugs del 13-14 de septiembre
 * ----------------------------------------------------------------------------
 * En un solo día, el mismo defecto apareció TRES veces con tres caras distintas:
 *
 *   1. `.glass-dense { position: relative }` anulaba el `fixed` del sidebar y el
 *      `absolute` de los globos. Síntoma: títulos truncados a la mitad con
 *      espacio de sobra al lado.
 *   2. `select-none` en el contenedor raíz impedía seleccionar texto en toda la
 *      app. Síntoma: "no puedo copiar nada".
 *   3. La animación de entrada terminaba en `transform: translateY(0)` con
 *      `fill-mode: both`, convirtiendo 28 contenedores en containing block
 *      permanente. Síntoma: un tooltip pintado debajo del bloque siguiente.
 *
 * Las tres son LA MISMA cosa: una declaración global que gana una pelea que
 * nadie sabía que estaba dando, y que se manifiesta lejos de donde vive. Ninguna
 * herramienta estándar las agarra, porque cada una es CSS válido y TypeScript
 * válido; el problema es la interacción.
 *
 * POR QUÉ ES UN SCRIPT Y NO UNA REGLA DE STYLELINT: stylelint razona sobre la
 * hoja de estilos sola. Acá hace falta cruzar la hoja con el JSX —qué clase
 * propia se usa junto a qué utilidad de Tailwind— y con el CSS compilado, que es
 * el único lugar donde se ve quién quedó en qué capa.
 *
 *     node scripts/revisar-cascada.mjs
 *
 * Sale con código 1 si encuentra una colisión activa. Las trampas armadas (una
 * clase riesgosa que hoy nadie combina mal) se informan pero no rompen el build:
 * son deuda, no incendio.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// El CSS se puede pasar por argumento para poder MATAR AL MUTANTE: un control
// que nunca se vio fallar no es un control. Con esto se corre contra una versión
// vieja del archivo y se comprueba que los bugs de ayer todavía lo disparan:
//   git show HEAD~5:src/index.css > /tmp/viejo.css && node scripts/revisar-cascada.mjs /tmp/viejo.css
const CSS = process.argv[2] || join(RAIZ, 'src/index.css');

/** Las propiedades donde una pelea entre CSS propio y Tailwind cambia el layout.
 *  No están todas a propósito: `color` o `font-size` pierden y no pasa nada
 *  grave. Estas otras mueven cajas, y una caja movida se lee como un bug de
 *  maquetación en un archivo que no tiene la culpa. */
const EN_DISPUTA = {
  position: [/\b(static|fixed|absolute|relative|sticky)\b/],
  display: [/\b(block|inline-block|flex|inline-flex|grid|inline-grid|hidden|contents)\b/],
  overflow: [/\boverflow(-x|-y)?-(auto|hidden|visible|scroll|clip)\b/],
  'border-radius': [/\brounded(-[a-z]+)?(-(none|sm|md|lg|xl|2xl|3xl|full))?\b/],
  width: [/\bw-\S+/], height: [/\bh-\S+/],
  opacity: [/\bopacity-\d+\b/],
  'z-index': [/\bz-\d+\b/],
};

// ── 1. Qué clases propias declaran algo en disputa, y fuera de @layer ────────
const css = readFileSync(CSS, 'utf8');
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Marca los tramos que SÍ están dentro de un @layer: ahí Tailwind gana y no
 *  hay pelea. Se hace contando llaves porque un @layer puede anidar. */
function tramosEnCapa(txt) {
  const tramos = [];
  const re = /@layer\s+[\w\s,]+\{/g;
  let m;
  while ((m = re.exec(txt))) {
    let i = re.lastIndex, prof = 1;
    while (i < txt.length && prof > 0) {
      if (txt[i] === '{') prof++;
      else if (txt[i] === '}') prof--;
      i++;
    }
    tramos.push([m.index, i]);
  }
  return tramos;
}
const enCapa = tramosEnCapa(sinComentarios);
const estaEnCapa = (pos) => enCapa.some(([a, b]) => pos >= a && pos < b);

/** Nombres que SON utilidades de Tailwind. Cuando index.css declara `.opacity-40`
 *  no está peleando con Tailwind: la está pisando a propósito (el paliativo de
 *  contraste lo hace). Reportarlas ahogaba el informe en cien líneas de ruido, y
 *  un control que grita de más enseña a ignorarlo. */
const ES_UTILIDAD = /^(opacity|w|h|z|p[xytrbl]?|m[xytrbl]?|text|bg|border|rounded|flex|grid|gap|top|left|right|bottom|inset|overflow|min|max|space)(-|$)/;

/** Dos declaraciones que dicen lo mismo no son una pelea. `.grupo-sticky` con
 *  `position: sticky` junto a la utilidad `sticky` da exactamente el resultado
 *  que el autor quería. */
const MISMO_VALOR = (valor, utilidad) =>
  valor.replace(/\s*!important\s*/, '').trim().toLowerCase() === utilidad.trim().toLowerCase();

const riesgosas = new Map(); // clase -> [{prop, valor}]
const reRegla = /(^|\})\s*([^{}@]+?)\s*\{([^{}]*)\}/g;
let r;
while ((r = reRegla.exec(sinComentarios))) {
  const [selector, cuerpo] = [r[2].trim(), r[3]];
  if (estaEnCapa(r.index)) continue;
  // Los pseudo-elementos estilan OTRA caja: `.custom-scrollbar::-webkit-scrollbar`
  // con `height: 4px` le da alto a la barra, no al contenedor. No hay pelea.
  if (/::/.test(selector)) continue;
  // `header.glass-dense` ya está acotado a un elemento, que es el arreglo
  // correcto: no se reporta.
  if (/^[a-z]+\./.test(selector)) continue;
  for (const cl of selector.matchAll(/(^|[\s,>+~])\.([a-zA-Z][\w-]*)(?=[\s,{:.]|$)/g)) {
    const clase = cl[2];
    if (ES_UTILIDAD.test(clase)) continue;
    for (const prop of Object.keys(EN_DISPUTA)) {
      const re = new RegExp(`(^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
      const hit = cuerpo.match(re);
      if (hit) {
        if (!riesgosas.has(clase)) riesgosas.set(clase, []);
        riesgosas.get(clase).push({ prop, valor: hit[2].trim() });
      }
    }
  }
}

// ── 2. Keyframes que terminan en un transform que no es `none` ──────────────
/** `animation-fill-mode: both` con un keyframe final `transform: translateY(0)`
 *  deja el transform APLICADO para siempre. Un transform aplicado crea
 *  containing block y stacking context, así que rompe `fixed` y `z-index` de
 *  todo lo que tenga adentro. `transform: none` hace exactamente lo mismo a la
 *  vista y no crea ninguna de las dos cosas. La diferencia es invisible en la
 *  pantalla y enorme en el layout. */
const animacionesMalas = [];
for (const kf of sinComentarios.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
  const [, nombre, cuerpo] = kf;
  const fin = cuerpo.match(/(?:to|100%)\s*\{([^}]*)\}/);
  if (!fin) continue;
  const t = fin[1].match(/transform\s*:\s*([^;]+)/);
  if (t && !/^\s*none\s*$/.test(t[1])) {
    const usadaConBoth = new RegExp(`animation:[^;]*\\b${nombre}\\b[^;]*\\b(both|forwards)\\b`).test(sinComentarios);
    if (usadaConBoth) animacionesMalas.push({ nombre, valor: t[1].trim() });
  }
}

// ── 3. Dónde se combinan esas clases con una utilidad que pelea ─────────────
function fuentes(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fuentes(p, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(e)) acc.push(p);
  }
  return acc;
}

const colisiones = [];
for (const archivo of fuentes(join(RAIZ, 'src'))) {
  const txt = readFileSync(archivo, 'utf8');
  txt.split('\n').forEach((linea, i) => {
    for (const [clase, props] of riesgosas) {
      if (!new RegExp(`[\\s"'\`]${clase}[\\s"'\`]`).test(linea)) continue;
      for (const { prop, valor } of props) {
        for (const util of EN_DISPUTA[prop]) {
          const m = linea.match(util);
          // `style={{…}}` inline gana siempre: si el componente ya lo forzó ahí,
          // no hay pelea. Es el escape válido y no se reporta.
          if (!m) continue;
          if (MISMO_VALOR(valor, m[0])) continue;
          if (!new RegExp(`style=\\{\\{[^}]*${prop.replace('-', '[-A-Z]')}`, 'i').test(linea)) {
            colisiones.push({
              archivo: relative(RAIZ, archivo), linea: i + 1, clase, prop,
              gana: valor, pierde: m[0],
            });
          }
        }
      }
    }
  });
}

// ── Informe ─────────────────────────────────────────────────────────────────
let fatal = false;

if (animacionesMalas.length) {
  fatal = true;
  console.log('\n✗ ANIMACIÓN QUE DEJA UN TRANSFORM PEGADO\n');
  for (const a of animacionesMalas) {
    console.log(`  @keyframes ${a.nombre} termina en "transform: ${a.valor}" y se usa con fill-mode both/forwards.`);
    console.log(`  Eso deja el transform aplicado para siempre: cada elemento animado queda convertido en`);
    console.log(`  containing block y stacking context, así que el "fixed" y el "z-index" de lo que tenga`);
    console.log(`  adentro dejan de funcionar. Usá "transform: none", que se ve igual y no crea ninguno.\n`);
  }
}

if (colisiones.length) {
  fatal = true;
  console.log('\n✗ COLISIONES ACTIVAS entre una clase propia y una utilidad de Tailwind\n');
  console.log('  src/index.css está FUERA de @layer, y una regla sin capa le gana a cualquier');
  console.log('  utilidad sin importar la especificidad. Gana la clase propia:\n');
  for (const c of colisiones) {
    console.log(`  ${c.archivo}:${c.linea}`);
    console.log(`    .${c.clase} declara ${c.prop}: ${c.gana}  →  "${c.pierde}" no hace nada.\n`);
  }
}

const trampas = [...riesgosas.keys()].filter(c => !colisiones.some(x => x.clase === c));
if (trampas.length) {
  console.log('\n⚠ TRAMPAS ARMADAS (informativo, no rompe el build)\n');
  console.log('  Estas clases declaran algo en disputa pero hoy nadie las combina mal.');
  console.log('  El día que alguien lo haga, la utilidad va a no hacer nada sin decir por qué:\n');
  for (const c of trampas) {
    console.log(`  .${c} → ${riesgosas.get(c).map(p => p.prop).join(', ')}`);
  }
  console.log('');
}

if (!fatal) console.log('\n✓ Sin colisiones activas de cascada.\n');
process.exit(fatal ? 1 : 0);
