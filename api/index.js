import { createRequire } from 'module'; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/accion.ts
var accion_exports = {};
__export(accion_exports, {
  AccionSchema: () => AccionSchema,
  POR_QUE_MANUAL: () => POR_QUE_MANUAL,
  VERBOS: () => VERBOS,
  VERBOS_EJECUTABLES: () => VERBOS_EJECUTABLES,
  VERBOS_EJECUTABLES_LISTA: () => VERBOS_EJECUTABLES_LISTA,
  esEjecutable: () => esEjecutable,
  parsearAccion: () => parsearAccion,
  tipoAutoDesde: () => tipoAutoDesde,
  tituloDesde: () => tituloDesde
});
import { z as z2 } from "zod";
function esEjecutable(verbo) {
  return !!verbo && verbo in VERBOS_EJECUTABLES;
}
function tituloDesde(a) {
  const o = a.objeto, p = a.parametros || {};
  const en = donde(o) ? ` en ${donde(o)}` : "";
  switch (a.verbo) {
    case "pausar_keyword":
      return o.keywords?.length ? `Pausar ${o.keywords.length} keywords${en}` : `Pausar ${fmtKw(o.keyword, o.match_type)}${en}`;
    case "reactivar_keyword":
      return `Reactivar ${fmtKw(o.keyword, o.match_type)}${en}`;
    case "agregar_negativa":
      return `Agregar negativa ${fmtKw(o.keyword, p.match_type_destino || o.match_type || "PHRASE")} a nivel ${p.nivel || "grupo"}${en}`;
    case "quitar_negativa":
      return `Quitar negativa ${fmtKw(o.keyword, o.match_type)}${en}`;
    case "cambiar_concordancia":
      return `Cambiar ${o.keyword} de ${MT[o.match_type || ""] || "?"} a ${MT[p.match_type_destino || ""] || "?"}${en}`;
    case "crear_keyword":
      return `Crear keyword ${fmtKw(o.keyword, p.match_type_destino || o.match_type)}${en}`;
    case "pausar_anuncio":
      return `Pausar anuncio ${o.anuncio_id || ""}${en}`.trim();
    case "crear_anuncio":
      return `Crear anuncio${en}`;
    case "cambiar_puja":
      return `Cambiar puja${p.valor_actual != null ? ` de ${p.valor_actual}` : ""}${p.valor_nuevo != null ? ` a ${p.valor_nuevo}` : ""}${en}`;
    case "cambiar_presupuesto":
      return `Cambiar presupuesto${p.valor_actual != null ? ` de ${p.valor_actual}` : ""}${p.valor_nuevo != null ? ` a ${p.valor_nuevo}` : ""}${o.campana ? ` de ${o.campana}` : ""}`;
    case "cambiar_estrategia_puja":
      return `Cambiar estrategia de puja${p.valor_actual ? ` de ${p.valor_actual}` : ""}${p.estrategia_destino ? ` a ${p.estrategia_destino}` : p.valor_nuevo ? ` a ${p.valor_nuevo}` : ""}${o.campana ? ` en ${o.campana}` : ""}`;
    case "cambiar_conversion":
      return `Cambiar ${o.accion_conversion || "acci\xF3n de conversi\xF3n"}${p.valor_nuevo ? ` a ${p.valor_nuevo}` : ""}`;
    case "cambiar_landing":
      return `Cambiar landing${p.valor_nuevo ? ` a ${p.valor_nuevo}` : ""}${en}`;
    case "cambiar_programacion":
      return `Cambiar programaci\xF3n de anuncios${o.campana ? ` en ${o.campana}` : ""}`;
    case "desactivar_automatizacion":
      return `Desactivar ${p.valor_actual || "automatizaci\xF3n de Google"}${o.campana ? ` en ${o.campana}` : ""}`;
    case "preguntar_cliente":
      return `Preguntar a ${p.a_quien || "cliente"}: ${(p.pregunta || "").slice(0, 80)}`;
    case "preguntar_andres":
      return `Decidir: ${(p.pregunta || "").slice(0, 90)}`;
    case "tarea_externa":
      return `${(p.que_hacer || "Tarea").slice(0, 80)}${p.donde ? ` en ${p.donde}` : ""}`;
    case "pausar_grupo":
      return `Pausar el grupo ${o.grupo} en ${o.campana}`;
    case "pausar_campana":
      return `Pausar la campa\xF1a ${o.campana}`;
    case "reactivar_campana":
      return `Reactivar la campa\xF1a ${o.campana}`;
    case "cambiar_objetivo_puja":
      return p.valor_nuevo == null ? `Quitar el objetivo de puja en ${o.campana}` : `Poner el objetivo de puja de ${o.campana} en ${p.valor_nuevo}`;
    case "cambiar_cpc_keyword":
      return `Cambiar el CPC de ${o.keyword} de ${p.valor_actual} a ${p.valor_nuevo}`;
    case "aplicar_etiqueta":
      return `Etiquetar ${o.campana} como ${p.etiqueta}`;
  }
}
function tipoAutoDesde(a) {
  const p = a.parametros || {};
  switch (a.verbo) {
    case "agregar_negativa":
      return p.nivel === "campana" ? "negativa_campana" : p.nivel === "lista" ? null : "negativa_grupo";
    case "quitar_negativa":
      return a.objeto.keyword ? "quitar_negativa" : null;
    case "pausar_keyword":
      return !a.objeto.keywords?.length ? "pausar_keyword" : null;
    case "reactivar_keyword":
      return a.objeto.keyword ? "reactivar_keyword" : null;
    case "pausar_anuncio":
      return "pausar_anuncio";
    case "pausar_grupo":
      return a.objeto.grupo ? "pausar_grupo" : null;
    case "pausar_campana":
      return a.objeto.campana ? "pausar_campana" : null;
    case "reactivar_campana":
      return a.objeto.campana ? "reactivar_campana" : null;
    case "cambiar_concordancia":
      return p.match_type_destino ? "cambiar_concordancia" : null;
    case "cambiar_estrategia_puja":
      return p.estrategia_destino ? "cambiar_estrategia_puja" : null;
    // Los de riesgo medio necesitan el valor anterior: sin el, no se puede revertir
    case "cambiar_objetivo_puja":
      return p.valor_actual != null ? "cambiar_objetivo_puja" : null;
    case "cambiar_presupuesto":
      return p.valor_actual != null && p.valor_nuevo != null ? "cambiar_presupuesto" : null;
    case "cambiar_cpc_keyword":
      return p.valor_actual != null && p.valor_nuevo != null ? "cambiar_cpc_keyword" : null;
    case "aplicar_etiqueta":
      return p.etiqueta ? "aplicar_etiqueta" : null;
    default:
      return null;
  }
}
function parsearAccion(texto) {
  if (!texto || !texto.trim()) return { error: "sin Accion JSON" };
  let raw2;
  const i = texto.indexOf("{"), j = texto.lastIndexOf("}");
  if (i < 0 || j <= i) return { error: "JSON inv\xE1lido: sin llaves" };
  try {
    raw2 = JSON.parse(texto.slice(i, j + 1));
  } catch (e) {
    return { error: "JSON inv\xE1lido: " + String(e.message).slice(0, 80) };
  }
  const r = AccionSchema.safeParse(raw2);
  if (!r.success) return { error: r.error.issues.map((i2) => `${i2.path.join(".")}: ${i2.message}`).join("; ") };
  const a = r.data;
  if (["pausar_keyword", "cambiar_concordancia", "reactivar_keyword"].includes(a.verbo) && !a.objeto.keyword && !a.objeto.keywords?.length) return { error: `${a.verbo} sin keyword` };
  if (a.verbo === "agregar_negativa" && !a.objeto.keyword && !a.objeto.keywords?.length) return { error: "agregar_negativa sin keyword" };
  if (a.verbo === "cambiar_concordancia" && !a.parametros?.match_type_destino) return { error: "cambiar_concordancia sin match_type_destino" };
  if (a.verbo.startsWith("preguntar") && !a.parametros?.pregunta) return { error: `${a.verbo} sin pregunta` };
  if (a.verbo === "tarea_externa" && !a.parametros?.que_hacer) return { error: "tarea_externa sin que_hacer" };
  if (["cambiar_presupuesto", "cambiar_objetivo_puja", "cambiar_cpc_keyword"].includes(a.verbo) && a.parametros?.valor_actual == null)
    return { error: `${a.verbo} sin valor_actual: sin el valor anterior el cambio no se puede revertir` };
  if (a.verbo === "cambiar_estrategia_puja" && !a.parametros?.estrategia_destino) return { error: "cambiar_estrategia_puja sin estrategia_destino" };
  const espera = a.parametros?.no_ejecutar_antes_de;
  if (espera && !/^\d{4}-\d{2}-\d{2}$/.test(espera)) return { error: `no_ejecutar_antes_de debe ser AAAA-MM-DD, lleg\xF3 "${espera}"` };
  return { accion: a };
}
var VERBOS, VERBOS_EJECUTABLES, POR_QUE_MANUAL, VERBOS_EJECUTABLES_LISTA, AccionSchema, MT, fmtKw, donde;
var init_accion = __esm({
  "src/lib/accion.ts"() {
    VERBOS = [
      "pausar_keyword",
      "reactivar_keyword",
      "agregar_negativa",
      "quitar_negativa",
      "cambiar_concordancia",
      "crear_keyword",
      "pausar_anuncio",
      "crear_anuncio",
      "cambiar_puja",
      "cambiar_presupuesto",
      "cambiar_estrategia_puja",
      "cambiar_conversion",
      "cambiar_landing",
      "cambiar_programacion",
      "desactivar_automatizacion",
      "preguntar_cliente",
      "preguntar_andres",
      "tarea_externa",
      // trabajo real fuera de Google Ads: un Sheet, el CRM, la landing, GTM
      // Verbos que el ejecutor SI puede aplicar, agregados el 7 sep 2026 tras verificar
      // la documentacion de AdsApp. El registro completo esta en capacidades_ejecucion.
      "quitar_negativa",
      "reactivar_keyword",
      "pausar_grupo",
      "pausar_campana",
      "reactivar_campana",
      "cambiar_estrategia_puja",
      "cambiar_objetivo_puja",
      "cambiar_presupuesto",
      "cambiar_cpc_keyword",
      "aplicar_etiqueta"
    ];
    VERBOS_EJECUTABLES = {
      agregar_negativa: { riesgo: "bajo", requiere: ["campana", "keyword"] },
      quitar_negativa: { riesgo: "bajo", requiere: ["campana", "keyword"] },
      pausar_keyword: { riesgo: "bajo", requiere: ["campana", "keyword"] },
      reactivar_keyword: { riesgo: "bajo", requiere: ["campana", "keyword"] },
      pausar_anuncio: { riesgo: "bajo", requiere: ["campana", "ad_id"] },
      pausar_grupo: { riesgo: "bajo", requiere: ["campana", "grupo"] },
      cambiar_concordancia: { riesgo: "bajo", requiere: ["campana", "keyword", "match_type_destino"] },
      aplicar_etiqueta: { riesgo: "bajo", requiere: ["campana", "etiqueta"] },
      cambiar_estrategia_puja: { riesgo: "medio", requiere: ["campana", "estrategia_destino"] },
      cambiar_objetivo_puja: { riesgo: "medio", requiere: ["campana", "valor_actual"] },
      cambiar_presupuesto: { riesgo: "medio", requiere: ["campana", "valor_actual", "valor_nuevo"] },
      pausar_campana: { riesgo: "medio", requiere: ["campana"] },
      reactivar_campana: { riesgo: "medio", requiere: ["campana"] },
      cambiar_cpc_keyword: { riesgo: "medio", requiere: ["campana", "keyword", "valor_actual", "valor_nuevo"] }
    };
    POR_QUE_MANUAL = {
      crear_anuncio: "AdsApp solo crea expanded text ads, que Google retir\xF3. Los RSA se hacen en la interfaz.",
      editar_anuncio: "Un anuncio no se edita: se crea uno nuevo y se pausa el viejo, y los RSA no se crean por script.",
      cambiar_conversion_primaria: "Las acciones de conversi\xF3n no est\xE1n en AdsApp. Se cambian en Objetivos \u203A Conversiones.",
      cambiar_segmentacion: "AdsApp lee la segmentaci\xF3n pero no la cambia de forma confiable.",
      cambiar_landing: "La URL final no se edita: hay que recrear el anuncio.",
      preguntar_andres: "Es una pregunta, no un cambio.",
      preguntar_cliente: "Es una pregunta, no un cambio.",
      tarea_externa: "Es trabajo fuera de Google Ads.",
      investigar: "Es diagn\xF3stico, no un cambio."
    };
    VERBOS_EJECUTABLES_LISTA = Object.keys(VERBOS_EJECUTABLES);
    AccionSchema = z2.object({
      verbo: z2.enum(VERBOS),
      objeto: z2.object({
        campana: z2.string().min(1).nullable().optional(),
        grupo: z2.string().nullable().optional(),
        keyword: z2.string().nullable().optional(),
        match_type: z2.enum(["EXACT", "PHRASE", "BROAD"]).nullable().optional(),
        anuncio_id: z2.string().nullable().optional(),
        accion_conversion: z2.string().nullable().optional(),
        keywords: z2.array(z2.string()).nullable().optional()
        // para lotes: pausar 21 keywords
      }),
      parametros: z2.object({
        match_type_destino: z2.enum(["EXACT", "PHRASE", "BROAD"]).nullable().optional(),
        nivel: z2.enum(["grupo", "campana", "lista"]).nullable().optional(),
        valor_nuevo: z2.union([z2.number(), z2.string()]).nullable().optional(),
        valor_actual: z2.union([z2.number(), z2.string()]).nullable().optional(),
        a_quien: z2.string().nullable().optional(),
        // preguntar_*
        donde: z2.string().nullable().optional(),
        // tarea_externa: que sistema
        que_hacer: z2.string().nullable().optional(),
        // tarea_externa: la tarea
        estrategia_destino: z2.string().nullable().optional(),
        // cambiar_estrategia_puja
        etiqueta: z2.string().nullable().optional(),
        // aplicar_etiqueta
        // Fecha AAAA-MM-DD antes de la cual no se ejecuta. Una condicion de secuencia
        // escrita en el texto no retiene nada: el 7 de septiembre de 2026 un accionable
        // que pedia esperar al 21 se ejecuto el mismo dia. Acá el pre-vuelo la hace cumplir.
        no_ejecutar_antes_de: z2.string().nullable().optional(),
        pregunta: z2.string().nullable().optional(),
        dato_que_falta: z2.string().nullable().optional()
      }).default({}),
      verificar: z2.object({
        metrica: z2.string(),
        fecha: z2.string(),
        // YYYY-MM-DD
        esperado: z2.string()
      }).nullable().optional()
    });
    MT = { EXACT: "exacta", PHRASE: "frase", BROAD: "amplia" };
    fmtKw = (k, mt) => k ? mt === "EXACT" ? `[${k}]` : mt === "PHRASE" ? `"${k}"` : k : "";
    donde = (o) => [o.grupo, o.campana].filter(Boolean).join(" \xB7 ");
  }
});

// src/server/lib/reporte-pdf.tsx
var reporte_pdf_exports = {};
__export(reporte_pdf_exports, {
  LOGO_URL: () => LOGO_URL,
  descargarLogo: () => descargarLogo,
  generarReportePDF: () => generarReportePDF,
  parsearBloques: () => parsearBloques
});
import { jsx, jsxs } from "react/jsx-runtime";
async function rp() {
  if (rpCache) return rpCache;
  const nombre = "@react-pdf/renderer";
  rpCache = await import(nombre);
  rpCache.Font.registerHyphenationCallback((w) => [w]);
  return rpCache;
}
function Reporte({ r, R }) {
  const { Document, Page, Text, View, Image } = R;
  const t = T[r.idioma];
  const m = r.metricas;
  const kpi = (k) => k === "cost" || k === "cpa" ? money(m[k]?.actual, r.moneda, r.locale) : k === "ctr" ? m[k]?.actual == null ? "-" : `${num(m[k].actual, r.locale, 2)}%` : num(m[k]?.actual, r.locale, k === "conversions" ? 2 : 0);
  const lbl = { cost: t.inv, clicks: t.clics, impressions: t.impr, conversions: t.conv, cpa: t.cpa, ctr: t.ctr };
  const orden = ["cost", "clicks", "impressions", "conversions", "cpa", "ctr"].filter((k) => m[k]?.actual != null);
  const totales = orden.map((k) => `${lbl[k]}: ${kpi(k)}`).join("  |  ");
  const deltas = r.periodo_anterior_completo ? ["cost", "conversions", "cpa"].map((k) => {
    const d = delta(m[k]?.actual ?? null, m[k]?.anterior ?? null);
    return d ? `${lbl[k]} ${d}` : "";
  }).filter(Boolean).join("  |  ") : "";
  const hoy = fecha((/* @__PURE__ */ new Date()).toISOString().slice(0, 10), r.idioma);
  const Pie = () => /* @__PURE__ */ jsx(Text, { style: s.pie, fixed: true, render: ({ pageNumber, totalPages }) => `${t.pag} ${pageNumber} ${t.de} ${totalPages} - NorthSignal` });
  return /* @__PURE__ */ jsx(Document, { title: `${r.titulo || t.titulo} - ${r.nombre_cliente}`, author: "NorthSignal", children: /* @__PURE__ */ jsxs(Page, { size: "A4", orientation: "landscape", style: s.page, wrap: true, children: [
    /* @__PURE__ */ jsx(Pie, {}),
    /* @__PURE__ */ jsxs(View, { style: s.cab, children: [
      r.logo ? /* @__PURE__ */ jsx(Image, { src: { data: r.logo, format: "png" }, style: s.logo }) : null,
      /* @__PURE__ */ jsxs(View, { children: [
        /* @__PURE__ */ jsxs(Text, { style: s.titulo, children: [
          r.titulo || t.titulo,
          " - NorthSignal"
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: s.sub, children: [
          t.cliente,
          ": ",
          r.nombre_cliente,
          " | ",
          t.periodo,
          ": ",
          fecha(r.periodo_desde, r.idioma),
          " - ",
          fecha(r.periodo_hasta, r.idioma),
          " | ",
          t.fecha,
          ": ",
          hoy
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Text, { style: s.totales, children: [
      totales,
      deltas ? `
${deltas} ${t.vs}` : ""
    ] }),
    r.bloques.map((b, i) => /* @__PURE__ */ jsxs(View, { style: s.bloque, wrap: false, children: [
      /* @__PURE__ */ jsx(Text, { style: s.etiqueta, children: b.etiqueta }),
      b.texto ? b.texto.split(/\n\s*\n/).map((p, j) => /* @__PURE__ */ jsx(Text, { style: s.p, children: p.trim() }, j)) : null,
      (b.vinetas || []).map((v, j) => /* @__PURE__ */ jsxs(View, { style: s.vineta, children: [
        /* @__PURE__ */ jsx(Text, { style: s.guion, children: "-" }),
        /* @__PURE__ */ jsx(Text, { style: s.vinetaTxt, children: v })
      ] }, j))
    ] }, i)),
    r.campanas.length > 0 && /* @__PURE__ */ jsxs(View, { children: [
      /* @__PURE__ */ jsxs(View, { wrap: false, children: [
        /* @__PURE__ */ jsx(Text, { style: s.tablaTitulo, children: t.campanas }),
        /* @__PURE__ */ jsxs(View, { style: s.th, children: [
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNombre], children: t.campana }),
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNum, s.n], children: t.costo }),
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNum, s.n], children: t.conversiones }),
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNum, s.n], children: t.cpa }),
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNum, s.n], children: t.ctr })
        ] }),
        r.campanas.slice(0, 1).map((c, i) => /* @__PURE__ */ jsxs(View, { style: [s.tr], children: [
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNombre], children: c.nombre }),
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(c.gasto, r.moneda, r.locale) }),
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: num(c.conv, r.locale, 2) }),
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(c.cpa, r.moneda, r.locale) }),
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: c.ctr == null ? "-" : `${num(c.ctr, r.locale, 2)}%` })
        ] }, i))
      ] }),
      r.campanas.slice(1).map((c, i) => /* @__PURE__ */ jsxs(View, { style: [s.tr, i % 2 === 0 ? s.trAlt : {}], wrap: false, children: [
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNombre], children: c.nombre }),
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(c.gasto, r.moneda, r.locale) }),
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: num(c.conv, r.locale, 2) }),
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(c.cpa, r.moneda, r.locale) }),
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: c.ctr == null ? "-" : `${num(c.ctr, r.locale, 2)}%` })
      ] }, i))
    ] }),
    r.grupos.length > 1 && /* @__PURE__ */ jsxs(View, { children: [
      /* @__PURE__ */ jsxs(View, { wrap: false, children: [
        /* @__PURE__ */ jsx(Text, { style: s.tablaTitulo, children: t.grupos }),
        /* @__PURE__ */ jsxs(View, { style: s.th, children: [
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNombre], children: t.grupo }),
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNum, s.n], children: t.costo }),
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNum, s.n], children: t.conversiones }),
          /* @__PURE__ */ jsx(Text, { style: [s.thT, s.cNum, s.n], children: t.cpa })
        ] }),
        r.grupos.slice(0, 1).map((g, i) => /* @__PURE__ */ jsxs(View, { style: [s.tr], children: [
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNombre], children: g.nombre }),
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(g.gasto, r.moneda, r.locale) }),
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: num(g.conv, r.locale, 2) }),
          /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(g.cpa, r.moneda, r.locale) })
        ] }, i))
      ] }),
      r.grupos.slice(1).map((g, i) => /* @__PURE__ */ jsxs(View, { style: [s.tr, i % 2 === 0 ? s.trAlt : {}], wrap: false, children: [
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNombre], children: g.nombre }),
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(g.gasto, r.moneda, r.locale) }),
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: num(g.conv, r.locale, 2) }),
        /* @__PURE__ */ jsx(Text, { style: [s.td, s.cNum, s.n], children: money(g.cpa, r.moneda, r.locale) })
      ] }, i)),
      /* @__PURE__ */ jsx(Text, { style: s.nota, children: t.nota })
    ] })
  ] }) });
}
function parsearBloques(texto) {
  const lineas = texto.split("\n");
  const bloques = [];
  let actual = null;
  const esEtiqueta = (l) => /^[A-ZÁÉÍÓÚÑ][^:\n]{2,40}:\s*$/.test(l.trim()) || /^(Contexto|Métricas|Metricas|Observaciones|Cambios aplicados|Cambios|Puntos de atención|Puntos de atencion|Próximos pasos|Proximos pasos|Context|Metrics|Observations|Changes applied|Changes|Points of attention|Attention|Next steps):/i.test(l.trim());
  for (const raw2 of lineas) {
    const l = raw2.trim();
    if (!l) continue;
    if (esEtiqueta(l)) {
      const [etq, ...resto] = l.split(":");
      actual = { etiqueta: etq.trim(), texto: resto.join(":").trim() || void 0, vinetas: [] };
      bloques.push(actual);
      continue;
    }
    if (!actual) {
      actual = { etiqueta: "", texto: "", vinetas: [] };
      bloques.push(actual);
    }
    if (/^[-•*]\s+/.test(l)) actual.vinetas.push(l.replace(/^[-•*]\s+/, ""));
    else actual.texto = (actual.texto ? actual.texto + "\n\n" : "") + l;
  }
  return bloques.map((b) => ({ ...b, vinetas: b.vinetas?.length ? b.vinetas : void 0 })).filter((b) => b.etiqueta || b.texto || b.vinetas);
}
async function descargarLogo() {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    logoCache = Buffer.from(await res.arrayBuffer());
    return logoCache;
  } catch {
    return null;
  }
}
async function generarReportePDF(r) {
  const R = await rp();
  return R.renderToBuffer(/* @__PURE__ */ jsx(Reporte, { r, R }));
}
var rpCache, AZUL, NAVY, GRIS_FILA, TEXTO, SUAVE, PIE, LOGO_URL, s, T, money, num, fecha, delta, logoCache;
var init_reporte_pdf = __esm({
  "src/server/lib/reporte-pdf.tsx"() {
    rpCache = null;
    AZUL = "#0062CC";
    NAVY = "#1A1F36";
    GRIS_FILA = "#F5F7FA";
    TEXTO = "#323232";
    SUAVE = "#646464";
    PIE = "#969696";
    LOGO_URL = "https://djbwxgicosargfobsmqd.supabase.co/storage/v1/object/public/logos/ChatGPT%20Image%204%20sept%202026,%2007_31_34%20p.m..png";
    s = {
      page: { fontFamily: "Helvetica", fontSize: 10, color: TEXTO, paddingTop: 36, paddingBottom: 42, paddingHorizontal: 42 },
      cab: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
      logo: { width: 40, height: 40, marginRight: 14 },
      titulo: { fontSize: 20, color: NAVY, marginTop: 2, lineHeight: 1.15 },
      sub: { fontSize: 10, color: SUAVE, marginTop: 5, lineHeight: 1.3 },
      totales: { fontSize: 10, color: TEXTO, marginBottom: 16, lineHeight: 1.45 },
      bloque: { marginBottom: 10 },
      etiqueta: { fontFamily: "Helvetica-Bold", fontSize: 10, color: NAVY, marginBottom: 3 },
      p: { fontSize: 10, marginBottom: 4, lineHeight: 1.45 },
      vineta: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
      guion: { width: 12, fontSize: 10 },
      vinetaTxt: { flex: 1, fontSize: 10, lineHeight: 1.45 },
      tablaTitulo: { fontFamily: "Helvetica-Bold", fontSize: 10, color: NAVY, marginTop: 14, marginBottom: 5 },
      th: { flexDirection: "row", backgroundColor: AZUL, paddingVertical: 5, paddingHorizontal: 8 },
      thT: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
      tr: { flexDirection: "row", paddingVertical: 4.5, paddingHorizontal: 8 },
      trAlt: { backgroundColor: GRIS_FILA },
      td: { fontSize: 8.5, color: TEXTO },
      n: { textAlign: "right" },
      cNombre: { flex: 4 },
      cNum: { flex: 1 },
      nota: { fontSize: 8, color: SUAVE, marginTop: 6 },
      pie: { position: "absolute", bottom: 18, left: 42, fontSize: 8, color: PIE }
    };
    T = {
      es: { titulo: "Reporte de Rendimiento", cliente: "Cliente", periodo: "Per\xEDodo", fecha: "Fecha", inv: "Inversi\xF3n", clics: "Clics", impr: "Impr", conv: "Conv", cpa: "CPA", ctr: "CTR", campanas: "Campa\xF1as", grupos: "Grupos de anuncios", campana: "Campa\xF1a", grupo: "Grupo", costo: "Costo", conversiones: "Conversiones", pag: "P\xE1gina", de: "de", vs: "vs per\xEDodo anterior", nota: "Solo se muestran campa\xF1as y grupos con inversi\xF3n en el per\xEDodo." },
      en: { titulo: "Performance Report", cliente: "Client", periodo: "Period", fecha: "Date", inv: "Spend", clics: "Clicks", impr: "Impr", conv: "Conv", cpa: "CPA", ctr: "CTR", campanas: "Campaigns", grupos: "Ad groups", campana: "Campaign", grupo: "Ad group", costo: "Cost", conversiones: "Conversions", pag: "Page", de: "of", vs: "vs previous period", nota: "Only campaigns and ad groups with spend in the period are shown." }
    };
    money = (v, m, l) => v == null ? "-" : new Intl.NumberFormat(l, { style: "currency", currency: m, maximumFractionDigits: m === "CLP" ? 0 : 2 }).format(v);
    num = (v, l, d = 1) => v == null ? "-" : new Intl.NumberFormat(l, { maximumFractionDigits: d }).format(v);
    fecha = (iso, idioma) => (/* @__PURE__ */ new Date(iso + "T12:00:00")).toLocaleDateString(idioma === "en" ? "en-GB" : "es-CL");
    delta = (a, b) => a == null || b == null || b === 0 ? "" : `${a - b >= 0 ? "+" : ""}${((a - b) / b * 100).toFixed(1)}%`;
    logoCache = null;
  }
});

// src/lib/tipoAuto.ts
var tipoAuto_exports = {};
__export(tipoAuto_exports, {
  concordanciaDestino: () => concordanciaDestino,
  detectarTipoAuto: () => detectarTipoAuto,
  extraerKeyword: () => extraerKeyword
});
function detectarTipoAuto(titulo, comoHacerlo) {
  const t = `${titulo} ${comoHacerlo || ""}`.toLowerCase();
  if (/negativ/.test(t)) return /nivel (de )?campa|a la campa|lista/.test(t) ? "negativa_campana" : "negativa_grupo";
  if (/concordancia|match type/.test(t) && /cambiar|pasar|mover|a exacta|a frase|a amplia|to exact|to phrase/.test(t) || /\bde (amplia|frase|exacta) a (amplia|frase|exacta)\b/.test(t)) return "cambiar_concordancia";
  if (/\b\d+ (keywords|palabras clave|negativas|t[eé]rminos)\b/.test(t)) return null;
  if (/pausar|pausa\b|desactivar/.test(t)) {
    if (/anuncio|rsa\b|\bad\b/.test(t)) return "pausar_anuncio";
    if (/grupo de anuncios|ad group|campa[ñn]a completa|toda la campa/.test(t)) return null;
    return "pausar_keyword";
  }
  return null;
}
function extraerKeyword(titulo, entidad) {
  const m = titulo.match(/["“'‘\[]([^"”'’\]]+)["”'’\]]/);
  if (m) return m[1].trim();
  const c = titulo.match(/^(?:cambiar|pausar|desactivar|agregar|añadir|excluir)\s+(?:la\s+keyword\s+|la\s+palabra\s+clave\s+|el\s+término\s+|la\s+)?(.+?)\s+(?:de\s+(?:concordancia|amplia|frase|exacta)\b|en\s+(?:el\s+grupo|la\s+campaña|[A-Z0-9])|como\s+negativa|a\s+nivel|a\s+(?:exacta|frase|amplia)\b)/i);
  if (c) return c[1].trim();
  const k = titulo.match(/(?:keyword|término|termino|palabra clave|negativa)\s+(?:de\s+)?([a-z0-9äöüß][^,;:()]{2,60}?)(?:\s+(?:en|del|de la|a nivel|como)\b|$)/i);
  if (k) return k[1].trim();
  const e = String(entidad || "");
  if (e.includes(" > ")) return e.split(" > ").pop().trim();
  const partes = e.split("|").map((x) => x.trim());
  return partes.length >= 3 ? partes[partes.length - 1] : "";
}
function concordanciaDestino(titulo) {
  const t = titulo.toLowerCase();
  const m = t.match(/\ba\s+(exacta|frase|amplia|exact|phrase|broad)\b/g);
  if (!m || !m.length) return null;
  const ult = m[m.length - 1].replace(/^a\s+/, "");
  return /exact/.test(ult) ? "EXACT" : /frase|phrase/.test(ult) ? "PHRASE" : "BROAD";
}
var init_tipoAuto = __esm({
  "src/lib/tipoAuto.ts"() {
  }
});

// server.ts
import "dotenv/config";

// src/server/routes/webhooks.ts
import { Router } from "express";

