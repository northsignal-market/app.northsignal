import { createRequire } from 'module'; const require = createRequire(import.meta.url);

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
var NOTION_PRIORITIES = {
  URGENTE: "Urgente",
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja"
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
var notionKey = process.env.NOTION_API_KEY;
var notion = notionKey ? new Client({ auth: notionKey }) : null;

// src/server/lib/gemini.ts
import { GoogleGenAI } from "@google/genai";
var geminiKey = process.env.GEMINI_API_KEY;
var ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

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
import { z as z2 } from "zod";
import cookieParser from "cookie-parser";
import { Client as NotionClient } from "@notionhq/client";
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
      const { data: cambiosDetectados } = await supabase.from("v_cambios_detectados").select("*").order("fecha_actual", { ascending: false }).limit(25);
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
    const { account, fecha, titulo, tipo, detalle } = req.body;
    const { data, error } = await supabase.from("annotations").insert([{
      account,
      fecha,
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
          causa_raiz: props["Causa raiz"]?.rich_text?.map((rt) => rt.plain_text).join("") || "",
          relacionado_con: props["Relacionado con"]?.relation?.map((rel) => rel.id) || [],
          semanas_pendiente: props["Semanas pendiente"]?.number ?? (props["Semanas pendiente"]?.formula?.number ?? 0),
          comments_count,
          created_at: page.created_time,
          url: page.url
        };
      }));
      res.json({ data });
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
      const rsaZodSchema = z2.object({
        headlines: z2.array(z2.string()),
        descriptions: z2.array(z2.string())
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
  app2.post("/api/cron/anomalias", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.authorization;
    if (secret && auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
    try {
      await runAnomalyWorker();
      res.json({ ok: true, ran_at: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.originalUrl || req.path}` });
  });
  app2.post("/api/cron/aprendizaje", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
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
  app2.post("/api/cron/mantenimiento", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase no configurado" });
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
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
  return app2;
}
async function runAnomalyWorker() {
  console.log("Running autonomous worker: Z-Score Anomalies Check");
  const actionablesDbId = NOTION_BASES.ACCIONABLES;
  if (!supabase || !notion || !actionablesDbId) return;
  const clients = ["360", "BHI", "KAREDO"];
  for (const client of clients) {
    const { data, error } = await supabase.from("v_campaign_analisis").select("*").eq("account", client).order("date_start", { ascending: false }).limit(9);
    if (!error && data && data.length >= 4) {
      const current = data[0];
      const history = data.slice(1, 9);
      const metrics = ["cpa", "gasto", "conversiones", "ctr_promedio"];
      for (const m of metrics) {
        const vals = history.map((r) => Number(r[m]) || 0);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sqDiffs = vals.map((v) => Math.pow(v - avg, 2));
        const stdDev = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / vals.length);
        const currVal = Number(current[m]) || 0;
        if (stdDev > 0) {
          const zScore = Math.abs((currVal - avg) / stdDev);
          if (zScore >= 2) {
            const direction = currVal > avg ? "up" : "down";
            const task_hash = `ANOMALY-${client}-${m}-${current.week_start || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
            try {
              const title = `[Anomal\xEDa] Pico de ${m.toUpperCase()} (${direction}) en ${client}`;
              const existing = await notion.databases.query({
                database_id: actionablesDbId,
                filter: {
                  property: "Accion",
                  title: { equals: title }
                }
              });
              const isCompletedOrDiscarded = (page) => {
                const state = page?.properties?.Estado?.select?.name;
                return state === NOTION_STATES.HECHO || state === NOTION_STATES.DESCARTADO;
              };
              const activeCard = existing.results.find((p) => !isCompletedOrDiscarded(p));
              if (activeCard) {
                await notion.comments.create({
                  parent: { page_id: activeCard.id },
                  rich_text: [{ text: { content: `Actualizaci\xF3n del Centinela: La anomal\xEDa en ${m.toUpperCase()} (${direction}) persiste. Z-Score actual: ${zScore.toFixed(2)}.` } }]
                });
                console.log(`Added comment to existing actionable for anomaly: ${title}`);
              } else {
                const why = `Se detect\xF3 una desviaci\xF3n estad\xEDstica con un Z-Score de ${zScore.toFixed(2)}. El valor actual es ${currVal.toFixed(2)} frente a un promedio hist\xF3rico de ${avg.toFixed(2)}.`;
                await notion.pages.create({
                  parent: { database_id: actionablesDbId },
                  properties: {
                    "Accion": { title: [{ text: { content: title } }] },
                    "Cliente": { select: { name: client } },
                    "Prioridad": { select: { name: NOTION_PRIORITIES.ALTA } },
                    "Estado": { select: { name: NOTION_STATES.PROPUESTO } },
                    "Por que": { rich_text: [{ text: { content: why } }] }
                  }
                });
                console.log(`Created actionable for anomaly: ${title}`);
              }
            } catch (e) {
              console.error(`Failed to handle actionable for anomaly: ${e}`);
            }
          }
        }
      }
    }
  }
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
