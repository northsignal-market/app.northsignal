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
  detectarTipoAuto: () => detectarTipoAuto,
  extraerKeyword: () => extraerKeyword
});
function detectarTipoAuto(titulo, comoHacerlo) {
  const t = `${titulo} ${comoHacerlo || ""}`.toLowerCase();
  if (/negativ/.test(t)) return /nivel (de )?campa|a la campa|lista/.test(t) ? "negativa_campana" : "negativa_grupo";
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
  const k = titulo.match(/(?:keyword|término|termino|palabra clave|negativa)\s+(?:de\s+)?([a-z0-9äöüß][^,;:()]{2,60}?)(?:\s+(?:en|del|de la|a nivel|como)\b|$)/i);
  if (k) return k[1].trim();
  const partes = String(entidad || "").split("|").map((x) => x.trim());
  return partes[2] || "";
}
var init_tipoAuto = __esm({
  "src/lib/tipoAuto.ts"() {
  }
});

// server.ts
import "dotenv/config";

// src/server/routes/webhooks.ts
import { Router } from "express";
import * as crypto from "crypto";

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
    const hash = crypto.createHmac("sha256", asanaSecret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const hashBuf = Buffer.from(hash, "utf8");
    if (sigBuf.length !== hashBuf.length || !crypto.timingSafeEqual(sigBuf, hashBuf)) {
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
    if (req.headers["authorization"] !== `Bearer ${ghlSecret}`) {
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
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z as z2 } from "zod";
var anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
var PRECIO_IN = 2 / 1e6;
var PRECIO_OUT = 10 / 1e6;
var PulsoSchema = z2.object({
  nivel: z2.enum(["normal", "atencion", "critico"]),
  resumen: z2.string().describe("3 a 5 l\xEDneas en espa\xF1ol. La primera dice qu\xE9 pas\xF3."),
  hallazgo_principal: z2.string().nullable(),
  conecta_con: z2.string().nullable().describe("Patr\xF3n anterior al que se parece, o null"),
  evidencia: z2.array(z2.object({
    nombre: z2.string(),
    grupo: z2.string().nullable(),
    valor: z2.number().nullable(),
    umbral: z2.number(),
    direccion: z2.enum(["sube", "baja", "cruza"]),
    cumple: z2.boolean(),
    tendencia_3d: z2.enum(["sube", "baja", "plana", "sin_datos"]),
    dias_seguidos_cumpliendo: z2.number().int().min(0),
    nota: z2.string().nullable().describe("Una l\xEDnea si hay algo que decir sobre este indicador hoy")
  })).describe("Un objeto por cada indicador del plan, en el mismo orden"),
  hipotesis_movidas: z2.array(z2.object({
    id: z2.string(),
    movimiento: z2.enum(["confirma", "descarta", "sin_cambio"]),
    evidencia_texto: z2.string()
  })),
  hallazgos: z2.array(z2.object({
    titulo: z2.string().describe('Como acci\xF3n: "Pausar X", "Revisar Y", no como problema'),
    severidad: z2.enum(["baja", "media", "alta", "critica"]),
    confianza: z2.number().min(0).max(1),
    entidad: z2.string().describe("Campa\xF1a, grupo, keyword o t\xE9rmino con nombre exacto"),
    evidencia_texto: z2.string().describe("Los n\xFAmeros que lo sostienen, con fechas"),
    naturaleza: z2.enum(["observacion", "inferencia", "hipotesis"]),
    como_hacerlo: z2.string().describe("Pasos numerados en la interfaz de Google Ads 2026 para ejecutarlo: Campa\xF1as > la campa\xF1a > el grupo > Palabras clave; pesta\xF1a Palabras clave negativas; Objetivos > Conversiones; Configuraci\xF3n > Puja. Uno por l\xEDnea. Escrito para una persona con Google Ads abierto, no para el sistema."),
    donde: z2.string().describe('El lugar en la cuenta, en palabras: "Grupo 7. Vergleich, keyword X". Nunca nombres de vistas.'),
    causa_raiz: z2.string().describe('El problema de fondo en una frase que otro hallazgo podr\xEDa compartir. Nunca "detectado por el pulso".')
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
- Bandeja: la pantalla de inicio. Una cola con lo que espera el criterio de Andr\xE9s, en orden: pide acci\xF3n hoy, listos para ejecutar, esperan confirmaci\xF3n, reportes para aprobar. Cada fila se abre ah\xED. Cuando est\xE1 vac\xEDa dice "Nada te espera". Debajo, colapsados: ayer en cada cuenta (una l\xEDnea por cuenta) y qu\xE9 pas\xF3 despu\xE9s (impacto de cambios a 14 d\xEDas, predicciones acertadas o falladas).
- Cuenta: todo lo de una cuenta, con el selector arriba (Karedo, BHI, 360) y seis pesta\xF1as. Semana: gr\xE1fico de 14 d\xEDas con lentes gasto/CPA, conversiones/clics, CTR/CPC; rango 7, 14 o fechas a elecci\xF3n; el plan de la semana con sus indicadores y cu\xE1ntos d\xEDas llevan cumpli\xE9ndose; qu\xE9 encontr\xF3 el an\xE1lisis diario d\xEDa por d\xEDa; colapsados: conversiones por grupo, cu\xE1ndo convierte (hora y d\xEDa), b\xFAsquedas nuevas, cambios en la cuenta. Diagn\xF3stico: ficha, objetivos y headroom, por qu\xE9 est\xE1 donde est\xE1 (los tres componentes del Quality Score ponderados por gasto), escalera de valor, accionables abiertos, decisiones estructurales. Brief: el an\xE1lisis completo del lunes con handoff. Accionables: todos, con filtros, incluidos hechos y descartados. Memoria: hip\xF3tesis abiertas, aprendizajes, doc maestro editable. Reportes: borradores al cliente para aprobar, editar, ver PDF.
- Datos: tablas por campa\xF1a, grupo, keyword, t\xE9rmino de b\xFAsqueda y conversiones, agrupadas en Por semana, Por d\xEDa y Diagn\xF3stico; cualquier rango de fechas; exportar PDF.
- Herramientas: RSA Factory (escribir anuncios desde los t\xE9rminos que convierten) y Gu\xEDa de operaci\xF3n (c\xF3mo funciona el ciclo, qu\xE9 hacer cada lunes, ejecutar un accionable, aprobar un reporte, cuando algo no cuadra).
- Sistema, cuatro grupos: Salud (datos por cuenta, integridad, tama\xF1o); Aprendizaje (calidad de cada an\xE1lisis, qu\xE9 pas\xF3 despu\xE9s de cada accionable, reflexiones, qui\xE9n escribe qu\xE9 y lo que el reconciliador corrigi\xF3); Automatizaci\xF3n (alertas, ejecuciones aprobadas, cambios de configuraci\xF3n); Soporte (tickets para Claude, bit\xE1cora de lo que Andr\xE9s cambi\xF3 a mano, ajustes).
- Cmd+K abre la paleta para saltar a cualquier lado. El bot\xF3n flotante abajo a la derecha: Preguntar (este asistente) y Reportar (ticket).
- Al abrir un accionable: Por qu\xE9, C\xF3mo hacerlo (pasos en Google Ads), D\xF3nde, y si es negativa o pausa, "Aprobar y que se haga" para que un script lo ejecute en la pr\xF3xima hora.

C\xD3MO FUNCIONA EL SISTEMA: scripts en Google Ads extraen a Supabase (diario 6:00, semanal lunes 7:00). Centinela cada 4 horas dentro de Google Ads: el \xFAnico que ve el d\xEDa en curso. Cada ma\xF1ana 6:45 Sonnet 5 lee el d\xEDa anterior contra el plan de la semana y escribe el pulso, buscando en la memoria sem\xE1ntica episodios parecidos. Cada lunes Opus 5 en Cowork analiza la semana, escribe el brief, accionables con pasos, reporte al cliente, el plan siguiente y dos predicciones con rango y probabilidad. Un reconciliador en SQL cada ma\xF1ana vence lo que nadie toc\xF3, deduplica por entidad y cierra alertas que cesaron. Andr\xE9s ejecuta los accionables (o aprueba que el script ejecute negativas y pausas) y aprueba los reportes. Nada cambia en Google Ads sin que \xE9l lo decida.

REGLAS DE ESTADO DE ACCIONABLES: Propuesto = listo para ejecutar. Bloqueado = es una deducci\xF3n o lo propuso un proceso autom\xE1tico; espera confirmaci\xF3n. En curso = aprobado para ejecuci\xF3n autom\xE1tica. Hecho = ejecutado, con fecha. Descartado = decidi\xF3 no hacerlo. Origen: Semanal, Pulso diario, Anomalias, Andres, Reconciliador. Naturaleza: Observaci\xF3n, Inferencia, Hip\xF3tesis.
`;
var TOOLS = [
  { name: "estado_cuenta", description: 'Resumen actual de una cuenta: veredicto de headroom, CPA de 7 y 14 d\xEDas, conversiones, plan de la semana vigente, \xFAltimo pulso diario. Usar cuando pregunten "c\xF3mo va X" o "qu\xE9 dice el plan de X".', input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ["KAREDO", "BHI", "360"] } }, required: ["cuenta"] } },
  { name: "accionables_abiertos", description: "Lista los accionables Propuestos y Bloqueados de una cuenta con t\xEDtulo, prioridad, naturaleza y por qu\xE9. Usar cuando pregunten qu\xE9 hay pendiente o qu\xE9 hacer.", input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ["KAREDO", "BHI", "360"] } }, required: ["cuenta"] } },
  { name: "salud_datos", description: "Estado de los datos: \xFAltima extracci\xF3n, semana disponible, integridad, crons. Usar cuando pregunten si los datos est\xE1n al d\xEDa o por qu\xE9 falta algo.", input_schema: { type: "object", properties: {} } },
  { name: "doc_maestro", description: "Devuelve una secci\xF3n del doc maestro de una cuenta: identidad, objetivos, restricciones, descartado, reporte, riesgos, vacios. Usar para preguntas sobre el cliente, sus reglas o su historia.", input_schema: { type: "object", properties: { cuenta: { type: "string", enum: ["KAREDO", "BHI", "360"] }, seccion: { type: "string", enum: ["identidad", "objetivos", "restricciones", "descartado", "reporte", "riesgos", "vacios"] } }, required: ["cuenta", "seccion"] } }
];
async function responderAsistente(supabase2, mensajes, contexto) {
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
  while (vueltas++ < 4) {
    const res = await anthropic2.messages.create({ model: "claude-sonnet-5", max_tokens: 1500, system: "Sos el asistente de NorthSignal, la app de operaci\xF3n de cuentas de Google Ads de Andr\xE9s. Ayud\xE1s a navegar la app y a entender los datos. No ejecut\xE1s cambios.", messages: msgs, tools: TOOLS, output_config: { effort: "low" } });
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
          out = { nota: "Los accionables viven en Notion; la app los muestra en Accionables. Filtr\xE1 por cuenta ah\xED.", cuenta: inp.cuenta };
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
    if (headerToken === process.env.APP_ACCESS_TOKEN) return next();
    if (verifySessionToken(headerToken)) return next();
    if (req.path.startsWith("/cron/") && process.env.CRON_SECRET && headerToken === process.env.CRON_SECRET) return next();
  }
  if (verifySessionToken(req.cookies?.auth_token)) return next();
  return res.status(401).json({ error: "Unauthorized" });
};

// src/server/auth/routes.ts
import { Router as Router2 } from "express";
var authRouter = Router2();
var loginAttempts = /* @__PURE__ */ new Map();
authRouter.post("/login", (req, res) => {
  const { password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1e3 };
  if (now > attempt.resetAt) {
    attempt.count = 0;
    attempt.resetAt = now + 15 * 60 * 1e3;
  }
  if (attempt.count >= 5) {
    return res.status(429).json({ error: "Demasiados intentos fallidos. Intente de nuevo en 15 minutos." });
  }
  if (!process.env.APP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "APP_ACCESS_TOKEN no est\xE1 configurado en el servidor" });
  }
  if (password === process.env.APP_ACCESS_TOKEN) {
    const sessionToken = createSessionToken();
    loginAttempts.delete(ip);
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
  attempt.count++;
  loginAttempts.set(ip, attempt);
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
    if (process.env.APP_ACCESS_TOKEN && headerToken === process.env.APP_ACCESS_TOKEN) return res.json({ authenticated: true });
    if (verifySessionToken(headerToken)) return res.json({ authenticated: true });
  }
  if (verifySessionToken(req.cookies?.auth_token)) return res.json({ authenticated: true });
  return res.status(401).json({ error: "Unauthorized" });
});

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
import { z as z3 } from "zod";
import cookieParser from "cookie-parser";
import { Client as NotionClient } from "@notionhq/client";
var cargarPdf = () => Promise.resolve().then(() => (init_reporte_pdf(), reporte_pdf_exports));
var notionClientCache = {};
async function resolveNotionClient(notion2, relationProp) {
  if (!relationProp?.relation || relationProp.relation.length === 0) return "Unknown";
  const pageId = relationProp.relation[0].id;
  if (notionClientCache[pageId]) return notionClientCache[pageId];
  try {
    const page = await notion2.pages.retrieve({ page_id: pageId });
    const name = page.properties.Cliente?.title?.[0]?.plain_text || page.properties.Name?.title?.[0]?.plain_text || "Unknown";
    const normalized = name.split(" ")[0].toUpperCase();
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
  app2.use("/api", authRouter);
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
      const clients = response.results.map((p) => {
        const name = p.properties.Cliente?.title?.map((t) => t.plain_text).join("") || "Sin nombre";
        const aprendizajes = p.properties["Aprendizajes consolidados"]?.rich_text?.map((t) => t.plain_text).join("") || "";
        const hipotesis = p.properties["Hipotesis abiertas"]?.rich_text?.map((t) => t.plain_text).join("") || "";
        const semanas = p.properties["Semanas analizadas"]?.number ?? 0;
        const status = p.properties.Estado?.select?.name || "Activo";
        const moneda = p.properties.Moneda?.select?.name || (name.toUpperCase().includes("KAREDO") ? "EUR" : "CLP");
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
          accounts.map((acc) => supabase.rpc("get_weekly_package", { p_account: acc }))
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
        const sortCol = order_by || defaultOrderBy[view] || (view === "v_keyword_tendencia" ? "gasto_total" : "cost");
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
        p_order_by: order_by || defaultOrderBy[view],
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
      const sortCol = order_by || defaultOrderBy[view];
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
        try {
          const commentRes = await notion2.comments.list({ block_id: page.id });
          comments_count = commentRes.results?.length || 0;
        } catch (err) {
        }
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
        sincronizado: (/* @__PURE__ */ new Date()).toISOString()
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
        const { data: pkg } = await supabase.rpc("get_weekly_package", { p_account: client });
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
        rich_text: [
          {
            text: {
              content: text
            }
          }
        ]
      });
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
        confirmar_hipotesis
      } = req.body;
      const properties = {};
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
      const { account, que_cambio, donde, valor_anterior, valor_nuevo, por_que, accionable_notion_id } = req.body;
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
        donde: donde || "conversiones",
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
      const rsaZodSchema = z3.object({
        headlines: z3.array(z3.string()),
        descriptions: z3.array(z3.string())
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
      const { account, que_cambio, donde, valor_anterior, valor_nuevo, por_que, accionable_notion_id } = req.body;
      if (!account || !que_cambio) return res.status(400).json({ error: "account y que_cambio son obligatorios" });
      const { data, error } = await supabase.from("operator_log").insert({
        account,
        que_cambio,
        donde: donde || "otro",
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
          const acct = /karedo/i.test(nombre) ? "KAREDO" : /bhi|best health/i.test(nombre) ? "BHI" : /360/.test(nombre) ? "360" : null;
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
  app2.post("/api/reportes/generar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const { account, desde, hasta, tipo = "semanal", brief_id, resumen_manual } = req.body || {};
      if (!account || !desde || !hasta) return res.status(400).json({ error: "account, desde y hasta son obligatorios" });
      const { data: cuenta } = await supabase.from("cuentas").select("*").eq("account", account).single();
      if (!cuenta) return res.status(404).json({ error: "cuenta no encontrada" });
      let secciones = { resumen: resumen_manual || "", cambiamos: "", sigue: "" };
      if (brief_id && notion) secciones = await extraerSeccionesBrief(brief_id);
      if (!secciones.resumen) return res.status(422).json({ error: "El brief no tiene secci\xF3n de reporte al cliente. Pas\xE1 resumen_manual o un brief_id con la secci\xF3n." });
      const { data: datos, error } = await supabase.rpc("get_reporte_datos", { p_account: account, p_desde: desde, p_hasta: hasta });
      if (error) return res.status(500).json({ error: error.message });
      const { data: fila, error: e2 } = await supabase.from("reportes_cliente").upsert({
        account,
        periodo_desde: desde,
        periodo_hasta: hasta,
        tipo,
        idioma: cuenta.idioma_reporte,
        estado: "borrador",
        resumen_ejecutivo: secciones.resumen,
        que_cambiamos: secciones.cambiamos || null,
        que_sigue: secciones.sigue || null,
        metricas: datos.metricas,
        serie: datos.serie,
        campanas: { campanas: datos.campanas, grupos: datos.grupos, accionables: datos.accionables_ejecutados },
        brief_notion_id: brief_id || null
      }, { onConflict: "account,periodo_desde,tipo" }).select().single();
      if (e2) return res.status(500).json({ error: e2.message });
      res.json({ ok: true, reporte: fila });
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
    const { resumen_ejecutivo, que_cambiamos, que_sigue } = req.body || {};
    const { data, error } = await supabase.from("reportes_cliente").update({ resumen_ejecutivo, que_cambiamos, que_sigue, editado: true, pdf_path: null }).eq("id", req.params.id).eq("estado", "borrador").select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app2.post("/api/reportes/:id/pdf", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    try {
      const pdf = await cargarPdf();
      const { data: r } = await supabase.from("reportes_cliente").select("*").eq("id", req.params.id).single();
      if (!r) return res.status(404).json({ error: "no encontrado" });
      const { data: cuenta } = await supabase.from("cuentas").select("*").eq("account", r.account).single();
      const dias = (new Date(r.periodo_hasta).getTime() - new Date(r.periodo_desde).getTime()) / 864e5 + 1;
      const { data: anteriorCount } = await supabase.from("v_serie_diaria").select("date", { count: "exact", head: true }).eq("account", r.account).gte("date", new Date(new Date(r.periodo_desde).getTime() - dias * 864e5).toISOString().slice(0, 10)).lt("date", r.periodo_desde);
      const textoCompleto = [r.resumen_ejecutivo, r.que_cambiamos ? `${r.idioma === "en" ? "Changes applied" : "Cambios aplicados"}:
${r.que_cambiamos}` : "", r.que_sigue ? `${r.idioma === "en" ? "Next steps" : "Pr\xF3ximos pasos"}:
${r.que_sigue}` : ""].filter(Boolean).join("\n\n");
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
        bloques: pdf.parsearBloques(textoCompleto),
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
      if (req.query.download === "1") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="NorthSignal_${r.account}_${r.periodo_desde}.pdf"`);
        return res.send(buf);
      }
      res.json({ ok: true, pdf_path: ruta, bytes: buf.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/reportes/:id/pdf", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { data: r } = await supabase.from("reportes_cliente").select("account, periodo_desde, pdf_path").eq("id", req.params.id).single();
    if (!r?.pdf_path) return res.status(404).json({ error: "sin PDF; generalo primero" });
    const { data, error } = await supabase.storage.from("reportes").download(r.pdf_path);
    if (error || !data) return res.status(500).json({ error: error?.message || "no se pudo descargar" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="NorthSignal_${r.account}_${r.periodo_desde}.pdf"`);
    res.send(Buffer.from(await data.arrayBuffer()));
  });
  app2.post("/api/reportes/:id/aprobar", async (req, res) => {
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
    const { data, error } = await supabase.from("v_alertas_abiertas").select("*").limit(100);
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
    do {
      const r = await notion.databases.query({ database_id: NOTION_BASES.ACCIONABLES, page_size: 100, start_cursor: cursor });
      for (const page of r.results) {
        const p = page.properties;
        const txt = (k) => p[k]?.rich_text?.map((t) => t.plain_text).join("") || "";
        const cliente = await resolveNotionClient(notion, p.Cliente);
        filas.push({
          notion_id: page.id,
          account: cliente,
          titulo: p.Accion?.title?.map((t) => t.plain_text).join("") || "",
          estado: p.Estado?.select?.name || "",
          prioridad: p.Prioridad?.select?.name || "",
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
    if (filas.length) {
      const { error } = await supabase.from("accionables_espejo").upsert(filas, { onConflict: "notion_id" });
      if (error) throw new Error(error.message);
    }
    let rellenados = 0;
    for (const f of filas) {
      if (!["Propuesto", "Bloqueado", "En curso"].includes(f.estado)) continue;
      const props = {};
      if (!f.origen) props.Origen = { select: { name: "Semanal" } };
      if (!f.entidad) {
        const r = await notion.pages.retrieve({ page_id: f.notion_id });
        const donde = r?.properties?.Donde?.rich_text?.map((t) => t.plain_text).join("") || "";
        if (donde.trim()) props.Entidad = { rich_text: [{ text: { content: donde.trim().slice(0, 200) } }] };
      }
      if (Object.keys(props).length) {
        try {
          await notion.pages.update({ page_id: f.notion_id, properties: props });
          rellenados++;
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
  async function aplicarPoliticaAuto(account, notionId, titulo, entidad, origen, confianza, comoHacerlo) {
    if (!supabase) return null;
    const { detectarTipoAuto: detectarTipoAuto2, extraerKeyword: extraerKeyword2 } = await Promise.resolve().then(() => (init_tipoAuto(), tipoAuto_exports));
    const tipo = detectarTipoAuto2(titulo, comoHacerlo);
    if (!tipo) return null;
    const { data: modo } = await supabase.rpc("politica_aplica", { p_account: account, p_tipo: tipo, p_origen: origen, p_confianza: confianza, p_entidad: entidad });
    if (!modo) return null;
    const partes = String(entidad || "").split("|").map((x) => x.trim());
    const kw = extraerKeyword2(titulo, entidad);
    if (!partes[0] || !kw && tipo !== "pausar_anuncio") return null;
    await supabase.from("acciones_aprobadas").insert({ account, notion_id: notionId, tipo, campana: partes[0], grupo: partes[1] || null, keyword: kw || null, match_type: /exact|exacta/i.test(titulo) ? "EXACT" : "PHRASE", modo, aprobada_por: "politica", por_politica: true });
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
    const { account, tipo, campana, grupo, keyword, match_type, ad_id, modo } = req.body || {};
    if (!["negativa_grupo", "negativa_campana", "pausar_keyword", "pausar_anuncio"].includes(tipo)) return res.status(400).json({ error: "Solo negativas y pausas se pueden ejecutar desde la app. Presupuesto, puja y conversiones se hacen a mano." });
    if (!account || !campana || !keyword && !ad_id) return res.status(400).json({ error: "Faltan account, campana y keyword o ad_id" });
    const { data, error } = await supabase.from("acciones_aprobadas").insert({ account, notion_id: req.params.id, tipo, campana, grupo: grupo || null, keyword: keyword || null, match_type: match_type || "PHRASE", ad_id: ad_id || null, modo: modo === "ejecutar" ? "ejecutar" : "simular" }).select().single();
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
      await supabase.from("operator_log").insert({ account: acc.account, fecha: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), hora: (/* @__PURE__ */ new Date()).toISOString().slice(11, 16), que_cambio: `${acc.tipo}: ${acc.keyword || acc.ad_id}`, donde: `${acc.campana}${acc.grupo ? " \u203A " + acc.grupo : ""}`, por_que: "Aprobado en la app, ejecutado por el script", accionable_notion_id: acc.notion_id });
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
  app2.post("/api/propuestas/:id/:accion", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const { accion } = req.params;
    const { nota } = req.body || {};
    const estado = { aprobar: "aprobada", descartar: "descartada", test: "en_test", adoptar: "adoptada", pausar: "pausada" }[accion];
    if (!estado) return res.status(400).json({ error: "accion invalida" });
    const { error } = await supabase.from("propuestas_estrategicas").update({ estado, decision_andres: nota || null, decidida_el: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) }).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app2.get("/api/aprendido", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const client = req.query.client;
    const [lec, con, tipo, brecha] = await Promise.all([
      client ? supabase.from("lecciones").select("*").or(`account.eq.${client},account.is.null`).order("confianza", { ascending: false }).limit(30) : supabase.from("lecciones").select("*").order("confianza", { ascending: false }).limit(40),
      supabase.from("conocimiento_externo").select("*").order("fecha", { ascending: false }).limit(30),
      client ? supabase.from("v_acierto_por_tipo").select("*").eq("account", client) : supabase.from("v_acierto_por_tipo").select("*"),
      supabase.from("v_brecha_objetivo").select("*")
    ]);
    res.json({ lecciones: lec.data || [], conocimiento: con.data || [], acierto_por_tipo: tipo.data || [], brecha: brecha.data || [] });
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
    const cuentas = req.query.client ? [req.query.client] : ["KAREDO", "BHI", "360"];
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
        const title = `${h.titulo} \xB7 ${cuenta}`.slice(0, 200);
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
      if (account === "KAREDO" && /karedo/i.test(nombre) || account === "BHI" && /bhi|best health/i.test(nombre) || account === "360" && /360/.test(nombre)) return p.id;
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