// src/server/lib/signatures.ts
import * as crypto from "crypto";
function verifyHmacSha256(secret, signature, payload) {
  if (!secret || !signature || !payload) return false;
  try {
    const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const hashBuf = Buffer.from(hash, "utf8");
    if (sigBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, hashBuf);
  } catch (e) {
    return false;
  }
}
function comparacionSegura(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(a, "utf8"), bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// src/server/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
var supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// src/server/domain/contracts.ts
import { z } from "zod";
var AsanaWebhookEvent = z.object({
  action: z.enum(["added", "changed", "removed", "deleted", "undeleted"]),
  created_at: z.string().optional(),
  resource: z.object({
    gid: z.string(),
    resource_type: z.string()
  }).optional(),
  parent: z.object({ gid: z.string() }).nullable().optional(),
  change: z.object({ field: z.string(), action: z.string() }).optional()
}).passthrough();
var AsanaWebhookPayload = z.object({
  events: z.array(AsanaWebhookEvent).optional()
}).passthrough();
var GHLWebhookPayload = z.object({
  type: z.string().optional(),
  locationId: z.string().optional(),
  contact_id: z.string().optional()
}).passthrough();

// src/server/routes/webhooks.ts
var webhooksRouter = Router();
var STATUS_RECEIVED = "RECEIVED";
var STATUS_PROCESSED = "PROCESSED";
var STATUS_QUARANTINED = "QUARANTINED";
var STATUS_FAILED = "FAILED";
webhooksRouter.post("/asana", async (req, res) => {
  try {
    const secret = req.headers["x-hook-secret"];
    if (secret) {
      res.setHeader("X-Hook-Secret", secret);
      return res.status(200).send();
    }
    const asanaSecret = process.env.ASANA_WEBHOOK_SECRET;
    if (!asanaSecret) {
      console.error("ASANA_WEBHOOK_SECRET no configurado. Webhook rechazado.");
      return res.status(503).json({ error: "Webhook no configurado" });
    }
    const signature = req.headers["x-hook-signature"];
    const rawBody = req.rawBody;
    if (!signature || !rawBody) {
      return res.status(401).json({ error: "Missing signature or raw body" });
    }
    if (!verifyHmacSha256(asanaSecret, signature, rawBody)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    res.status(200).json({ received: true });
    const payload = req.body;
    let parsedPayload;
    try {
      parsedPayload = AsanaWebhookPayload.parse(payload);
    } catch (zodError) {
      if (supabase) {
        const { error: quarErr } = await supabase.from("webhook_events").insert([{
          source: "asana",
          payload,
          status: STATUS_QUARANTINED,
          error_msg: zodError.message,
          received_at: (/* @__PURE__ */ new Date()).toISOString()
        }]);
        if (quarErr) console.error("Failed to log quarantined event", quarErr);
      }
      return;
    }
    if (!parsedPayload.events || parsedPayload.events.length === 0) return;
    for (const event of parsedPayload.events) {
      if (event.resource?.resource_type !== "task") continue;
      if (event.action !== "changed" && event.action !== "added") continue;
      const taskGid = event.resource.gid;
      if (supabase) {
        const { data: webhookLog, error: logErr } = await supabase.from("webhook_events").insert([{
          source: "asana",
          external_id: taskGid,
          payload: event,
          status: STATUS_RECEIVED,
          received_at: (/* @__PURE__ */ new Date()).toISOString()
        }]).select("id").single();
        if (logErr) throw new Error(`Supabase log error: ${logErr.message}`);
        let logId = webhookLog?.id;
        try {
          const asanaPat = process.env.ASANA_PAT;
          if (!asanaPat) throw new Error("ASANA_PAT no configurado");
          const resp = await fetch(
            `https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=name,completed,memberships.section.name,custom_fields.name,custom_fields.number_value,custom_fields.text_value`,
            { headers: { Authorization: `Bearer ${asanaPat}` } }
          );
          if (!resp.ok) {
            throw new Error(`Asana API error: ${resp.status}`);
          }
          const { data: task } = await resp.json();
          const monto = task.custom_fields?.find((f) => f.name === "Monto")?.number_value;
          const gclid = task.custom_fields?.find((f) => f.name === "GCLID")?.text_value;
          const seccion = task.memberships?.[0]?.section?.name;
          if (seccion === "Cerrado ganado" && monto && gclid) {
            const { error: upsertErr } = await supabase.from("true_roas_events").upsert({
              client: "360",
              source: "asana",
              external_id: taskGid,
              gclid,
              monto,
              event_date: task.modified_at || (/* @__PURE__ */ new Date()).toISOString()
            }, { onConflict: "client,gclid,external_id" });
            if (upsertErr) throw new Error(`Supabase upsert error: ${upsertErr.message}`);
          }
          if (logId) {
            await supabase.from("webhook_events").update({
              status: STATUS_PROCESSED,
              processed_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", logId);
          }
        } catch (procErr) {
          if (logId) {
            await supabase.from("webhook_events").update({
              status: STATUS_FAILED,
              error_msg: procErr.message,
              processed_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", logId);
          }
        }
      }
    }
  } catch (e) {
    console.error("Asana webhook top-level error:", e);
  }
});
webhooksRouter.post("/gohighlevel", async (req, res) => {
  try {
    const ghlSecret = process.env.GHL_WEBHOOK_SECRET;
    if (!ghlSecret) {
      console.error("GHL_WEBHOOK_SECRET no configurado. Webhook rechazado.");
      return res.status(503).json({ error: "Webhook no configurado" });
    }
    const auth = String(req.headers["authorization"] || "");
    if (!comparacionSegura(auth, `Bearer ${ghlSecret}`)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    res.status(200).json({ received: true });
    const payload = req.body;
    if (supabase) {
      const externalId = payload.contact_id || payload.locationId || "unknown";
      const { data: webhookLog, error: logErr } = await supabase.from("webhook_events").insert([{
        source: "gohighlevel",
        external_id: externalId,
        payload,
        status: STATUS_RECEIVED,
        received_at: (/* @__PURE__ */ new Date()).toISOString()
      }]).select("id").single();
      if (logErr) throw new Error(`Supabase log error: ${logErr.message}`);
      let logId = webhookLog?.id;
      try {
        if (logId) {
          await supabase.from("webhook_events").update({
            status: STATUS_PROCESSED,
            processed_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", logId);
        }
      } catch (procErr) {
        if (logId) {
          await supabase.from("webhook_events").update({
            status: STATUS_FAILED,
            error_msg: procErr.message,
            processed_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", logId);
        }
      }
    }
  } catch (e) {
    console.error("GHL webhook top-level error:", e);
  }
});

// src/server/domain/notionSchema.ts
var NOTION_BASES = {
  CLIENTES: "e5f736fe-b4e5-4e3c-b827-fabc5db8a0c8",
  BRIEFS: process.env.NOTION_BRIEFS_DB_ID || "1aedbb2d-d6e8-42a8-aca7-630cf97c4965",
  ACCIONABLES: process.env.NOTION_ACCIONABLES_DB_ID || "373cde2b-d8c2-47e3-bc89-56c7d7c7e568",
  PIPELINE: "6dcfb06b-c2fc-444c-b10d-f3cc8f485059"
};
var NOTION_STATES = {
  PROPUESTO: "Propuesto",
  EN_CURSO: "En curso",
  HECHO: "Hecho",
  DESCARTADO: "Descartado",
  BLOQUEADO: "Bloqueado"
};
var NOTION_REVISION_IA = {
  SIN_REVISAR: "Sin revisar",
  ANALIZADO: "Analizado por Gemini",
  COINCIDEN: "Coinciden",
  EN_DISPUTA: "En disputa",
  RESUELTO: "Resuelto"
};

// src/server/lib/notion.ts
import { Client } from "@notionhq/client";
import PQueue from "p-queue";
var notionKey = process.env.NOTION_API_KEY;
var raw = notionKey ? new Client({ auth: notionKey }) : null;
var queue = new PQueue({ intervalCap: 3, interval: 1e3, carryoverConcurrencyCount: true, concurrency: 3 });
var MAX_RETRIES = 4;
async function conReintentos(fn, idempotente, etiqueta) {
  let intento = 0;
  while (true) {
    try {
      return await queue.add(fn);
    } catch (e) {
      const status = e?.status ?? e?.response?.status;
      const code = e?.code;
      const retryAfter = Number(e?.headers?.["retry-after"] ?? e?.response?.headers?.["retry-after"] ?? 0);
      const esRateLimit = status === 429 || status === 529 || code === "rate_limited" || code === "service_overload";
      const esServidor = status !== void 0 && status >= 500 && status <= 504;
      const reintentar = esRateLimit || esServidor && idempotente;
      intento++;
      if (!reintentar || intento > MAX_RETRIES) {
        console.error(`[notion] ${etiqueta} fall\xF3 tras ${intento} intento(s): ${status ?? code ?? e?.message}`);
        throw e;
      }
      const base = retryAfter > 0 ? retryAfter * 1e3 : Math.min(1e3 * 2 ** intento, 16e3);
      await new Promise((r) => setTimeout(r, base + Math.random() * 300));
    }
  }
}
function envolver(cliente) {
  const idempotentes = /* @__PURE__ */ new Set(["retrieve", "list", "query", "search"]);
  const wrap = (obj, ruta) => new Proxy(obj, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v === "function") {
        return (...args) => conReintentos(() => v.apply(target, args), idempotentes.has(prop), [...ruta, prop].join("."));
      }
      if (v && typeof v === "object" && !Array.isArray(v)) return wrap(v, [...ruta, prop]);
      return v;
    }
  });
  return wrap(cliente, ["notion"]);
}
var notion = raw ? envolver(raw) : null;

// src/server/lib/gemini.ts
import { GoogleGenAI } from "@google/genai";
var geminiKey = process.env.GEMINI_API_KEY;
var ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

// src/server/lib/pulso.ts
init_accion();
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z as z3 } from "zod";
var AccionPlanaSchema = z3.object({
  verbo: z3.enum(VERBOS),
  campana: z3.string().nullable().describe("Nombre exacto de la campana"),
  grupo: z3.string().nullable().describe("Nombre exacto del grupo, o null"),
  keyword: z3.string().nullable().describe("Texto exacto de la keyword sin corchetes ni comillas, o null"),
  match_type: z3.string().nullable().describe("EXACT, PHRASE o BROAD: la concordancia ACTUAL"),
  match_type_destino: z3.string().nullable().describe("Solo para cambiar_concordancia: EXACT, PHRASE o BROAD"),
  nivel: z3.string().nullable().describe("Solo para agregar_negativa: grupo, campana o lista"),
  pregunta: z3.string().nullable().describe("Solo para preguntar_andres o preguntar_cliente"),
  donde: z3.string().nullable().describe("Solo para tarea_externa: en que sistema (Sheet, CRM, landing, GTM)"),
  que_hacer: z3.string().nullable().describe("Solo para tarea_externa: la tarea concreta"),
  no_ejecutar_antes_de: z3.string().nullable().describe("AAAA-MM-DD si el cambio no debe aplicarse antes de una fecha, por ejemplo porque hay que esperar a que otro cambio madure. Null si se puede ejecutar ya."),
  verificar_metrica: z3.string().nullable().describe("Que metrica confirma que funciono"),
  verificar_fecha: z3.string().nullable().describe("Cuando revisarlo, AAAA-MM-DD"),
  verificar_esperado: z3.string().nullable().describe("Que numero se espera")
});
var anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
var PRECIO_IN = 2 / 1e6;
var PRECIO_OUT = 10 / 1e6;
var PulsoSchema = z3.object({
  nivel: z3.enum(["normal", "atencion", "critico"]),
  resumen: z3.string().describe("3 a 5 l\xEDneas en espa\xF1ol. La primera dice qu\xE9 pas\xF3."),
  hallazgo_principal: z3.string().nullable(),
  conecta_con: z3.string().nullable().describe("Patr\xF3n anterior al que se parece, o null"),
  evidencia: z3.array(z3.object({
    nombre: z3.string(),
    grupo: z3.string().nullable(),
    valor: z3.number().nullable(),
    umbral: z3.number(),
    direccion: z3.enum(["sube", "baja", "cruza"]),
    cumple: z3.boolean(),
    tendencia_3d: z3.enum(["sube", "baja", "plana", "sin_datos"]),
    dias_seguidos_cumpliendo: z3.number().int().min(0),
    nota: z3.string().nullable().describe("Una l\xEDnea si hay algo que decir sobre este indicador hoy")
  })).describe("Un objeto por cada indicador del plan, en el mismo orden"),
  hipotesis_movidas: z3.array(z3.object({
    id: z3.string(),
    movimiento: z3.enum(["confirma", "descarta", "sin_cambio"]),
    evidencia_texto: z3.string()
  })),
  hallazgos: z3.array(z3.object({
    titulo: z3.string().describe('Como acci\xF3n con verbo de la lista cerrada: "Pausar X en Y", "Agregar negativa Z", "Preguntar a Andr\xE9s si...". Nunca "Revisar" ni "Decidir".'),
    severidad: z3.enum(["baja", "media", "alta", "critica"]),
    confianza: z3.number().min(0).max(1),
    entidad: z3.string().describe("Campa\xF1a, grupo, keyword o t\xE9rmino con nombre exacto"),
    evidencia_texto: z3.string().describe("Los n\xFAmeros que lo sostienen, con fechas"),
    naturaleza: z3.enum(["observacion", "inferencia", "hipotesis"]),
    como_hacerlo: z3.string().describe("Pasos numerados en la interfaz de Google Ads 2026 para ejecutarlo: Campa\xF1as > la campa\xF1a > el grupo > Palabras clave; pesta\xF1a Palabras clave negativas; Objetivos > Conversiones; Configuraci\xF3n > Puja. Uno por l\xEDnea. Escrito para una persona con Google Ads abierto, no para el sistema."),
    accion: AccionPlanaSchema.nullable().describe('La acci\xF3n estructurada, si el hallazgo es accionable. Verbo de la lista cerrada; nunca "revisar" ni "decidir": si no pod\xE9s decidir, es preguntar_andres con la pregunta y el dato que falta. objeto.keyword con el texto exacto como est\xE1 en la cuenta, sin corchetes ni comillas; objeto.grupo y objeto.campana con nombres exactos de grupos_ayer. Null si el hallazgo es solo informativo.'),
    donde: z3.string().describe('El lugar en la cuenta, en palabras: "Grupo 7. Vergleich, keyword X". Nunca nombres de vistas.'),
    causa_raiz: z3.string().describe('El problema de fondo en una frase que otro hallazgo podr\xEDa compartir. Nunca "detectado por el pulso".')
  })).describe("Cobertura completa: todo lo que encontraste, incluso con confianza baja. No filtres.")
});
function pulsoDisponible() {
  return !!anthropic;
}
async function correrPulso(cuenta, fecha2, input, reglasCuenta, parecidos = []) {
  if (!anthropic) return { cuenta, fecha: fecha2, tokens_in: 0, tokens_out: 0, costo_usd: 0, error: "ANTHROPIC_API_KEY no configurada" };
  const plan = input?.plan;
  const sinPlan = !plan;
  const memoriaTxt = parecidos.length ? `

EPISODIOS PARECIDOS (encontrados por b\xFAsqueda sem\xE1ntica en la memoria del sistema; usalos para conecta_con solo si de verdad se parecen):
${parecidos.map((m) => `- [${m.fecha}] (${m.tipo}, similitud ${m.similitud}) ${m.texto}`).join("\n")}` : "";
  const system = `Sos el analista diario de la cuenta de Google Ads ${cuenta}. Sos el ciclo r\xE1pido de un sistema de dos ciclos: el lunes, un analista semanal escribi\xF3 un PLAN con indicadores a vigilar, umbrales, hip\xF3tesis y condiciones de escalamiento. Tu trabajo es reportar EVIDENCIA contra ese plan para el d\xEDa ${fecha2}, no reinterpretar la estrategia.

REGLAS DE LA CUENTA (no negociables):
${reglasCuenta}

PRINCIPIOS:
- Lo observado se escribe como hecho; lo inferido como hip\xF3tesis con qu\xE9 lo confirmar\xEDa.
- Una discrepancia no es hallazgo hasta descartar operador, reloj y configuraci\xF3n. Si operator_log o cambios_google explican el movimiento, decilo.
- operator_log dice lo que Andr\xE9s YA HIZO, con fecha. Nunca propongas hacer lo que ya est\xE1 hecho, ni deshacerlo, ni lo reportes como pendiente. Si operator_log dice "cambi\xE9 X de A a B el d\xEDa D", el estado actual es B desde D, y cualquier lectura anterior a D que diga A es hist\xF3rica. El 6 de septiembre un pulso propuso revertir un cambio que Andr\xE9s hab\xEDa registrado ese mismo d\xEDa; la tarea semanal lo descart\xF3. No se repite.
- Los d\xEDas provisionales (madurez \u2260 consolidado) no sostienen conclusiones sobre conversiones.
- Ante un deterioro, mir\xE1 primero conv_por_grupo: \xBFes un grupo o toda la cuenta?
- Una ca\xEDda de volumen (impresiones, clics) y una ca\xEDda de tasa (conv_rate) son dos preguntas con dos causas posibles.
- Si pulsos_previos ya se\xF1alaron lo mismo, dec\xED que contin\xFAa y cont\xE1 los d\xEDas; no lo presentes como nuevo.
- Con 1 conversi\xF3n/d\xEDa de promedio, un d\xEDa en cero es normal. Lo dice el plan.
- Fechas expl\xEDcitas siempre.
- Con lo leading se dirige; con lo lagging se califica. No alertes por CPA de un d\xEDa.

SOBRE EVIDENCIA: por cada indicador del plan, un objeto con el valor de hoy (de leading_7d o grupos_ayer seg\xFAn corresponda), si cumple el umbral en la direcci\xF3n indicada, la tendencia de 3 d\xEDas, y cu\xE1ntos d\xEDas seguidos lo viene cumpliendo (contando pulsos_previos). Si el indicador es conv_rate_grupo, el valor sale de grupos_ayer para ese grupo.

SOBRE LO QUE YA EXISTE: en estado_cuenta.accionables_abiertos est\xE1 lo que ya se propuso y sigue abierto, con su entidad. Si tu hallazgo es sobre la misma entidad, decilo en evidencia_texto ("ya hay un accionable abierto para X desde el d\xEDa Y; sigue vigente porque...") y pon\xE9 confianza baja: no hace falta crear otro. En estado_cuenta.operator_log_14d y cambios_google_7d est\xE1 lo que Andr\xE9s o Google ya cambiaron: un movimiento que coincide con un cambio registrado no es hallazgo, es efecto.

SOBRE HALLAZGOS: report\xE1 todo lo que encontr\xE1s, incluidos los de confianza baja o severidad baja. No decidas qu\xE9 importa: un filtro posterior lo hace con umbrales. Tu trabajo es cobertura. Cada hallazgo con entidad nombrada exacta y los n\xFAmeros que lo sostienen. Severidad critica solo si: cambio autom\xE1tico de Google, primaria sin datos con gasto normal, o gasto sin conversi\xF3n sobre el CPA m\xE1ximo en un grupo que antes convert\xEDa.

SOBRE NIVEL: critico si hay un hallazgo critica con confianza \u2265 0,8. atencion si alguna condici\xF3n del plan lleva 2+ d\xEDas cumpli\xE9ndose o hay un hallazgo alta con confianza \u2265 0,7. normal en cualquier otro caso.
${sinPlan ? "\nNO HAY PLAN para esta semana. Report\xE1 evidencia sobre los cuatro indicadores base (clics, conv_rate, cpc, lost_is_budget) con umbrales de la mediana de los 7 d\xEDas, y marc\xE1 en el resumen que falta el plan." : ""}`;
  const user = `DATOS DEL ${fecha2}:
${JSON.stringify(input)}${memoriaTxt}`;
  try {
    const msg = await anthropic.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 16e3,
      // El system es estable dia a dia por cuenta: se cachea (1 hora) y el input cuesta un decimo en las corridas siguientes.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral", ttl: "1h" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort: "medium", format: zodOutputFormat(PulsoSchema) }
    });
    const parsed = msg.parsed_output;
    if (!parsed) throw new Error("Sin parsed_output: " + (msg.stop_reason || "desconocido"));
    if (msg.stop_reason === "max_tokens") throw new Error("Se cort\xF3 por max_tokens");
    const u = msg.usage;
    const tin = u.input_tokens || 0, tout = u.output_tokens || 0, tcache = u.cache_read_input_tokens || 0, tcw = u.cache_creation_input_tokens || 0;
    const costo = tin * PRECIO_IN + tcache * PRECIO_IN * 0.1 + tcw * PRECIO_IN * 2 + tout * PRECIO_OUT;
    return { cuenta, fecha: fecha2, nivel: parsed.nivel, hallazgo: parsed.hallazgo_principal, tokens_in: tin + tcache + tcw, tokens_out: tout, costo_usd: costo, parsed };
  } catch (e) {
    if (/Unterminated|max_tokens|parse structured/i.test(String(e.message)) && !system.includes("REINTENTO")) {
      try {
        const msg2 = await anthropic.messages.parse({
          model: "claude-sonnet-5",
          max_tokens: 16e3,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral", ttl: "1h" } }, { type: "text", text: "REINTENTO: la respuesta anterior se cort\xF3 por largo. Limit\xE1 hallazgos a los 4 m\xE1s relevantes y cada evidencia_texto a dos oraciones." }],
          messages: [{ role: "user", content: user }],
          output_config: { effort: "medium", format: zodOutputFormat(PulsoSchema) }
        });
        const parsed = msg2.parsed_output;
        if (parsed) {
          const tin = msg2.usage.input_tokens || 0, tout = msg2.usage.output_tokens || 0;
          return { cuenta, fecha: fecha2, nivel: parsed.nivel, hallazgo: parsed.hallazgo_principal, tokens_in: tin, tokens_out: tout, costo_usd: tin * PRECIO_IN + tout * PRECIO_OUT, parsed };
        }
      } catch (e2) {
        return { cuenta, fecha: fecha2, tokens_in: 0, tokens_out: 0, costo_usd: 0, error: `${e.message} \xB7 reintento: ${e2.message}` };
      }
    }
    return { cuenta, fecha: fecha2, tokens_in: 0, tokens_out: 0, costo_usd: 0, error: e.message };
  }
}

// src/server/lib/asistente.ts
import Anthropic2 from "@anthropic-ai/sdk";

// src/lib/glosario.ts
var GLOSARIO = {
  // Métricas base
  "CPA": "Costo por conversi\xF3n: gasto dividido por conversiones. Se recalcula sobre sumas, nunca se promedia.",
  "CPC": "Costo por clic promedio: gasto dividido por clics.",
  "CTR": "Tasa de clics: clics dividido por impresiones. Mide relevancia del anuncio.",
  "Conv. rate": "Tasa de conversi\xF3n: conversiones dividido por clics. Mide la landing y la calidad del tr\xE1fico.",
  "Impresiones": "Veces que el anuncio se mostr\xF3. Con cuota constante, refleja la demanda real.",
  "Gasto": "Costo total en la moneda de la cuenta.",
  // Cuotas
  "Impression share": "Cuota de impresiones: qu\xE9 porcentaje de las subastas elegibles gan\xF3 el anuncio.",
  "IS": "Cuota de impresiones: porcentaje de subastas elegibles donde el anuncio apareci\xF3.",
  "Lost IS budget": "Cuota perdida por presupuesto: demanda que existi\xF3 y no se captur\xF3 por falta de dinero.",
  "Lost IS rank": "Cuota perdida por ranking: demanda que no se captur\xF3 por Quality Score o puja baja. Presupuesto no lo arregla.",
  "Limitada por": "Qu\xE9 frena a la campa\xF1a: presupuesto (falta dinero) o ranking (falta calidad o puja).",
  // Calidad
  "Quality Score": "Puntaje 1-10 de Google por relevancia, CTR esperado y landing. Baja el CPC cuando sube.",
  "QS": "Quality Score: puntaje 1-10 de relevancia. Cuanto m\xE1s alto, menos cuesta cada clic.",
  // Escalamiento
  "CPA marginal": "Cu\xE1nto cuesta cada conversi\xF3n ADICIONAL al subir presupuesto. Si duplica al promedio, la campa\xF1a est\xE1 saturada.",
  "Headroom": "Margen para escalar: el siguiente escal\xF3n de presupuesto rinde parecido al actual.",
  "Saturada": "El siguiente peso compra conversiones al doble o m\xE1s. Subir presupuesto no rinde.",
  "Techo": "Cuota de impresiones sobre 90%: no queda demanda por capturar.",
  // Datos
  "Madurez": "Cu\xE1n asentado est\xE1 el dato: provisional (\xFAltimos 2 d\xEDas), madurando (3-7) o consolidado (7+).",
  "Provisional": "Dato de los \xFAltimos 2 d\xEDas. Las conversiones pueden llegar tarde; no sostiene conclusiones.",
  "Consolidado": "Dato con 7+ d\xEDas: las conversiones ya llegaron. Es el que se usa para decidir.",
  "D\xEDas con datos": "Cu\xE1ntos d\xEDas del rango tienen extracci\xF3n. Si es menor al rango, el total es parcial.",
  // Anomalías
  "z-score": "Desv\xEDo contra la media m\xF3vil de 7 d\xEDas, en desviaciones est\xE1ndar. 2 = raro, 3 = muy raro.",
  "Anomal\xEDa": "D\xEDa con desv\xEDo estad\xEDstico de gasto o CPA contra su media m\xF3vil. Los provisionales se ignoran.",
  "Baseline": "Media m\xF3vil de los 7 d\xEDas previos. La referencia contra la que se mide el desv\xEDo.",
  // Estructura
  "Branded": "Grupo de keywords de marca. Captura demanda existente; no es crecimiento.",
  "Concordancia": "C\xF3mo Google empareja la b\xFAsqueda con la keyword: exacta, frase o amplia.",
  "T\xE9rmino nuevo": "B\xFAsqueda que apareci\xF3 por primera vez en los \xFAltimos 14 d\xEDas. Si gasta sin convertir, candidato a negativa.",
  "Keyword disparadora": "La keyword que hizo que el anuncio apareciera para ese t\xE9rmino de b\xFAsqueda.",
  "Negativa": "Palabra que impide que el anuncio aparezca. Se propone; nunca se aplica sola.",
  // Conversiones
  "Primaria": "Conversi\xF3n que Smart Bidding usa para optimizar. Debe ser la etapa m\xE1s profunda con 15+ eventos/mes.",
  "Secundaria": "Conversi\xF3n que se registra pero no gu\xEDa la puja.",
  "Smart Bidding": "Puja autom\xE1tica de Google. Necesita 15+ conversiones al mes para aprender.",
  "tCPA": "CPA objetivo: le dice a Smart Bidding cu\xE1nto pagar por conversi\xF3n.",
  "Escalera de valor": "Etapas del embudo con valor estimado cada una. La primaria deber\xEDa ser la m\xE1s profunda con volumen.",
  "GCLID": "Identificador del clic de Google. Permite subir conversiones offline.",
  "GBRAID": "Identificador del clic en iOS con privacidad. Equivale al GCLID; Make lo descartaba.",
  "Ventana de 90 d\xEDas": "Google solo acepta conversiones offline de clics de hasta 90 d\xEDas. Un ciclo m\xE1s largo no se puede atribuir.",
  // Sistema
  "Acci\xF3n estructurada": "El accionable como dato: verbo de lista cerrada, objeto, par\xE1metros y qu\xE9 verificar. El t\xEDtulo se deriva de esto y el bot\xF3n de ejecutar lo lee.",
  "Pre-vuelo": "Chequeo antes de ejecutar: si otro accionable abierto entra en conflicto con este, no se ejecuta hasta resolverlo.",
  "Versi\xF3n": "Cada vez que el cuerpo de un accionable cambia, el sistema guarda qu\xE9 cambi\xF3, cu\xE1ndo y por qu\xE9. Lo ves en el accionable.",
  "Bandeja": "La cola de lo que espera tu criterio: acci\xF3n hoy, listos, por confirmar, reportes. Vac\xEDa es la meta.",
  "Calibraci\xF3n": "Si el sistema acierta lo que promete: con 80% de confianza declarada, deber\xEDa acertar 8 de 10.",
  "Predicci\xF3n": "Rango de conversiones o CPA para la semana que empieza, con la probabilidad de caer adentro. Se compara el lunes siguiente.",
  "Pulso diario": "Interpretaci\xF3n de Sonnet 5 de cada d\xEDa contra el plan de la semana. Evidencia, no conclusi\xF3n.",
  "Plan semanal": "Lo que Opus 5 escribi\xF3 el lunes: qu\xE9 vigilar, con qu\xE9 umbral, qu\xE9 hip\xF3tesis probar.",
  "Leading indicator": "M\xE9trica que se mueve antes que el resultado. Con lo leading se dirige; con lo lagging se califica.",
  "Reflexi\xF3n": "Lo que una corrida escribi\xF3 sobre qu\xE9 har\xEDa distinto. La siguiente la lee.",
  "Naturaleza": "Observaci\xF3n (dato), Inferencia (deducci\xF3n) o Hip\xF3tesis (conjetura). Solo las observaciones nacen Propuestas.",
  "Handoff": "Memoria de trabajo del brief: hip\xF3tesis abiertas, cambios cuyo efecto no se ve, datos provisionales.",
  "Veredicto": "Conclusi\xF3n calculada, no opini\xF3n: HEADROOM, TECHO, LIMITADA POR RANKING, NO ESCALAR, INESTABLE.",
  "Tasa de acierto": "De los accionables ejecutados, cu\xE1ntos movieron la m\xE9trica en la direcci\xF3n esperada.",
  "MDE": "Efecto m\xEDnimo detectable: cu\xE1nto tendr\xEDa que moverse una m\xE9trica para que un test lo vea. Sobre 35%, no testeable."
};

// src/server/lib/asistente.ts
var anthropic2 = process.env.ANTHROPIC_API_KEY ? new Anthropic2({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
var MAPA_APP = `
SECCIONES DE LA APP (men\xFA izquierdo, cinco \xEDtems):
- Bandeja: la pantalla de inicio. Arriba, Novedades: comentarios y ediciones de los agentes en accionables, propuestas nuevas, tickets respondidos, ejecuciones autom\xE1ticas; se marcan vistas al abrir. Debajo, una cola con lo que espera el criterio de Andr\xE9s, en orden: pide acci\xF3n hoy, listos para ejecutar, esperan confirmaci\xF3n, reportes para aprobar. Cada fila se abre ah\xED. Cuando est\xE1 vac\xEDa dice "Nada te espera". Debajo, colapsados: ayer en cada cuenta (una l\xEDnea por cuenta) y qu\xE9 pas\xF3 despu\xE9s (impacto de cambios a 14 d\xEDas, predicciones acertadas o falladas).
- Cuenta: todo lo de una cuenta, con el selector arriba (Karedo, BHI, 360) y seis pesta\xF1as. Semana: gr\xE1fico de 14 d\xEDas con lentes gasto/CPA, conversiones/clics, CTR/CPC; rango 7, 14 o fechas a elecci\xF3n; el plan de la semana con sus indicadores y cu\xE1ntos d\xEDas llevan cumpli\xE9ndose; qu\xE9 encontr\xF3 el an\xE1lisis diario d\xEDa por d\xEDa; colapsados: conversiones por grupo, cu\xE1ndo convierte (hora y d\xEDa), b\xFAsquedas nuevas, cambios en la cuenta. Diagn\xF3stico: ficha, objetivos y headroom, por qu\xE9 est\xE1 donde est\xE1 (los tres componentes del Quality Score ponderados por gasto), escalera de valor, accionables abiertos, decisiones estructurales. Brief: el an\xE1lisis completo del lunes con handoff. Accionables: todos, con filtros, incluidos hechos y descartados. Memoria: hip\xF3tesis abiertas, aprendizajes, doc maestro editable. Reportes: borradores al cliente para aprobar, editar, ver PDF.
- Datos: tablas por campa\xF1a, grupo, keyword, t\xE9rmino de b\xFAsqueda y conversiones, agrupadas en Por semana, Por d\xEDa y Diagn\xF3stico; cualquier rango de fechas; exportar PDF.
- Herramientas: RSA Factory (escribir anuncios desde los t\xE9rminos que convierten) y Gu\xEDa de operaci\xF3n (c\xF3mo funciona el ciclo, qu\xE9 hacer cada lunes, ejecutar un accionable, aprobar un reporte, cuando algo no cuadra).
- Sistema, cuatro grupos: Salud (datos por cuenta, integridad, tama\xF1o); Aprendizaje (calidad de cada an\xE1lisis, qu\xE9 pas\xF3 despu\xE9s de cada accionable, reflexiones, qui\xE9n escribe qu\xE9 y lo que el reconciliador corrigi\xF3); Automatizaci\xF3n (alertas, ejecuciones aprobadas, cambios de configuraci\xF3n); Soporte (tickets para Claude, bit\xE1cora de lo que Andr\xE9s cambi\xF3 a mano, ajustes).
- Cmd+K abre la paleta para saltar a cualquier lado. El bot\xF3n flotante abajo a la derecha: Preguntar (este asistente) y Reportar (ticket).
- Al abrir un accionable: selectores de Estado (Propuesto, Bloqueado, En curso, Hecho, Descartado) y Prioridad arriba; Por qu\xE9, C\xF3mo hacerlo (pasos en Google Ads), D\xF3nde, qu\xE9 cambi\xF3 desde que se propuso, con qu\xE9 se relaciona, y si es negativa, pausa o cambio de concordancia con acci\xF3n estructurada v\xE1lida, "Aprobar y que se haga" para que un script lo ejecute en la pr\xF3xima hora.

C\xD3MO FUNCIONA EL SISTEMA: scripts en Google Ads extraen a Supabase (diario 6:00, semanal lunes 7:00). Centinela cada 4 horas dentro de Google Ads: el \xFAnico que ve el d\xEDa en curso. Cada ma\xF1ana 6:45 Sonnet 5 lee el d\xEDa anterior contra el plan de la semana y escribe el pulso, buscando en la memoria sem\xE1ntica episodios parecidos. Cada lunes Opus 5 en Cowork analiza la semana, escribe el brief, accionables con pasos, reporte al cliente, el plan siguiente y dos predicciones con rango y probabilidad. Un reconciliador en SQL cada ma\xF1ana vence lo que nadie toc\xF3, deduplica por entidad y cierra alertas que cesaron. Andr\xE9s ejecuta los accionables (o aprueba que el script ejecute negativas y pausas) y aprueba los reportes. Nada cambia en Google Ads sin que \xE9l lo decida.

REGLAS DE ESTADO DE ACCIONABLES: Propuesto = listo para ejecutar. Bloqueado = es una deducci\xF3n o lo propuso un proceso autom\xE1tico; espera confirmaci\xF3n. En curso = aprobado para ejecuci\xF3n autom\xE1tica. Hecho = ejecutado, con fecha. Descartado = decidi\xF3 no hacerlo. Origen: Semanal, Pulso diario, Anomalias, Andres, Reconciliador. Naturaleza: Observaci\xF3n, Inferencia, Hip\xF3tesis.
`;
function construirHerramientas(cuentas) {
  const ENUM = cuentas.length ? cuentas : ["KAREDO", "BHI", "360"];
  return [
    { name: "estado_cuenta", description: 'Resumen actual de una cuenta: veredicto de headroom, CPA de 7 y 14 d\xEDas, conversiones, plan de la semana vigente, \xFAltimo pulso diario. Usar cuando pregunten "c\xF3mo va X" o "qu\xE9 dice el plan de X".', input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ENUM } }, required: ["cuenta"] } },
    { name: "accionables_abiertos", description: "Lista los accionables Propuestos y Bloqueados de una cuenta con t\xEDtulo, prioridad, naturaleza y por qu\xE9. Usar cuando pregunten qu\xE9 hay pendiente o qu\xE9 hacer.", input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ENUM } }, required: ["cuenta"] } },
    { name: "explicar_accionable", description: "Todo el razonamiento detras de un accionable: quien lo propuso, con que evidencia, que invariantes toca, si se puede ejecutar y por que no, y que paso con cambios parecidos. Usar SIEMPRE que pregunten por que se propuso algo, si conviene hacerlo, o que pasa si lo hago.", input_schema: { type: "object", properties: { notion_id: { type: "string", description: "El id del accionable. Si no lo tenes, buscalo primero con buscar_accionable." } }, required: ["notion_id"] } },
    { name: "ejecutar_accionable", description: 'Encola un accionable para que el ejecutor lo aplique en Google Ads. SOLO usar cuando Andres lo pide explicitamente ("ejecutalo", "dale", "hacelo"). Nunca por iniciativa propia. Antes de llamarla, explicar que va a hacer y esperar confirmacion en el mismo mensaje.', input_schema: { type: "object", properties: { notion_id: { type: "string" }, modo: { type: "string", enum: ["simular", "ejecutar"], description: "simular muestra que haria sin tocar nada; ejecutar lo aplica de verdad" } }, required: ["notion_id", "modo"] } },
    { name: "dejar_nota_para_agente", description: "Deja una nota que el agente de esa cuenta va a leer en su proxima corrida. Usar cuando Andres pregunta algo que el agente deberia investigar, da una instruccion que cambia como analizar, o corrige algo que el agente asumio mal. Asi la conversacion no muere aca.", input_schema: { type: "object", properties: { contenido: { type: "string", description: "Que tiene que saber el agente, en una o dos frases claras" }, cuenta: { type: "string", enum: ENUM }, para: { type: "string", enum: ["semanal", "pulso", "mensual", "cualquiera"] }, tipo: { type: "string", enum: ["pregunta", "instruccion", "contexto", "correccion"] } }, required: ["contenido"] } },
    { name: "que_pregunte_andres", description: "Las notas que Andres ya dejo para los agentes y todavia no fueron atendidas. Usar cuando pregunte si ya avis\xF3 algo, o para no repetir una nota que ya existe.", input_schema: { type: "object", properties: {}, required: [] } },
    { name: "consultar_datos", description: "Corre una consulta de lectura sobre una vista del sistema. Usar para preguntas concretas sobre numeros que ninguna otra herramienta responde. Solo lectura: la vista tiene que existir en diccionario_datos.", input_schema: { type: "object", properties: { vista: { type: "string", description: "Nombre exacto de la vista, tal como aparece en que_datos_hay" }, cuenta: { type: "string", enum: ENUM }, limite: { type: "number" } }, required: ["vista"] } },
    { name: "que_datos_hay", description: "Catalogo de las 119 vistas y funciones del sistema con para que sirve cada una y que cuidado tener. Usar cuando pregunten donde esta un dato, si existe algo, o cuando haga falta explorar mas alla de lo obvio.", input_schema: { type: "object", properties: { buscar: { type: "string", description: 'Palabra a buscar, por ejemplo "conversiones" o "landing". Vacio devuelve el catalogo entero.' } }, required: [] } },
    { name: "completitud_de_cuenta", description: "Que le falta a una cuenta para operar bien: doc maestro, reglas, nucleo, terminos protegidos, objetivo, datos frescos, destinatarios de reporte. Usar cuando pregunten si una cuenta esta lista, que falta cargar, o por que algo no funciona en una cuenta puntual.", input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ENUM } }, required: ["cuenta"] } },
    { name: "estado_de_los_flujos", description: "Cada flujo de datos del sistema: quien lo escribe, cuando fue el ultimo dato, si esta vivo o cortado. Usar SIEMPRE antes de decir que un dato no existe: puede que el flujo que lo trae nunca se haya conectado, que es distinto de que no haya habido nada.", input_schema: { type: "object", properties: {}, required: [] } },
    { name: "salud_del_sistema", description: "Estado del sistema: fallas, cosas para mirar, tareas que dejaron de correr. Usar cuando pregunten si algo anda mal, por que algo no corrio, o para un chequeo general.", input_schema: { type: "object", properties: {}, required: [] } },
    { name: "por_que_limitada", description: "Descompone por que una cuenta pierde subastas: CTR esperado, relevancia del anuncio o experiencia de landing, ponderado por gasto, con las peores keywords. Usar cuando pregunten por que no escala, por que se pierde cuota, o que hacer para mejorar.", input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ENUM } }, required: ["cuenta"] } },
    { name: "buscar_accionable", description: 'Busca accionables de una cuenta por palabras del t\xEDtulo o del "por qu\xE9", en cualquier estado. Usar cuando pregunten por un accionable puntual ("la propuesta de agrupar campa\xF1as", "el de las negativas") y haga falta el detalle completo.', input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ENUM }, texto: { type: "string", description: 'Palabras a buscar, por ejemplo "agrupar campa\xF1as" o "negativas competidores"' } }, required: ["cuenta", "texto"] } },
    { name: "propuestas_estrategicas", description: "Propuestas estrat\xE9gicas de una cuenta con su estado, qu\xE9 se propuso, qu\xE9 se hizo realmente y el resultado esperado. Usar cuando pregunten por una propuesta o una estrategia, que NO son accionables.", input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ENUM } }, required: ["cuenta"] } },
    { name: "salud_datos", description: "Estado de los datos: \xFAltima extracci\xF3n, semana disponible, integridad, crons. Usar cuando pregunten si los datos est\xE1n al d\xEDa o por qu\xE9 falta algo.", input_schema: { type: "object", properties: {} } },
    { name: "doc_maestro", description: "Devuelve una secci\xF3n del doc maestro de una cuenta: identidad, objetivos, restricciones, descartado, reporte, riesgos, vacios. Usar para preguntas sobre el cliente, sus reglas o su historia.", input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ENUM }, seccion: { type: "string", enum: ["identidad", "objetivos", "restricciones", "descartado", "reporte", "riesgos", "vacios"] } }, required: ["cuenta", "seccion"] } }
  ];
}
async function responderAsistente(supabase2, mensajes, contexto) {
  const { data: filas } = await supabase2.from("cuentas").select("account, nombre_cliente, moneda, perfil_analisis").eq("activa", true).order("account");
  const cuentasActivas2 = (filas || []).map((c) => c.account);
  const TOOLS = construirHerramientas(cuentasActivas2);
  const listaCuentas = (filas || []).map((c) => `${c.account} (${c.nombre_cliente || c.account}, ${c.moneda}${c.perfil_analisis === "cadena" ? ", multi-local" : ""})`).join("; ");
  if (!anthropic2) return { texto: "El asistente necesita ANTHROPIC_API_KEY en Vercel.", costo_usd: 0 };
  const glosarioTxt = Object.entries(GLOSARIO).map(([k, v]) => `${k}: ${v}`).join("\n");
  const primerTurno = `CONTEXTO DE LA APP NORTHSIGNAL (leelo antes de responder)
${MAPA_APP}
GLOSARIO:
${glosarioTxt}

AHORA MISMO: el usuario est\xE1 en la secci\xF3n "${contexto.pagina || "desconocida"}" con la cuenta ${contexto.cuenta || "sin seleccionar"}.

C\xD3MO RESPOND\xC9S: en espa\xF1ol rioplatense, corto, directo, sin guion largo, sin listas de tres forzadas. Si la pregunta es sobre datos de una cuenta, us\xE1 las herramientas; nunca inventes un n\xFAmero. Si es sobre d\xF3nde est\xE1 algo en la app, dec\xED la secci\xF3n y qu\xE9 hacer. Si es sobre un t\xE9rmino, us\xE1 el glosario. Si no sab\xE9s, decilo y suger\xED crear un ticket desde Sistema.

PREGUNTA: ${mensajes[mensajes.length - 1]?.content || ""}`;
  const historial = mensajes.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  const msgs = [...historial, { role: "user", content: primerTurno }];
  let costo = 0;
  let vueltas = 0;
  while (vueltas++ < 7) {
    const res = await anthropic2.messages.create({ model: "claude-sonnet-5", max_tokens: 2500, system: `Sos el asistente de NorthSignal, la app con la que Andr\xE9s opera cuentas de Google Ads. Habl\xE1s con Andr\xE9s, que es quien construy\xF3 el sistema y conoce cada cuenta: no le expliques lo obvio ni le pidas contexto que ya tiene.

Las cuentas activas hoy son: ${listaCuentas || "ninguna cargada"}. Esa lista sale de la base en cada consulta, as\xED que es la buena. Nunca digas que una cuenta no existe sin buscarla ah\xED, ni sugieras abrir un ticket porque una cuenta "deber\xEDa estar cargada" si figura.

QU\xC9 POD\xC9S HACER

Antes de decir que algo no existe, mir\xE1 si el flujo que lo trae est\xE1 vivo con estado_de_los_flujos. Caso concreto y activo: los webhooks de cierres reales nunca recibieron un evento, as\xED que v_cierres_totales y v_win_rates_reales est\xE1n vac\xEDas y van a seguir as\xED hasta que se conecte GoHighLevel y Asana. Eso no es "no hubo cierres": es un flujo sin conectar, y decirlo mal lleva a la conclusi\xF3n opuesta.

Responder con datos. Todo n\xFAmero, nombre de campa\xF1a, keyword o fecha sale de una herramienta. Si no lo trajiste de una herramienta, no lo digas: "no lo tengo, lo busco" es una respuesta correcta y "creo que era alrededor de" no lo es. Cuando una herramienta devuelve vac\xEDo, mir\xE1 si trae una explicaci\xF3n del porqu\xE9 antes de concluir nada: no es lo mismo "no hay datos" que "todav\xEDa no se puede saber".

Explicar el razonamiento de un accionable. Para eso est\xE1 explicar_accionable: trae qui\xE9n lo propuso, con qu\xE9 evidencia, qu\xE9 invariantes toca, si se puede ejecutar y por qu\xE9 no, y qu\xE9 pas\xF3 con cambios parecidos. Si Andr\xE9s pregunta por qu\xE9 se propuso algo o si conviene hacerlo, esa es la herramienta, siempre, antes de opinar.

Ejecutar, si te lo pide. ejecutar_accionable encola un cambio por el mismo camino que el bot\xF3n de la app: mismo pre-vuelo, mismos guardarra\xEDles, mismo registro. Reglas: solo cuando lo pide expl\xEDcitamente, nunca por iniciativa propia, y antes de encolar dec\xED en una l\xEDnea qu\xE9 va a pasar. Si dud\xE1s de si lo est\xE1 pidiendo, ofrec\xE9 simular primero.

Hablarle a los agentes. Si Andr\xE9s pregunta algo que el agente deber\xEDa investigar, da una instrucci\xF3n que cambia c\xF3mo analizar, o corrige algo que un agente asumi\xF3 mal, us\xE1 dejar_nota_para_agente. Sin eso la conversaci\xF3n muere ac\xE1 y el agente del lunes vuelve a analizar lo de siempre. Dec\xEDselo en una l\xEDnea cuando lo hagas: "le dej\xE9 nota al agente semanal de 360".

C\xD3MO RESPONDER

Directo y conversacional. Sin encabezados ni vi\xF1etas salvo que la respuesta sea naturalmente una lista. Castellano rioplatense.

Cuando algo no se puede, dec\xED por qu\xE9 y de qui\xE9n es el l\xEDmite. "Los RSA no se crean por script, eso es de Google" sirve; "no puedo hacer eso" no.

Un n\xFAmero siempre con su ventana: "5,44 USD en las \xFAltimas 4 semanas", no "5,44 USD".

Si la pregunta toca varias cuentas, contest\xE1 por cuenta: cada una tiene reglas propias y promediarlas da un n\xFAmero que no significa nada.`, messages: msgs, tools: TOOLS, output_config: { effort: "low" } });
    costo += (res.usage.input_tokens || 0) * 2 / 1e6 + (res.usage.output_tokens || 0) * 10 / 1e6;
    const toolUses = res.content.filter((b) => b.type === "tool_use");
    if (!toolUses.length || res.stop_reason !== "tool_use") {
      const texto = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return { texto, costo_usd: costo };
    }
    msgs.push({ role: "assistant", content: res.content });
    const results = [];
    for (const tu of toolUses) {
      let out;
      try {
        const inp = tu.input;
        if (tu.name === "estado_cuenta") {
          const [h, s7, plan, pulso] = await Promise.all([
            supabase2.from("v_headroom").select("*").eq("account", inp.cuenta).maybeSingle(),
            supabase2.from("v_serie_diaria").select("date,gasto,conversiones,cpa,madurez").eq("account", inp.cuenta).order("date", { ascending: false }).limit(14),
            supabase2.from("plan_semanal").select("semana,contexto,indicadores,hipotesis").eq("account", inp.cuenta).order("semana", { ascending: false }).limit(1).maybeSingle(),
            supabase2.from("pulso_diario").select("fecha,nivel,hallazgo_principal,resumen").eq("account", inp.cuenta).order("fecha", { ascending: false }).limit(1).maybeSingle()
          ]);
          const d = s7.data || [];
          const sum = (arr, k) => arr.reduce((a, r) => a + Number(r[k] || 0), 0);
          const c7 = d.slice(0, 7), c14 = d;
          out = { headroom: h.data, ultimos_7d: { gasto: sum(c7, "gasto"), conversiones: sum(c7, "conversiones"), cpa: sum(c7, "conversiones") ? sum(c7, "gasto") / sum(c7, "conversiones") : null }, ultimos_14d: { gasto: sum(c14, "gasto"), conversiones: sum(c14, "conversiones"), cpa: sum(c14, "conversiones") ? sum(c14, "gasto") / sum(c14, "conversiones") : null }, plan: plan.data, ultimo_pulso: pulso.data };
        } else if (tu.name === "accionables_abiertos") {
          const { data: acc } = await supabase2.from("accionables_espejo").select("titulo, estado, prioridad, naturaleza, origen, entidad, por_que, detectado, vence, accion, accion_valida, accion_error, url").eq("account", inp.cuenta).in("estado", ["Propuesto", "Bloqueado", "Aprobado", "En curso"]).order("prioridad", { ascending: true }).limit(30);
          out = {
            cuenta: inp.cuenta,
            cuantos: (acc || []).length,
            accionables: (acc || []).map((x) => ({
              titulo: x.titulo,
              estado: x.estado,
              prioridad: x.prioridad,
              naturaleza: x.naturaleza,
              origen: x.origen,
              entidad: x.entidad,
              por_que: (x.por_que || "").slice(0, 700),
              detectado: x.detectado,
              vence: x.vence,
              se_puede_ejecutar: !!x.accion_valida,
              verbo: x.accion?.verbo || null,
              por_que_manual: x.accion_valida ? null : x.accion_error || "sin acci\xF3n estructurada",
              url: x.url
            })),
            nota: (acc || []).length ? 'Contenido real del espejo de Notion, sincronizado cada 30 minutos. Pod\xE9s citar t\xEDtulos y el "por qu\xE9" textual.' : "Esta cuenta no tiene accionables abiertos ahora mismo."
          };
        } else if (tu.name === "explicar_accionable") {
          const { data: exp } = await supabase2.rpc("explicar_accionable", { p_notion_id: inp.notion_id });
          out = exp || { error: "No encontr\xE9 ese accionable. Buscalo primero con buscar_accionable." };
        } else if (tu.name === "ejecutar_accionable") {
          const base = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3e3}`;
          let j = null, ok = false;
          try {
            const r = await fetch(`${base}/api/accionables/${encodeURIComponent(inp.notion_id)}/aprobar-ejecutar`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.APP_ACCESS_TOKEN}` },
              body: JSON.stringify({ modo: inp.modo === "ejecutar" ? "ejecutar" : "simular" })
            });
            ok = r.ok;
            j = await r.json().catch(() => null);
          } catch (e) {
            j = { error: e?.message || "no se pudo llamar al endpoint" };
          }
          out = ok ? {
            ok: true,
            modo: inp.modo,
            resultado: j,
            nota: inp.modo === "simular" ? "Simulado: no se toc\xF3 nada. El resultado muestra qu\xE9 har\xEDa." : "Encolado. El ejecutor de Google Ads lo aplica dentro de la hora."
          } : {
            ok: false,
            error: j?.error || "No se pudo encolar",
            motivo: j?.por_que || j?.conflicto,
            que_hacer: 'Si dice que no tiene acci\xF3n estructurada v\xE1lida, hay que ejecutarlo a mano con los pasos de "C\xF3mo hacerlo".'
          };
        } else if (tu.name === "dejar_nota_para_agente") {
          const { data: id } = await supabase2.rpc("dejar_nota_para_agente", {
            p_contenido: inp.contenido,
            p_account: inp.cuenta || null,
            p_para: inp.para || "semanal",
            p_tipo: inp.tipo || "pregunta"
          });
          out = { ok: true, id, nota: `Anotado para el agente ${inp.para || "semanal"}${inp.cuenta ? " de " + inp.cuenta : ""}. Lo va a leer en su pr\xF3xima corrida.` };
        } else if (tu.name === "que_pregunte_andres") {
          const { data: notas } = await supabase2.from("v_notas_pendientes").select("*").limit(20);
          out = { pendientes: notas || [] };
        } else if (tu.name === "consultar_datos") {
          const { data: dic } = await supabase2.rpc("diccionario_datos");
          const existe = (dic || []).some((d) => d.objeto === inp.vista);
          if (!existe) {
            out = { error: `La vista "${inp.vista}" no existe. Mir\xE1 que_datos_hay para el cat\xE1logo.` };
          } else {
            let q = supabase2.from(inp.vista).select("*").limit(Math.min(inp.limite || 30, 100));
            if (inp.cuenta) q = q.eq("account", inp.cuenta);
            const { data: filas2, error: e } = await q;
            out = e ? { error: e.message, nota: "Puede que esa vista no filtre por cuenta." } : { vista: inp.vista, filas: filas2 || [], cuantas: (filas2 || []).length };
          }
        } else if (tu.name === "que_datos_hay") {
          const { data: dic } = await supabase2.rpc("diccionario_datos");
          const q = String(inp.buscar || "").toLowerCase().trim();
          const filas2 = (dic || []).filter((d) => !q || `${d.objeto} ${d.usar_para} ${d.cuidado || ""}`.toLowerCase().includes(q));
          out = {
            encontrados: filas2.length,
            objetos: filas2.slice(0, 40),
            nota: filas2.length > 40 ? "Se muestran los primeros 40. Afin\xE1 la b\xFAsqueda." : void 0
          };
        } else if (tu.name === "completitud_de_cuenta") {
          const { data: comp } = await supabase2.rpc("completitud_de_cuenta", { p_account: inp.cuenta });
          out = {
            cuenta: inp.cuenta,
            requisitos: comp || [],
            faltan: (comp || []).filter((r) => !r.cumple).map((r) => r.requisito)
          };
        } else if (tu.name === "estado_de_los_flujos") {
          const { data: fl } = await supabase2.rpc("estado_de_los_flujos");
          out = {
            flujos: fl || [],
            cortados: (fl || []).filter((f) => f.estado === "CORTADO" || f.estado === "NUNCA RECIBIO NADA")
          };
        } else if (tu.name === "salud_del_sistema") {
          const { data: s2 } = await supabase2.rpc("get_salud_sistema");
          out = s2 || { error: "no disponible" };
        } else if (tu.name === "por_que_limitada") {
          const { data: p } = await supabase2.from("v_por_que_limitada").select("*").eq("account", inp.cuenta).maybeSingle();
          out = p || { cuenta: inp.cuenta, nota: "Sin datos de cuota perdida para esta cuenta en el periodo." };
        } else if (tu.name === "buscar_accionable") {
          const q = String(inp.texto || "").trim();
          const { data: acc } = await supabase2.from("accionables_espejo").select("titulo, estado, prioridad, naturaleza, origen, entidad, por_que, detectado, vence, accion, accion_valida, accion_error, ejecutado_el, url").eq("account", inp.cuenta).or(`titulo.ilike.%${q}%,por_que.ilike.%${q}%,entidad.ilike.%${q}%`).limit(10);
          out = (acc || []).length ? { cuenta: inp.cuenta, encontrados: acc.length, accionables: acc.map((x) => ({ ...x, por_que: (x.por_que || "").slice(0, 1500), se_puede_ejecutar: !!x.accion_valida })) } : { cuenta: inp.cuenta, encontrados: 0, nota: `No hay accionables de ${inp.cuenta} que mencionen "${q}". Puede estar escrito distinto: prob\xE1 con una palabra sola.` };
        } else if (tu.name === "propuestas_estrategicas") {
          const { data: pr } = await supabase2.from("propuestas_estrategicas").select("id, tipo, titulo, estado, hipotesis, que_se_propuso, ejecucion_real, resultado_esperado, creada_el, decidida_el").eq("account", inp.cuenta).order("creada_el", { ascending: false }).limit(10);
          out = (pr || []).length ? { cuenta: inp.cuenta, propuestas: pr } : { cuenta: inp.cuenta, nota: "Esta cuenta no tiene propuestas estrat\xE9gicas cargadas." };
        } else if (tu.name === "salud_datos") {
          const [dh, integ, snaps] = await Promise.all([supabase2.from("v_data_health").select("*"), supabase2.from("v_integridad_conversiones").select("*").limit(5), supabase2.from("v_snapshots_disponibles").select("*")]);
          out = { data_health: dh.data, descuadres: integ.data, snapshots: snaps.data };
        } else if (tu.name === "doc_maestro") {
          const r = await supabase2.from("doc_maestro_humano").select("contenido").eq("account", inp.cuenta).eq("seccion", inp.seccion).eq("vigente", true).maybeSingle();
          out = r.data?.contenido || "Secci\xF3n vac\xEDa.";
        } else out = { error: "herramienta desconocida" };
      } catch (e) {
        out = { error: e.message };
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: typeof out === "string" ? out : JSON.stringify(out).slice(0, 6e3) });
    }
    msgs.push({ role: "user", content: results });
  }
  return { texto: "No pude cerrar la respuesta en cuatro pasos. Prob\xE1 una pregunta m\xE1s acotada.", costo_usd: costo };
}

// src/server/lib/memoria.ts
async function embed(textos) {
  if (!ai || !textos.length) return null;
  try {
    const out = [];
    for (const t of textos) {
      const r = await ai.models.embedContent({ model: "text-embedding-004", contents: t.slice(0, 2e3) });
      const v = r?.embeddings?.[0]?.values || r?.embedding?.values;
      if (!v) return null;
      out.push(v);
    }
    return out;
  } catch (e) {
    console.error("[embed] " + e.message);
    return null;
  }
}
async function embeberPendientes(supabase2) {
  const { data: pend } = await supabase2.from("v_memoria_pendiente").select("*");
  if (!pend?.length) return 0;
  const vecs = await embed(pend.map((p) => `${p.tipo}: ${p.texto}`));
  if (!vecs) return 0;
  let n = 0;
  for (let i = 0; i < pend.length; i++) {
    const { error } = await supabase2.from("memoria").update({ embedding: JSON.stringify(vecs[i]) }).eq("id", pend[i].id);
    if (!error) n++;
  }
  return n;
}
async function parecidoA(supabase2, texto, account, k = 5, excluirDesde = null) {
  const v = await embed([texto]);
  if (!v) return [];
  const { data, error } = await supabase2.rpc("parecido_a", { p_embedding: JSON.stringify(v[0]), p_account: account, p_k: k, p_excluir_desde: excluirDesde });
  if (error) {
    console.error("[parecido_a] " + error.message);
    return [];
  }
  return data || [];
}

// src/server/auth/session.ts
import * as crypto2 from "crypto";
var SECRET = () => process.env.SESSION_SECRET || process.env.APP_ACCESS_TOKEN || "";
var SESSION_MS = 7 * 24 * 60 * 60 * 1e3;
function sign(payload) {
  return crypto2.createHmac("sha256", SECRET()).update(payload).digest("hex");
}
function createSessionToken() {
  const expires = Date.now() + SESSION_MS;
  const nonce = crypto2.randomBytes(12).toString("hex");
  const payload = `${expires}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}
function verifySessionToken(token) {
  if (!token || !SECRET()) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, sig] = parts;
  const expected = sign(`${expires}.${nonce}`);
  if (sig.length !== expected.length) return false;
  if (!crypto2.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(expires) > Date.now();
}

// src/server/auth/middleware.ts
var authMiddleware = (req, res, next) => {
  if (["/health", "/login", "/logout", "/me"].includes(req.path)) return next();
  if (req.path.startsWith("/webhooks/")) return next();
  if (!process.env.APP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "APP_ACCESS_TOKEN no est\xE1 configurado en el servidor" });
  }
  const headerToken = req.headers.authorization?.split(" ")[1];
  if (headerToken) {
    if (comparacionSegura(headerToken, process.env.APP_ACCESS_TOKEN || "")) return next();
    if (verifySessionToken(headerToken)) return next();
    if (req.path.startsWith("/cron/") && process.env.CRON_SECRET && comparacionSegura(headerToken, process.env.CRON_SECRET)) return next();
  }
  if (verifySessionToken(req.cookies?.auth_token)) return next();
  return res.status(401).json({ error: "Unauthorized" });
};

// src/server/auth/routes.ts
import { Router as Router2 } from "express";

// src/server/auth/limite.ts
function ipDe(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "desconocida";
}
async function verificarLimite(supabase2, clave, ruta, max = 20, ventanaMin = 15) {
  if (!supabase2) return { permitido: true };
  try {
    const { data, error } = await supabase2.rpc("limite_de_tasa", {
      p_clave: clave,
      p_ruta: ruta,
      p_max: max,
      p_ventana: `${ventanaMin} minutes`
    });
    if (error) return { permitido: true };
    return {
      permitido: !!data?.permitido,
      motivo: data?.motivo,
      esperar: data?.esperar_segundos
    };
  } catch {
    return { permitido: true };
  }
}
async function registrarIntento(supabase2, clave, ruta, exito, detalle) {
  if (!supabase2) return;
  try {
    await supabase2.rpc("registrar_intento", {
      p_clave: clave,
      p_ruta: ruta,
      p_exito: exito,
      p_detalle: detalle || null
    });
  } catch {
  }
}

// src/server/auth/routes.ts
function crearAuthRouter(supabase2) {
  const authRouter = Router2();
  authRouter.post("/login", async (req, res) => {
    const { password } = req.body;
    const ip = ipDe(req);
    const v = await verificarLimite(supabase2, ip, "/login", 10, 15);
    if (!v.permitido) {
      return res.status(429).json({
        error: v.motivo === "demasiados intentos fallidos" ? `Demasiados intentos fallidos. Prob\xE1 de nuevo en ${Math.ceil((v.esperar || 60) / 60)} minuto(s).` : `Demasiados intentos. Prob\xE1 de nuevo en ${Math.ceil((v.esperar || 60) / 60)} minuto(s).`,
        esperar_segundos: v.esperar
      });
    }
    if (!process.env.APP_ACCESS_TOKEN) {
      return res.status(500).json({ error: "APP_ACCESS_TOKEN no est\xE1 configurado en el servidor" });
    }
    if (comparacionSegura(String(password || ""), process.env.APP_ACCESS_TOKEN)) {
      const sessionToken = createSessionToken();
      await registrarIntento(supabase2, ip, "/login", true);
      const isProd = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIE === "true";
      res.cookie("auth_token", sessionToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1e3,
        path: "/"
      });
      return res.json({ success: true, token: sessionToken });
    }
    await registrarIntento(supabase2, ip, "/login", false, "contrase\xF1a incorrecta");
    return res.status(401).json({ error: "Contrase\xF1a incorrecta" });
  });
  authRouter.post("/logout", (_req, res) => {
    const isProd = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIE === "true";
    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/"
    });
    res.json({ success: true });
  });
  authRouter.get("/me", (req, res) => {
    const headerToken = req.headers.authorization?.split(" ")[1];
    if (headerToken) {
      if (process.env.APP_ACCESS_TOKEN && comparacionSegura(headerToken, process.env.APP_ACCESS_TOKEN)) return res.json({ authenticated: true });
      if (verifySessionToken(headerToken)) return res.json({ authenticated: true });
    }
    if (verifySessionToken(req.cookies?.auth_token)) return res.json({ authenticated: true });
    return res.status(401).json({ error: "Unauthorized" });
  });
  return authRouter;
}

// src/server/entorno.ts
function entornoActual() {
  const v = process.env.VERCEL_ENV;
  if (v === "production") return "produccion";
  if (v === "preview") return "rama";
  if (v) return "local";
  return process.env.NODE_ENV === "production" && process.env.FORZAR_PRODUCCION === "true" ? "produccion" : "local";
}
var esProduccion = () => entornoActual() === "produccion";
function puedeEscribirAfuera() {
  if (esProduccion()) return { permitido: true };
  return {
    permitido: false,
    motivo: `Est\xE1s en entorno "${entornoActual()}" y esto escribe hacia afuera. Queda en modo simulaci\xF3n: ves qu\xE9 har\xEDa, pero no sale. Si de verdad quer\xE9s ejecutar contra la cuenta real, hacelo desde la app desplegada.`
  };
}
function banda() {
  const e = entornoActual();
  if (e === "produccion") return null;
  return e === "rama" ? { entorno: e, color: "#b45309", texto: "RAMA DE PRUEBA \xB7 las acciones no se ejecutan" } : { entorno: e, color: "#b42318", texto: "LOCAL contra la base REAL \xB7 las acciones no se ejecutan" };
}

// src/server/domain/clientRules.ts
var CLIENT_RULES = {
  KAREDO: {
    currency: "EUR",
    locale: "de-DE",
    dailyBudget: 135,
    forbiddenMetrics: ["conv_value", "roas", "all_conversions"],
    aiContext: `
CUENTA: Karedo GmbH \xB7 SaaS B2B de software para tutela legal \xB7 Alemania \xB7 EUR
Presupuesto: 135 EUR/d\xEDa \xB7 Solo Search

REGLAS QUE NO POD\xC9S VIOLAR:
- NUNCA menciones ROAS ni valor de conversi\xF3n. El valor est\xE1 fijado
  arbitrariamente en 20 EUR por registro: cualquier ROAS derivado no significa nada.
- Las conversiones son DIRECCIONALES. Enhanced Conversions tiene 0-15% de
  coincidencia y dispara al hacer clic en "Registrieren", no al completar el
  registro. La direcci\xF3n del error es DESCONOCIDA: no afirmes que est\xE1n
  subestimadas ni sobrestimadas.
- No propongas cambios de puja salvo que se apoyen en datos de simulaci\xF3n o en
  un problema estructural evidente.
- Hay una conversi\xF3n primaria sin datos ("sin conexi\xF3n (subida)") que corrompe
  la se\xF1al de Smart Bidding. Es el problema abierto de mayor prioridad.
- Hay cinco acciones de conversi\xF3n SIGNUP activas simult\xE1neamente.`
  },
  BHI: {
    currency: "CLP",
    locale: "es-CL",
    dailyBudget: 2e4,
    forbiddenMetrics: ["conv_value", "roas"],
    aiContext: `
CUENTA: Best Health International \xB7 Asesor\xEDa en salud internacional \xB7 Chile \xB7 CLP
Presupuesto: 20.000 CLP/d\xEDa \xB7 Solo Search \xB7 ABC1 en cinco comunas de Santiago

REGLAS QUE NO POD\xC9S VIOLAR:
- RIESGO REGULATORIO: el DFL 251 Art. 46 proh\xEDbe a aseguradoras offshore vender
  o intermediar seguros en Chile. Nunca uses ni sugieras las palabras vender,
  contratar, cotizar, p\xF3liza, precios, su seguro ni opciones de cobertura. El
  vocabulario es de asesor\xEDa, orientaci\xF3n y acompa\xF1amiento.
- Cualquier se\xF1al de AI Max, recursos generados autom\xE1ticamente o auto-apply es
  un problema de CUMPLIMIENTO LEGAL, no de rendimiento.
- Las conversiones de Google NO son la fuente de verdad del negocio. El pipeline
  real vive en GoHighLevel. Nunca las llames solicitudes ni leads.
- Hay tres conversiones marcadas como primarias, lo que reparte la se\xF1al de
  Smart Bidding en objetivos de peso muy distinto.
- Subir presupuesto S\xCD genera m\xE1s volumen, pero a un CPA 55% mayor.
- Ciclo de venta largo: un movimiento semanal casi nunca es significativo.`
  },
  "360": {
    currency: "CLP",
    locale: "es-CL",
    dailyBudget: 21e3,
    forbiddenMetrics: ["conv_value", "roas", "all_conversions"],
    aiContext: `
CUENTA: 360 Producciones \xB7 Productora de eventos corporativos \xB7 Chile \xB7 CLP
Presupuesto: 21.000 CLP/d\xEDa \xB7 Solo Search \xB7 Ticket de 3 a 25 millones CLP

REGLAS QUE NO POD\xC9S VIOLAR:
- Los montos de negocio salen del campo Monto de Asana, NUNCA de Google Ads. El
  valor de conversi\xF3n est\xE1 inflado por una regla de 1,5x.
- NUNCA uses all_conversions. Suma clics a WhatsApp, mail y llamadas que no son
  negocio: en una semana medida fueron 4 conversiones reales contra 10 totales.
- El Quality Score est\xE1 limitado por la landing, no por los anuncios. Es un techo
  estructural que no se resuelve con pujas.
- Volumen bajo: unos 14 formularios y 0,5 cierres al mes.
- En julio de 2026 un paquete de recomendaciones autom\xE1ticas de Google revirti\xF3
  meses de trabajo sin ser detectado. Cualquier cambio auto-aplicado es cr\xEDtico.`
  }
};
function getClientContext(client) {
  return CLIENT_RULES[client]?.aiContext || "Sin contexto espec\xEDfico de negocio.";
}

// server.ts
import express from "express";
import path from "path";
import { z as z4 } from "zod";
import cookieParser from "cookie-parser";
import { Client as NotionClient } from "@notionhq/client";
var cargarPdf = () => Promise.resolve().then(() => (init_reporte_pdf(), reporte_pdf_exports));
var notionClientCache = {};
var _cuentasCache = { at: 0, data: [] };
async function cuentasActivas() {
  if (Date.now() - _cuentasCache.at < 3e5 && _cuentasCache.data.length) return _cuentasCache.data;
  if (!supabase) return [];
  const completo = await supabase.from("cuentas").select("account, nombre_cliente, moneda, locale, zona_horaria, cid, perfil_analisis, presupuesto_diario, notion_ficha_id, plataformas").eq("activa", true).order("account");
  if (completo.data?.length) {
    _cuentasCache = { at: Date.now(), data: completo.data };
    return completo.data;
  }
  if (completo.error) console.error("[cuentas] select completo fall\xF3: " + completo.error.message + " \u2014 reintentando con columnas base");
  const base = await supabase.from("cuentas").select("account, nombre_cliente, moneda, cid, perfil_analisis").eq("activa", true).order("account");
  if (base.error) console.error("[cuentas] select base tambi\xE9n fall\xF3: " + base.error.message);
  if (base.data?.length) _cuentasCache = { at: Date.now(), data: base.data };
  return base.data || [];
}
async function resolveNotionClient(notion2, relationProp) {
  if (!relationProp?.relation || relationProp.relation.length === 0) return "Unknown";
  const pageId = relationProp.relation[0].id;
  if (notionClientCache[pageId]) return notionClientCache[pageId];
  try {
    const porFicha = (await cuentasActivas()).find((c) => c.notion_ficha_id && c.notion_ficha_id.replace(/-/g, "") === String(pageId).replace(/-/g, ""));
    if (porFicha) {
      notionClientCache[pageId] = porFicha.account;
      return porFicha.account;
    }
  } catch {
  }
  try {
    const page = await notion2.pages.retrieve({ page_id: pageId });
    const name = page.properties.Cliente?.title?.[0]?.plain_text || page.properties.Name?.title?.[0]?.plain_text || "Unknown";
    const cts = await cuentasActivas();
    const nm = String(name).toLowerCase().trim();
    const encontrada = cts.find((c) => (c.nombre_cliente || "").toLowerCase() === nm) || cts.find((c) => nm === c.account.toLowerCase().replace(/_/g, " ")) || cts.find((c) => nm.startsWith((c.nombre_cliente || "").toLowerCase().split(" ")[0]) && (c.nombre_cliente || "").split(" ").length > 1 && nm.includes((c.nombre_cliente || "").toLowerCase().split(" ")[1]));
    if (!encontrada) console.warn(`[notion] cliente sin cuenta: "${name}" (pagina ${pageId})`);
    const normalized = encontrada ? encontrada.account : "Unknown";
    notionClientCache[pageId] = normalized;
    return normalized;
  } catch (e) {
    return "Unknown";
  }
}
function createApp() {
  const app2 = express();
  app2.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app2.use(cookieParser());
  app2.use("/api", crearAuthRouter(supabase));
  app2.get("/r/:token", async (req, res) => {
    if (!supabase) return res.status(503).send("No disponible");
    const ip = ipDe(req);
    const lim = await verificarLimite(supabase, ip, "/r", 30, 10);
    if (!lim.permitido) return res.status(429).send('<html><body style="font-family:Helvetica;padding:40px;color:#333">Demasiados pedidos. Prob\xE1 de nuevo en unos minutos.</body></html>');
    const { data: r } = await supabase.from("v_reporte_publico").select("*").eq("token", req.params.token).maybeSingle();
    if (!r) {
      await registrarIntento(supabase, ip, "/r", false, "token inexistente");
      return res.status(404).send('<html><body style="font-family:Helvetica;padding:40px;color:#333">Este reporte no est\xE1 disponible.</body></html>');
    }
    await registrarIntento(supabase, ip, "/r", true);
    await supabase.from("reportes_cliente").update({ vistas: r.vistas ? r.vistas + 1 : 1, visto_el: r.visto_el || (/* @__PURE__ */ new Date()).toISOString() }).eq("token", req.params.token);
    const en = r.idioma === "en";
    const t = en ? { titulo: "Performance Report", periodo: "Period", inv: "Spend", conv: "Conversions", cpa: "CPA", clics: "Clicks", ctr: "CTR", vs: "vs previous period", camp: "Campaigns", grp: "Ad groups", pdf: "Download PDF", by: "Prepared by" } : { titulo: "Reporte de rendimiento", periodo: "Per\xEDodo", inv: "Inversi\xF3n", conv: "Conversiones", cpa: "CPA", clics: "Clics", ctr: "CTR", vs: "vs per\xEDodo anterior", camp: "Campa\xF1as", grp: "Grupos de anuncios", pdf: "Descargar PDF", by: "Preparado por" };
    const { data: cuenta } = await supabase.from("cuentas").select("moneda, locale").eq("account", r.account).single();
    const fmt = (v, tipo = "num") => v == null ? "\u2014" : tipo === "moneda" ? new Intl.NumberFormat(cuenta?.locale || "es-CL", { style: "currency", currency: cuenta?.moneda || "CLP", maximumFractionDigits: cuenta?.moneda === "EUR" ? 2 : 0 }).format(Number(v)) : tipo === "pct" ? Number(v).toFixed(2) + "%" : new Intl.NumberFormat(cuenta?.locale || "es-CL", { maximumFractionDigits: 1 }).format(Number(v));
    const delta2 = (k) => {
      const m = r.metricas?.[k];
      if (!m || m.anterior == null || m.actual == null || !m.anterior) return "";
      const d = (m.actual - m.anterior) / m.anterior * 100;
      const bueno = k === "cpa" ? d < 0 : d > 0;
      return `<span style="font-size:12px;color:${bueno ? "#1a7f37" : "#b42318"}">${d > 0 ? "+" : ""}${d.toFixed(0)}% ${t.vs}</span>`;
    };
    const kpis = r.reporte_plantilla?.kpis || ["gasto", "conversiones", "cpa", "clics"];
    const kpiNombre = { gasto: t.inv, conversiones: t.conv, cpa: t.cpa, clics: t.clics, ctr: t.ctr, cuota_impresiones: en ? "Impression share" : "Cuota de impresiones" };
    const kpiHtml = kpis.map((k) => `<div style="flex:1;min-width:120px;padding:14px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${kpiNombre[k] || k}</div><div style="font-size:22px;font-weight:600;color:#111827;margin:4px 0 2px">${fmt(r.metricas?.[k]?.actual, k === "gasto" || k === "cpa" ? "moneda" : k === "ctr" || k === "cuota_impresiones" ? "pct" : "num")}</div>${delta2(k)}</div>`).join("");
    const esc = (x) => String(x ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const bloques = (r.bloques || []).map((b) => `<section style="margin:22px 0"><h2 style="font-size:14px;font-weight:700;color:#111827;margin:0 0 8px">${esc(b.etiqueta)}</h2>${b.texto ? `<p style="margin:0 0 8px;line-height:1.55">${esc(b.texto).replace(/\n\n/g, '</p><p style="margin:0 0 8px;line-height:1.55">')}</p>` : ""}${b.vinetas?.length ? `<ul style="margin:0;padding-left:18px;line-height:1.55">${b.vinetas.map((v) => `<li style="margin:4px 0">${esc(v)}</li>`).join("")}</ul>` : ""}</section>`).join("");
    const tabla = (filas, cols) => filas?.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><thead><tr>${cols.map((c) => `<th style="text-align:${c.k === "nombre" || c.k === "campana" ? "left" : "right"};padding:8px;background:#0062CC;color:#fff;font-weight:600">${c.n}</th>`).join("")}</tr></thead><tbody>${filas.map((f, i) => `<tr style="background:${i % 2 ? "#f9fafb" : "#fff"}">${cols.map((c) => `<td style="text-align:${c.k === "nombre" || c.k === "campana" ? "left" : "right"};padding:7px 8px;border-bottom:1px solid #eee">${c.f ? fmt(f[c.k], c.f) : esc(f[c.k])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
    const camp = tabla(r.campanas?.campanas || [], [{ k: "nombre", n: t.camp }, { k: "gasto", n: t.inv, f: "moneda" }, { k: "conv", n: t.conv, f: "num" }, { k: "cpa", n: t.cpa, f: "moneda" }, { k: "ctr", n: t.ctr, f: "pct" }]);
    const grp = tabla((r.campanas?.grupos || []).slice(0, 15), [{ k: "nombre", n: t.grp }, { k: "gasto", n: t.inv, f: "moneda" }, { k: "conv", n: t.conv, f: "num" }, { k: "cpa", n: t.cpa, f: "moneda" }]);
    const titulo = (r.encabezado_reporte || "").split("|")[0].trim() || r.nombre_cliente;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    res.send(`<!doctype html><html lang="${r.idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} \xB7 ${t.titulo}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:860px;margin:0 auto;padding:24px 16px 48px">
  <header style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:8px 0 16px;border-bottom:2px solid #0062CC;margin-bottom:20px">
    <div><div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em">NorthSignal</div><h1 style="font-size:22px;margin:4px 0 2px;color:#111827">${esc(titulo)}</h1><div style="font-size:13px;color:#4b5563">${t.titulo} \xB7 ${t.periodo}: ${r.periodo_desde} \u2192 ${r.periodo_hasta}</div></div>
    <a href="/api/publico/reportes/${esc(r.token)}/pdf" style="font-size:13px;color:#0062CC;text-decoration:none;white-space:nowrap">${t.pdf} \u2193</a>
  </header>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">${kpiHtml}</div>
  <main style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 22px 18px;font-size:14px">${bloques}</main>
  <div style="margin-top:20px">${camp}${grp}</div>
  <footer style="margin-top:28px;font-size:12px;color:#6b7280">${t.by} ${esc(r.reporte_plantilla?.firma || "NorthSignal")} \xB7 v${r.version}</footer>
</div></body></html>`);
  });
  app2.get("/api/publico/reportes/:token/pdf", async (req, res) => {
    if (!supabase) return res.status(503).send("No disponible");
    const ipPdf = ipDe(req);
    const limPdf = await verificarLimite(supabase, ipPdf, "/publico-pdf", 20, 10);
    if (!limPdf.permitido) return res.status(429).send("Demasiados pedidos. Prob\xE1 de nuevo en unos minutos.");
    const { data: r } = await supabase.from("reportes_cliente").select("id, pdf_path, estado, account, periodo_desde").eq("token", req.params.token).in("estado", ["aprobado", "enviado"]).maybeSingle();
    if (!r) {
      await registrarIntento(supabase, ipPdf, "/publico-pdf", false, "token inexistente");
      return res.status(404).send("No disponible");
    }
    await registrarIntento(supabase, ipPdf, "/publico-pdf", true);
    let ruta = r.pdf_path;
    if (!ruta) {
      try {
        ruta = (await generarYGuardarPdf(r.id)).pdf_path;
      } catch {
      }
    }
    if (!ruta) return res.status(404).send("PDF no disponible");
    const { data: file } = await supabase.storage.from("reportes").download(ruta);
    if (!file) return res.status(404).send("PDF no disponible");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="reporte_${r.account}_${r.periodo_desde}.pdf"`);
    res.send(Buffer.from(await file.arrayBuffer()));
  });
  app2.use("/api", authMiddleware);
  app2.use("/api", (req, res, next) => {
    const t0 = Date.now();
    const origJson = res.json.bind(res);
    res.json = (body) => {
      const ms = Date.now() - t0;
      if (res.statusCode >= 500) {
        console.error(`[${res.statusCode}] ${req.method} ${req.originalUrl} ${ms}ms \u2014 ${body?.error || JSON.stringify(body).slice(0, 200)}`);
      } else if (ms > 8e3) {
        console.warn(`[lento ${ms}ms] ${req.method} ${req.originalUrl}`);
      }
      return origJson(body);
    };
    next();
  });
  app2.get("/api/health/system", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase missing" });
    try {
      const { data: dataHealth } = await supabase.from("v_data_health").select("*");
      const { data: webhookHealth } = await supabase.from("v_webhook_health").select("*");
      const { data: integridadDatos } = await supabase.from("v_integridad_datos").select("*");
      const { data: runScorecard } = await supabase.from("v_run_scorecard").select("*").order("run_date", { ascending: false });
      const { data: runTendencia } = await supabase.from("v_run_tendencia").select("*");
      const { data: cambiosDetectados } = await supabase.from("v_cambios_detectados").select("*").order("detectado_hasta", { ascending: false }).limit(25);
      const { data: diccionarioDatos } = await supabase.rpc("diccionario_datos");
      res.json({
        dataHealth: dataHealth || [],
        webhookHealth: webhookHealth || [],
        integridadDatos: integridadDatos || [],
        runScorecard: runScorecard || [],
        runTendencia: runTendencia || [],
        cambiosDetectados: cambiosDetectados || [],
        diccionarioDatos: diccionarioDatos || []
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/health/run_quality/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase missing" });
    try {
      const { revision_humana } = req.body;
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const paramId = req.params.id;
      let query = supabase.from("run_quality").update({
        revision_humana,
        revision_humana_fecha: today
      });
      if (/^\d{4}-\d{2}-\d{2}/.test(paramId)) {
        query = query.eq("run_date", paramId);
      } else {
        query = query.eq("id", paramId);
      }
      const { data, error } = await query.select();
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/daily/overview", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
    const client = req.query.client || "360";
    try {
      const { data: pulses, error: pulseErr } = await supabase.from("v_pulso_hoy").select("*");
      if (pulseErr) console.error("Pulse error:", pulseErr);
      const pulse = pulses?.find((p) => p.account?.toLowerCase() === client.toLowerCase()) || null;
      const { data: dailySeries, error: serieErr } = await supabase.from("v_serie_diaria").select("*").eq("account", client).order("date", { ascending: true }).limit(28);
      if (serieErr) console.error("Serie error:", serieErr);
      const { data: diaConCambios, error: cambiosErr } = await supabase.from("v_dia_con_cambios").select("*").eq("account", client).order("date", { ascending: false }).limit(14);
      if (cambiosErr) console.error("Cambios error:", cambiosErr);
      const { data: newTerms, error: termsErr } = await supabase.from("v_terminos_nuevos").select("*").eq("account", client).order("gasto_acumulado", { ascending: false }).limit(10);
      if (termsErr) console.error("Terms error:", termsErr);
      const { data: recentChanges, error: recentErr } = await supabase.from("v_cambios_recientes").select("*").eq("account", client).limit(10);
      if (recentErr) console.error("Recent changes error:", recentErr);
      res.json({
        success: true,
        client,
        pulse,
        allPulses: pulses || [],
        daily: dailySeries || [],
        dailySeries: dailySeries || [],
        diaConCambios: diaConCambios || [],
        newTerms: newTerms || [],
        recentChanges: recentChanges || []
      });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/todos_los_cambios", async (req, res) => {
    try {
      const client = req.query.client || req.query.account;
      if (!client) return res.status(400).json({ error: "Client required" });
      if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
      const { data, error } = await supabase.from("v_todos_los_cambios").select("*").ilike("account", client).order("fecha", { ascending: false }).limit(50);
      if (error) {
        console.error("Error consultando v_todos_los_cambios:", error);
        return res.json({ changes: [] });
      }
      res.json({ changes: data || [] });
    } catch (e) {
      res.json({ changes: [] });
    }
  });
  app2.get("/api/daily/terminos_nuevos", async (req, res) => {
    try {
      const client = req.query.client || req.query.account || "360";
      if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
      const { data: newTerms, error: termsErr } = await supabase.from("v_terminos_nuevos").select("*").ilike("account", client).order("gasto_acumulado", { ascending: false }).limit(20);
      if (termsErr) {
        console.error("Terms error:", termsErr);
        return res.json({ terms: [] });
      }
      res.json({ terms: newTerms || [] });
    } catch (e) {
      res.json({ terms: [] });
    }
  });
  app2.get("/api/notion/clients", async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion2 = new NotionClient({ auth: notionKey2 });
      const response = await notion2.databases.query({
        database_id: NOTION_BASES.CLIENTES,
        page_size: 20
      });
      const monedaPorCuenta = new Map((await cuentasActivas()).map((c) => [c.account, c.moneda]));
      const clients = response.results.map((p) => {
        const name = p.properties.Cliente?.title?.map((t) => t.plain_text).join("") || "Sin nombre";
        const aprendizajes = p.properties["Aprendizajes consolidados"]?.rich_text?.map((t) => t.plain_text).join("") || "";
        const hipotesis = p.properties["Hipotesis abiertas"]?.rich_text?.map((t) => t.plain_text).join("") || "";
        const semanas = p.properties["Semanas analizadas"]?.number ?? 0;
        const status = p.properties.Estado?.select?.name || "Activo";
        const moneda = p.properties.Moneda?.select?.name || [...monedaPorCuenta.entries()].find(([a]) => name.toUpperCase().includes(a))?.[1] || "CLP";
        const country = p.properties.Pais?.select?.name || "";
        const budget = p.properties["Presupuesto diario"]?.number || 0;
        const customerId = p.properties["Customer ID"]?.rich_text?.map((t) => t.plain_text).join("") || "";
        return {
          id: p.id,
          name,
          status,
          aprendizajes_consolidados: aprendizajes,
          hipotesis_abiertas: hipotesis,
          semanas_analizadas: semanas,
          moneda,
          country,
          daily_budget: budget,
          customer_id: customerId,
          url: p.url
        };
      });
      res.json({ success: true, clients });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok", os: "NorthSignal v1.0" });
  });
  app2.get("/api/data", async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    let actionables = [];
    let briefs = [];
    let status = { supabase: false, notion: false };
    let errors = {};
    if (supabase) {
      try {
        const { data: accountsData, error: accountsErr } = await supabase.from("weekly_brief").select("account").order("run_ts", { ascending: false }).limit(1e3);
        if (accountsErr) throw accountsErr;
        const accounts = Array.from(new Set(accountsData.map((r) => r.account)));
        const results = await Promise.all(
          accounts.map(async (acc) => {
            const pf = (await cuentasActivas()).find((c) => c.account === acc)?.perfil_analisis;
            return supabase.rpc(pf === "cadena" ? "get_weekly_package_cadena" : "get_weekly_package", { p_account: acc });
          })
        );
        results.forEach((res2) => {
          if (res2.error) {
            console.error(res2.error);
          } else if (res2.data) {
            const data = Array.isArray(res2.data) ? res2.data[0] : res2.data;
            if (data && data.cuenta) {
              const account = data.cuenta;
              let spend = 0, cpa = 0, conversions = 0;
              const alerts = [];
              if (Array.isArray(data.brief)) {
                data.brief.forEach((row) => {
                  if (row.seccion === "totales" && row.item === "gasto") spend = parseFloat(row.valor) || 0;
                  if (row.seccion === "totales" && row.item === "cpa") cpa = parseFloat(row.valor) || 0;
                  if (row.seccion === "totales" && row.item === "conversiones") conversions = parseFloat(row.valor) || 0;
                });
              }
              if (Array.isArray(data.alertas_altas)) {
                data.alertas_altas.forEach((al) => {
                  alerts.push({
                    item: al.tipo || al.item || al.regla,
                    detail: al.entidad || al.detalle || al.valor,
                    note: (al.detalle || al.motivo || "") + (al.valor ? " (Valor: " + al.valor + ")" : "")
                  });
                });
              } else if (Array.isArray(data.brief)) {
                data.brief.forEach((row) => {
                  if (row.seccion === "alertas_alta") {
                    alerts.push({
                      item: row.item,
                      detail: row.detalle,
                      note: row.nota
                    });
                  }
                });
              }
              const history = [];
              if (Array.isArray(data.tendencia_8_semanas)) {
                data.tendencia_8_semanas.forEach((trend) => {
                  history.push({
                    week_start: trend.semana,
                    spend: trend.gasto || 0,
                    cpa: trend.cpa || 0,
                    conversions: trend.conversiones || 0
                  });
                });
                history.sort((a, b) => a.week_start.localeCompare(b.week_start));
              }
              briefs.push({
                id: account + "-" + data.semana,
                account,
                week_start: data.semana,
                metrics: { spend, cpa, conversions },
                alerts,
                history
              });
            }
          }
        });
        status.supabase = true;
      } catch (e) {
        errors.supabase = e.message || String(e);
      }
    } else {
      errors.supabase = "Credenciales de Supabase no configuradas";
    }
    if (notionKey2) {
      try {
        const notion2 = new NotionClient({ auth: notionKey2 });
        const response = await notion2.databases.query({
          database_id: NOTION_BASES.ACCIONABLES,
          page_size: 100
        });
        if (response.results) {
          status.notion = true;
          actionables = await Promise.all(response.results.map(async (page) => {
            const props = page.properties;
            const titleArray = props.Accion?.title || props.Name?.title || props.Title?.title;
            const title = titleArray && titleArray.length > 0 ? titleArray.map((rt) => rt.plain_text).join("") : "Accionable sin t\xEDtulo";
            const client = await resolveNotionClient(notion2, props.Cliente || props.Client);
            const why = props["Por que"]?.rich_text?.map((rt) => rt.plain_text).join("") || "";
            const where = props.Donde?.rich_text?.map((rt) => rt.plain_text).join("") || "";
            const status2 = props.Estado?.select?.name || NOTION_STATES.PROPUESTO;
            const priority = props.Prioridad?.select?.name || "Medium";
            const revision_ia = props["Revision IA"]?.select?.name || NOTION_REVISION_IA.SIN_REVISAR;
            const punto_disputa = props["Punto en disputa"]?.rich_text?.map((rt) => rt.plain_text).join("") || "";
            const decision_final = props["Decision final"]?.rich_text?.map((rt) => rt.plain_text).join("") || "";
            const ejecutado_el = props["Ejecutado el"]?.date?.start || null;
            const resultado_observado = props["Resultado observado"]?.rich_text?.map((rt) => rt.plain_text).join("") || "";
            const detectado = props["Detectado"]?.date?.start || page.created_time;
            let comments_count = 0;
            try {
              const commentRes = await notion2.comments.list({ block_id: page.id });
              comments_count = commentRes.results?.length || 0;
            } catch (err) {
            }
            return {
              id: page.id,
              client,
              title,
              description: why || "Extra\xEDdo desde Notion (" + page.url + ")",
              status: status2,
              priority,
              why,
              where,
              revision_ia,
              punto_disputa,
              decision_final,
              ejecutado_el,
              resultado_observado,
              detectado,
              comments_count,
              url: page.url,
              created_at: page.created_time,
              entities: []
            };
          }));
        }
      } catch (e) {
        errors.notion = e.message || String(e);
      }
    } else {
      errors.notion = "Notion API Key no configurada";
    }
    res.json({ actionables, briefs, status, errors });
  });
  app2.get("/api/metrics/mtd", async (req, res) => {
    try {
      const client = req.query.client;
      if (!client) return res.status(400).json({ error: "Client required" });
      if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
      const today = /* @__PURE__ */ new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      const { data: weeklyData, error: weeklyError } = await supabase.from("v_tendencia_semanal").select("gasto, week_start").eq("account", client).gte("week_start", firstDay);
      if (!weeklyError && weeklyData) {
        const total = weeklyData.reduce((acc, curr) => acc + Number(curr.gasto || 0), 0);
        return res.json({ success: true, mtd_spend: total });
      }
      return res.json({ success: true, mtd_spend: 0 });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/metrics/weeks", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
    const client = req.query.client;
    if (!client) return res.status(400).json({ error: "Client required" });
    const { data, error } = await supabase.from("v_campaign_analisis").select("week_start").eq("account", client).order("week_start", { ascending: false });
    if (error) return res.status(500).json({ error: error.message || error });
    const weeks = Array.from(new Set(data.map((d) => d.week_start))).filter(Boolean);
    return res.json({ weeks });
  });
  app2.get("/api/metrics/true-roas", async (req, res) => {
    try {
      const client = req.query.client || req.query.account;
      if (!client) return res.status(400).json({ error: "Client required" });
      if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
      const today = /* @__PURE__ */ new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const { data, error } = await supabase.from("true_roas_events").select("monto").ilike("client", client).gte("event_date", firstDay);
      if (error) {
        console.error("Error fetching true-roas:", error);
        return res.json({ success: true, mtd_income: 0 });
      }
      const totalIncome = (data || []).reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
      res.json({ success: true, mtd_income: totalIncome });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  const _colsCache = /* @__PURE__ */ new Map();
  async function columnasDeVista(view) {
    if (_colsCache.has(view)) return _colsCache.get(view);
    try {
      const { data } = await supabase.from(view).select("*").limit(1);
      const set = new Set(Object.keys(data && data[0] || {}));
      if (set.size) _colsCache.set(view, set);
      return set;
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  app2.get(["/api/metrics/:view", "/api/views/:view"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado", disponible: false });
    const { view } = req.params;
    const client = req.query.client || req.query.account;
    const week = req.query.week;
    const from_date = req.query.from || week;
    const to_date = req.query.to;
    const search = req.query.search;
    const search_col = req.query.searchColumn;
    const group_by = req.query.groupBy;
    const order_by = req.query.orderBy;
    const order_dir = req.query.orderDir;
    const limit = Number(req.query.limit) || 25;
    const offset = Number(req.query.offset) || 0;
    let filters = [];
    try {
      if (req.query.filters) {
        filters = JSON.parse(req.query.filters);
      }
    } catch (e) {
    }
    const cols = await columnasDeVista(view);
    const orderValido = order_by && cols.has(order_by) ? order_by : void 0;
    const defaultOrderBy = {
      v_campaign_analisis: "cost",
      v_adgroup_analisis: "cost",
      v_keywords_analisis: "cost",
      v_search_terms_analisis: "cost",
      v_keywords_daily: "cost",
      v_search_terms_daily: "cost",
      v_keyword_tendencia: "gasto_total",
      v_conversiones_por_accion: "primarias",
      v_ngrams_sin_conversion: "costo_total",
      v_fuzzy_negatives: "gasto_perdido",
      v_tendencia_semanal: "week_start"
    };
    if (["v_keywords_daily", "v_search_terms_daily", "v_keyword_tendencia"].includes(view)) {
      try {
        let query = supabase.from(view).select("*", { count: "exact" }).ilike("account", client);
        if (from_date) query = query.gte(view === "v_keyword_tendencia" ? "primer_dia" : "date", from_date);
        if (to_date) query = query.lte(view === "v_keyword_tendencia" ? "ultimo_dia" : "date", to_date);
        if (search && search_col) {
          query = query.ilike(search_col, `%${search}%`);
        }
        const sortCol = orderValido || (cols.has(defaultOrderBy[view]) ? defaultOrderBy[view] : cols.has("cost") ? "cost" : [...cols][0]);
        query = query.order(sortCol, { ascending: order_dir === "asc" });
        query = query.range(offset, offset + limit - 1);
        const { data: rows, count, error: qErr } = await query;
        if (qErr) throw qErr;
        let totCost = 0;
        let totConvs = 0;
        let totClicks = 0;
        let totImpr = 0;
        (rows || []).forEach((row) => {
          totCost += Number(row.cost || row.gasto_total || 0);
          totConvs += Number(row.conversions || row.conversiones_total || 0);
          totClicks += Number(row.clicks || row.clics_total || 0);
          totImpr += Number(row.impressions || 0);
        });
        const totals = {
          cost: totCost,
          conversions: totConvs,
          clicks: totClicks,
          impressions: totImpr,
          cost_per_conv: totConvs > 0 ? Math.round(totCost / totConvs) : null,
          ctr: totImpr > 0 ? Number((totClicks / totImpr * 100).toFixed(2)) : 0,
          disponible: true
        };
        return res.json({
          data: rows || [],
          total: count || (rows ? rows.length : 0),
          totals
        });
      } catch (err) {
        console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${err.message}`);
        return res.status(500).json({ error: err.message, disponible: false });
      }
    }
    try {
      const { data, error } = await supabase.rpc("get_view_data", {
        p_view: view,
        p_account: client,
        p_from: from_date || null,
        p_to: to_date || null,
        p_search: search || null,
        p_search_col: search_col || null,
        p_filters: filters,
        p_group_by: group_by || null,
        p_order_by: orderValido || defaultOrderBy[view],
        p_order_dir: order_dir || "desc",
        p_limit: limit,
        p_offset: offset
      });
      if (!error && data) {
        const r = Array.isArray(data) ? data[0] : data;
        return res.json({
          data: r.data || [],
          total: r.total || 0,
          totals: { ...r.totals || {}, disponible: true }
        });
      }
      let query = supabase.from(view).select("*", { count: "exact" });
      if (client) query = query.ilike("account", client);
      if (from_date) {
        const dateCol = ["v_tendencia_semanal", "v_campaign_analisis", "v_adgroup_analisis", "v_keywords_analisis", "v_search_terms_analisis", "v_conversiones_por_accion", "v_ngrams_sin_conversion", "v_fuzzy_negatives"].includes(view) ? "week_start" : "date";
        query = query.gte(dateCol, from_date);
      }
      if (to_date) {
        const dateCol = ["v_tendencia_semanal", "v_campaign_analisis", "v_adgroup_analisis", "v_keywords_analisis", "v_search_terms_analisis", "v_conversiones_por_accion", "v_ngrams_sin_conversion", "v_fuzzy_negatives"].includes(view) ? "week_start" : "date";
        query = query.lte(dateCol, to_date);
      }
      if (search && search_col) {
        query = query.ilike(search_col, `%${search}%`);
      }
      const sortCol = orderValido || (cols.has(defaultOrderBy[view]) ? defaultOrderBy[view] : "cost");
      if (sortCol) {
        query = query.order(sortCol, { ascending: order_dir === "asc" });
      }
      query = query.range(offset, offset + limit - 1);
      const { data: rows, count, error: qErr } = await query;
      if (qErr) throw qErr;
      let totCost = 0;
      let totConvs = 0;
      let totClicks = 0;
      let totImpr = 0;
      (rows || []).forEach((row) => {
        totCost += Number(row.cost || row.costo || row.gasto_total || 0);
        totConvs += Number(row.conversions || row.conversiones || row.conversiones_total || 0);
        totClicks += Number(row.clicks || row.clics || row.clics_total || 0);
        totImpr += Number(row.impressions || row.impresiones || 0);
      });
      return res.json({
        data: rows || [],
        total: count || (rows ? rows.length : 0),
        totals: {
          cost: totCost,
          conversions: totConvs,
          clicks: totClicks,
          impressions: totImpr,
          disponible: true
        }
      });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      return res.status(500).json({ error: e.message, disponible: false });
    }
  });
  app2.get("/api/annotations", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
    const client = req.query.client;
    if (!client) return res.status(400).json({ error: "Client required" });
    const { data: manual, error: err1 } = await supabase.from("annotations").select("*").eq("account", client);
    const { data: system, error: err2 } = await supabase.from("v_change_annotations").select("*").eq("account", client);
    if (err1) console.error(err1);
    if (err2) console.error(err2);
    return res.json({ manual: manual || [], system: system || [] });
  });
  app2.post("/api/annotations", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
    const { account, fecha: fecha2, titulo, tipo, detalle } = req.body;
    const { data, error } = await supabase.from("annotations").insert([{
      account,
      fecha: fecha2,
      titulo,
      tipo,
      detalle,
      creado_por: "Analista"
    }]).select();
    if (error) return res.status(500).json({ error: error.message || error });
    res.json({ success: true, data });
  });
  app2.get("/api/notion/briefs", async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion2 = new NotionClient({ auth: notionKey2 });
      const response = await notion2.databases.query({
        database_id: NOTION_BASES.BRIEFS,
        page_size: 50,
        sorts: [{ timestamp: "created_time", direction: "descending" }]
      });
      const data = await Promise.all(response.results.map(async (page) => {
        const client = await resolveNotionClient(notion2, page.properties.Cliente || page.properties.Client);
        const props = page.properties;
        return {
          id: page.id,
          client,
          title: props.Brief?.title?.map((rt) => rt.plain_text).join("") || "Untitled Brief",
          headline: props.Titular?.rich_text?.map((rt) => rt.plain_text).join("") || "No headline available",
          status: props.Estado?.select?.name || "Unknown",
          spend: props.Gasto?.number || 0,
          cpa: props.CPA?.number || 0,
          conversions: props.Conversiones?.number || 0,
          highAlerts: props["Alertas ALTA"]?.number || 0,
          semana: props.Semana?.date?.start || null,
          brief_anterior: props["Brief anterior"]?.relation?.[0]?.id || null,
          brief_siguiente: props["Brief siguiente"]?.relation?.[0]?.id || null,
          handoff: props.Handoff?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          lecciones: props.Lecciones?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          dias_provisionales: props["Dias provisionales"]?.number || 0,
          url: page.url,
          created_at: page.created_time
        };
      }));
      res.json({ data });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/notion/actionables", async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion2 = new NotionClient({ auth: notionKey2 });
      const response = await notion2.databases.query({
        database_id: NOTION_BASES.ACCIONABLES,
        page_size: 50,
        sorts: [{ timestamp: "created_time", direction: "descending" }]
      });
      const data = await Promise.all(response.results.map(async (page) => {
        const client = await resolveNotionClient(notion2, page.properties.Cliente || page.properties.Client);
        const props = page.properties;
        let comments_count = 0;
        return {
          id: page.id,
          client,
          title: props.Accion?.title?.map((rt) => rt.plain_text).join("") || "Untitled",
          status: props.Estado?.select?.name || NOTION_STATES.PROPUESTO,
          priority: props.Prioridad?.select?.name || "Medium",
          why: props["Por que"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          where: props.Donde?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          tags: props.Etiquetas?.multi_select?.map((ms) => ms.name) || props.Tags?.multi_select?.map((ms) => ms.name) || [],
          revision_ia: props["Revision IA"]?.select?.name || NOTION_REVISION_IA.SIN_REVISAR,
          punto_disputa: props["Punto en disputa"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          decision_final: props["Decision final"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          ejecutado_el: props["Ejecutado el"]?.date?.start || null,
          resultado_observado: props["Resultado observado"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          detectado: props["Detectado"]?.date?.start || page.created_time,
          naturaleza: props.Naturaleza?.select?.name || "Observacion",
          que_lo_confirmaria: props["Que lo confirmaria"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          como_hacerlo: props["Como hacerlo"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          origen: props["Origen"]?.select?.name || "",
          accion_json: props["Accion JSON"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          entidad: props["Entidad"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          vence: props["Vence"]?.date?.start || null,
          reemplazado_por: props["Reemplazado por"]?.relation?.[0]?.id || null,
          last_edited: page.last_edited_time,
          causa_raiz: props["Causa raiz"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          relacionado_con: props["Relacionado con"]?.relation?.map((rel) => rel.id) || [],
          semanas_pendiente: props["Semanas pendiente"]?.number ?? (props["Semanas pendiente"]?.formula?.number ?? 0),
          comments_count,
          created_at: page.created_time,
          url: page.url
        };
      }));
      const { parsearAccion: parsearAccion2 } = await Promise.resolve().then(() => (init_accion(), accion_exports));
      for (const a of data) {
        const p = parsearAccion2(a.accion_json);
        a.accion = p.accion || null;
        a.accion_error = p.error || null;
      }
      const visibles = data.filter((a) => !a.reemplazado_por);
      res.json({ data: visibles });
      if (supabase) supabase.from("accionables_espejo").upsert(data.map((a) => ({
        notion_id: a.id,
        account: a.client,
        titulo: a.title,
        estado: a.status,
        prioridad: a.priority,
        naturaleza: a.naturaleza,
        origen: a.origen || null,
        entidad: a.entidad || null,
        causa_raiz: a.causa_raiz || null,
        por_que: (a.why || "").slice(0, 1e3),
        detectado: a.detected || null,
        ejecutado_el: a.ejecutado_el || null,
        vence: a.vence,
        reemplazado_por: a.reemplazado_por,
        semanas_pendiente: a.weeks_pending ?? null,
        revision_ia: a.revision_ia || null,
        ultima_edicion: a.last_edited,
        sincronizado: (/* @__PURE__ */ new Date()).toISOString(),
        accion: a.accion || null,
        accion_valida: !!a.accion,
        accion_error: a.accion_error || null
      })), { onConflict: "notion_id" }).then(({ error }) => {
        if (error) console.error("[espejo] " + error.message);
      });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/notion/actionables/:id/comments", async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion2 = new NotionClient({ auth: notionKey2 });
      const response = await notion2.comments.list({ block_id: req.params.id });
      const comments = response.results.map((comment) => ({
        id: comment.id,
        text: comment.rich_text.map((rt) => rt.plain_text).join(""),
        created_at: comment.created_time,
        author: comment.created_by?.name || "Unknown"
      }));
      res.json({ comments });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/notion/actionables/:id/analyze", async (req, res) => {
    const { action, force } = req.body;
    if (!action) return res.status(400).json({ error: "Action data is required" });
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    const notion2 = new NotionClient({ auth: notionKey2 });
    if (!force) {
      try {
        const commentRes = await notion2.comments.list({ block_id: req.params.id });
        const prev = commentRes.results?.find((c) => {
          const t = c.rich_text?.map((rt) => rt.plain_text).join("") || "";
          return t.includes("[SEGUNDA OPINI\xD3N IA") || t.includes("[SEGUNDA OPINION IA") || t.includes("SEGUNDA OPINI\xD3N IA");
        });
        if (prev) {
          const prevDate = prev.created_time ? new Date(prev.created_time).toLocaleDateString("es-ES") : "previa";
          return res.status(409).json({
            requiresConfirmation: true,
            previousDate: prevDate,
            message: `Este accionable ya fue analizado por Gemini (${prevDate}). \xBFDeseas volver a analizarlo?`
          });
        }
      } catch (errCheck) {
      }
    }
    try {
      const client = action.client || "Unknown";
      if (client === "Unknown") {
        return res.status(400).json({ error: "No se pudo identificar el cliente del accionable." });
      }
      const contextStr = getClientContext(client);
      let weeklySummary = "No se pudieron obtener datos detallados de la semana.";
      try {
        if (!supabase) throw new Error("No supabase credentials");
        const perfil = (await cuentasActivas()).find((c) => c.account === client)?.perfil_analisis;
        const { data: pkg } = await supabase.rpc(perfil === "cadena" ? "get_weekly_package_cadena" : "get_weekly_package", { p_account: client });
        if (pkg && pkg.length > 0) {
          const state = pkg[0].estado_estructural ? JSON.stringify(pkg[0].estado_estructural).substring(0, 500) : "";
          const alerts = pkg[0].alertas_altas ? JSON.stringify(pkg[0].alertas_altas).substring(0, 500) : "";
          const metrics = pkg[0].tendencia_8_semanas ? JSON.stringify(pkg[0].tendencia_8_semanas).substring(0, 500) : "";
          weeklySummary = `Estado: ${state}
Alertas: ${alerts}
M\xE9tricas recientes: ${metrics}`;
        }
      } catch (e) {
        console.error("Error fetching weekly package", e);
      }
      let historicalContext = "No se encontraron decisiones pasadas similares.";
      try {
        if (supabase) {
          const tempAi = ai;
          const textToEmbed = `T\xEDtulo: ${action.title || ""}
Justificaci\xF3n: ${action.why || ""}
Resoluci\xF3n: ${action.where || ""}`;
          const embedRes = await tempAi.models.embedContent({
            model: "text-embedding-004",
            contents: textToEmbed
          });
          const embedding = embedRes.embeddings[0].values;
          const { data: matches } = await supabase.rpc("match_actionables", {
            query_embedding: embedding,
            match_threshold: 0.78,
            match_count: 2
          });
          if (matches && matches.length > 0) {
            historicalContext = matches.map((m) => `- T\xEDtulo: ${m.title}
  Justificaci\xF3n: ${m.justificacion}
  Resoluci\xF3n: ${m.resolucion}`).join("\n\n");
          }
        }
      } catch (e) {
        console.error("Error fetching historical matches", e);
      }
      const prompt = `Sos analista senior de Google Ads. Otro analista propuso el accionable de abajo. Tu trabajo es dar una SEGUNDA OPINI\xD3N, no repetir la primera.

${contextStr}

CONTEXTO HIST\xD3RICO: Decisiones pasadas similares: ${historicalContext}
DATOS DE LA SEMANA: ${weeklySummary}

ACCIONABLE PROPUESTO POR EL PRIMER ANALISTA:
T\xEDtulo: ${action.title || "N/A"}
Hip\xF3tesis: ${action.why || "N/A"}
Ubicaci\xF3n: ${action.where || "N/A"}
Prioridad asignada: ${action.priority || "N/A"}

Evalu\xE1 exactamente estas cuatro dimensiones, nada m\xE1s:
1. FUNDAMENTO  \xBFlos datos respaldan la hip\xF3tesis?
2. EJECUCI\xD3N   \xBFlas instrucciones son correctas y completas?
3. RIESGO      \xBFqu\xE9 puede salir mal y qu\xE9 se pierde al ejecutar?
4. PRIORIDAD   \xBFel orden asignado es el adecuado?

Respond\xE9 en texto plano, sin markdown, con este formato:
VEREDICTO: [COINCIDO / COINCIDO CON RESERVAS / DISCREPO / DATOS INSUFICIENTES]

FUNDAMENTO [2 o 3 frases citando datos concretos.]
EJECUCI\xD3N [Qu\xE9 falta o qu\xE9 corregir\xEDas de las instrucciones.]
RIESGO [Qu\xE9 puede salir mal. Si no hay riesgo relevante, decilo.]
PRIORIDAD [De acuerdo o no con el orden, y por qu\xE9]

SI DISCREPO: EN QU\xC9 EXACTAMENTE
[Una l\xEDnea. El punto preciso del desacuerdo, no un resumen. Si no discrep\xE1s, pod\xE9s omitir esta secci\xF3n.]`;
      let aiResponse;
      let analysisText = "";
      let retries = 3;
      let delay = 2e3;
      let lastErrorReason = "";
      while (retries > 0) {
        try {
          aiResponse = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt
          });
          analysisText = aiResponse.text || "";
          break;
        } catch (err) {
          lastErrorReason = err.message || err.toString();
          const errStr = String(err).toLowerCase() + " " + lastErrorReason.toLowerCase();
          const isQuota = errStr.includes("quota") || errStr.includes("resource_exhausted") || errStr.includes("429");
          if (isQuota) {
            lastErrorReason = "Cuota excedida de la API de Gemini (429 / Resource Exhausted)";
            break;
          }
          const is503 = errStr.includes("503") || errStr.includes("unavailable") || errStr.includes("high demand");
          if (is503) {
            retries--;
            if (retries === 0) {
              lastErrorReason = "Servicio no disponible / Alta demanda (503)";
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          } else {
            break;
          }
        }
      }
      if (!analysisText) {
        return res.status(503).json({
          error: "El an\xE1lisis no se pudo completar",
          reason: lastErrorReason || "Gemini no devolvi\xF3 respuesta",
          retryable: true
        });
      }
      const veredictoMatch = analysisText.match(/VEREDICTO:\s*(.*)/i);
      const veredicto = veredictoMatch ? veredictoMatch[1].trim() : "";
      let revisionStatus = NOTION_REVISION_IA.ANALIZADO;
      let puntoDisputa = "";
      if (veredicto.includes("DISCREPO")) {
        revisionStatus = NOTION_REVISION_IA.EN_DISPUTA;
        const discrepoMatch = analysisText.match(/SI DISCREPO: EN QUÉ EXACTAMENTE\s*\n(.*)/i);
        if (discrepoMatch) {
          puntoDisputa = discrepoMatch[1].trim();
        }
      }
      const notion3 = new NotionClient({ auth: notionKey2 });
      const propertiesToUpdate = {
        "Revision IA": { select: { name: revisionStatus } }
      };
      if (puntoDisputa) {
        propertiesToUpdate["Punto en disputa"] = {
          rich_text: [{ text: { content: puntoDisputa.substring(0, 2e3) } }]
        };
      }
      try {
        await notion3.pages.update({
          page_id: req.params.id,
          properties: propertiesToUpdate
        });
      } catch (notionErr) {
        console.error("Error updating Notion page properties:", notionErr);
      }
      const prefix = "[SEGUNDA OPINI\xD3N IA \xB7 no es una decisi\xF3n]\n\n";
      const fullText = prefix + analysisText;
      const MAX_LENGTH = 1900;
      const blocks = [];
      let resto = fullText;
      while (resto.length > MAX_LENGTH) {
        let corte = resto.lastIndexOf("\n", MAX_LENGTH);
        if (corte < MAX_LENGTH * 0.5) corte = MAX_LENGTH;
        blocks.push({ text: { content: resto.slice(0, corte) } });
        resto = resto.slice(corte);
      }
      if (resto) blocks.push({ text: { content: resto } });
      try {
        const commentResponse = await notion3.comments.create({
          parent: { page_id: req.params.id },
          rich_text: blocks
        });
      } catch (commentErr) {
        console.error("Error posting Notion comment:", commentErr);
        throw new Error("No se pudo publicar el comentario en Notion: " + (commentErr.message || commentErr.toString()));
      }
      res.json({ success: true, analysis: analysisText });
    } catch (e) {
      console.error("Error analyzing actionable:", e);
      res.status(500).json({ error: e.message || e.toString() });
    }
  });
  app2.post("/api/notion/actionables/:id/comments", async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion2 = new NotionClient({ auth: notionKey2 });
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const response = await notion2.comments.create({
        parent: { page_id: req.params.id },
        rich_text: [{ text: { content: `[ANDRES ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}] ${text}` } }]
      });
      if (supabase) {
        try {
          await supabase.from("accionable_comentarios").upsert({ comment_id: response.id, notion_id: req.params.id, autor: "andres", prefijo: "ANDRES", texto: text, creado: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "comment_id" });
        } catch {
        }
      }
      res.json({ success: true, comment: response });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/notion/actionables/:id", async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion2 = new NotionClient({ auth: notionKey2 });
      const {
        status,
        resolutionNote,
        ejecutado_el,
        resultado_observado,
        naturaleza,
        que_lo_confirmaria,
        causa_raiz,
        confirmar_hipotesis,
        prioridad
      } = req.body;
      const properties = {};
      if (prioridad) properties["Prioridad"] = { select: { name: prioridad } };
      const targetStatus = confirmar_hipotesis ? NOTION_STATES.PROPUESTO : status;
      if (targetStatus) {
        properties["Estado"] = {
          select: {
            name: targetStatus
          }
        };
      }
      if (resolutionNote !== void 0) {
        properties["Decision final"] = {
          rich_text: [{ text: { content: resolutionNote.substring(0, 2e3) } }]
        };
      }
      if (ejecutado_el !== void 0) {
        properties["Ejecutado el"] = ejecutado_el ? { date: { start: ejecutado_el } } : null;
      }
      if (resultado_observado !== void 0) {
        properties["Resultado observado"] = {
          rich_text: [{ text: { content: (resultado_observado || "").substring(0, 2e3) } }]
        };
      }
      if (naturaleza !== void 0) {
        properties["Naturaleza"] = {
          select: { name: naturaleza }
        };
      }
      if (que_lo_confirmaria !== void 0) {
        properties["Que lo confirmaria"] = {
          rich_text: [{ text: { content: (que_lo_confirmaria || "").substring(0, 2e3) } }]
        };
      }
      if (causa_raiz !== void 0) {
        properties["Causa raiz"] = {
          rich_text: [{ text: { content: (causa_raiz || "").substring(0, 2e3) } }]
        };
      }
      const response = await notion2.pages.update({
        page_id: req.params.id,
        properties
      });
      if (confirmar_hipotesis) {
        const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        try {
          await notion2.comments.create({
            parent: { page_id: req.params.id },
            rich_text: [{ text: { content: `[CONFIRMACI\xD3N OPERADOR ${todayStr}] Hip\xF3tesis/Inferencia confirmada por Andr\xE9s. Pasa a Propuesto.` } }]
          });
        } catch (comErr) {
          console.error("Error creating confirmation comment:", comErr);
        }
      }
      if (targetStatus === NOTION_STATES.HECHO && req.body.actionable) {
        const actionable = req.body.actionable;
        if (supabase) {
          try {
            const entityName = actionable.where || actionable.title || "Unknown Entity";
            const cooldownDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1e3).toISOString();
            await supabase.from("entity_states").insert([{
              account: actionable.client,
              entity_name: entityName,
              cooldown_until: cooldownDate
            }]);
            console.log("Cooldown applied for entity:", entityName);
          } catch (err) {
            console.error("Error applying cooldown", err);
          }
          if (ai) {
            try {
              const textToEmbed = `T\xEDtulo: ${actionable.title || ""}
Justificaci\xF3n: ${actionable.why || ""}
Resoluci\xF3n: ${actionable.where || ""}
Nota: ${resolutionNote || ""}`;
              const embedRes = await ai.models.embedContent({
                model: "text-embedding-004",
                contents: textToEmbed
              });
              const embedding = embedRes.embeddings[0].values;
              await supabase.from("actionables_memory").insert([{
                notion_id: req.params.id,
                client: actionable.client,
                title: actionable.title,
                justificacion: actionable.why,
                resolucion: actionable.where,
                embedding
              }]);
              console.log("Memory vector saved for actionable:", req.params.id);
            } catch (err) {
              console.error("Error creating memory embedding", err);
            }
          }
        }
      }
      res.json({ success: true, data: response });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/notion/actionables/:id/recent_changes", async (req, res) => {
    try {
      const client = req.query.client;
      if (!client) return res.status(400).json({ error: "Client required" });
      if (!supabase) return res.status(500).json({ error: "Supabase credentials missing" });
      const { data, error } = await supabase.from("v_todos_los_cambios").select("*").ilike("account", client).order("fecha", { ascending: false }).order("hora", { ascending: false }).limit(30);
      if (error) {
        console.error("Error consultando v_todos_los_cambios:", error);
        return res.json({ changes: [] });
      }
      res.json({ changes: data || [] });
    } catch (e) {
      res.json({ changes: [] });
    }
  });
  app2.post("/api/operator_log", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase missing" });
    try {
      const { account, que_cambio, donde: donde2, valor_anterior, valor_nuevo, por_que, accionable_notion_id } = req.body;
      if (!account || !que_cambio) {
        return res.status(400).json({ error: "account y que_cambio son requeridos" });
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const nowTime = (/* @__PURE__ */ new Date()).toTimeString().split(" ")[0];
      const { data, error } = await supabase.from("operator_log").insert([{
        account,
        fecha: today,
        hora: nowTime,
        que_cambio,
        donde: donde2 || "conversiones",
        valor_anterior: valor_anterior || null,
        valor_nuevo: valor_nuevo || null,
        por_que: por_que || "",
        accionable_notion_id: accionable_notion_id || null
      }]).select();
      if (error) {
        console.error("Error insertando en operator_log:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, data });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  const getPageBlocksHandler = async (req, res) => {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!notionKey2) return res.json({ blocks: [], error: "Missing NOTION_API_KEY" });
    try {
      const notion2 = new NotionClient({ auth: notionKey2 });
      const response = await notion2.blocks.children.list({ block_id: req.params.id, page_size: 100 });
      const blocks = response.results.map((block) => {
        let text = "";
        let type = block.type;
        if (block[type]?.rich_text) {
          text = block[type].rich_text.map((rt) => rt.plain_text).join("");
        }
        return { type, text };
      });
      res.json({ blocks });
    } catch (e) {
      console.warn("Failed to fetch Notion blocks:", e.message);
      res.json({ blocks: [], error: e.message });
    }
  };
  app2.get("/api/notion/page/:id/blocks", getPageBlocksHandler);
  app2.get("/api/notion/briefs/:id/blocks", getPageBlocksHandler);
  app2.post("/api/mutations/revert", async (req, res) => {
    try {
      const { actionable } = req.body;
      if (supabase) {
        await supabase.from("pending_mutations").insert([{
          action_type: "UNDO_CHANGE",
          campaign_name: actionable.where || "",
          keyword_text: actionable.title || "",
          status: "APPROVED",
          client: actionable.client
        }]);
      }
      res.json({ success: true });
    } catch (e) {
      console.error(`[500] ${req?.method || ""} ${req?.originalUrl || ""} \u2014 ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/generate-rsa", async (req, res) => {
    try {
      const { client, searchTerms } = req.body;
      if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
      let complianceRule = "";
      if (client === "BHI") {
        complianceRule = "REGLA ESTRICTA DE COMPLIANCE PARA BHI: PROHIBIDO USAR las palabras 'p\xF3liza', 'seguro', 'vender', o 'contratar'. El texto ser\xE1 rechazado si contiene estas palabras.";
      }
      const rsaSchemaConfig = {
        type: "OBJECT",
        properties: {
          headlines: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Lista de 3 a 5 t\xEDtulos para el anuncio, m\xE1ximo 30 caracteres cada uno."
          },
          descriptions: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Lista de 2 a 4 descripciones para el anuncio, m\xE1ximo 90 caracteres cada una."
          }
        },
        required: ["headlines", "descriptions"]
      };
      const { termMetrics, topAssets } = req.body;
      const metricsTxt = Array.isArray(termMetrics) && termMetrics.length ? "\n\nM\xE9tricas de esos t\xE9rminos (conversiones, clics, gasto):\n" + termMetrics.map((m) => `- "${m.term}": ${m.conv} conv, ${m.clicks} clics, ${m.cost} gasto`).join("\n") : "";
      const assetsTxt = Array.isArray(topAssets) && topAssets.length ? "\n\nAssets actuales que Google califica por rendimiento (no repetir los BEST literalmente; superar los LOW):\n" + topAssets.map((a) => `- [${a.label}] ${a.tipo}: "${a.texto}"`).join("\n") : "";
      const rules = getClientContext(client) || "";
      const prompt = `Act\xFAa como un experto en Google Ads. Genera textos para un Responsive Search Ad (RSA) basado en estos t\xE9rminos de b\xFAsqueda exitosos: ${searchTerms.join(", ")}.${metricsTxt}${assetsTxt}

Reglas de la cuenta:
${rules}

Prioriz\xE1 los t\xE9rminos con m\xE1s conversiones. Cada headline debe ser distinto en \xE1ngulo, no en sin\xF3nimos.
${complianceRule}
Los t\xEDtulos no deben superar los 30 caracteres.
Las descripciones no deben superar los 90 caracteres.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: rsaSchemaConfig
        }
      });
      if (!response.text) throw new Error("No response text");
      const rsaZodSchema = z4.object({
        headlines: z4.array(z4.string()),
        descriptions: z4.array(z4.string())
      });
      const parsedData = rsaZodSchema.parse(JSON.parse(response.text));
      const result = {
        headlines: parsedData.headlines.map((h) => h.length > 30 ? h.substring(0, 30) : h),
        descriptions: parsedData.descriptions.map((d) => d.length > 90 ? d.substring(0, 90) : d)
      };
      res.json({ success: true, data: result });
    } catch (e) {
      console.error("Error generating RSA:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app2.use("/api/webhooks", webhooksRouter);
  app2.get("/api/anomalias", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      const days = Number(req.query.days) || 14;
      if (!client) return res.status(400).json({ error: "client requerido" });
      const from = /* @__PURE__ */ new Date();
      from.setDate(from.getDate() - days);
      const fromStr = from.toISOString().slice(0, 10);
      const [serie, explicadas] = await Promise.all([
        supabase.from("v_anomalias_diarias").select("*").eq("account", client).gte("date", fromStr).order("date"),
        supabase.from("v_anomalia_explicada").select("*").eq("account", client).gte("date", fromStr).order("date")
      ]);
      if (serie.error) return res.status(500).json({ error: serie.error.message });
      const criticas = (explicadas.data || []).filter((a) => a.severidad === "critica");
      const altas = (explicadas.data || []).filter((a) => a.severidad === "alta");
      const fmt = (d) => (/* @__PURE__ */ new Date(d + "T12:00:00")).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
      let titulo = `${days} d\xEDas dentro de lo normal`;
      if (criticas.length) {
        const dias = criticas.map((a) => fmt(a.date)).join(" y ");
        const met = criticas[0].metrica_anomala || "gasto";
        const dir = criticas[0][met === "cpa" ? "cpa_direccion" : "gasto_direccion"] === "sube" ? "se dispar\xF3" : "se derrumb\xF3";
        titulo = `${met.toUpperCase()} ${dir} ${dias}: ${criticas[0].explicacion.toLowerCase()}`;
      } else if (altas.length) {
        titulo = `${altas.length} d\xEDa(s) fuera de lo habitual: ${altas[0].explicacion.toLowerCase()}`;
      }
      res.json({ serie: serie.data, anomalias: explicadas.data || [], titulo });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/conversiones-grupo", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      const days = Number(req.query.days) || 14;
      const desde = /* @__PURE__ */ new Date();
      desde.setDate(desde.getDate() - days);
      const { data, error } = await supabase.from("v_conversiones_por_grupo").select("date, ad_group, conversion_action, conversions, madurez").eq("account", client).gte("date", desde.toISOString().slice(0, 10)).order("date");
      if (error) return res.status(500).json({ error: error.message });
      const grupos = Array.from(new Set((data || []).map((r) => r.ad_group))).sort();
      const porFecha = {};
      for (const r of data || []) {
        porFecha[r.date] = porFecha[r.date] || { date: r.date, madurez: r.madurez };
        porFecha[r.date][r.ad_group] = (porFecha[r.date][r.ad_group] || 0) + Number(r.conversions);
      }
      const filas = Object.values(porFecha).sort((a, b) => a.date.localeCompare(b.date));
      const apagados = [];
      for (const g of grupos) {
        const serie = filas.map((f) => f[g] || 0);
        const conConv = serie.filter((v) => v > 0).length;
        if (conConv >= 3) {
          let racha = 0, maxRacha = 0;
          for (const v of serie) {
            racha = v === 0 ? racha + 1 : 0;
            maxRacha = Math.max(maxRacha, racha);
          }
          if (maxRacha >= 2) apagados.push(`${g} (${maxRacha} d\xEDas seguidos en cero)`);
        }
      }
      res.json({ grupos, filas, hallazgo: apagados.length ? `Se apag\xF3: ${apagados.join("; ")}` : null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/hora-dia", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      if (!client) return res.status(400).json({ error: "client requerido" });
      const { data, error } = await supabase.from("v_hora_dia").select("*").eq("account", client).order("dow_num").order("hour");
      if (error) return res.status(500).json({ error: error.message });
      const rows = data || [];
      const conConv = rows.filter((r) => Number(r.conversiones) > 0);
      const sinConv = rows.filter((r) => Number(r.gasto) > 0 && Number(r.conversiones) === 0);
      const mejor = conConv.sort((a, b) => Number(a.cpa) - Number(b.cpa))[0];
      const peor = sinConv.sort((a, b) => Number(b.gasto) - Number(a.gasto))[0];
      res.json({
        celdas: rows,
        semana: rows[0]?.week_start,
        mejor: mejor ? { dia: mejor.dia, hora: mejor.hour, cpa: mejor.cpa, conv: mejor.conversiones } : null,
        peor_sin_conv: peor ? { dia: peor.dia, hora: peor.hour, gasto: peor.gasto } : null
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/rsa-assets", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      const { data, error } = await supabase.from("rsa_assets").select("field_type, asset_text, performance_label, impressions, clicks, ctr, conversions, ad_group").eq("account", client).order("conversions", { ascending: false }).limit(60);
      if (error) return res.status(500).json({ error: error.message });
      const rank = { BEST: 0, GOOD: 1, LEARNING: 2, LOW: 3 };
      res.json((data || []).sort((a, b) => (rank[a.performance_label] ?? 9) - (rank[b.performance_label] ?? 9) || Number(b.conversions) - Number(a.conversions)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/entidades/:entidad", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const { entidad } = req.params;
      const client = req.query.client || req.query.account;
      const from = req.query.from;
      const to = req.query.to;
      if (!client || !from || !to) return res.status(400).json({ error: "client, from y to son obligatorios" });
      const { data, error } = await supabase.rpc("get_entidades", {
        p_entidad: entidad,
        p_account: client,
        p_from: from,
        p_to: to,
        p_search: req.query.search || null,
        p_order_by: req.query.orderBy || "cost",
        p_order_dir: req.query.orderDir || "desc",
        p_limit: Number(req.query.limit) || 1e3,
        p_offset: Number(req.query.offset) || 0
      });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/objetivos", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      const q = (t) => client ? supabase.from(t).select("*").eq("account", client) : supabase.from(t).select("*");
      const [targets, headroom, proyeccion] = await Promise.all([
        q("account_targets"),
        q("v_headroom"),
        q("v_proyeccion_escalamiento")
      ]);
      res.json({
        targets: targets.data || [],
        headroom: headroom.data || [],
        proyeccion: proyeccion.data || []
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/objetivos/:account", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const { account } = req.params;
      const { conversiones_mes_objetivo, cpa_maximo, presupuesto_mes_maximo, ciclo_venta_dias, notas } = req.body;
      const patch = { actualizado: (/* @__PURE__ */ new Date()).toISOString(), actualizado_por: "Andres (app)" };
      if (conversiones_mes_objetivo != null) {
        patch.conversiones_mes_objetivo = conversiones_mes_objetivo;
        patch.conversiones_mes_origen = "negocio";
      }
      if (cpa_maximo != null) {
        patch.cpa_maximo = cpa_maximo;
        patch.cpa_maximo_origen = "negocio";
      }
      if (presupuesto_mes_maximo != null) patch.presupuesto_mes_maximo = presupuesto_mes_maximo;
      if (ciclo_venta_dias != null) patch.ciclo_venta_dias = ciclo_venta_dias;
      if (notas != null) patch.notas = notas;
      const { data, error } = await supabase.from("account_targets").update(patch).eq("account", account).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/escalera", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      const q = (t) => client ? supabase.from(t).select("*").eq("account", client) : supabase.from(t).select("*");
      const [etapas, recomendada, pendientes] = await Promise.all([
        q("v_escalera_valor").order("stage_order"),
        q("v_primaria_recomendada"),
        q("v_pendientes_subir_google")
      ]);
      res.json({
        etapas: etapas.data || [],
        recomendada: recomendada.data?.[0] || null,
        pendientes_subir: pendientes.data || []
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/operator-log", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const { account, que_cambio, donde: donde2, valor_anterior, valor_nuevo, por_que, accionable_notion_id } = req.body;
      if (!account || !que_cambio) return res.status(400).json({ error: "account y que_cambio son obligatorios" });
      const { data, error } = await supabase.from("operator_log").insert({
        account,
        que_cambio,
        donde: donde2 || "otro",
        valor_anterior,
        valor_nuevo,
        por_que,
        accionable_notion_id
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/operator-log", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      let q = supabase.from("operator_log").select("*").order("fecha", { ascending: false }).limit(30);
      if (client) q = q.eq("account", client);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/cambios", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      const days = Number(req.query.days) || 10;
      const from = /* @__PURE__ */ new Date();
      from.setDate(from.getDate() - days);
      const fromStr = from.toISOString().slice(0, 10);
      let q = supabase.from("v_todos_los_cambios").select("*").gte("fecha", fromStr).order("fecha", { ascending: false }).limit(60);
      if (client) q = q.eq("account", client);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/cierres", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const client = req.query.client;
      let q = supabase.from("v_cierres_totales").select("*").order("event_date", { ascending: false });
      if (client) q = q.eq("client", client);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      const total = (data || []).reduce((a, r) => a + Number(r.monto || 0), 0);
      const atribuido = (data || []).filter((r) => r.tipo === "atribuido").reduce((a, r) => a + Number(r.monto || 0), 0);
      res.json({ cierres: data || [], total, atribuido, sin_atribucion: total - atribuido });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/scorecard", async (_req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const [runs, tendencia] = await Promise.all([
        supabase.from("v_run_scorecard").select("*").order("run_date", { ascending: false }).limit(30),
        supabase.from("v_run_tendencia").select("*")
      ]);
      res.json({ corridas: runs.data || [], tendencia: tendencia.data || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/scorecard/:id", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
      const { revision_humana } = req.body;
      const { data, error } = await supabase.from("run_quality").update({ revision_humana, revision_humana_fecha: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) }).eq("id", req.params.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.all("/api/cron/anomalias", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const r = await runAnomalyWorker();
      res.json({ ok: true, ran_at: (/* @__PURE__ */ new Date()).toISOString(), ...r });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.all("/api/cron/aprendizaje", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const resultado = { ran_at: (/* @__PURE__ */ new Date()).toISOString() };
    try {
      if (notion && NOTION_BASES.ACCIONABLES) {
        const pages = [];
        let cursor;
        do {
          const r = await notion.databases.query({
            database_id: NOTION_BASES.ACCIONABLES,
            filter: { and: [{ property: "Estado", select: { equals: NOTION_STATES.HECHO } }, { property: "Ejecutado el", date: { is_not_empty: true } }] },
            start_cursor: cursor,
            page_size: 100
          });
          pages.push(...r.results);
          cursor = r.has_more ? r.next_cursor : void 0;
        } while (cursor);
        const filas = [];
        for (const page of pages) {
          const p = page.properties;
          const titulo = p.Accion?.title?.map((t) => t.plain_text).join("") || "";
          const client = await resolveNotionClient(notion, p.Cliente || p.Client);
          const verificar = (p["Por que"]?.rich_text?.map((t) => t.plain_text).join("") || "") + " " + titulo;
          const low = (titulo + " " + verificar).toLowerCase();
          const metrica = /cpa|costo por/.test(low) ? "cpa" : /conversi/.test(low) ? "conversiones" : /ctr/.test(low) ? "ctr" : /gasto|presupuesto|budget/.test(low) ? "gasto" : /clic/.test(low) ? "clics" : null;
          const direccion = /baj|reduc|recort|pausar|quitar|negativ|elimin/.test(low) ? "baja" : /sub|aument|activ|agregar|crear|escal/.test(low) ? "sube" : metrica === "cpa" ? "baja" : "sube";
          filas.push({
            notion_id: page.id,
            account: client || "DESCONOCIDO",
            titulo,
            ejecutado_el: p["Ejecutado el"]?.date?.start,
            metrica_objetivo: metrica,
            direccion_esperada: direccion,
            causa_raiz: p["Causa raiz"]?.rich_text?.map((t) => t.plain_text).join("") || null,
            naturaleza: p.Naturaleza?.select?.name || null,
            sincronizado_el: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        if (filas.length) {
          const { error } = await supabase.from("accionables_ejecutados").upsert(filas, { onConflict: "notion_id" });
          resultado.accionables_sincronizados = error ? `error: ${error.message}` : filas.length;
        } else resultado.accionables_sincronizados = 0;
      }
      const { data: impactos } = await supabase.from("v_impacto_accionables").select("*").not("veredicto", "like", "PENDIENTE%");
      let escritos = 0;
      for (const imp of impactos || []) {
        if (!notion) break;
        try {
          const page = await notion.pages.retrieve({ page_id: imp.notion_id });
          const ya = page.properties?.["Resultado observado"]?.rich_text?.length > 0;
          if (ya) continue;
          const texto = `[AUTO ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}] ${imp.veredicto}. ${imp.metrica_objetivo || "metrica"}: ${imp.metrica_objetivo === "cpa" ? `${imp.cpa_antes} \u2192 ${imp.cpa_despues}` : imp.metrica_objetivo === "gasto" ? `${imp.gasto_antes} \u2192 ${imp.gasto_despues}` : imp.metrica_objetivo === "conversiones" ? `${imp.conv_antes} \u2192 ${imp.conv_despues}` : `${imp.ctr_antes} \u2192 ${imp.ctr_despues}`} (${imp.variacion_pct ?? "?"}%). Ventana: 14 d\xEDas antes vs ${imp.dias_despues} d\xEDas consolidados despu\xE9s.`;
          await notion.pages.update({ page_id: imp.notion_id, properties: { "Resultado observado": { rich_text: [{ text: { content: texto.slice(0, 1900) } }] } } });
          escritos++;
        } catch (e) {
        }
      }
      resultado.resultados_escritos_en_notion = escritos;
      if (notion && NOTION_BASES.CLIENTES) {
        const fichas = await notion.databases.query({ database_id: NOTION_BASES.CLIENTES });
        let sincronizados = 0;
        for (const f of fichas.results) {
          const nombre = f.properties?.Cliente?.title?.map((t) => t.plain_text).join("") || f.properties?.Name?.title?.map((t) => t.plain_text).join("") || "";
          const cts = await cuentasActivas();
          const acct = cts.find((c) => (c.nombre_cliente || "").toLowerCase() === String(nombre).toLowerCase())?.account || cts.find((c) => String(nombre).toLowerCase().includes((c.nombre_cliente || "").split(" ")[0].toLowerCase()))?.account || cts.find((c) => String(nombre).toLowerCase().includes(c.account.toLowerCase().replace("_", " ")))?.account || null;
          if (!acct) continue;
          const aprendizajes = f.properties["Aprendizajes consolidados"]?.rich_text?.map((t) => t.plain_text).join("") || null;
          const hipotesis = f.properties["Hipotesis abiertas"]?.rich_text?.map((t) => t.plain_text).join("") || null;
          let pendientes = null;
          if (NOTION_BASES.ACCIONABLES) {
            const bl = await notion.databases.query({
              database_id: NOTION_BASES.ACCIONABLES,
              filter: { and: [{ property: "Estado", select: { equals: NOTION_STATES.BLOQUEADO } }, { property: "Cliente", relation: { contains: f.id } }] },
              page_size: 20
            });
            const lineas = bl.results.map((a) => {
              const t = a.properties.Accion?.title?.map((x) => x.plain_text).join("") || "";
              const q = a.properties["Que lo confirmaria"]?.rich_text?.map((x) => x.plain_text).join("") || "";
              return `- **${t}**${q ? ` \u2014 lo confirmar\xEDa: ${q}` : ""}`;
            });
            pendientes = lineas.length ? lineas.join("\n") : null;
          }
          await supabase.from("doc_maestro_consolidado").upsert({ account: acct, aprendizajes, hipotesis_abiertas: hipotesis, pendientes, sincronizado_el: (/* @__PURE__ */ new Date()).toISOString() });
          sincronizados++;
        }
        resultado.doc_maestro_consolidado = sincronizados;
      }
      const { data: wr } = await supabase.rpc("actualizar_win_rates");
      resultado.win_rates_actualizados = wr || [];
      await supabase.rpc("actualizar_eventos_escalera");
      const { data: tasa } = await supabase.from("v_tasa_acierto").select("*");
      const { data: refl } = await supabase.from("v_reflexiones_recurrentes").select("*").limit(10);
      resultado.tasa_acierto = tasa || [];
      resultado.propuestas_de_cambio_al_prompt = refl || [];
      res.json({ ok: true, ...resultado });
    } catch (e) {
      res.status(500).json({ error: e.message, parcial: resultado });
    }
  });
  app2.get("/api/aprendizaje", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    const q = (t) => client ? supabase.from(t).select("*").eq("account", client) : supabase.from(t).select("*");
    const [impacto, tasa, refl, recurrentes] = await Promise.all([
      q("v_impacto_accionables").order("ejecutado_el", { ascending: false }).limit(30),
      q("v_tasa_acierto"),
      q("reflexiones").order("run_date", { ascending: false }).limit(20),
      q("v_reflexiones_recurrentes")
    ]);
    res.json({ impacto: impacto.data || [], tasa_acierto: tasa.data || [], reflexiones: refl.data || [], propuestas: recurrentes.data || [] });
  });
  app2.post("/api/reflexiones", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { account, tipo, que_paso, que_haria_distinto, regla_del_prompt, confianza } = req.body;
    if (!account || !tipo || !que_paso || !que_haria_distinto) return res.status(400).json({ error: "faltan campos" });
    const { data, error } = await supabase.from("reflexiones").insert({ account, tipo, que_paso, que_haria_distinto, regla_del_prompt, confianza: confianza || "media" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app2.get("/api/estrategia", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    const [dec, marg] = await Promise.all([
      client ? supabase.from("v_decision_estructural").select("*").eq("account", client) : supabase.from("v_decision_estructural").select("*"),
      client ? supabase.from("v_cpa_marginal").select("*").eq("account", client).order("campaign").order("escalon") : supabase.from("v_cpa_marginal").select("*").order("account").order("campaign").order("escalon")
    ]);
    if (dec.error) return res.status(500).json({ error: dec.error.message });
    res.json({ decisiones: dec.data || [], cpa_marginal: marg.data || [] });
  });
  async function extraerSeccionesBrief(pageId) {
    if (!notion) return { resumen: "", cambiamos: "", sigue: "" };
    let cursor;
    const bloques = [];
    do {
      const r = await notion.blocks.children.list({ block_id: pageId, page_size: 100, start_cursor: cursor });
      bloques.push(...r.results);
      cursor = r.has_more ? r.next_cursor : void 0;
    } while (cursor);
    const texto = (b) => (b[b.type]?.rich_text || []).map((t) => t.plain_text).join("");
    let dentro = false;
    const lineas = [];
    for (const b of bloques) {
      const esHeading = /^heading_/.test(b.type);
      const t = texto(b).trim();
      if (esHeading) {
        if (/reporte (para|al) (el )?cliente|client report/i.test(t)) {
          dentro = true;
          continue;
        }
        if (dentro) break;
        continue;
      }
      if (!dentro || !t) continue;
      if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") lineas.push("- " + t);
      else lineas.push(t);
    }
    return { resumen: lineas.join("\n"), cambiamos: "", sigue: "" };
  }
  async function bloquesDe(r) {
    if (Array.isArray(r.bloques) && r.bloques.length) return r.bloques;
    const pdf = await cargarPdf();
    const textoCompleto = [r.resumen_ejecutivo, r.que_cambiamos ? `${r.idioma === "en" ? "Changes applied" : "Cambios aplicados"}:
${r.que_cambiamos}` : "", r.que_sigue ? `${r.idioma === "en" ? "Next steps" : "Pr\xF3ximos pasos"}:
${r.que_sigue}` : ""].filter(Boolean).join("\n\n");
    const b = pdf.parsearBloques(textoCompleto || "");
    if (b.length && supabase) await supabase.from("reportes_cliente").update({ bloques: b }).eq("id", r.id);
    return b;
  }
  async function guardarVersion(reporteId, bloques, autor, motivo) {
    if (!supabase) return;
    const { data: r } = await supabase.from("reportes_cliente").select("version").eq("id", reporteId).single();
    const v = (r?.version || 1) + 1;
    await supabase.from("reportes_versiones").insert({ reporte_id: reporteId, version: v, autor, bloques, motivo });
    await supabase.from("reportes_cliente").update({ version: v, bloques, editado: autor === "andres", pdf_path: null }).eq("id", reporteId);
    return v;
  }
  async function regenerarSeccion(r, cuenta, etiqueta, instruccion) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Sin ANTHROPIC_API_KEY");
    const Anthropic3 = (await import("@anthropic-ai/sdk")).default;
    const cli = new Anthropic3({ apiKey: process.env.ANTHROPIC_API_KEY });
    const [pulsos, hechos, estado] = await Promise.all([
      supabase.from("pulso_diario").select("fecha, hallazgo_principal, resumen").eq("account", r.account).gte("fecha", r.periodo_desde).lte("fecha", r.periodo_hasta).order("fecha"),
      supabase.from("accionables_espejo").select("titulo, ejecutado_el, por_que").eq("account", r.account).eq("estado", "Hecho").gte("ejecutado_el", r.periodo_desde).lte("ejecutado_el", r.periodo_hasta),
      supabase.rpc("get_estado_cuenta", { p_account: r.account })
    ]);
    const idioma = r.idioma === "en" ? "ingl\xE9s" : "espa\xF1ol";
    const otras = (r.bloques || []).filter((b) => b.etiqueta !== etiqueta).map((b) => `${b.etiqueta}: ${b.texto || ""} ${(b.vinetas || []).map((v) => "- " + v).join(" ")}`).join("\n");
    const prompt = `Reescrib\xED SOLO la secci\xF3n "${etiqueta}" del reporte al cliente ${cuenta.nombre_cliente}, per\xEDodo ${r.periodo_desde} a ${r.periodo_hasta}, en ${idioma}, primera persona del singular.
${instruccion ? "INSTRUCCI\xD3N DE ANDR\xC9S: " + instruccion : ""}
LAS OTRAS SECCIONES (no las repitas ni las contradigas): ${otras}
REGLAS: sin guion largo; sin "no es X, es Y"; sin listas de tres forzadas; sin adverbios de intensidad; un n\xFAmero exacto en vez de un adjetivo; prueba del CFO; malas noticias en voz activa y con causa. Entre 1 y 5 vi\xF1etas si la secci\xF3n es de vi\xF1etas (Observaciones, Cambios, Atenci\xF3n, Pr\xF3ximos); un p\xE1rrafo corto si es Contexto.
REGLAS DE LA CUENTA: ${cuenta.reglas_dominio || ""}
DATOS: ${JSON.stringify(r.metricas)} SERIE: ${JSON.stringify(r.serie)} CAMPA\xD1AS: ${JSON.stringify(r.campanas)}
AN\xC1LISIS DIARIO DEL PER\xCDODO: ${JSON.stringify(pulsos.data || [])} CAMBIOS EJECUTADOS: ${JSON.stringify(hechos.data || [])} PLAN Y ABIERTOS: ${JSON.stringify({ plan: estado.data?.plan_vigente?.contexto, abiertos: estado.data?.accionables_abiertos?.map((a) => a.titulo) })}
Devolv\xE9 SOLO JSON: {"texto": "<p\xE1rrafo o vac\xEDo>", "vinetas": ["...", "..."]}`;
    const msg = await cli.messages.create({ model: "claude-sonnet-5", max_tokens: 1200, messages: [{ role: "user", content: prompt }], output_config: { effort: "medium" } });
    const raw2 = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const i = raw2.indexOf("{"), j = raw2.lastIndexOf("}");
    const o = JSON.parse(raw2.slice(i, j + 1));
    return { texto: o.texto || void 0, vinetas: Array.isArray(o.vinetas) && o.vinetas.length ? o.vinetas : void 0 };
  }
  async function buscarBriefEnRango(account, desde, hasta) {
    if (!notion || !NOTION_BASES.BRIEFS) return null;
    const clienteId = await findNotionClientId(notion, account);
    if (!clienteId) return null;
    const q = await notion.databases.query({ database_id: NOTION_BASES.BRIEFS, filter: { and: [{ property: "Cliente", relation: { contains: clienteId } }, { property: "Semana", date: { on_or_after: desde } }, { property: "Semana", date: { on_or_before: hasta } }] }, sorts: [{ property: "Semana", direction: "descending" }], page_size: 4 });
    return q.results[0] || null;
  }
  async function redactarReporte(account, cuenta, desde, hasta, datos) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Sin brief para ese rango y sin ANTHROPIC_API_KEY para redactar");
    const Anthropic3 = (await import("@anthropic-ai/sdk")).default;
    const cli = new Anthropic3({ apiKey: process.env.ANTHROPIC_API_KEY });
    const [pulsos, accHechos, estado] = await Promise.all([
      supabase.from("pulso_diario").select("fecha, hallazgo_principal, resumen").eq("account", account).gte("fecha", desde).lte("fecha", hasta).order("fecha"),
      supabase.from("accionables_espejo").select("titulo, ejecutado_el, por_que").eq("account", account).eq("estado", "Hecho").gte("ejecutado_el", desde).lte("ejecutado_el", hasta),
      supabase.rpc("get_estado_cuenta", { p_account: account })
    ]);
    const idioma = cuenta.idioma_reporte === "en" ? "ingl\xE9s" : "espa\xF1ol";
    const etiquetas = cuenta.idioma_reporte === "en" ? "Context:, Observations:, Changes applied:, Points of attention:, Next steps:" : "Contexto:, Observaciones:, Cambios aplicados:, Puntos de atenci\xF3n:, Pr\xF3ximos pasos:";
    const prompt = `Escrib\xED la secci\xF3n de reporte al cliente para ${cuenta.nombre_cliente}, per\xEDodo ${desde} a ${hasta}, en ${idioma}, primera persona del singular (sos el media buyer de NorthSignal).

ESTRUCTURA: bloques con etiqueta en su propia l\xEDnea seguida de dos puntos y vi\xF1etas con guion debajo. Etiquetas exactas: ${etiquetas}. Contexto solo si afecta la lectura. Entre dos y cinco vi\xF1etas en Observaciones. Cada bloque con el largo que necesita; las vi\xF1etas no miden todas igual.

QUE NO HACER: sin guion largo; sin "no es X, es Y"; sin listas de exactamente tres forzadas; sin adverbios de intensidad; sin "cabe destacar" ni "en este sentido"; sin escalar afirmaciones; un n\xFAmero exacto en vez de un adjetivo; sin tablas; sin keywords sueltas; sin jerga (prueba del CFO). Malas noticias en voz activa y con causa.

REGLAS DE LA CUENTA: ${cuenta.reglas_dominio || ""}

DATOS DEL PER\xCDODO: ${JSON.stringify(datos.metricas)}
SERIE: ${JSON.stringify(datos.serie)}
CAMPA\xD1AS Y GRUPOS CON GASTO: ${JSON.stringify({ campanas: datos.campanas, grupos: datos.grupos })}
LO QUE EL AN\xC1LISIS DIARIO ENCONTR\xD3 CADA D\xCDA: ${JSON.stringify(pulsos.data || [])}
CAMBIOS EJECUTADOS EN EL PER\xCDODO: ${JSON.stringify(accHechos.data || [])}
ACCIONABLES ABIERTOS Y PLAN: ${JSON.stringify({ abiertos: estado.data?.accionables_abiertos, plan: estado.data?.plan_vigente?.contexto, por_que_limitada: estado.data?.por_que_limitada?.por_que })}

Devolv\xE9 solo el texto del reporte, sin encabezado ni comentarios.`;
    const msg = await cli.messages.create({ model: "claude-sonnet-5", max_tokens: 2500, messages: [{ role: "user", content: prompt }], output_config: { effort: "medium" } });
    return msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }
  app2.post("/api/reportes/generar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const { account, desde, hasta, tipo: tipoIn, brief_id, resumen_manual } = req.body || {};
      if (!account || !desde || !hasta) return res.status(400).json({ error: "account, desde y hasta son obligatorios" });
      if (hasta < desde) return res.status(400).json({ error: "El rango est\xE1 al rev\xE9s" });
      const dias = (new Date(hasta).getTime() - new Date(desde).getTime()) / 864e5 + 1;
      const tipo = tipoIn || (dias > 10 ? "mensual" : "semanal");
      const { data: cuenta } = await supabase.from("cuentas").select("*").eq("account", account).single();
      if (!cuenta) return res.status(404).json({ error: "cuenta no encontrada" });
      const { count: nDias } = await supabase.from("v_serie_diaria").select("date", { count: "exact", head: true }).eq("account", account).gte("date", desde).lte("date", hasta);
      if (!nDias) return res.status(422).json({ error: `No hay datos diarios de ${account} entre ${desde} y ${hasta}. La capa diaria empieza el 22 de agosto de 2026.` });
      const { data: datos, error } = await supabase.rpc("get_reporte_datos", { p_account: account, p_desde: desde, p_hasta: hasta });
      if (error) return res.status(500).json({ error: error.message });
      let secciones = { resumen: resumen_manual || "", cambiamos: "", sigue: "" };
      let origen = resumen_manual ? "manual" : "";
      let briefUsado = brief_id || null;
      if (!secciones.resumen && notion) {
        const brief = brief_id ? { id: brief_id } : await buscarBriefEnRango(account, desde, hasta);
        if (brief) {
          secciones = await extraerSeccionesBrief(brief.id);
          briefUsado = brief.id;
          if (secciones.resumen) origen = "brief";
        }
      }
      if (!secciones.resumen) {
        secciones.resumen = await redactarReporte(account, cuenta, desde, hasta, datos);
        origen = "sonnet-5";
      }
      const pdfLib = await cargarPdf();
      const textoInicial = [secciones.resumen, secciones.cambiamos ? `${cuenta.idioma_reporte === "en" ? "Changes applied" : "Cambios aplicados"}:
${secciones.cambiamos}` : "", secciones.sigue ? `${cuenta.idioma_reporte === "en" ? "Next steps" : "Pr\xF3ximos pasos"}:
${secciones.sigue}` : ""].filter(Boolean).join("\n\n");
      const bloquesIniciales = pdfLib.parsearBloques(textoInicial);
      const { data: fila, error: e2 } = await supabase.from("reportes_cliente").upsert({
        account,
        periodo_desde: desde,
        periodo_hasta: hasta,
        tipo,
        idioma: cuenta.idioma_reporte,
        estado: "borrador",
        bloques: bloquesIniciales,
        version: 1,
        resumen_ejecutivo: secciones.resumen,
        que_cambiamos: secciones.cambiamos || null,
        que_sigue: secciones.sigue || null,
        metricas: datos.metricas,
        serie: datos.serie,
        campanas: { campanas: datos.campanas, grupos: datos.grupos, accionables: datos.accionables_ejecutados },
        brief_notion_id: briefUsado,
        escrito_por: origen === "brief" ? "opus-5-semanal" : origen === "sonnet-5" ? "sonnet-5-desde-datos" : "andres"
      }, { onConflict: "account,periodo_desde,tipo" }).select().single();
      if (e2) return res.status(500).json({ error: e2.message });
      await supabase.from("reportes_versiones").upsert({ reporte_id: fila.id, version: 1, autor: origen === "brief" ? "opus-5-semanal" : origen === "sonnet-5" ? "sonnet-5" : "andres", bloques: bloquesIniciales, motivo: "borrador inicial" }, { onConflict: "reporte_id,version", ignoreDuplicates: true });
      res.json({ ok: true, reporte: fila, origen, dias_con_datos: nDias });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/reportes", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    let q = supabase.from("reportes_cliente").select("id, account, periodo_desde, periodo_hasta, tipo, idioma, estado, resumen_ejecutivo, que_cambiamos, que_sigue, metricas, pdf_path, creado, aprobado_el, enviado_el, enviado_a, editado").order("periodo_desde", { ascending: false }).limit(30);
    if (client) q = q.eq("account", client);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app2.put("/api/reportes/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { bloques, nota_interna, motivo } = req.body || {};
    const { data: r } = await supabase.from("reportes_cliente").select("id, estado").eq("id", req.params.id).single();
    if (!r) return res.status(404).json({ error: "no encontrado" });
    if (["enviado"].includes(r.estado)) return res.status(409).json({ error: "Ya se envi\xF3; para cambiarlo, cre\xE1 una versi\xF3n nueva del per\xEDodo." });
    if (Array.isArray(bloques)) await guardarVersion(Number(req.params.id), bloques, "andres", motivo || "edici\xF3n");
    if (nota_interna !== void 0) await supabase.from("reportes_cliente").update({ nota_interna }).eq("id", req.params.id);
    const { data } = await supabase.from("reportes_cliente").select("*").eq("id", req.params.id).single();
    res.json(data);
  });
  app2.post("/api/reportes/:id/regenerar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const { etiqueta, instruccion } = req.body || {};
      const { data: r } = await supabase.from("reportes_cliente").select("*").eq("id", req.params.id).single();
      if (!r) return res.status(404).json({ error: "no encontrado" });
      if (r.estado === "enviado") return res.status(409).json({ error: "Ya se envi\xF3." });
      const { data: cuenta } = await supabase.from("cuentas").select("*").eq("account", r.account).single();
      r.bloques = await bloquesDe(r);
      const nuevo = await regenerarSeccion(r, cuenta, etiqueta, instruccion);
      const bloques = r.bloques.map((b) => b.etiqueta === etiqueta ? { ...b, ...nuevo } : b);
      if (!r.bloques.some((b) => b.etiqueta === etiqueta)) bloques.push({ etiqueta, ...nuevo });
      const v = await guardarVersion(r.id, bloques, "regenerar", `regener\xF3 "${etiqueta}"${instruccion ? ": " + instruccion : ""}`);
      res.json({ ok: true, bloques, version: v });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/reportes/:id/versiones", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.from("reportes_versiones").select("id, version, fecha, autor, motivo").eq("reporte_id", req.params.id).order("version", { ascending: false });
    res.json(data || []);
  });
  app2.post("/api/reportes/:id/versiones/:v/restaurar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data: ver } = await supabase.from("reportes_versiones").select("bloques").eq("reporte_id", req.params.id).eq("version", req.params.v).single();
    if (!ver) return res.status(404).json({ error: "version no encontrada" });
    const v = await guardarVersion(Number(req.params.id), ver.bloques, "andres", `restaur\xF3 la v${req.params.v}`);
    res.json({ ok: true, version: v, bloques: ver.bloques });
  });
  async function generarYGuardarPdf(id) {
    const req = { params: { id } };
    const res = { status: () => ({ json: (j) => {
      throw new Error(j.error || "error");
    } }), json: (j) => j };
    const pdf = await cargarPdf();
    const { data: r } = await supabase.from("reportes_cliente").select("*").eq("id", req.params.id).single();
    if (!r) return res.status(404).json({ error: "no encontrado" });
    const { data: cuenta } = await supabase.from("cuentas").select("*").eq("account", r.account).single();
    const dias = (new Date(r.periodo_hasta).getTime() - new Date(r.periodo_desde).getTime()) / 864e5 + 1;
    const { data: anteriorCount } = await supabase.from("v_serie_diaria").select("date", { count: "exact", head: true }).eq("account", r.account).gte("date", new Date(new Date(r.periodo_desde).getTime() - dias * 864e5).toISOString().slice(0, 10)).lt("date", r.periodo_desde);
    const bloquesR = await bloquesDe(r);
    const input = {
      account: r.account,
      nombre_cliente: cuenta.nombre_cliente,
      idioma: r.idioma,
      moneda: cuenta.moneda,
      locale: cuenta.locale,
      titulo: (cuenta.encabezado_reporte || "").split("|")[0].trim() || void 0,
      periodo_desde: r.periodo_desde,
      periodo_hasta: r.periodo_hasta,
      tipo: r.tipo,
      bloques: bloquesR,
      metricas: r.metricas,
      periodo_anterior_completo: (anteriorCount ?? 0) >= dias,
      campanas: r.campanas?.campanas || [],
      grupos: r.campanas?.grupos || [],
      logo: await pdf.descargarLogo()
    };
    const buf = await pdf.generarReportePDF(input);
    const ruta = `${r.account}/${r.tipo}_${r.periodo_desde}_${r.id}.pdf`;
    const { error: up } = await supabase.storage.from("reportes").upload(ruta, buf, { contentType: "application/pdf", upsert: true });
    if (up) return res.status(500).json({ error: up.message });
    await supabase.from("reportes_cliente").update({ pdf_path: ruta, pdf_bytes: buf.length }).eq("id", r.id);
    return { ok: true, pdf_path: ruta, bytes: buf.length };
  }
  app2.post("/api/reportes/:id/pdf", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      res.json(await generarYGuardarPdf(Number(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/reportes/:id/pdf", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data: r0 } = await supabase.from("reportes_cliente").select("account, periodo_desde, pdf_path").eq("id", req.params.id).single();
    if (!r0) return res.status(404).json({ error: "no encontrado" });
    let r = r0;
    if (!r.pdf_path) {
      try {
        const g = await generarYGuardarPdf(Number(req.params.id));
        r = { ...r, pdf_path: g.pdf_path };
      } catch (e) {
        return res.status(500).json({ error: "No pude generar el PDF: " + e.message });
      }
    }
    const { data, error } = await supabase.storage.from("reportes").download(r.pdf_path);
    if (error || !data) return res.status(500).json({ error: error?.message || "no se pudo descargar" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `inline; filename="NorthSignal_${r.account}_${r.periodo_desde}.pdf"`);
    res.send(Buffer.from(await data.arrayBuffer()));
  });
  app2.post("/api/reportes/:id/revisado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    await supabase.from("reportes_cliente").update({ estado: "revisado" }).eq("id", req.params.id).eq("estado", "borrador");
    res.json({ ok: true });
  });
  app2.post("/api/reportes/:id/enviar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data: r } = await supabase.from("reportes_cliente").select("*").eq("id", req.params.id).single();
    if (!r) return res.status(404).json({ error: "no encontrado" });
    if (r.estado !== "aprobado") return res.status(409).json({ error: "Primero aprobalo." });
    const { data: cuenta } = await supabase.from("cuentas").select("*").eq("account", r.account).single();
    const url = `${process.env.APP_URL || "https://app-northsignal.vercel.app"}/r/${r.token}`;
    const canal = (req.body || {}).canal || cuenta.canal_reporte;
    if (canal === "slack") {
      const hook = process.env[`SLACK_WEBHOOK_${r.account}`] || process.env.SLACK_WEBHOOK_URL;
      if (!hook) return res.status(422).json({ error: `Falta SLACK_WEBHOOK_${r.account} en Vercel. Mientras tanto, copi\xE1 el link y pegalo en Slack: ${url}` });
      const bloques = await bloquesDe(r);
      const resumen = bloques.slice(0, 2).map((b) => `*${b.etiqueta}*
${b.texto || ""}${(b.vinetas || []).map((v) => "\n\u2022 " + v).join("")}`).join("\n\n");
      const m = r.metricas || {};
      const texto = r.idioma === "en" ? `*Weekly report \xB7 ${r.periodo_desde} to ${r.periodo_hasta}*
Spend ${m.gasto?.actual ?? "-"} \xB7 Conversions ${m.conversiones?.actual ?? "-"} \xB7 CPA ${m.cpa?.actual ?? "-"}

${resumen}

Full report: ${url}` : `*Reporte semanal \xB7 ${r.periodo_desde} al ${r.periodo_hasta}*
Inversi\xF3n ${m.gasto?.actual ?? "-"} \xB7 Conversiones ${m.conversiones?.actual ?? "-"} \xB7 CPA ${m.cpa?.actual ?? "-"}

${resumen}

Reporte completo: ${url}`;
      const rs = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: texto }) });
      if (!rs.ok) return res.status(500).json({ error: "Slack respondi\xF3 " + rs.status });
      await supabase.from("reportes_cliente").update({ estado: "enviado", enviado_el: (/* @__PURE__ */ new Date()).toISOString(), enviado_a: "slack" }).eq("id", r.id);
      return res.json({ ok: true, canal: "slack", url });
    }
    if (canal === "email") {
      await supabase.from("reportes_cliente").update({ enviado_a: "email:pendiente" }).eq("id", r.id);
      return res.json({ ok: true, canal: "email", pendiente: true, url, nota: "El script lo manda por mail con el PDF adjunto en la pr\xF3xima corrida de las 9:15." });
    }
    return res.json({ ok: true, canal: "manual", url, nota: "Canal manual: copi\xE1 el link o descarg\xE1 el PDF." });
  });
  app2.get("/api/cron/reportes-por-enviar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.from("reportes_cliente").select("id, account, periodo_desde, periodo_hasta, idioma, token, pdf_path, metricas, bloques, resumen_ejecutivo").eq("estado", "aprobado").eq("enviado_a", "email:pendiente");
    const out = [];
    for (const r of data || []) {
      const { data: cuenta } = await supabase.from("cuentas").select("nombre_cliente, destinatarios_reporte, nombre_contacto, encabezado_reporte").eq("account", r.account).single();
      let pdfUrl = null;
      if (r.pdf_path) {
        const { data: signed } = await supabase.storage.from("reportes").createSignedUrl(r.pdf_path, 3600);
        pdfUrl = signed?.signedUrl || null;
      }
      out.push({ ...r, cuenta, pdf_url: pdfUrl, link: `${process.env.APP_URL || "https://app-northsignal.vercel.app"}/r/${r.token}` });
    }
    res.json(out);
  });
  app2.post("/api/cron/reportes-enviado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { id, a } = req.body || {};
    await supabase.from("reportes_cliente").update({ estado: "enviado", enviado_el: (/* @__PURE__ */ new Date()).toISOString(), enviado_a: "email:" + (a || "") }).eq("id", id);
    res.json({ ok: true });
  });
  app2.post("/api/reportes/:id/aprobar", async (req, res) => {
    {
      const a = puedeEscribirAfuera();
      if (!a.permitido) return res.status(403).json({ error: a.motivo, entorno: entornoActual() });
    }
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data, error } = await supabase.from("reportes_cliente").update({ estado: "aprobado", aprobado_el: (/* @__PURE__ */ new Date()).toISOString(), aprobado_por: "andres" }).eq("id", req.params.id).eq("estado", "borrador").select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app2.post("/api/reportes/:id/descartar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { error } = await supabase.from("reportes_cliente").update({ estado: "descartado" }).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app2.all("/api/cron/reportes", async (req, res) => {
    if (!supabase || !notion || !NOTION_BASES.BRIEFS) return res.status(503).json({ error: "Supabase o Notion no configurados" });
    const hoy = /* @__PURE__ */ new Date();
    const dow = hoy.getDay();
    const lunesPrevio = new Date(hoy);
    lunesPrevio.setDate(hoy.getDate() - (dow + 6) % 7 - 7);
    const desde = lunesPrevio.toISOString().slice(0, 10);
    const hasta = new Date(lunesPrevio.getTime() + 6 * 864e5).toISOString().slice(0, 10);
    const { data: cuentas } = await supabase.from("cuentas").select("account, frecuencia_reporte").eq("activa", true).in("frecuencia_reporte", ["semanal", "ninguna"]);
    const out = [];
    for (const c of cuentas || []) {
      try {
        const { data: existe } = await supabase.from("reportes_cliente").select("id").eq("account", c.account).eq("periodo_desde", desde).eq("tipo", "semanal").maybeSingle();
        if (existe) {
          out.push({ cuenta: c.account, nota: "ya existe" });
          continue;
        }
        const q = await notion.databases.query({ database_id: NOTION_BASES.BRIEFS, filter: { and: [{ property: "Semana", date: { equals: desde } }, { property: "Cliente", relation: { contains: await findNotionClientId(notion, c.account) || "" } }] }, page_size: 1 });
        const brief = q.results[0];
        if (!brief) {
          out.push({ cuenta: c.account, nota: `sin brief para ${desde}` });
          continue;
        }
        const secciones = await extraerSeccionesBrief(brief.id);
        if (!secciones.resumen) {
          out.push({ cuenta: c.account, nota: "brief sin secci\xF3n de reporte" });
          continue;
        }
        const { data: datos } = await supabase.rpc("get_reporte_datos", { p_account: c.account, p_desde: desde, p_hasta: hasta });
        const { data: cta } = await supabase.from("cuentas").select("idioma_reporte").eq("account", c.account).single();
        await supabase.from("reportes_cliente").insert({
          account: c.account,
          periodo_desde: desde,
          periodo_hasta: hasta,
          tipo: "semanal",
          idioma: cta?.idioma_reporte || "es",
          estado: "borrador",
          resumen_ejecutivo: secciones.resumen,
          que_cambiamos: secciones.cambiamos || null,
          que_sigue: secciones.sigue || null,
          metricas: datos.metricas,
          serie: datos.serie,
          campanas: { campanas: datos.campanas, grupos: datos.grupos, accionables: datos.accionables_ejecutados },
          brief_notion_id: brief.id
        });
        out.push({ cuenta: c.account, creado: true, periodo: `${desde} \u2192 ${hasta}` });
      } catch (e) {
        out.push({ cuenta: c.account, error: e.message });
      }
    }
    res.json({ ok: true, semana: desde, resultados: out });
  });
  app2.post("/api/asistente", async (req, res) => {
    {
      const lim = await verificarLimite(supabase, ipDe(req), "/asistente", 40, 60);
      if (!lim.permitido) return res.status(429).json({
        error: `Demasiados mensajes seguidos. Prob\xE1 de nuevo en ${Math.ceil((lim.esperar || 60) / 60)} minuto(s).`
      });
      await registrarIntento(supabase, ipDe(req), "/asistente", true);
    }
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const { mensajes, pagina, cuenta } = req.body || {};
      if (!Array.isArray(mensajes) || !mensajes.length) return res.status(400).json({ error: "mensajes requerido" });
      const r = await responderAsistente(supabase, mensajes.slice(-8), { pagina, cuenta });
      res.json(r);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/coherencia", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const [e, r] = await Promise.all([supabase.from("escritores").select("*").order("entidad"), supabase.from("reconciliaciones").select("*").order("corrida", { ascending: false }).limit(40)]);
    res.json({ escritores: e.data || [], reconciliaciones: r.data || [] });
  });
  app2.post("/api/tickets", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { tipo = "bug", titulo, descripcion, pagina, cuenta, contexto } = req.body || {};
    if (!titulo) return res.status(400).json({ error: "titulo requerido" });
    const { data, error } = await supabase.from("tickets").insert({ tipo, titulo, descripcion, pagina, cuenta, contexto }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app2.get("/api/tickets", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data, error } = await supabase.from("tickets").select("*").order("creado", { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app2.get("/api/alertas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data, error } = await supabase.from("v_alertas_agrupadas").select("*").limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app2.post("/api/alertas/:id/:accion", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { accion } = req.params;
    const { dias, por_que } = req.body || {};
    const upd = accion === "vista" ? { estado: "vista", vista_el: (/* @__PURE__ */ new Date()).toISOString() } : accion === "resolver" ? { estado: "resuelta", resuelta_el: (/* @__PURE__ */ new Date()).toISOString() } : accion === "silenciar" ? { estado: "silenciada", silenciada_hasta: new Date(Date.now() + (Number(dias) || 7) * 864e5).toISOString().slice(0, 10), silenciada_por_que: por_que || null } : null;
    if (!upd) return res.status(400).json({ error: "accion invalida" });
    const { error } = await supabase.from("alertas").update(upd).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  async function sincronizarEspejo() {
    if (!supabase || !notion || !NOTION_BASES.ACCIONABLES) return 0;
    let cursor;
    const filas = [];
    const { parsearAccion: parsearAccion2 } = await Promise.resolve().then(() => (init_accion(), accion_exports));
    do {
      const r = await notion.databases.query({ database_id: NOTION_BASES.ACCIONABLES, page_size: 100, start_cursor: cursor });
      for (const page of r.results) {
        const p = page.properties;
        const txt = (k) => p[k]?.rich_text?.map((t) => t.plain_text).join("") || "";
        const cliente = await resolveNotionClient(notion, p.Cliente);
        const parsed = parsearAccion2(txt("Accion JSON"));
        let accionError = parsed.error || null;
        if (parsed.accion?.objeto?.keyword && ["pausar_keyword", "cambiar_concordancia", "reactivar_keyword"].includes(parsed.accion.verbo) && cliente) {
          const { data: rk } = await supabase.rpc("resolver_keyword", { p_account: cliente, p_keyword: parsed.accion.objeto.keyword, p_pista: `${parsed.accion.objeto.grupo || ""} ${parsed.accion.objeto.campana || ""}` });
          if (!rk?.campana) accionError = `keyword "${parsed.accion.objeto.keyword}" no encontrada activa en ${cliente}`;
          else {
            parsed.accion.objeto.campana = rk.campana;
            parsed.accion.objeto.grupo = rk.grupo;
            if (!parsed.accion.objeto.match_type) parsed.accion.objeto.match_type = rk.match_type;
          }
        }
        if (parsed.accion && cliente && !accionError) {
          const { data: inv } = await supabase.rpc("verificar_invariantes", { p_account: cliente, p_accion: parsed.accion });
          const bloq = (inv || []).filter((x) => x.bloquea);
          if (bloq.length) {
            accionError = "INVARIANTE: " + bloq.map((x) => x.detalle).join(" | ");
            const st = p.Estado?.select?.name;
            if (["Propuesto", "Bloqueado"].includes(st) && !txt("Decision final").includes("[INVARIANTE")) {
              try {
                await notion.comments.create({ parent: { page_id: page.id }, rich_text: [{ text: { content: `[INVARIANTE ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}] Este accionable viola una regla que no se negocia: ${bloq.map((x) => x.detalle).join(" | ")}`.slice(0, 1900) } }] });
              } catch {
              }
            }
          }
        }
        filas.push({
          notion_id: page.id,
          account: cliente,
          titulo: p.Accion?.title?.map((t) => t.plain_text).join("") || "",
          estado: p.Estado?.select?.name || "",
          prioridad: p.Prioridad?.select?.name || "",
          accion: parsed.accion || null,
          accion_valida: !!parsed.accion && !accionError,
          accion_error: accionError,
          naturaleza: p.Naturaleza?.select?.name || "",
          origen: p.Origen?.select?.name || null,
          entidad: txt("Entidad") || null,
          causa_raiz: txt("Causa raiz") || null,
          por_que: txt("Por que").slice(0, 1e3),
          detectado: p.Detectado?.date?.start || null,
          ejecutado_el: p["Ejecutado el"]?.date?.start || null,
          vence: p.Vence?.date?.start || null,
          reemplazado_por: p["Reemplazado por"]?.relation?.[0]?.id || null,
          semanas_pendiente: p["Semanas pendiente"]?.number ?? null,
          revision_ia: p["Revision IA"]?.select?.name || null,
          ultima_edicion: page.last_edited_time,
          sincronizado: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      cursor = r.has_more ? r.next_cursor : void 0;
    } while (cursor);
    const { createHash } = await import("crypto");
    const campos = ["titulo", "por_que", "accion", "entidad", "prioridad", "estado"];
    const { data: previos } = await supabase.from("accionables_espejo").select("notion_id, titulo, por_que, accion, entidad, prioridad, estado, hash, version").in("notion_id", filas.map((f) => f.notion_id));
    const prevMap = new Map((previos || []).map((p) => [p.notion_id, p]));
    const versiones = [];
    for (const f of filas) {
      const hash = createHash("sha256").update(JSON.stringify(campos.map((c) => f[c] ?? null))).digest("hex").slice(0, 16);
      const prev = prevMap.get(f.notion_id);
      f.hash = hash;
      if (!prev) {
        f.version = 1;
        versiones.push({ notion_id: f.notion_id, version: 1, autor: f.origen || "desconocido", diff: { creado: { antes: null, despues: f.titulo } }, hash });
        continue;
      }
      if (prev.hash === hash) {
        f.version = prev.version || 1;
        continue;
      }
      const diff = {};
      for (const c of campos) {
        const a = prev[c] ?? null, b = f[c] ?? null;
        if (JSON.stringify(a) !== JSON.stringify(b)) diff[c] = { antes: typeof a === "string" ? a.slice(0, 600) : a, despues: typeof b === "string" ? b.slice(0, 600) : b };
      }
      f.version = (prev.version || 1) + 1;
      versiones.push({ notion_id: f.notion_id, version: f.version, autor: f.ultima_edicion && Date.now() - new Date(f.ultima_edicion).getTime() < 3 * 36e5 ? "reciente" : "desconocido", diff, hash });
    }
    if (filas.length) {
      const { error } = await supabase.from("accionables_espejo").upsert(filas, { onConflict: "notion_id" });
      if (error) throw new Error(error.message);
    }
    if (versiones.length) {
      const { error: ev } = await supabase.from("accionable_versiones").upsert(versiones, { onConflict: "notion_id,version", ignoreDuplicates: true });
      if (ev) console.error("[versiones] " + ev.message);
      else console.log(`[versiones] ${versiones.length} nuevas`);
    }
    try {
      await supabase.rpc("detectar_conflictos");
    } catch (e) {
      console.error("[conflictos] " + e.message);
    }
    let rellenados = 0;
    for (const f of filas) {
      if (!["Propuesto", "Bloqueado", "En curso"].includes(f.estado)) continue;
      const props = {};
      if (!f.origen) props.Origen = { select: { name: "Semanal" } };
      if (!f.entidad) {
        const r = await notion.pages.retrieve({ page_id: f.notion_id });
        const donde2 = r?.properties?.Donde?.rich_text?.map((t) => t.plain_text).join("") || "";
        if (donde2.trim()) props.Entidad = { rich_text: [{ text: { content: donde2.trim().slice(0, 200) } }] };
      }
      if (Object.keys(props).length) {
        try {
          await notion.pages.update({ page_id: f.notion_id, properties: props });
          rellenados++;
          await new Promise((r) => setTimeout(r, 350));
        } catch (e) {
          console.error("[espejo relleno] " + e.message);
        }
      }
    }
    if (rellenados) console.log(`[espejo] ${rellenados} accionables con Origen/Entidad rellenados`);
    const hace24 = new Date(Date.now() - 864e5).toISOString();
    const { data: yaAprobados } = await supabase.from("acciones_aprobadas").select("notion_id");
    const setAprob = new Set((yaAprobados || []).map((x) => x.notion_id));
    for (const f of filas) {
      if (f.estado !== "Propuesto" || setAprob.has(f.notion_id) || !f.ultima_edicion || f.ultima_edicion < hace24) continue;
      try {
        await aplicarPoliticaAuto(f.account, f.notion_id, f.titulo, f.entidad || "", f.origen || "Semanal", null, null);
      } catch (e) {
        console.error("[politica espejo] " + e.message);
      }
    }
    return filas.length;
  }
  app2.all("/api/cron/espejo", async (req, res) => {
    try {
      const n = await sincronizarEspejo();
      res.json({ ok: true, sincronizados: n });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.all("/api/cron/reconciliar", async (req, res) => {
    if (!supabase || !notion) return res.status(503).json({ error: "Supabase o Notion no configurados" });
    try {
      await sincronizarEspejo();
    } catch (e) {
      console.error("[espejo] " + e.message);
    }
    try {
      await supabase.rpc("memoria_ingestar");
      const n = await embeberPendientes(supabase);
      if (n) console.log(`[memoria] ${n} embebidos`);
    } catch (e) {
      console.error("[memoria] " + e.message);
    }
    const { data: resumen } = await supabase.rpc("reconciliar");
    const { data: pendientes } = await supabase.from("reconciliaciones").select("*").eq("aplicada", false).order("corrida").limit(50);
    let aplicadas = 0;
    const errores = [];
    for (const r of pendientes || []) {
      try {
        const [tipo, id] = String(r.objeto).split(":");
        if (tipo !== "accionable") continue;
        if (r.accion === "vencer") {
          await notion.pages.update({ page_id: id, properties: { Estado: { select: { name: NOTION_STATES.DESCARTADO } }, "Decision final": { rich_text: [{ text: { content: `[RECONCILIADOR ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}] ${r.detalle}` } }] } } });
        } else if (r.accion === "duplicado") {
          const viejo = (String(r.detalle).match(/Misma entidad que ([0-9a-f-]{32,36})/) || [])[1];
          if (viejo) await notion.pages.update({ page_id: id, properties: { "Reemplazado por": { relation: [{ id: viejo }] } } });
        } else if (r.accion === "ya_hecho") {
          await notion.comments.create({ parent: { page_id: id }, rich_text: [{ text: { content: `[RECONCILIADOR] ${r.detalle} Si es as\xED, marcalo Hecho con la fecha.` } }] });
        }
        await supabase.from("reconciliaciones").update({ aplicada: true, aplicada_el: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", r.id);
        aplicadas++;
      } catch (e) {
        errores.push(`${r.objeto}: ${e.message}`);
      }
    }
    res.json({ ok: true, resumen, aplicadas, errores });
  });
  async function resolverKeyword(account, kw, pista) {
    if (!supabase || !kw) return null;
    const { data } = await supabase.rpc("resolver_keyword", { p_account: account, p_keyword: kw, p_pista: pista || "" });
    return data && data.campana ? data : null;
  }
  async function aplicarPoliticaAuto(account, notionId, titulo, entidad, origen, confianza, comoHacerlo) {
    if (!supabase) return null;
    const { detectarTipoAuto: detectarTipoAuto2, extraerKeyword: extraerKeyword2, concordanciaDestino: concordanciaDestino2 } = await Promise.resolve().then(() => (init_tipoAuto(), tipoAuto_exports));
    const tipo = detectarTipoAuto2(titulo, comoHacerlo);
    if (!tipo) return null;
    const { data: modo } = await supabase.rpc("politica_aplica", { p_account: account, p_tipo: tipo, p_origen: origen, p_confianza: confianza, p_entidad: entidad });
    if (!modo) return null;
    const { data: espA } = await supabase.from("accionables_espejo").select("accion, accion_valida").eq("notion_id", notionId).maybeSingle();
    const lote = espA?.accion_valida && espA.accion?.objeto?.keywords?.length > 1 ? espA.accion.objeto.keywords : null;
    const kw = lote ? lote[0] : extraerKeyword2(titulo, entidad);
    if (!kw && tipo !== "pausar_anuncio") return null;
    const destino = tipo === "cambiar_concordancia" ? concordanciaDestino2(titulo) : null;
    if (tipo === "cambiar_concordancia" && !destino) return null;
    let loteOk = null;
    if (lote && tipo === "pausar_keyword") {
      loteOk = [];
      for (const k of lote) {
        const rr = await resolverKeyword(account, k, entidad || "");
        if (rr) loteOk.push(k);
      }
      if (!loteOk.length) return null;
    }
    const r = await resolverKeyword(account, kw, `${entidad || ""} ${titulo}`);
    if (!r) return null;
    const { data: bloqueo, error: errPv } = await supabase.rpc("prevuelo", { p_notion_id: notionId });
    if (errPv) {
      console.error("[politica] prevuelo fallo: " + errPv.message);
      return null;
    }
    if (bloqueo) {
      try {
        if (notion) await notion.comments.create({ parent: { page_id: notionId }, rich_text: [{ text: { content: `[POL\xCDTICA] Cumple la regla pero no se ejecuta solo: ${bloqueo}` } }] });
      } catch {
      }
      return null;
    }
    await supabase.from("acciones_aprobadas").insert({ account, notion_id: notionId, tipo, campana: r.campana, grupo: loteOk ? null : r.grupo, keyword: loteOk ? null : kw, keywords: loteOk || (lote && tipo.startsWith("negativa") ? lote : null), match_type: tipo === "cambiar_concordancia" ? "ANY" : /exact|exacta/i.test(titulo) ? "EXACT" : "PHRASE", match_type_destino: destino, modo: puedeEscribirAfuera().permitido ? modo : "simular", aprobada_por: "politica", por_politica: true });
    if (notion) {
      try {
        await notion.pages.update({ page_id: notionId, properties: { Estado: { select: { name: "En curso" } } } });
        await notion.comments.create({ parent: { page_id: notionId }, rich_text: [{ text: { content: `[POL\xCDTICA ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}] Cumple la regla de ejecuci\xF3n autom\xE1tica para ${tipo.replace("_", " ")} (${modo}). El script lo aplica en la pr\xF3xima hora. Si no quer\xEDas esto, desactiv\xE1 la pol\xEDtica en Sistema \u203A Automatizaci\xF3n.` } }] });
      } catch {
      }
    }
    return modo;
  }
  app2.post("/api/accionables/:id/aprobar-ejecutar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const body = req.body || {};
    if (supabase) {
      const { data: esp } = await supabase.from("accionables_espejo").select("accion, accion_valida, accion_error, account").eq("notion_id", req.params.id).maybeSingle();
      if (!esp?.accion_valida || !esp.accion) return res.status(422).json({ error: `Este accionable no tiene acci\xF3n estructurada v\xE1lida${esp?.accion_error ? ` (${esp.accion_error})` : ""}. Ejecutalo a mano con "C\xF3mo hacerlo", o esper\xE1 a que la tarea del lunes lo reformule.` });
      {
        const { tipoAutoDesde: tipoAutoDesde2 } = await Promise.resolve().then(() => (init_accion(), accion_exports));
        const a = esp.accion;
        const t = tipoAutoDesde2(a);
        if (t) {
          body.account = esp.account;
          body.tipo = t;
          body.campana = a.objeto.campana;
          body.grupo = a.objeto.grupo;
          body.keyword = a.objeto.keyword || a.objeto.keywords?.[0];
          body.keywords = a.objeto.keywords?.length > 1 ? a.objeto.keywords : void 0;
          body.match_type = a.objeto.match_type || (t.startsWith("negativa") ? a.parametros?.match_type_destino || "PHRASE" : "ANY");
          body.match_type_destino = a.parametros?.match_type_destino;
          body.ad_id = a.objeto.anuncio_id;
          body.parametros = a.parametros || {};
        }
      }
    }
    const { account, tipo, campana, grupo, keyword, match_type, match_type_destino, ad_id, modo } = body;
    const keywordsLote = Array.isArray(body.keywords) && body.keywords.length > 1 ? body.keywords : void 0;
    const { data: bloqueo, error: errPrevuelo } = await supabase.rpc("prevuelo", { p_notion_id: req.params.id });
    if (errPrevuelo) return res.status(500).json({ error: `El pre-vuelo fall\xF3 y no se encola sin \xE9l: ${errPrevuelo.message}` });
    if (bloqueo) return res.status(409).json({ error: `No se puede ejecutar todav\xEDa: ${bloqueo}`, conflicto: true });
    {
      const viejos = { negativa_grupo: "agregar_negativa", negativa_campana: "agregar_negativa" };
      const verboReal = viejos[tipo] || tipo;
      const { data: cap } = await supabase.from("capacidades_ejecucion").select("ejecutable, por_que_no, riesgo, requiere").eq("verbo", verboReal).maybeSingle();
      if (!cap) return res.status(400).json({ error: `Verbo desconocido: ${tipo}. Los v\xE1lidos est\xE1n en capacidades_ejecucion.` });
      if (!cap.ejecutable) return res.status(400).json({ error: `Esto no lo puede hacer un script: ${cap.por_que_no}`, manual: true, por_que: cap.por_que_no });
    }
    if (tipo === "cambiar_concordancia" && !match_type_destino) return res.status(400).json({ error: "No pude leer la concordancia destino del t\xEDtulo. Ejecutalo a mano." });
    if (!account || !keyword && !ad_id) return res.status(400).json({ error: "Faltan account y keyword o ad_id" });
    let camp = campana, grp = grupo, mt = match_type;
    let loteResuelto;
    if (keywordsLote && tipo === "pausar_keyword") {
      const ok = [], no = [];
      for (const k of keywordsLote) {
        const r = await resolverKeyword(account, k, `${campana || ""} ${grupo || ""}`);
        if (r) {
          ok.push(k);
          if (!camp) camp = r.campana;
        } else no.push(k);
      }
      if (!ok.length) return res.status(422).json({ error: `Ninguna de las ${keywordsLote.length} keywords est\xE1 activa en ${account}. Puede que ya est\xE9n pausadas.` });
      loteResuelto = ok;
      grp = null;
      mt = "ANY";
      if (no.length) console.log(`[lote] ${no.length} no encontradas: ${no.join(", ")}`);
    } else if (tipo === "quitar_negativa" && keyword) {
      const limpio = String(keyword).replace(/^[\[\"]+|[\]\"]+$/g, "").trim();
      let q = supabase.from("negatives").select("campaign, ad_group, match_type, negative_keyword").eq("account", account).ilike("negative_keyword", `%${limpio}%`);
      if (campana) q = q.eq("campaign", campana);
      const { data: negs } = await q.order("run_ts", { ascending: false }).limit(5);
      if (!negs?.length) return res.status(422).json({ error: `No encontr\xE9 la negativa "${keyword}" en ${account}. Puede que ya se haya quitado, o que est\xE9 escrita distinto. Verific\xE1 en Palabras clave negativas.` });
      const elegida = negs.find((n) => !body.nivel || (body.nivel === "campana" ? !n.ad_group : !!n.ad_group)) || negs[0];
      camp = elegida.campaign;
      grp = elegida.ad_group || null;
      mt = elegida.match_type || mt;
    } else if (keyword && tipo !== "negativa_grupo" && tipo !== "negativa_campana") {
      const r = await resolverKeyword(account, keyword, `${campana || ""} ${grupo || ""}`);
      if (!r) return res.status(422).json({ error: `No encontr\xE9 la keyword "${keyword}" activa en ${account}. Puede estar escrita distinto o ya pausada. Ejecutalo a mano con "C\xF3mo hacerlo".` });
      camp = r.campana;
      grp = r.grupo;
      mt = r.match_type;
    } else if (keyword) {
      const r = await resolverKeyword(account, keyword, `${campana || ""} ${grupo || ""}`);
      if (r) {
        camp = r.campana;
        if (!grp) grp = r.grupo;
      } else if (grupo) {
        const { data: g } = await supabase.from("keywords").select("campaign, ad_group").eq("account", account).ilike("ad_group", `%${grupo}%`).limit(1).maybeSingle();
        if (g) {
          camp = g.campaign;
          grp = g.ad_group;
        }
      }
      if (!camp) return res.status(422).json({ error: "No pude determinar la campa\xF1a. Ejecutalo a mano." });
    }
    const afuera = puedeEscribirAfuera();
    const modoReal = afuera.permitido ? modo : "simular";
    const p = body.parametros || {};
    const { data, error } = await supabase.from("acciones_aprobadas").insert({
      account,
      notion_id: req.params.id,
      tipo,
      campana: camp,
      grupo: grp || null,
      keyword: loteResuelto ? null : keyword || null,
      keywords: loteResuelto || (keywordsLote && tipo.startsWith("negativa") ? keywordsLote : null),
      match_type: mt || "PHRASE",
      match_type_destino: match_type_destino || null,
      ad_id: ad_id || null,
      nivel: p.nivel || null,
      estrategia_destino: p.estrategia_destino || null,
      valor_actual: p.valor_actual ?? null,
      valor_nuevo: p.valor_nuevo ?? null,
      etiqueta: p.etiqueta || null,
      modo: modoReal === "ejecutar" ? "ejecutar" : "simular"
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (notion) {
      try {
        await notion.pages.update({ page_id: req.params.id, properties: { Estado: { select: { name: "En curso" } } } });
        await notion.comments.create({ parent: { page_id: req.params.id }, rich_text: [{ text: { content: `[APP ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}] Aprobado para ejecuci\xF3n autom\xE1tica (${modo === "ejecutar" ? "real" : "simulaci\xF3n"}). El script ejecutor lo aplica en la pr\xF3xima hora.` } }] });
      } catch {
      }
    }
    res.json(data);
  });
  app2.get("/api/acciones-aprobadas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.from("acciones_aprobadas").select("*").order("aprobada_el", { ascending: false }).limit(50);
    res.json(data || []);
  });
  app2.post("/api/cron/ejecutor-resultado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { id, estado, resultado } = req.body || {};
    if (!id || !estado) return res.status(400).json({ error: "id y estado" });
    const { data: acc } = await supabase.from("acciones_aprobadas").update({ estado, resultado, ejecutada_el: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select().single();
    if (acc?.notion_id && notion && estado === "ejecutada") {
      try {
        await notion.pages.update({ page_id: acc.notion_id, properties: { Estado: { select: { name: NOTION_STATES.HECHO } }, "Ejecutado el": { date: { start: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) } }, "Decision final": { rich_text: [{ text: { content: `Ejecutado por el script a las ${(/* @__PURE__ */ new Date()).toISOString().slice(11, 16)} UTC. ${resultado || ""}`.slice(0, 1900) } }] } } });
      } catch {
      }
      await supabase.from("operator_log").insert({ account: acc.account, fecha: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), hora: (/* @__PURE__ */ new Date()).toISOString().slice(11, 16), que_cambio: `${acc.tipo}: ${acc.keywords?.length ? acc.keywords.length + " keywords: " + acc.keywords.join(", ").slice(0, 300) : acc.keyword || acc.ad_id}`, donde: `${acc.campana}${acc.grupo ? " \u203A " + acc.grupo : ""}`, por_que: "Aprobado en la app, ejecutado por el script", accionable_notion_id: acc.notion_id });
    }
    res.json({ ok: true });
  });
  app2.get("/api/limitada", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.from("v_por_que_limitada").select("*").eq("account", req.query.client).maybeSingle();
    res.json(data || null);
  });
  app2.get("/api/politicas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const [p, g] = await Promise.all([supabase.from("politicas_auto").select("*").order("tipo"), supabase.from("ajustes_sistema").select("valor").eq("clave", "auto_ejecucion").maybeSingle()]);
    res.json({ politicas: p.data || [], general: g.data?.valor?.activa === true });
  });
  app2.put("/api/politicas/general", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { activa } = req.body || {};
    await supabase.from("ajustes_sistema").update({ valor: { activa: !!activa, nota: "Interruptor general. Si esta en false, ninguna politica ejecuta aunque este activa." }, actualizado: (/* @__PURE__ */ new Date()).toISOString() }).eq("clave", "auto_ejecucion");
    res.json({ ok: true });
  });
  app2.put("/api/politicas/:tipo", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { activa, modo, confianza_min, gasto_max, solo_origen, cuentas } = req.body || {};
    const upd = { actualizada: (/* @__PURE__ */ new Date()).toISOString() };
    if (activa !== void 0) upd.activa = !!activa;
    if (modo) upd.modo = modo;
    if (confianza_min != null) upd.confianza_min = confianza_min;
    if (gasto_max !== void 0) upd.gasto_max = gasto_max;
    if (solo_origen) upd.solo_origen = solo_origen;
    if (cuentas) upd.cuentas = cuentas;
    const { error } = await supabase.from("politicas_auto").update(upd).eq("tipo", req.params.tipo);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app2.post("/api/invariantes", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { account, accion } = req.body || {};
    const { data, error } = await supabase.rpc("verificar_invariantes", { p_account: account, p_accion: accion });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app2.get("/api/relaciones-abiertas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.from("accionable_relaciones").select("a, b, motivo").eq("resuelta", false).eq("severidad", "bloquea");
    const m = {};
    for (const r of data || []) {
      m[r.a] = r.motivo;
      if (!String(r.b).startsWith("keyword:")) m[r.b] = r.motivo;
    }
    res.json(m);
  });
  app2.get("/api/accionables/:id/contexto", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const id = req.params.id;
    const [v, rel, esp] = await Promise.all([
      supabase.from("accionable_versiones").select("*").eq("notion_id", id).order("version", { ascending: false }).limit(10),
      supabase.from("v_accionable_relaciones").select("*").or(`a.eq.${id},b.eq.${id}`).eq("resuelta", false),
      supabase.from("accionables_espejo").select("version, accion, accion_valida, accion_error, hash").eq("notion_id", id).maybeSingle()
    ]);
    const { data: bloqueo } = await supabase.rpc("prevuelo", { p_notion_id: id });
    res.json({ versiones: v.data || [], relaciones: rel.data || [], actual: esp.data, bloqueo: bloqueo || null });
  });
  app2.post("/api/relaciones/:id/resolver", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    await supabase.from("accionable_relaciones").update({ resuelta: true, resuelta_el: (/* @__PURE__ */ new Date()).toISOString(), resuelta_por: "andres" }).eq("id", req.params.id);
    res.json({ ok: true });
  });
  app2.get("/api/respaldo/:que", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const mapa = {
      esquema: { fn: "volcar_esquema", archivo: "00000000000001_linea_base.sql" },
      semillas: { fn: "volcar_semillas", archivo: "00000000000002_datos_semilla.sql" },
      crons: { fn: "volcar_crons", archivo: "00000000000003_tareas_programadas.sql" }
    };
    const cfg = mapa[req.params.que];
    if (!cfg) return res.status(400).json({ error: "Ped\xED esquema, semillas o crons" });
    const { data, error } = await supabase.rpc(cfg.fn);
    if (error) return res.status(500).json({ error: error.message });
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${cfg.archivo}"`);
    res.send(data || "");
  });
  app2.get("/api/respaldo", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const [e, s2, c] = await Promise.all([
      supabase.rpc("volcar_esquema"),
      supabase.rpc("volcar_semillas"),
      supabase.rpc("volcar_crons")
    ]);
    const err = e.error || s2.error || c.error;
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      generado: (/* @__PURE__ */ new Date()).toISOString(),
      archivos: [
        { nombre: "00000000000001_linea_base.sql", kb: Math.round((e.data || "").length / 1024), url: "/api/respaldo/esquema" },
        { nombre: "00000000000002_datos_semilla.sql", kb: Math.round((s2.data || "").length / 1024), url: "/api/respaldo/semillas" },
        { nombre: "00000000000003_tareas_programadas.sql", kb: Math.round((c.data || "").length / 1024), url: "/api/respaldo/crons" }
      ],
      donde_van: "supabase/migrations/ en el repo northsignal-market/app.northsignal"
    });
  });
  app2.get("/api/entorno", (_req, res) => {
    res.json({ entorno: entornoActual(), es_produccion: esProduccion(), banda: banda() });
  });
  app2.post("/api/novedades/grupo/leer", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { cuenta, tipo, actor, dia } = req.body || {};
    if (!cuenta || !tipo || !actor || !dia) return res.status(400).json({ error: "Faltan cuenta, tipo, actor o dia" });
    const { data, error } = await supabase.rpc("marcar_grupo_leido", { p_cuenta: cuenta, p_tipo: tipo, p_actor: actor, p_dia: dia });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, marcadas: data });
  });
  app2.post("/api/alertas/grupo/resolver", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { cuenta, tipo, dia } = req.body || {};
    if (!cuenta || !tipo || !dia) return res.status(400).json({ error: "Faltan cuenta, tipo o dia" });
    const { data, error } = await supabase.rpc("resolver_grupo_alertas", { p_account: cuenta, p_tipo: tipo, p_dia: dia });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, resueltas: data });
  });
  app2.get("/api/flujos", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data, error } = await supabase.rpc("estado_de_los_flujos");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ flujos: data || [], cortados: (data || []).filter((f) => f.estado === "CORTADO" || f.estado === "NUNCA RECIBIO NADA") });
  });
  app2.get("/api/notas-agentes", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const [{ data: pend }, { data: resp }] = await Promise.all([
      supabase.from("v_notas_pendientes").select("*").limit(20),
      supabase.from("v_respuestas_de_agentes").select("*").limit(20)
    ]);
    res.json({ pendientes: pend || [], respuestas: resp || [] });
  });
  app2.get("/api/orden-del-dia", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data, error } = await supabase.rpc("orden_del_dia");
    if (error) return res.status(500).json({ error: error.message });
    const filas = data || [];
    const bloques = {};
    for (const f of filas) {
      (bloques[f.bloque] ||= []).push(f);
    }
    res.json({
      total: filas.length,
      un_clic: (bloques["Un clic"] || []).length,
      bloques: Object.entries(bloques).map(([nombre, items]) => ({ nombre, cuantos: items.length, items }))
    });
  });
  app2.get("/api/salud", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data, error } = await supabase.rpc("get_salud_sistema");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app2.get("/api/cuentas", async (_req, res) => res.json(await cuentasActivas()));
  app2.get("/api/cadena/:nivel", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { nivel } = req.params;
    const q = req.query;
    const account = q.account || q.client;
    if (!account) return res.status(400).json({ error: "falta account" });
    const semanas = Math.min(26, Math.max(1, parseInt(q.semanas) || 4));
    const nulo = (v) => v === void 0 || v === "" || v === "todos" ? null : String(v);
    const fns = {
      objetivos: { fn: "nav_objetivos", args: { p_account: account, p_semanas: semanas } },
      locales: { fn: "v_location_ranking_bayes", args: { p_account: account, p_semanas: semanas } },
      campanas: { fn: "nav_campanas", args: { p_account: account, p_location: nulo(q.local), p_objetivo: nulo(q.objetivo), p_semanas: semanas } },
      grupos: { fn: "nav_grupos", args: { p_account: account, p_location: nulo(q.local), p_campana: nulo(q.campana), p_semanas: semanas } },
      keywords: { fn: "nav_keywords", args: { p_account: account, p_location: nulo(q.local), p_campana: nulo(q.campana), p_grupo: nulo(q.grupo), p_semanas: semanas } },
      terminos: { fn: "nav_terminos", args: { p_account: account, p_location: nulo(q.local), p_campana: nulo(q.campana), p_grupo: nulo(q.grupo), p_semanas: semanas } },
      contadores: { fn: "nav_contadores", args: { p_account: account, p_semanas: semanas } },
      transversal: { fn: "v_keywords_entre_locales", args: { p_account: account, p_semanas: semanas } },
      corporativas: { fn: "v_corporativas", args: { p_account: account, p_semanas: semanas } }
    };
    const cfg = fns[nivel];
    if (!cfg) return res.status(400).json({ error: "nivel invalido: " + nivel });
    const { data, error } = await supabase.rpc(cfg.fn, cfg.args);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ nivel, filas: data || [], semanas });
  });
  app2.get("/api/briefing", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.rpc("get_briefing");
    res.json(data);
  });
  app2.get("/api/ciclo", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    const [cal, calg, imp, tasa, pred] = await Promise.all([
      supabase.from("v_calibracion").select("*"),
      supabase.from("v_calibracion_global").select("*").maybeSingle(),
      client ? supabase.from("v_impacto_accionables").select("*").eq("account", client).order("ejecutado_el", { ascending: false }).limit(10) : supabase.from("v_impacto_accionables").select("*").order("ejecutado_el", { ascending: false }).limit(10),
      supabase.from("v_tasa_acierto").select("*"),
      client ? supabase.from("predicciones").select("*").eq("account", client).order("semana", { ascending: false }).limit(8) : supabase.from("predicciones").select("*").order("semana", { ascending: false }).limit(12)
    ]);
    res.json({ calibracion: cal.data || [], global: calg.data, impactos: imp.data || [], tasa_acierto: tasa.data || [], predicciones: pred.data || [] });
  });
  app2.get("/api/propuestas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    let q = supabase.from("propuestas_estrategicas").select("*").order("fecha", { ascending: false }).limit(40);
    if (req.query.client) q = q.eq("account", req.query.client);
    const { data } = await q;
    res.json(data || []);
  });
  app2.post("/api/propuestas/:id/estado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { estado, nota, ejecucion_real } = req.body || {};
    if (!["propuesta", "aprobada", "en_test", "adoptada", "descartada", "pausada"].includes(estado)) return res.status(400).json({ error: "estado invalido" });
    const { data, error } = await supabase.rpc("propuesta_cambiar_estado", { p_id: Number(req.params.id), p_estado: estado, p_nota: nota || null, p_ejecucion_real: ejecucion_real || null, p_por: "andres" });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app2.put("/api/propuestas/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { ejecucion_real, resultado_real, decision_andres } = req.body || {};
    const upd = {};
    if (ejecucion_real !== void 0) upd.ejecucion_real = ejecucion_real;
    if (resultado_real !== void 0) upd.resultado_real = resultado_real;
    if (decision_andres !== void 0) upd.decision_andres = decision_andres;
    const { error } = await supabase.from("propuestas_estrategicas").update(upd).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app2.post("/api/propuestas/:id/:accion", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const estado = { aprobar: "aprobada", descartar: "descartada", test: "en_test", adoptar: "adoptada", pausar: "pausada" }[req.params.accion];
    if (!estado) return res.status(400).json({ error: "accion invalida" });
    const { data, error } = await supabase.rpc("propuesta_cambiar_estado", { p_id: Number(req.params.id), p_estado: estado, p_nota: (req.body || {}).nota || null, p_ejecucion_real: null, p_por: "andres" });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app2.get("/api/aprendido", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    const [lec, con, tipo, brecha] = await Promise.all([
      // v_lecciones_vigentes, no la tabla: excluye lo que quedo en cuarentena por
      // haberse escrito sobre datos que despues resultaron falsos.
      client ? supabase.from("v_lecciones_vigentes").select("*").or(`account.eq.${client},account.is.null`).order("confianza", { ascending: false }).limit(30) : supabase.from("v_lecciones_vigentes").select("*").order("confianza", { ascending: false }).limit(40),
      supabase.from("conocimiento_externo").select("*").order("fecha", { ascending: false }).limit(30),
      client ? supabase.from("v_acierto_por_tipo").select("*").eq("account", client) : supabase.from("v_acierto_por_tipo").select("*"),
      supabase.from("v_brecha_objetivo").select("*")
    ]);
    const { data: inv } = await supabase.from("v_accionables_invalidos").select("*").limit(30);
    res.json({ lecciones: lec.data || [], conocimiento: con.data || [], acierto_por_tipo: tipo.data || [], brecha: brecha.data || [], invalidos: inv || [] });
  });
  async function sincronizarComentarios() {
    if (!supabase || !notion) return 0;
    const { data: abiertos } = await supabase.from("accionables_espejo").select("notion_id, account, titulo").in("estado", ["Propuesto", "Bloqueado", "En curso"]).is("reemplazado_por", null);
    let nuevos = 0;
    for (const a of abiertos || []) {
      try {
        const r = await notion.comments.list({ block_id: a.notion_id, page_size: 50 });
        for (const c of r.results || []) {
          const texto = (c.rich_text || []).map((t) => t.plain_text).join("");
          const m = texto.match(/^\[([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ .·]*?)(?:\s[\d-]+.*?)?\]/);
          const prefijo = m ? m[1].trim() : null;
          const esAndres = /^\[ANDRES/i.test(texto) || !m && c.created_by?.type === "person";
          const autor = esAndres ? "andres" : m ? "agente" : "notion";
          const { data: ins } = await supabase.from("accionable_comentarios").upsert({ comment_id: c.id, notion_id: a.notion_id, account: a.account, autor, prefijo, texto: texto.slice(0, 2e3), creado: c.created_time }, { onConflict: "comment_id", ignoreDuplicates: true }).select("comment_id");
          if (ins?.length && autor !== "andres") {
            const { data: actorRow } = await supabase.rpc("actor_desde_prefijo", { p: prefijo });
            await supabase.from("novedades").upsert({ tipo: "comentario", account: a.account, ref_tipo: "accionable", ref_id: a.notion_id, titulo: `${prefijo ? prefijo.replace(/·.*$/, "").trim() : "Alguien"} coment\xF3: ${String(a.titulo).slice(0, 70)}`, texto: texto.replace(/^\[[^\]]*\]\s*/, "").slice(0, 300), autor: prefijo || "notion", actor: actorRow || "agente", verbo: "comento", objeto_titulo: a.titulo, creada: c.created_time, clave: "comentario:" + c.id }, { onConflict: "clave", ignoreDuplicates: true });
            nuevos++;
          }
        }
        await new Promise((r2) => setTimeout(r2, 350));
      } catch (e) {
        console.error("[comentarios] " + a.notion_id + ": " + e.message);
      }
    }
    return nuevos;
  }
  async function refrescarEspejo() {
    const notionKey2 = process.env.NOTION_API_KEY;
    if (!supabase || !notionKey2 || !NOTION_BASES.ACCIONABLES) return 0;
    const notion2 = new NotionClient({ auth: notionKey2 });
    const r = await notion2.databases.query({ database_id: NOTION_BASES.ACCIONABLES, page_size: 100 });
    const { parsearAccion: parsearAccion2 } = await Promise.resolve().then(() => (init_accion(), accion_exports));
    const filas = [];
    for (const page of r.results) {
      const p = page.properties || {};
      const txt = (x) => (x?.rich_text || x?.title || []).map((t) => t.plain_text).join("");
      const cuenta = await resolveNotionClient(notion2, p.Cliente);
      const accionJson = txt(p["Accion JSON"]);
      const parsed = parsearAccion2(accionJson);
      filas.push({
        notion_id: page.id,
        account: cuenta,
        titulo: txt(p.Accion || p.Accionable || p.Name || p.Title),
        estado: p.Estado?.select?.name || null,
        prioridad: p.Prioridad?.select?.name || null,
        naturaleza: p.Naturaleza?.select?.name || null,
        origen: p.Origen?.select?.name || null,
        entidad: txt(p.Entidad) || null,
        causa_raiz: txt(p["Causa raiz"]) || null,
        como_hacerlo: txt(p["Como hacerlo"]) || null,
        donde: txt(p.Donde) || null,
        por_que: txt(p["Por que"] || p["Por qu\xE9"]).slice(0, 2e3),
        detectado: p.Detectado?.date?.start || null,
        ejecutado_el: p["Ejecutado el"]?.date?.start || null,
        vence: p.Vence?.date?.start || null,
        semanas_pendiente: p["Semanas pendiente"]?.number ?? null,
        revision_ia: txt(p["Revision IA"]) || null,
        ultima_edicion: page.last_edited_time,
        sincronizado: (/* @__PURE__ */ new Date()).toISOString(),
        url: page.url,
        accion: parsed.accion || null,
        accion_valida: !!parsed.accion,
        accion_error: parsed.error || null
      });
    }
    if (!filas.length) return 0;
    const { error } = await supabase.from("accionables_espejo").upsert(filas, { onConflict: "notion_id" });
    if (error) throw new Error(error.message);
    return filas.length;
  }
  app2.all("/api/cron/novedades", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const comentarios = await sincronizarComentarios();
      const { data: otras } = await supabase.rpc("novedades_generar");
      let espejo = 0;
      try {
        espejo = await refrescarEspejo();
      } catch (e) {
        console.error("[espejo] " + e.message);
      }
      res.json({ ok: true, comentarios_nuevos: comentarios, otras, espejo_filas: espejo });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/novedades", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.from(req.query.todas ? "v_novedades_7d" : "v_novedades_agrupadas").select("*").limit(req.query.todas ? 150 : 60);
    res.json(data || []);
  });
  app2.post("/api/novedades/leer", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { ref_tipo, ref_id, todas } = req.body || {};
    let q = supabase.from("novedades").update({ leida_el: (/* @__PURE__ */ new Date()).toISOString() }).is("leida_el", null);
    if (!todas) {
      if (!ref_tipo || !ref_id) return res.status(400).json({ error: "ref_tipo y ref_id, o todas" });
      q = q.eq("ref_tipo", ref_tipo).eq("ref_id", String(ref_id));
    }
    const { error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app2.get("/api/accionables/:id/comentarios", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data } = await supabase.from("accionable_comentarios").select("*").eq("notion_id", req.params.id).order("creado", { ascending: false });
    res.json(data || []);
  });
  app2.get("/api/doc-maestro/:account", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { account } = req.params;
    const [doc, secciones] = await Promise.all([
      supabase.rpc("get_doc_maestro", { p_account: account }),
      supabase.from("doc_maestro_humano").select("seccion, orden, contenido, version, editado_el, editado_por").eq("account", account).eq("vigente", true).order("orden")
    ]);
    if (doc.error) return res.status(500).json({ error: doc.error.message });
    res.setHeader("Cache-Control", "no-store");
    res.json({ markdown: doc.data, secciones: secciones.data || [] });
  });
  app2.put("/api/doc-maestro/:account/:seccion", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { account, seccion } = req.params;
    const { contenido } = req.body;
    if (!contenido || typeof contenido !== "string") return res.status(400).json({ error: "contenido requerido" });
    const { data, error } = await supabase.rpc("doc_maestro_editar", { p_account: account, p_seccion: seccion, p_contenido: contenido, p_editado_por: "andres" });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ version: data });
  });
  app2.get("/api/doc-maestro/:account/:seccion/versiones", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { account, seccion } = req.params;
    const { data, error } = await supabase.from("doc_maestro_humano").select("version, editado_el, editado_por, vigente, contenido").eq("account", account).eq("seccion", seccion).order("version", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app2.all("/api/cron/pulso-diario", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    if (!pulsoDisponible()) return res.status(503).json({ error: "ANTHROPIC_API_KEY no configurada" });
    const ayer = /* @__PURE__ */ new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fecha2 = req.query.fecha || ayer.toISOString().slice(0, 10);
    const cuentas = req.query.client ? [req.query.client] : (await cuentasActivas()).map((c) => c.account);
    const forzar = req.query.forzar === "1";
    const { data: existentes } = await supabase.from("pulso_diario").select("account").eq("fecha", fecha2).in("account", cuentas);
    const yaHechas = new Set((existentes || []).map((e) => e.account));
    const pendientes = forzar ? cuentas : cuentas.filter((c) => !yaHechas.has(c));
    if (!pendientes.length) return res.json({ ok: true, fecha: fecha2, resultados: [], nota: "ya exist\xEDa pulso para todas las cuentas" });
    const resultados = await Promise.allSettled(pendientes.map(async (cuenta) => {
      const { data: input, error } = await supabase.rpc("get_pulso_input", { p_account: cuenta, p_fecha: fecha2 });
      if (error) throw new Error(`get_pulso_input: ${error.message}`);
      const { data: estado } = await supabase.rpc("get_estado_cuenta", { p_account: cuenta });
      if (estado) {
        input.estado_cuenta = estado;
        input.foto_tomada = estado.foto_tomada;
      }
      const { data: cta } = await supabase.from("cuentas").select("reglas_dominio").eq("account", cuenta).maybeSingle();
      const reglas = cta?.reglas_dominio || getClientContext(cuenta) || "";
      let parecidos = [];
      try {
        const resumenHoy = [input?.anomalias_2d?.map((a) => a.explicacion).join(". "), input?.grupos_ayer?.slice(0, 4).map((g) => `${g.grupo} ${g.conv} conv ${g.clics} clics`).join("; "), input?.terminos_nuevos_con_gasto?.slice(0, 3).map((t) => t.t).join(", ")].filter(Boolean).join(" | ");
        if (resumenHoy.length > 40) parecidos = await parecidoA(supabase, resumenHoy, cuenta, 5, fecha2);
      } catch {
      }
      const r = await correrPulso(cuenta, fecha2, input, reglas, parecidos);
      if (r.error || !r.parsed) throw new Error(r.error || "sin salida");
      const p = r.parsed;
      const planId = input?.plan?.id || null;
      await supabase.from("pulso_diario").upsert({
        account: cuenta,
        fecha: fecha2,
        nivel: p.nivel,
        resumen: p.resumen,
        hallazgo_principal: p.hallazgo_principal,
        conecta_con: p.conecta_con,
        plan_id: planId,
        evidencia: p.evidencia,
        hallazgos: p.hallazgos,
        hipotesis_movidas: p.hipotesis_movidas,
        tokens_in: r.tokens_in,
        tokens_out: r.tokens_out,
        costo_usd: r.costo_usd,
        modelo: "claude-sonnet-5",
        foto_leida: input?.foto_tomada || null
      }, { onConflict: "account,fecha" });
      const { data: filtrados } = await supabase.rpc("filtrar_hallazgos_a_accionables", { p_account: cuenta, p_fecha: fecha2 });
      let creados = 0;
      for (const h of filtrados || []) {
        if (!notion || !NOTION_BASES.ACCIONABLES) break;
        const { tituloDesde: tituloDesde3 } = await Promise.resolve().then(() => (init_accion(), accion_exports));
        const pl = h.accion;
        const accionCanonica = pl ? {
          verbo: pl.verbo,
          objeto: { campana: pl.campana || null, grupo: pl.grupo || null, keyword: pl.keyword || null, match_type: pl.match_type || null },
          parametros: { match_type_destino: pl.match_type_destino || null, nivel: pl.nivel || null, pregunta: pl.pregunta || null, donde: pl.donde || null, que_hacer: pl.que_hacer || null, no_ejecutar_antes_de: pl.no_ejecutar_antes_de || null },
          verificar: pl.verificar_metrica ? { metrica: pl.verificar_metrica, fecha: pl.verificar_fecha || "", esperado: pl.verificar_esperado || "" } : null
        } : null;
        const tituloBase = accionCanonica ? tituloDesde3(accionCanonica) : h.titulo;
        const title = `${tituloBase} \xB7 ${cuenta}`.slice(0, 200);
        const entidadClave = String(h.donde || h.entidad || "").slice(0, 200);
        const { data: existenteId } = await supabase.rpc("accionable_existente", { p_account: cuenta, p_entidad: entidadClave, p_causa: h.causa_raiz || null });
        if (existenteId) {
          try {
            await notion.comments.create({ parent: { page_id: existenteId }, rich_text: [{ text: { content: `[PULSO ${fecha2}] Sigue vigente. ${String(h.evidencia_texto || "").slice(0, 600)}` } }] });
          } catch {
          }
          continue;
        }
        const ex = await notion.databases.query({ database_id: actionablesDbSafe(), filter: { property: "Accion", title: { equals: title } } });
        const activo = ex.results.find((pg) => {
          const st = pg?.properties?.Estado?.select?.name;
          return st !== NOTION_STATES.HECHO && st !== NOTION_STATES.DESCARTADO;
        });
        if (activo) continue;
        const clienteId = await findNotionClientId(notion, cuenta);
        const nat = h.naturaleza === "observacion" ? "Observacion" : h.naturaleza === "inferencia" ? "Inferencia" : "Hipotesis";
        const vence = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        const props = {
          Accion: { title: [{ text: { content: title } }] },
          // Un solo escritor: el pulso PROPONE. Nace Bloqueado; el semanal lo confirma el lunes. Vence en 7 dias si nadie lo toca.
          Estado: { select: { name: NOTION_STATES.BLOQUEADO } },
          Origen: { select: { name: "Pulso diario" } },
          Entidad: { rich_text: [{ text: { content: entidadClave } }] },
          Vence: { date: { start: vence } },
          Prioridad: { select: { name: h.severidad === "critica" ? "Urgente" : h.severidad === "alta" ? "Alta" : "Media" } },
          Naturaleza: { select: { name: nat } },
          "Por que": { rich_text: [{ text: { content: String(h.evidencia_texto || "").slice(0, 1900) } }] },
          "Como hacerlo": { rich_text: [{ text: { content: String(h.como_hacerlo || "").slice(0, 1900) } }] },
          "Accion JSON": { rich_text: [{ text: { content: accionCanonica ? "`" + JSON.stringify(accionCanonica).slice(0, 1880) + "`" : "" } }] },
          "Causa raiz": { rich_text: [{ text: { content: String(h.causa_raiz || p.conecta_con || "").slice(0, 500) } }] },
          Donde: { rich_text: [{ text: { content: String(h.donde || h.entidad || "").slice(0, 300) } }] },
          Detectado: { date: { start: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) } },
          "Semanas pendiente": { number: 0 }
        };
        props["Que lo confirmaria"] = { rich_text: [{ text: { content: `Propuesto por el an\xE1lisis diario con confianza ${h.confianza}. La tarea del lunes lo confirma con 7 d\xEDas de evidencia, o lo descarta. Vence el ${vence} si nadie lo toca.` } }] };
        if (clienteId) props.Cliente = { relation: [{ id: clienteId }] };
        const creada = await notion.pages.create({ parent: { database_id: actionablesDbSafe() }, properties: props });
        creados++;
        try {
          await aplicarPoliticaAuto(cuenta, creada.id, title, entidadClave, "Pulso diario", Number(h.confianza), h.como_hacerlo);
        } catch (e) {
          console.error("[politica] " + e.message);
        }
      }
      return { cuenta, nivel: p.nivel, hallazgo: p.hallazgo_principal, hallazgos_detectados: p.hallazgos.length, accionables_creados: creados, tokens_in: r.tokens_in, tokens_out: r.tokens_out, costo_usd: Number(r.costo_usd.toFixed(5)) };
    }));
    const out = resultados.map((r, i) => r.status === "fulfilled" ? r.value : { cuenta: pendientes[i], error: r.reason.message });
    out.filter((r) => r.error).forEach((r) => console.error(`[pulso] ${r.cuenta}: ${r.error}`));
    try {
      await supabase.rpc("memoria_ingestar");
      const n = await embeberPendientes(supabase);
      if (n) console.log(`[memoria] ${n} embebidos`);
    } catch (e) {
      console.error("[memoria] " + e.message);
    }
    res.json({ ok: true, fecha: fecha2, modelo: "claude-sonnet-5", resultados: out, costo_total_usd: Number(out.reduce((a, r) => a + (r.costo_usd || 0), 0).toFixed(5)) });
  });
  app2.get("/api/plan", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    if (!client) return res.status(400).json({ error: "client requerido" });
    const { data: plan } = await supabase.from("plan_semanal").select("*").eq("account", client).order("semana", { ascending: false }).limit(1).maybeSingle();
    if (!plan) return res.json({ plan: null, pulsos: [] });
    const { data: pulsos } = await supabase.from("pulso_diario").select("fecha, nivel, resumen, hallazgo_principal, conecta_con, evidencia, hipotesis_movidas, hallazgos, costo_usd").eq("account", client).gte("fecha", plan.semana).order("fecha");
    const ind = plan.indicadores.map((i, idx) => ({
      ...i,
      serie: (pulsos || []).map((p) => {
        const e = (p.evidencia || [])[idx];
        return { fecha: p.fecha, valor: e?.valor ?? null, cumple: e?.cumple ?? null, dias: e?.dias_seguidos_cumpliendo ?? 0 };
      })
    }));
    res.json({ plan: { ...plan, indicadores: ind }, pulsos: pulsos || [] });
  });
  app2.get("/api/pulso", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    const days = Number(req.query.days) || 7;
    let q = supabase.from("pulso_diario").select("*").order("fecha", { ascending: false }).limit(days * 3);
    if (client) q = q.eq("account", client);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const costoMes = (data || []).filter((p) => new Date(p.fecha) >= new Date(Date.now() - 30 * 864e5)).reduce((a, p) => a + Number(p.costo_usd || 0), 0);
    res.json({ pulsos: data || [], costo_ultimos_30d_usd: Number(costoMes.toFixed(4)) });
  });
  app2.all("/api/cron/mantenimiento", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const { data, error } = await supabase.rpc("mantenimiento_semanal");
      if (error) return res.status(500).json({ error: error.message });
      const { data: salud } = await supabase.from("v_salud_sistema").select("tabla, filas, estado").neq("estado", "OK");
      res.json({ ok: true, ran_at: (/* @__PURE__ */ new Date()).toISOString(), borrado: data, alertas: salud || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/salud-sistema", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data, error } = await supabase.from("v_salud_sistema").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app2.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.originalUrl || req.path}` });
  });
  app2.use("/api", (err, req, res, _next) => {
    const detalle = err?.message || String(err);
    console.error(`[error no capturado] ${req?.method} ${req?.originalUrl} \u2014 ${detalle}`);
    if (res.headersSent) return;
    res.status(500).json({
      error: "Algo fall\xF3 en el servidor procesando este pedido.",
      detalle,
      ruta: req?.originalUrl,
      que_hacer: "Si se repite, mir\xE1 Sistema > Salud o revis\xE1 los registros de Vercel."
    });
  });
  return app2;
}
function actionablesDbSafe() {
  return NOTION_BASES.ACCIONABLES;
}
async function findNotionClientId(notionClient, account) {
  if (!NOTION_BASES.CLIENTES) return null;
  try {
    const r = await notionClient.databases.query({ database_id: NOTION_BASES.CLIENTES });
    for (const p of r.results) {
      const nombre = p.properties?.Cliente?.title?.map((t) => t.plain_text).join("") || p.properties?.Name?.title?.map((t) => t.plain_text).join("") || "";
      const ct = (await cuentasActivas()).find((c) => c.account === account);
      const nm = String(nombre).toLowerCase(), base = (ct?.nombre_cliente || account).toLowerCase();
      if (nm === base || nm.includes(base.split(" ")[0]) || nm.includes(account.toLowerCase().replace("_", " "))) return p.id;
    }
  } catch {
  }
  return null;
}
async function runAnomalyWorker() {
  const actionablesDbId = NOTION_BASES.ACCIONABLES;
  if (!supabase || !notion || !actionablesDbId) return { creados: 0, motivo: "sin supabase o notion" };
  const desde = /* @__PURE__ */ new Date();
  desde.setDate(desde.getDate() - 5);
  const { data: anomalias, error } = await supabase.from("v_anomalia_explicada").select("*").in("severidad", ["critica", "alta"]).gte("date", desde.toISOString().slice(0, 10)).order("date", { ascending: false });
  if (error) {
    console.error("[anomalias] " + error.message);
    return { creados: 0, error: error.message };
  }
  let creados = 0, comentados = 0;
  for (const a of anomalias || []) {
    const cuenta = a.account;
    const fecha2 = a.date;
    const metrica = a.metrica_anomala || (a.gasto_direccion ? "gasto" : "cpa");
    const title = `[Anomal\xEDa] ${cuenta} \xB7 ${metrica} ${a.gasto_direccion || a.cpa_direccion || ""} el ${fecha2}`;
    try {
      const existing = await notion.databases.query({
        database_id: actionablesDbId,
        filter: { property: "Accion", title: { equals: title } }
      });
      const activo = existing.results.find((p) => {
        const st = p?.properties?.Estado?.select?.name;
        return st !== NOTION_STATES.HECHO && st !== NOTION_STATES.DESCARTADO;
      });
      if (activo) continue;
      const explicado = /Cambio (propio|automático)|registró/.test(a.explicacion || "");
      const naturaleza = explicado ? "Observacion" : "Hipotesis";
      const clienteId = await findNotionClientId(notion, cuenta);
      const why = `Desv\xEDo estad\xEDstico el ${fecha2}: severidad ${a.severidad}. ` + (a.gasto_z != null ? `Gasto z=${Number(a.gasto_z).toFixed(1)} (${a.gasto} vs baseline ${a.gasto_baseline}). ` : "") + (a.cpa_z != null ? `CPA z=${Number(a.cpa_z).toFixed(1)} (${a.cpa} vs baseline ${a.cpa_baseline}). ` : "") + (a.campana_principal ? `Campa\xF1a principal: ${a.campana_principal}. ` : "") + `Explicaci\xF3n de la vista: ${a.explicacion}`;
      const entidadClaveA = a.campana_principal ? String(a.campana_principal) : `${cuenta}|anomalia`;
      const { data: existenteA } = await supabase.rpc("accionable_existente", { p_account: cuenta, p_entidad: entidadClaveA, p_causa: null });
      if (existenteA) {
        try {
          await notion.comments.create({ parent: { page_id: existenteA }, rich_text: [{ text: { content: `[ANOMALIAS ${fecha2}] Otro desv\xEDo en la misma entidad. ${why}`.slice(0, 600) } }] });
        } catch {
        }
        continue;
      }
      const props = {
        Accion: { title: [{ text: { content: title } }] },
        Estado: { select: { name: NOTION_STATES.BLOQUEADO } },
        Origen: { select: { name: "Anomalias" } },
        Entidad: { rich_text: [{ text: { content: entidadClaveA } }] },
        Vence: { date: { start: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) } },
        Prioridad: { select: { name: a.severidad === "critica" ? "Urgente" : "Alta" } },
        Naturaleza: { select: { name: naturaleza } },
        "Por que": { rich_text: [{ text: { content: why.slice(0, 1900) } }] },
        "Causa raiz": { rich_text: [{ text: { content: explicado ? "Un cambio del mismo d\xEDa explica el desv\xEDo" : "Desv\xEDo sin cambio registrado ese d\xEDa" } }] },
        Donde: { rich_text: [{ text: { content: a.campana_principal ? `Campa\xF1a ${a.campana_principal}` : `Cuenta ${cuenta}, el ${fecha2}` } }] },
        Detectado: { date: { start: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) } },
        "Semanas pendiente": { number: 0 }
      };
      if (!explicado) props["Que lo confirmaria"] = { rich_text: [{ text: { content: "Una fila en operator_log de Andr\xE9s para ese d\xEDa, o un diff en v_cambios_detectados, o confirmaci\xF3n de que fue el mercado (mismo d\xEDa de la semana previa similar)." } }] };
      if (clienteId) props.Cliente = { relation: [{ id: clienteId }] };
      await notion.pages.create({ parent: { database_id: actionablesDbId }, properties: props });
      creados++;
    } catch (e) {
      console.error(`[anomalias] ${title}: ${e.message}`);
    }
  }
  try {
    const { data: dh } = await supabase.from("v_data_health").select("account, estado, mensaje");
    for (const d of dh || []) if (d.estado && d.estado !== "OK") await supabase.rpc("alerta_registrar", { p_account: d.account, p_nivel: "hoy", p_tipo: "datos_rotos", p_titulo: `Datos de ${d.account} con problema`, p_detalle: d.mensaje, p_accion: "Revisar Sistema > Datos por cuenta. Si la extraccion fallo, correr el script en Google Ads a mano.", p_origen: "watchdog" });
    const { data: integ } = await supabase.from("v_integridad_conversiones").select("account, date, diferencia").limit(3);
    for (const i of integ || []) await supabase.rpc("alerta_registrar", { p_account: i.account, p_nivel: "semana", p_tipo: "datos_rotos", p_titulo: `Conversiones descuadradas el ${i.date}`, p_detalle: `Diferencia de ${i.diferencia} entre acciones y campa\xF1a.`, p_accion: "Revisar si el script diario corrio dos veces con claves distintas.", p_origen: "integridad", p_entidad: null, p_fecha_dato: i.date });
    const { data: autos } = await supabase.from("google_live_events").select("account, entity_name, client_type, event_date").eq("event_type", "AUTO_CHANGE").gte("event_date", new Date(Date.now() - 864e5).toISOString());
    for (const a of autos || []) await supabase.rpc("alerta_registrar", { p_account: a.account, p_nivel: "hoy", p_tipo: "cambio_automatico", p_titulo: `Google aplico un cambio solo en ${a.account}`, p_detalle: `${a.entity_name} (${a.client_type})`, p_accion: "Entrar a Google Ads > Historial de cambios, revisar y revertir si no lo pediste. Despues desactivar Recomendaciones > Aplicar automaticamente.", p_origen: "centinela", p_entidad: a.entity_name, p_fecha_dato: String(a.event_date).slice(0, 10) });
    const { data: pulsos } = await supabase.from("pulso_diario").select("account, fecha, evidencia").gte("fecha", new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10));
    for (const p of pulsos || []) for (const e of p.evidencia || []) if (e.cumple && Number(e.dias_seguidos_cumpliendo) >= 3)
      await supabase.rpc("alerta_registrar", { p_account: p.account, p_nivel: "semana", p_tipo: "plan_condicion", p_titulo: `${p.account}: ${e.nombre}${e.grupo ? " en " + e.grupo : ""} lleva ${e.dias_seguidos_cumpliendo} dias cumpliendo`, p_detalle: e.nota || null, p_accion: "Mirar el plan en Hoy: esta condicion habilita una decision el lunes.", p_origen: "pulso", p_entidad: e.grupo || e.nombre, p_fecha_dato: p.fecha });
  } catch (e) {
    console.error("[alertas] " + e.message);
  }
  console.log(`[anomalias] ${(anomalias || []).length} detectadas, ${creados} accionables nuevos`);
  return { detectadas: (anomalias || []).length, creados, comentados };
}
async function startLocal() {
  const app2 = createApp();
  const PORT = Number(process.env.PORT) || 3e3;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app2.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app2.use(express.static(distPath));
    app2.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app2.listen(PORT, "0.0.0.0", () => console.log(`NorthSignal OS en puerto ${PORT}`));
}
if (!process.env.VERCEL) {
  startLocal();
}

// api/_entry.ts
var app = createApp();
var entry_default = app;
export {
  entry_default as default
};
