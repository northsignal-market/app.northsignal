// dotenv PRIMERO: los módulos de lib/ construyen clientes al importarse
// y necesitan las variables ya cargadas.
import 'dotenv/config';
import { webhooksRouter } from './src/server/routes/webhooks';
import { NOTION_BASES, NOTION_STATES, NOTION_PRIORITIES, NOTION_REVISION_IA } from './src/server/domain/notionSchema';
import { VIEW_CONFIGS, validCols, validSearchCols } from './src/server/domain/viewConfig';


import { notion } from './src/server/lib/notion';
import { ai } from './src/server/lib/gemini';
import { correrPulso, pulsoDisponible } from './src/server/lib/pulso';
import { responderAsistente } from './src/server/lib/asistente';
import { embeberPendientes, parecidoA } from './src/server/lib/memoria';
import type { ReporteInput } from './src/server/lib/reporte-pdf';
// react-pdf se carga solo cuando se genera un PDF: su dependencia pdfkit hace
// requires dinamicos que tumban el arranque si el bundle no los incluye.
const cargarPdf = () => import('./src/server/lib/reporte-pdf');
import { supabase } from './src/server/lib/supabase';
import { authMiddleware } from './src/server/auth/middleware';
import { authRouter } from './src/server/auth/routes';
import { CLIENT_RULES, getClientContext } from './src/server/domain/clientRules';


import express from "express";
import path from "path";
import { z } from "zod";
import cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Client as NotionClient } from '@notionhq/client';
import { GoogleGenAI } from '@google/genai';

// Cache for Notion Client resolutions
const notionClientCache: Record<string, string> = {};
// Cuentas activas desde Supabase, no cableadas. Agregar un cliente es una fila,
// no un despliegue. Cache corto para no consultar en cada peticion.
let _cuentasCache: { at: number; data: any[] } = { at: 0, data: [] };
async function cuentasActivas(): Promise<any[]> {
  if (Date.now() - _cuentasCache.at < 300000 && _cuentasCache.data.length) return _cuentasCache.data;
  if (!supabase) return [];
  const { data } = await supabase.from('cuentas').select('account, nombre_cliente, moneda, locale, cid, perfil_analisis, presupuesto_diario, notion_ficha_id').eq('activa', true).order('account');
  if (data?.length) _cuentasCache = { at: Date.now(), data };
  return data || [];
}

async function resolveNotionClient(notion: any, relationProp: any): Promise<string> {
  if (!relationProp?.relation || relationProp.relation.length === 0) return 'Unknown';
  const pageId = relationProp.relation[0].id;
  if (notionClientCache[pageId]) return notionClientCache[pageId];
  // Primero por la ficha: es la unica forma exacta. "Fresh Monkee" cortado en el primer
  // espacio daba "FRESH", no "FRESH_MONKEE", y el accionable quedaba huerfano.
  try {
    const porFicha = (await cuentasActivas()).find((c: any) => c.notion_ficha_id && c.notion_ficha_id.replace(/-/g, '') === String(pageId).replace(/-/g, ''));
    if (porFicha) { notionClientCache[pageId] = porFicha.account; return porFicha.account; }
  } catch {}
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const name = page.properties.Cliente?.title?.[0]?.plain_text || 
                 page.properties.Name?.title?.[0]?.plain_text || 'Unknown';
    // Por nombre completo contra la tabla; el corte en el primer espacio es el ultimo recurso
    const cts = await cuentasActivas();
    const nm = String(name).toLowerCase().trim();
    const encontrada = cts.find((c: any) => (c.nombre_cliente || '').toLowerCase() === nm)
                    || cts.find((c: any) => nm === c.account.toLowerCase().replace(/_/g, ' '))
                    || cts.find((c: any) => nm.startsWith((c.nombre_cliente || '').toLowerCase().split(' ')[0]) && (c.nombre_cliente || '').split(' ').length > 1 && nm.includes((c.nombre_cliente || '').toLowerCase().split(' ')[1]));
    // Si no se puede resolver contra una cuenta real, NO se inventa un nombre.
    // El corte en el primer espacio daba basura como "FRESH" o "ZZ", que despues
    // aparecia como cuenta huerfana en el espejo. Mejor 'Unknown' y una alerta.
    if (!encontrada) console.warn(`[notion] cliente sin cuenta: "${name}" (pagina ${pageId})`);
    const normalized = encontrada ? encontrada.account : 'Unknown';
    notionClientCache[pageId] = normalized;
    return normalized;
  } catch (e) {
    return 'Unknown';
  }
}

/**
 * Crea la app Express con todos los endpoints. No escucha ni sirve estáticos:
 * eso lo hace el entorno (dev local con Vite, o Vercel serverless).
 */
export function createApp() {
  const app = express();

  app.use(express.json({
    verify: (req: any, res, buf) => {
      (req as any).rawBody = buf;
    }
  }));
  app.use(cookieParser());
  app.use('/api', authRouter);


// Auth routes extracted to auth/routes.ts

  // Auth middleware extracted to auth/middleware.ts

  // ================================================================
  // LINK PUBLICO DEL REPORTE: /r/:token. Sin login. El cliente lo abre en el telefono.
  // Solo reportes aprobados o enviados. Registra la primera vista.
  // ================================================================
  app.get("/r/:token", async (req, res) => {
    if (!supabase) return res.status(503).send('No disponible');
    const { data: r } = await supabase.from('v_reporte_publico').select('*').eq('token', req.params.token).maybeSingle();
    if (!r) return res.status(404).send('<html><body style="font-family:Helvetica;padding:40px;color:#333">Este reporte no está disponible.</body></html>');
    await supabase.from('reportes_cliente').update({ vistas: (r as any).vistas ? (r as any).vistas + 1 : 1, visto_el: (r as any).visto_el || new Date().toISOString() }).eq('token', req.params.token);
    const en = r.idioma === 'en';
    const t = en ? { titulo: 'Performance Report', periodo: 'Period', inv: 'Spend', conv: 'Conversions', cpa: 'CPA', clics: 'Clicks', ctr: 'CTR', vs: 'vs previous period', camp: 'Campaigns', grp: 'Ad groups', pdf: 'Download PDF', by: 'Prepared by' } : { titulo: 'Reporte de rendimiento', periodo: 'Período', inv: 'Inversión', conv: 'Conversiones', cpa: 'CPA', clics: 'Clics', ctr: 'CTR', vs: 'vs período anterior', camp: 'Campañas', grp: 'Grupos de anuncios', pdf: 'Descargar PDF', by: 'Preparado por' };
    const { data: cuenta } = await supabase.from('cuentas').select('moneda, locale').eq('account', r.account).single();
    const fmt = (v: any, tipo: 'moneda' | 'num' | 'pct' = 'num') => v == null ? '—' : tipo === 'moneda' ? new Intl.NumberFormat(cuenta?.locale || 'es-CL', { style: 'currency', currency: cuenta?.moneda || 'CLP', maximumFractionDigits: cuenta?.moneda === 'EUR' ? 2 : 0 }).format(Number(v)) : tipo === 'pct' ? Number(v).toFixed(2) + '%' : new Intl.NumberFormat(cuenta?.locale || 'es-CL', { maximumFractionDigits: 1 }).format(Number(v));
    const delta = (k: string) => { const m = r.metricas?.[k]; if (!m || m.anterior == null || m.actual == null || !m.anterior) return ''; const d = (m.actual - m.anterior) / m.anterior * 100; const bueno = k === 'cpa' ? d < 0 : d > 0; return `<span style="font-size:12px;color:${bueno ? '#1a7f37' : '#b42318'}">${d > 0 ? '+' : ''}${d.toFixed(0)}% ${t.vs}</span>`; };
    const kpis = (r.reporte_plantilla?.kpis || ['gasto', 'conversiones', 'cpa', 'clics']) as string[];
    const kpiNombre: Record<string, string> = { gasto: t.inv, conversiones: t.conv, cpa: t.cpa, clics: t.clics, ctr: t.ctr, cuota_impresiones: en ? 'Impression share' : 'Cuota de impresiones' };
    const kpiHtml = kpis.map(k => `<div style="flex:1;min-width:120px;padding:14px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${kpiNombre[k] || k}</div><div style="font-size:22px;font-weight:600;color:#111827;margin:4px 0 2px">${fmt(r.metricas?.[k]?.actual, k === 'gasto' || k === 'cpa' ? 'moneda' : k === 'ctr' || k === 'cuota_impresiones' ? 'pct' : 'num')}</div>${delta(k)}</div>`).join('');
    const esc = (x: any) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
    const bloques = (r.bloques || []).map((b: any) => `<section style="margin:22px 0"><h2 style="font-size:14px;font-weight:700;color:#111827;margin:0 0 8px">${esc(b.etiqueta)}</h2>${b.texto ? `<p style="margin:0 0 8px;line-height:1.55">${esc(b.texto).replace(/\n\n/g, '</p><p style="margin:0 0 8px;line-height:1.55">')}</p>` : ''}${b.vinetas?.length ? `<ul style="margin:0;padding-left:18px;line-height:1.55">${b.vinetas.map((v: string) => `<li style="margin:4px 0">${esc(v)}</li>`).join('')}</ul>` : ''}</section>`).join('');
    const tabla = (filas: any[], cols: { k: string; n: string; f?: 'moneda' | 'num' | 'pct' }[]) => filas?.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><thead><tr>${cols.map(c => `<th style="text-align:${c.k === 'nombre' || c.k === 'campana' ? 'left' : 'right'};padding:8px;background:#0062CC;color:#fff;font-weight:600">${c.n}</th>`).join('')}</tr></thead><tbody>${filas.map((f, i) => `<tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">${cols.map(c => `<td style="text-align:${c.k === 'nombre' || c.k === 'campana' ? 'left' : 'right'};padding:7px 8px;border-bottom:1px solid #eee">${c.f ? fmt(f[c.k], c.f) : esc(f[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
    const camp = tabla(r.campanas?.campanas || [], [{ k: 'nombre', n: t.camp }, { k: 'gasto', n: t.inv, f: 'moneda' }, { k: 'conv', n: t.conv, f: 'num' }, { k: 'cpa', n: t.cpa, f: 'moneda' }, { k: 'ctr', n: t.ctr, f: 'pct' }]);
    const grp = tabla((r.campanas?.grupos || []).slice(0, 15), [{ k: 'nombre', n: t.grp }, { k: 'gasto', n: t.inv, f: 'moneda' }, { k: 'conv', n: t.conv, f: 'num' }, { k: 'cpa', n: t.cpa, f: 'moneda' }]);
    const titulo = (r.encabezado_reporte || '').split('|')[0].trim() || r.nombre_cliente;
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Robots-Tag', 'noindex');
    res.send(`<!doctype html><html lang="${r.idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · ${t.titulo}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:860px;margin:0 auto;padding:24px 16px 48px">
  <header style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:8px 0 16px;border-bottom:2px solid #0062CC;margin-bottom:20px">
    <div><div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em">NorthSignal</div><h1 style="font-size:22px;margin:4px 0 2px;color:#111827">${esc(titulo)}</h1><div style="font-size:13px;color:#4b5563">${t.titulo} · ${t.periodo}: ${r.periodo_desde} → ${r.periodo_hasta}</div></div>
    <a href="/api/publico/reportes/${esc(r.token)}/pdf" style="font-size:13px;color:#0062CC;text-decoration:none;white-space:nowrap">${t.pdf} ↓</a>
  </header>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">${kpiHtml}</div>
  <main style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 22px 18px;font-size:14px">${bloques}</main>
  <div style="margin-top:20px">${camp}${grp}</div>
  <footer style="margin-top:28px;font-size:12px;color:#6b7280">${t.by} ${esc(r.reporte_plantilla?.firma || 'NorthSignal')} · v${r.version}</footer>
</div></body></html>`);
  });
  // PDF publico por token (solo aprobados/enviados)
  app.get("/api/publico/reportes/:token/pdf", async (req, res) => {
    if (!supabase) return res.status(503).send('No disponible');
    const { data: r } = await supabase.from('reportes_cliente').select('id, pdf_path, estado, account, periodo_desde').eq('token', req.params.token).in('estado', ['aprobado', 'enviado']).maybeSingle();
    if (!r) return res.status(404).send('No disponible');
    let ruta = r.pdf_path;
    if (!ruta) { try { ruta = (await generarYGuardarPdf(r.id)).pdf_path; } catch {} }
    if (!ruta) return res.status(404).send('PDF no disponible');
    const { data: file } = await supabase.storage.from('reportes').download(ruta);
    if (!file) return res.status(404).send('PDF no disponible');
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="reporte_${r.account}_${r.periodo_desde}.pdf"`);
    res.send(Buffer.from(await file.arrayBuffer()));
  });

  app.use('/api', authMiddleware);

  // Observabilidad: Vercel solo ve el status code, no el cuerpo. Este
  // middleware registra ruta, mensaje y tiempo de cada respuesta >= 500 y de
  // cada respuesta lenta, para que los logs de Vercel cuenten qué pasó.
  app.use('/api', (req, res, next) => {
    const t0 = Date.now();
    const origJson = res.json.bind(res);
    res.json = (body: any) => {
      const ms = Date.now() - t0;
      if (res.statusCode >= 500) {
        console.error(`[${res.statusCode}] ${req.method} ${req.originalUrl} ${ms}ms — ${body?.error || JSON.stringify(body).slice(0, 200)}`);
      } else if (ms > 8000) {
        console.warn(`[lento ${ms}ms] ${req.method} ${req.originalUrl}`);
      }
      return origJson(body);
    };
    next();
  });





  // Healthcheck & System Observability
  app.get("/api/health/system", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase missing' });
    try {
      const { data: dataHealth } = await supabase.from('v_data_health').select('*');
      const { data: webhookHealth } = await supabase.from('v_webhook_health').select('*');
      const { data: integridadDatos } = await supabase.from('v_integridad_datos').select('*');
      const { data: runScorecard } = await supabase.from('v_run_scorecard').select('*').order('run_date', { ascending: false });
      const { data: runTendencia } = await supabase.from('v_run_tendencia').select('*');
      const { data: cambiosDetectados } = await supabase.from('v_cambios_detectados').select('*').order('detectado_hasta', { ascending: false }).limit(25);
      const { data: diccionarioDatos } = await supabase.rpc('diccionario_datos');
      
      res.json({ 
        dataHealth: dataHealth || [], 
        webhookHealth: webhookHealth || [], 
        integridadDatos: integridadDatos || [],
        runScorecard: runScorecard || [],
        runTendencia: runTendencia || [],
        cambiosDetectados: cambiosDetectados || [],
        diccionarioDatos: diccionarioDatos || []
      });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/health/run_quality/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase missing' });
    try {
      const { revision_humana } = req.body;
      const today = new Date().toISOString().split('T')[0];
      const paramId = req.params.id;
      let query = supabase.from('run_quality').update({
        revision_humana,
        revision_humana_fecha: today
      });
      if (/^\d{4}-\d{2}-\d{2}/.test(paramId)) {
        query = query.eq('run_date', paramId);
      } else {
        query = query.eq('id', paramId);
      }
      const { data, error } = await query.select();
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true, data });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/daily/overview", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });
    const client = (req.query.client as string) || '360';
    
    try {
      // 1. Pulso hoy
      const { data: pulses, error: pulseErr } = await supabase.from('v_pulso_hoy').select('*');
      if (pulseErr) console.error("Pulse error:", pulseErr);
      const pulse = pulses?.find((p: any) => p.account?.toLowerCase() === client.toLowerCase()) || null;

      // 2. Serie diaria (ultimos 28 dias para soportar comparacion semanal)
      const { data: dailySeries, error: serieErr } = await supabase
        .from('v_serie_diaria')
        .select('*')
        .eq('account', client)
        .order('date', { ascending: true })
        .limit(28);
      if (serieErr) console.error("Serie error:", serieErr);

      // 3. Dia con cambios (ultimos 14 dias con delta_cpa y cambios)
      const { data: diaConCambios, error: cambiosErr } = await supabase
        .from('v_dia_con_cambios')
        .select('*')
        .eq('account', client)
        .order('date', { ascending: false })
        .limit(14);
      if (cambiosErr) console.error("Cambios error:", cambiosErr);

      // 4. Terminos nuevos
      const { data: newTerms, error: termsErr } = await supabase
        .from('v_terminos_nuevos')
        .select('*')
        .eq('account', client)
        .order('gasto_acumulado', { ascending: false })
        .limit(10);
      if (termsErr) console.error("Terms error:", termsErr);

      // 5. Cambios recientes
      const { data: recentChanges, error: recentErr } = await supabase
        .from('v_cambios_recientes')
        .select('*')
        .eq('account', client)
        .limit(10);
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
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/todos_los_cambios", async (req, res) => {
    try {
      const client = (req.query.client as string) || (req.query.account as string);
      if (!client) return res.status(400).json({ error: 'Client required' });
      if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });

      const { data, error } = await supabase
        .from('v_todos_los_cambios')
        .select('*')
        .ilike('account', client)
        .order('fecha', { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error consultando v_todos_los_cambios:", error);
        return res.json({ changes: [] });
      }
      res.json({ changes: data || [] });
    } catch(e: any) {
      res.json({ changes: [] });
    }
  });

  app.get("/api/daily/terminos_nuevos", async (req, res) => {
    try {
      const client = (req.query.client as string) || (req.query.account as string) || '360';
      if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });

      const { data: newTerms, error: termsErr } = await supabase
        .from('v_terminos_nuevos')
        .select('*')
        .ilike('account', client)
        .order('gasto_acumulado', { ascending: false })
        .limit(20);

      if (termsErr) {
        console.error("Terms error:", termsErr);
        return res.json({ terms: [] });
      }
      res.json({ terms: newTerms || [] });
    } catch (e: any) {
      res.json({ terms: [] });
    }
  });

  app.get("/api/notion/clients", async (req, res) => {
    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion = new NotionClient({ auth: notionKey });
      const response = await notion.databases.query({
        database_id: NOTION_BASES.CLIENTES,
        page_size: 20
      });
      const monedaPorCuenta = new Map((await cuentasActivas()).map(c => [c.account, c.moneda]));
      const clients = response.results.map((p: any) => {
        const name = p.properties.Cliente?.title?.map((t: any) => t.plain_text).join('') || 'Sin nombre';
        const aprendizajes = p.properties['Aprendizajes consolidados']?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        const hipotesis = p.properties['Hipotesis abiertas']?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        const semanas = p.properties['Semanas analizadas']?.number ?? 0;
        const status = p.properties.Estado?.select?.name || 'Activo';
        const moneda = p.properties.Moneda?.select?.name || [...monedaPorCuenta.entries()].find(([a]) => name.toUpperCase().includes(a))?.[1] || 'CLP';
        const country = p.properties.Pais?.select?.name || '';
        const budget = p.properties['Presupuesto diario']?.number || 0;
        const customerId = p.properties['Customer ID']?.rich_text?.map((t: any) => t.plain_text).join('') || '';
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
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", os: "NorthSignal v1.0" });
  });

  
  

  // Main Dashboard Data Endpoint

  app.get("/api/data", async (req, res) => {
    // Keep this for the Command Center overview (fetches Supabase Briefs and Notion Actionables)
    
    
    const notionKey = process.env.NOTION_API_KEY;

    let actionables: any[] = [];
    let briefs: any[] = [];
    let status = { supabase: false, notion: false };
    let errors: { supabase?: string, notion?: string } = {};

    // 1. Try fetching from Supabase
    
    if (supabase) {
      try {
        
        
        // Obtener cuentas activas dinámicamente
        // Usar un límite alto para asegurar que traemos todas las cuentas recientes o preferiblemente un view si existiera
        const { data: accountsData, error: accountsErr } = await supabase
          .from('weekly_brief')
          .select('account')
          .order('run_ts', { ascending: false })
          .limit(1000);
          
        if (accountsErr) throw accountsErr;
        
        const accounts = Array.from(new Set(accountsData.map(r => r.account)));
        
        // Llamar a get_weekly_package para cada cuenta
        const results = await Promise.all(
          accounts.map(async (acc: string) => {
            const pf = (await cuentasActivas()).find(c => c.account === acc)?.perfil_analisis;
            return supabase!.rpc(pf === 'cadena' ? 'get_weekly_package_cadena' : 'get_weekly_package', { p_account: acc });
          })
        );
        
        results.forEach(res => {
          if (res.error) {
            console.error(res.error);
          } else if (res.data) {
            const data = Array.isArray(res.data) ? res.data[0] : res.data;
            if (data && data.cuenta) {
              const account = data.cuenta;
              let spend = 0, cpa = 0, conversions = 0;
              const alerts = [];
              
              if (Array.isArray(data.brief)) {
                data.brief.forEach(row => {
                  if (row.seccion === 'totales' && row.item === 'gasto') spend = parseFloat(row.valor) || 0;
                  if (row.seccion === 'totales' && row.item === 'cpa') cpa = parseFloat(row.valor) || 0;
                  if (row.seccion === 'totales' && row.item === 'conversiones') conversions = parseFloat(row.valor) || 0;
                });
              }

              if (Array.isArray(data.alertas_altas)) {
                data.alertas_altas.forEach(al => {
                  alerts.push({
                    item: al.tipo || al.item || al.regla,
                    detail: al.entidad || al.detalle || al.valor,
                    note: (al.detalle || al.motivo || '') + (al.valor ? ' (Valor: ' + al.valor + ')' : '')
                  });
                });
              } else if (Array.isArray(data.brief)) {
                // Fallback to brief rows if alertas_altas array is missing or differently named
                data.brief.forEach(row => {
                  if (row.seccion === 'alertas_alta') {
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
                data.tendencia_8_semanas.forEach(trend => {
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
                id: account + '-' + data.semana,
                account: account,
                week_start: data.semana,
                metrics: { spend, cpa, conversions },
                alerts: alerts,
                history: history
              });
            }
          }
        });
        
        status.supabase = true;
      } catch (e: any) {
        errors.supabase = e.message || String(e);
      }
    }
 else {
      errors.supabase = "Credenciales de Supabase no configuradas";
    }

    // 2. Try fetching from Notion
    if (notionKey) {
      try {
        const notion = new NotionClient({ auth: notionKey });
        
        
        const response = await notion.databases.query({
          database_id: NOTION_BASES.ACCIONABLES,
          page_size: 100
        });
        
        if (response.results) {
          // Si devuelve vacío sin error, puede ser falla silenciosa, pero no es error de la API.
          // Notion devuelve results: [] si no hay items o si la query al data source es vacía.
          status.notion = true;
          actionables = await Promise.all(response.results.map(async (page: any) => {
            const props = page.properties;
            const titleArray = props.Accion?.title || props.Name?.title || props.Title?.title;
            const title = titleArray && titleArray.length > 0 
                          ? titleArray.map((rt: any) => rt.plain_text).join('') 
                          : 'Accionable sin título';
            const client = await resolveNotionClient(notion, props.Cliente || props.Client);
            
            const why = props['Por que']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
            const where = props.Donde?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
            const status = props.Estado?.select?.name || NOTION_STATES.PROPUESTO;
            const priority = props.Prioridad?.select?.name || 'Medium';
            const revision_ia = props['Revision IA']?.select?.name || NOTION_REVISION_IA.SIN_REVISAR;
            const punto_disputa = props['Punto en disputa']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
            const decision_final = props['Decision final']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
            const ejecutado_el = props['Ejecutado el']?.date?.start || null;
            const resultado_observado = props['Resultado observado']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
            const detectado = props['Detectado']?.date?.start || page.created_time;

            let comments_count = 0;
            try {
              const commentRes = await notion.comments.list({ block_id: page.id });
              comments_count = commentRes.results?.length || 0;
            } catch (err) {
              // ignore or default to 0
            }
            
            return {
              id: page.id,
              client: client,
              title: title,
              description: why || 'Extraído desde Notion (' + page.url + ')',
              status: status,
              priority: priority,
              why: why,
              where: where,
              revision_ia: revision_ia,
              punto_disputa: punto_disputa,
              decision_final: decision_final,
              ejecutado_el: ejecutado_el,
              resultado_observado: resultado_observado,
              detectado: detectado,
              comments_count: comments_count,
              url: page.url,
              created_at: page.created_time,
              entities: []
            };
          }));
        }
      } catch (e: any) {
        errors.notion = e.message || String(e);
      }
    } else {
      errors.notion = "Notion API Key no configurada";
    }

    res.json({ actionables, briefs, status, errors });
  });

  // Dedicated Notion API endpoints
    
  
  

  app.get("/api/metrics/mtd", async (req, res) => {
    try {
      const client = req.query.client as string;
      if (!client) return res.status(400).json({ error: 'Client required' });
      
      
      if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });
      
      
      
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      
      // Fallback a v_tendencia_semanal
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('v_tendencia_semanal')
        .select('gasto, week_start')
        .eq('account', client)
        .gte('week_start', firstDay);
        
      if (!weeklyError && weeklyData) {
        const total = weeklyData.reduce((acc, curr) => acc + Number(curr.gasto || 0), 0);
        return res.json({ success: true, mtd_spend: total });
      }
      
      return res.json({ success: true, mtd_spend: 0 });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/metrics/weeks", async (req, res) => {
    
    
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });
    
    const client = req.query.client as string;
    if (!client) return res.status(400).json({ error: 'Client required' });

    
    // Fetch unique weeks from v_campaign_analisis (or another view that has week_start)
    const { data, error } = await supabase.from('v_campaign_analisis')
      .select('week_start')
      .eq('account', client)
      .order('week_start', { ascending: false });
      
    if (error) return res.status(500).json({ error: error.message || error });
    
    const weeks = Array.from(new Set(data.map(d => d.week_start))).filter(Boolean);
    return res.json({ weeks });
  });

  // Endpoint: True ROAS (must be placed before /api/metrics/:view)
  app.get("/api/metrics/true-roas", async (req, res) => {
    try {
      const client = (req.query.client as string) || (req.query.account as string);
      if (!client) return res.status(400).json({ error: 'Client required' });
      if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });

      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from('true_roas_events')
        .select('monto')
        .ilike('client', client)
        .gte('event_date', firstDay);

      if (error) {
        console.error("Error fetching true-roas:", error);
        return res.json({ success: true, mtd_income: 0 });
      }

      const totalIncome = (data || []).reduce((acc: number, curr: any) => acc + (Number(curr.monto) || 0), 0);
      res.json({ success: true, mtd_income: totalIncome });
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        res.status(500).json({ error: e.message });
    }
  });

  const _colsCache = new Map<string, Set<string>>();
  async function columnasDeVista(view: string): Promise<Set<string>> {
    if (_colsCache.has(view)) return _colsCache.get(view)!;
    try {
      const { data } = await supabase!.from(view).select('*').limit(1);
      const set = new Set(Object.keys((data && data[0]) || {}));
      if (set.size) _colsCache.set(view, set);
      return set;
    } catch { return new Set(); }
  }
  app.get(["/api/metrics/:view", "/api/views/:view"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado', disponible: false });
    const { view } = req.params;
    const client = (req.query.client as string) || (req.query.account as string);
    const week = req.query.week as string; // fallback
    const from_date = req.query.from as string || week;
    const to_date = req.query.to as string;
    const search = req.query.search as string;
    const search_col = req.query.searchColumn as string;
    const group_by = req.query.groupBy as string;
    const order_by = req.query.orderBy as string;
    const order_dir = req.query.orderDir as string;
    const limit = Number(req.query.limit) || 25;
    const offset = Number(req.query.offset) || 0;
    
    let filters = [];
    try {
      if (req.query.filters) {
         filters = JSON.parse(req.query.filters as string);
      }
    } catch(e) {}

    
    // Columnas reales de cada vista, cacheadas: si el orderBy pedido no existe (viene de otra vista), usar el default.
    const cols = await columnasDeVista(view);
    const orderValido = order_by && cols.has(order_by) ? order_by : undefined;
    const defaultOrderBy: Record<string, string> = {
      v_campaign_analisis: 'cost',
      v_adgroup_analisis: 'cost',
      v_keywords_analisis: 'cost',
      v_search_terms_analisis: 'cost',
      v_keywords_daily: 'cost',
      v_search_terms_daily: 'cost',
      v_keyword_tendencia: 'gasto_total',
      v_conversiones_por_accion: 'primarias',
      v_ngrams_sin_conversion: 'costo_total',
      v_fuzzy_negatives: 'gasto_perdido',
      v_tendencia_semanal: 'week_start'
    };

    // Vistas diarias directas o de tendencia
    if (['v_keywords_daily', 'v_search_terms_daily', 'v_keyword_tendencia'].includes(view)) {
      try {
        let query = supabase.from(view).select('*', { count: 'exact' }).ilike('account', client);
        if (from_date) query = query.gte(view === 'v_keyword_tendencia' ? 'primer_dia' : 'date', from_date);
        if (to_date) query = query.lte(view === 'v_keyword_tendencia' ? 'ultimo_dia' : 'date', to_date);
        if (search && search_col) {
          query = query.ilike(search_col, `%${search}%`);
        }
        const sortCol = orderValido || (cols.has(defaultOrderBy[view]) ? defaultOrderBy[view] : (cols.has('cost') ? 'cost' : [...cols][0]));
        query = query.order(sortCol, { ascending: order_dir === 'asc' });
        query = query.range(offset, offset + limit - 1);

        const { data: rows, count, error: qErr } = await query;
        if (qErr) throw qErr;

        let totCost = 0;
        let totConvs = 0;
        let totClicks = 0;
        let totImpr = 0;

        (rows || []).forEach((row: any) => {
          totCost += Number(row.cost || row.gasto_total || 0);
          totConvs += Number(row.conversions || row.conversiones_total || 0);
          totClicks += Number(row.clicks || row.clics_total || 0);
          totImpr += Number(row.impressions || 0);
        });

        const totals: any = {
          cost: totCost,
          conversions: totConvs,
          clicks: totClicks,
          impressions: totImpr,
          cost_per_conv: totConvs > 0 ? Math.round(totCost / totConvs) : null,
          ctr: totImpr > 0 ? Number(((totClicks / totImpr) * 100).toFixed(2)) : 0,
          disponible: true
        };

        return res.json({
          data: rows || [],
          total: count || (rows ? rows.length : 0),
          totals
        });
      } catch (err: any) {
        console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${err.message}`);
          return res.status(500).json({ error: err.message, disponible: false });
      }
    }

    try {
      const { data, error } = await supabase.rpc('get_view_data', {
        p_view: view,
        p_account: client,
        p_from: from_date || null,
        p_to: to_date || null,
        p_search: search || null,
        p_search_col: search_col || null,
        p_filters: filters,
        p_group_by: group_by || null,
        p_order_by: orderValido || defaultOrderBy[view],
        p_order_dir: order_dir || 'desc',
        p_limit: limit,
        p_offset: offset
      });

      if (!error && data) {
        // La función devuelve un objeto JSON escalar, no un array.
        const r = Array.isArray(data) ? data[0] : data;
        return res.json({
          data: r.data || [],
          total: r.total || 0,
          totals: { ...(r.totals || {}), disponible: true }
        });
      }

      // Fallback a consulta directa sobre la vista si RPC no existe o falla
      let query = supabase.from(view).select('*', { count: 'exact' });
      if (client) query = query.ilike('account', client);
      if (from_date) {
        const dateCol = ['v_tendencia_semanal', 'v_campaign_analisis', 'v_adgroup_analisis', 'v_keywords_analisis', 'v_search_terms_analisis', 'v_conversiones_por_accion', 'v_ngrams_sin_conversion', 'v_fuzzy_negatives'].includes(view) ? 'week_start' : 'date';
        query = query.gte(dateCol, from_date);
      }
      if (to_date) {
        const dateCol = ['v_tendencia_semanal', 'v_campaign_analisis', 'v_adgroup_analisis', 'v_keywords_analisis', 'v_search_terms_analisis', 'v_conversiones_por_accion', 'v_ngrams_sin_conversion', 'v_fuzzy_negatives'].includes(view) ? 'week_start' : 'date';
        query = query.lte(dateCol, to_date);
      }
      if (search && search_col) {
        query = query.ilike(search_col, `%${search}%`);
      }
      const sortCol = orderValido || (cols.has(defaultOrderBy[view]) ? defaultOrderBy[view] : 'cost');
      if (sortCol) {
        query = query.order(sortCol, { ascending: order_dir === 'asc' });
      }
      query = query.range(offset, offset + limit - 1);

      const { data: rows, count, error: qErr } = await query;
      if (qErr) throw qErr;

      let totCost = 0;
      let totConvs = 0;
      let totClicks = 0;
      let totImpr = 0;

      (rows || []).forEach((row: any) => {
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
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        return res.status(500).json({ error: e.message, disponible: false });
    }
  });


  
  app.get("/api/annotations", async (req, res) => {
    
    
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });
    
    const client = req.query.client as string;
    if (!client) return res.status(400).json({ error: 'Client required' });

    
    
    // Fetch manual annotations
    const { data: manual, error: err1 } = await supabase.from('annotations')
       .select('*')
       .eq('account', client);
       
    // Fetch system change annotations
    const { data: system, error: err2 } = await supabase.from('v_change_annotations')
       .select('*')
       .eq('account', client);
       
    if (err1) console.error(err1);
    if (err2) console.error(err2);

    return res.json({ manual: manual || [], system: system || [] });
  });

  app.post("/api/annotations", async (req, res) => {
    
    
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });
    
    
    const { account, fecha, titulo, tipo, detalle } = req.body;
    const { data, error } = await supabase.from('annotations').insert([{
       account, fecha, titulo, tipo, detalle, creado_por: 'Analista'
    }]).select();
    
    if (error) return res.status(500).json({ error: error.message || error });
    res.json({ success: true, data });
  });

  app.get("/api/notion/briefs", async (req, res) => {
    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion = new NotionClient({ auth: notionKey });
      
      const response = await notion.databases.query({
        database_id: NOTION_BASES.BRIEFS,
        page_size: 50,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
      });
      const data = await Promise.all(response.results.map(async (page: any) => {
        const client = await resolveNotionClient(notion, page.properties.Cliente || page.properties.Client);
        const props = page.properties;
        return {
          id: page.id,
          client: client,
          title: props.Brief?.title?.map((rt: any) => rt.plain_text).join('') || 'Untitled Brief',
          headline: props.Titular?.rich_text?.map((rt: any) => rt.plain_text).join('') || 'No headline available',
          status: props.Estado?.select?.name || 'Unknown',
          spend: props.Gasto?.number || 0,
          cpa: props.CPA?.number || 0,
          conversions: props.Conversiones?.number || 0,
          highAlerts: props['Alertas ALTA']?.number || 0,
          semana: props.Semana?.date?.start || null,
          brief_anterior: props['Brief anterior']?.relation?.[0]?.id || null,
          brief_siguiente: props['Brief siguiente']?.relation?.[0]?.id || null,
          handoff: props.Handoff?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          lecciones: props.Lecciones?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          dias_provisionales: props['Dias provisionales']?.number || 0,
          url: page.url,
          created_at: page.created_time
        };
      }));
      res.json({ data });
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/notion/actionables", async (req, res) => {
    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion = new NotionClient({ auth: notionKey });
      
      const response = await notion.databases.query({
        database_id: NOTION_BASES.ACCIONABLES,
        page_size: 50,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
      });
      const data = await Promise.all(response.results.map(async (page: any) => {
        const client = await resolveNotionClient(notion, page.properties.Cliente || page.properties.Client);
        const props = page.properties;
        // Sin comments.list por pagina: eran 50 llamadas por carga y Notion limita a 3/s. El drawer los pide al abrir.
        let comments_count = 0;
        return {
          id: page.id,
          client: client,
          title: props.Accion?.title?.map((rt: any) => rt.plain_text).join('') || 'Untitled',
          status: props.Estado?.select?.name || NOTION_STATES.PROPUESTO,
          priority: props.Prioridad?.select?.name || 'Medium',
          why: props['Por que']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          where: props.Donde?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          tags: props.Etiquetas?.multi_select?.map((ms: any) => ms.name) || props.Tags?.multi_select?.map((ms: any) => ms.name) || [],
          revision_ia: props['Revision IA']?.select?.name || NOTION_REVISION_IA.SIN_REVISAR,
          punto_disputa: props['Punto en disputa']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          decision_final: props['Decision final']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          ejecutado_el: props['Ejecutado el']?.date?.start || null,
          resultado_observado: props['Resultado observado']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          detectado: props['Detectado']?.date?.start || page.created_time,
          naturaleza: props.Naturaleza?.select?.name || 'Observacion',
          que_lo_confirmaria: props['Que lo confirmaria']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          como_hacerlo: props['Como hacerlo']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          origen: props['Origen']?.select?.name || '',
          accion_json: props['Accion JSON']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          entidad: props['Entidad']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          vence: props['Vence']?.date?.start || null,
          reemplazado_por: props['Reemplazado por']?.relation?.[0]?.id || null,
          last_edited: page.last_edited_time,
          causa_raiz: props['Causa raiz']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          relacionado_con: props['Relacionado con']?.relation?.map((rel: any) => rel.id) || [],
          semanas_pendiente: props['Semanas pendiente']?.number ?? (props['Semanas pendiente']?.formula?.number ?? 0),
          comments_count,
          created_at: page.created_time,
          url: page.url
        };
      }));
      // La app oculta los reemplazados; el resto los ve
      const { parsearAccion } = await import('./src/lib/accion');
      for (const a of data as any[]) { const p = parsearAccion(a.accion_json); a.accion = p.accion || null; a.accion_error = p.error || null; }
      const visibles = data.filter((a: any) => !a.reemplazado_por);
      res.json({ data: visibles });
      // Espejo en Supabase: permite dedupe por entidad y reconciliacion en SQL. Fire-and-forget.
      if (supabase) supabase.from('accionables_espejo').upsert(data.map((a: any) => ({
        notion_id: a.id, account: a.client, titulo: a.title, estado: a.status, prioridad: a.priority, naturaleza: a.naturaleza, origen: a.origen || null,
        entidad: a.entidad || null, causa_raiz: a.causa_raiz || null, por_que: (a.why || '').slice(0, 1000), detectado: a.detected || null, ejecutado_el: a.ejecutado_el || null,
        vence: a.vence, reemplazado_por: a.reemplazado_por, semanas_pendiente: a.weeks_pending ?? null, revision_ia: a.revision_ia || null, ultima_edicion: a.last_edited, sincronizado: new Date().toISOString(),
        accion: a.accion || null, accion_valida: !!a.accion, accion_error: a.accion_error || null
      })), { onConflict: 'notion_id' }).then(({ error }: any) => { if (error) console.error('[espejo] ' + error.message); });
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        res.status(500).json({ error: e.message });
    }
  });
  
  app.get("/api/notion/actionables/:id/comments", async (req, res) => {
    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion = new NotionClient({ auth: notionKey });
      const response = await notion.comments.list({ block_id: req.params.id });
      
      const comments = response.results.map((comment: any) => ({
        id: comment.id,
        text: comment.rich_text.map((rt: any) => rt.plain_text).join(''),
        created_at: comment.created_time,
        author: comment.created_by?.name || 'Unknown'
      }));
      
      res.json({ comments });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });


  app.post("/api/notion/actionables/:id/analyze", async (req, res) => {
    const { action, force } = req.body;
    if (!action) return res.status(400).json({ error: 'Action data is required' });

    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.status(500).json({ error: "Missing NOTION_API_KEY" });

    const notion = new NotionClient({ auth: notionKey });

    // Verificación de duplicado: si ya fue analizado previamente por Gemini y no se fuerza
    if (!force) {
      try {
        const commentRes = await notion.comments.list({ block_id: req.params.id });
        const prev = commentRes.results?.find((c: any) => {
          const t = c.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
          return t.includes('[SEGUNDA OPINIÓN IA') || t.includes('[SEGUNDA OPINION IA') || t.includes('SEGUNDA OPINIÓN IA');
        });
        if (prev) {
          const prevDate = prev.created_time ? new Date(prev.created_time).toLocaleDateString('es-ES') : 'previa';
          return res.status(409).json({
            requiresConfirmation: true,
            previousDate: prevDate,
            message: `Este accionable ya fue analizado por Gemini (${prevDate}). ¿Deseas volver a analizarlo?`
          });
        }
      } catch (errCheck) {
        // Ignorar si falla lectura previa de comentarios
      }
    }

    try {
      const client = action.client || 'Unknown';
      if (client === 'Unknown') {
        return res.status(400).json({ error: 'No se pudo identificar el cliente del accionable.' });
      }

      // Step A & B: Inject client context
      const contextStr = getClientContext(client);

      // Step C: Provide real data (summarized to avoid massive prompt)
      let weeklySummary = "No se pudieron obtener datos detallados de la semana.";
      try {
        
        
        if(!supabase) throw new Error('No supabase credentials');
        
        const perfil = (await cuentasActivas()).find(c => c.account === client)?.perfil_analisis;
        const { data: pkg } = await supabase.rpc(perfil === 'cadena' ? 'get_weekly_package_cadena' : 'get_weekly_package', { p_account: client });
        if (pkg && pkg.length > 0) {
           // Provide a summarized version to Gemini to keep tokens low
           const state = pkg[0].estado_estructural ? JSON.stringify(pkg[0].estado_estructural).substring(0, 500) : '';
           const alerts = pkg[0].alertas_altas ? JSON.stringify(pkg[0].alertas_altas).substring(0, 500) : '';
           const metrics = pkg[0].tendencia_8_semanas ? JSON.stringify(pkg[0].tendencia_8_semanas).substring(0, 500) : '';
           weeklySummary = `Estado: ${state}\nAlertas: ${alerts}\nMétricas recientes: ${metrics}`;
        }
      } catch(e) { console.error("Error fetching weekly package", e); }

      // Step C.2: Historical similarity matching
      let historicalContext = "No se encontraron decisiones pasadas similares.";
      try {
         
         
         if (supabase) {
            const tempAi = ai;
            const textToEmbed = `Título: ${action.title || ''}\nJustificación: ${action.why || ''}\nResolución: ${action.where || ''}`;
            const embedRes = await tempAi.models.embedContent({
               model: 'text-embedding-004',
               contents: textToEmbed
            });
            const embedding = embedRes.embeddings[0].values;
            
            const { data: matches } = await supabase.rpc('match_actionables', {
               query_embedding: embedding,
               match_threshold: 0.78,
               match_count: 2
            });
            if (matches && matches.length > 0) {
               historicalContext = matches.map((m: any) => `- Título: ${m.title}\n  Justificación: ${m.justificacion}\n  Resolución: ${m.resolucion}`).join('\n\n');
            }
         }
      } catch (e) { console.error("Error fetching historical matches", e); }

      // Step D: The 4-dimension Rubric
      
      const prompt = `Sos analista senior de Google Ads. Otro analista propuso el accionable de abajo. Tu trabajo es dar una SEGUNDA OPINIÓN, no repetir la primera.

${contextStr}

CONTEXTO HISTÓRICO: Decisiones pasadas similares: ${historicalContext}
DATOS DE LA SEMANA: ${weeklySummary}

ACCIONABLE PROPUESTO POR EL PRIMER ANALISTA:
Título: ${action.title || 'N/A'}
Hipótesis: ${action.why || 'N/A'}
Ubicación: ${action.where || 'N/A'}
Prioridad asignada: ${action.priority || 'N/A'}

Evaluá exactamente estas cuatro dimensiones, nada más:
1. FUNDAMENTO  ¿los datos respaldan la hipótesis?
2. EJECUCIÓN   ¿las instrucciones son correctas y completas?
3. RIESGO      ¿qué puede salir mal y qué se pierde al ejecutar?
4. PRIORIDAD   ¿el orden asignado es el adecuado?

Respondé en texto plano, sin markdown, con este formato:
VEREDICTO: [COINCIDO / COINCIDO CON RESERVAS / DISCREPO / DATOS INSUFICIENTES]

FUNDAMENTO [2 o 3 frases citando datos concretos.]
EJECUCIÓN [Qué falta o qué corregirías de las instrucciones.]
RIESGO [Qué puede salir mal. Si no hay riesgo relevante, decilo.]
PRIORIDAD [De acuerdo o no con el orden, y por qué]

SI DISCREPO: EN QUÉ EXACTAMENTE
[Una línea. El punto preciso del desacuerdo, no un resumen. Si no discrepás, podés omitir esta sección.]`;

      let aiResponse;
      let analysisText = '';
      let retries = 3;
      let delay = 2000;
      let lastErrorReason = '';

      while (retries > 0) {
        try {
          aiResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt
          });
          analysisText = aiResponse.text || '';
          break;
        } catch (err: any) {
          lastErrorReason = err.message || err.toString();
          const errStr = String(err).toLowerCase() + ' ' + lastErrorReason.toLowerCase();
          const isQuota = errStr.includes('quota') || errStr.includes('resource_exhausted') || errStr.includes('429');
          if (isQuota) {
            lastErrorReason = 'Cuota excedida de la API de Gemini (429 / Resource Exhausted)';
            break;
          }
          const is503 = errStr.includes('503') || errStr.includes('unavailable') || errStr.includes('high demand');
          if (is503) {
            retries--;
            if (retries === 0) {
              lastErrorReason = 'Servicio no disponible / Alta demanda (503)';
              break;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            break;
          }
        }
      }

      if (!analysisText) {
        return res.status(503).json({
          error: 'El análisis no se pudo completar',
          reason: lastErrorReason || 'Gemini no devolvió respuesta',
          retryable: true
        });
      }

      // Parse verdict and update Notion
      const veredictoMatch = analysisText.match(/VEREDICTO:\s*(.*)/i);
      const veredicto = veredictoMatch ? veredictoMatch[1].trim() : '';
      
      let revisionStatus = NOTION_REVISION_IA.ANALIZADO as string;
      let puntoDisputa = '';
      
      if (veredicto.includes('DISCREPO')) {
         revisionStatus = NOTION_REVISION_IA.EN_DISPUTA as string;
         const discrepoMatch = analysisText.match(/SI DISCREPO: EN QUÉ EXACTAMENTE\s*\n(.*)/i);
         if (discrepoMatch) {
            puntoDisputa = discrepoMatch[1].trim();
         }
      }

      const notion = new NotionClient({ auth: notionKey });
      
      const propertiesToUpdate: any = {
        'Revision IA': { select: { name: revisionStatus } }
      };
      
      if (puntoDisputa) {
        propertiesToUpdate['Punto en disputa'] = { 
          rich_text: [{ text: { content: puntoDisputa.substring(0, 2000) } }] 
        };
      }

      try {
        await notion.pages.update({
          page_id: req.params.id,
          properties: propertiesToUpdate
        });
      } catch (notionErr: any) {
        console.error("Error updating Notion page properties:", notionErr);
        // Continue anyway to try posting the comment
      }

      // Post comment (handling the 2000 character limit)
      const prefix = "[SEGUNDA OPINIÓN IA · no es una decisión]\n\n";
      const fullText = prefix + analysisText;
      
      const MAX_LENGTH = 1900;
      const blocks = [];
      let resto = fullText;
      while (resto.length > MAX_LENGTH) {
        let corte = resto.lastIndexOf('\n', MAX_LENGTH);
        if (corte < MAX_LENGTH * 0.5) corte = MAX_LENGTH;
        blocks.push({ text: { content: resto.slice(0, corte) } });
        resto = resto.slice(corte);
      }
      if (resto) blocks.push({ text: { content: resto } });

      try {
        const commentResponse = await notion.comments.create({
          parent: { page_id: req.params.id },
          rich_text: blocks
        });
      } catch (commentErr: any) {
        console.error("Error posting Notion comment:", commentErr);
        throw new Error("No se pudo publicar el comentario en Notion: " + (commentErr.message || commentErr.toString()));
      }
      
      res.json({ success: true, analysis: analysisText });
    } catch (e: any) {
      console.error('Error analyzing actionable:', e);
      res.status(500).json({ error: e.message || e.toString() });
    }
  });

  app.post("/api/notion/actionables/:id/comments", async (req, res) => {
    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion = new NotionClient({ auth: notionKey });
      const { text } = req.body;
      
      if (!text) return res.status(400).json({ error: 'Text is required' });
      
      const response = await notion.comments.create({
        parent: { page_id: req.params.id },
        rich_text: [{ text: { content: `[ANDRES ${new Date().toISOString().slice(0, 10)}] ${text}` } }]
      });
      // Espejo: los comentarios de Andres no generan novedad
      if (supabase) { try { await supabase.from('accionable_comentarios').upsert({ comment_id: (response as any).id, notion_id: req.params.id, autor: 'andres', prefijo: 'ANDRES', texto: text, creado: new Date().toISOString() }, { onConflict: 'comment_id' }); } catch {} }
      res.json({ success: true, comment: response });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

    
  app.put("/api/notion/actionables/:id", async (req, res) => {
    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.status(500).json({ error: "Missing NOTION_API_KEY" });
    try {
      const notion = new NotionClient({ auth: notionKey });
      const { 
        status, resolutionNote, ejecutado_el, resultado_observado,
        naturaleza, que_lo_confirmaria, causa_raiz, confirmar_hipotesis, prioridad
      } = req.body;
      
      const properties: any = {};
      if (prioridad) properties['Prioridad'] = { select: { name: prioridad } };
      const targetStatus = confirmar_hipotesis ? NOTION_STATES.PROPUESTO : status;
      if (targetStatus) {
        properties['Estado'] = {
          select: {
            name: targetStatus
          }
        };
      }

      if (resolutionNote !== undefined) {
        properties['Decision final'] = {
          rich_text: [{ text: { content: resolutionNote.substring(0, 2000) } }]
        };
      }

      if (ejecutado_el !== undefined) {
        properties['Ejecutado el'] = ejecutado_el ? { date: { start: ejecutado_el } } : null;
      }

      if (resultado_observado !== undefined) {
        properties['Resultado observado'] = {
          rich_text: [{ text: { content: (resultado_observado || '').substring(0, 2000) } }]
        };
      }

      if (naturaleza !== undefined) {
        properties['Naturaleza'] = {
          select: { name: naturaleza }
        };
      }

      if (que_lo_confirmaria !== undefined) {
        properties['Que lo confirmaria'] = {
          rich_text: [{ text: { content: (que_lo_confirmaria || '').substring(0, 2000) } }]
        };
      }

      if (causa_raiz !== undefined) {
        properties['Causa raiz'] = {
          rich_text: [{ text: { content: (causa_raiz || '').substring(0, 2000) } }]
        };
      }

      const response = await notion.pages.update({
        page_id: req.params.id,
        properties
      });

      // Si se confirma una hipótesis/inferencia en Bloqueado, agregar comentario fechado
      if (confirmar_hipotesis) {
        const todayStr = new Date().toISOString().split('T')[0];
        try {
          await notion.comments.create({
            parent: { page_id: req.params.id },
            rich_text: [{ text: { content: `[CONFIRMACIÓN OPERADOR ${todayStr}] Hipótesis/Inferencia confirmada por Andrés. Pasa a Propuesto.` } }]
          });
        } catch (comErr) {
          console.error("Error creating confirmation comment:", comErr);
        }
      }

      // Module 1: Semantic memory insertion & Anti-Amnesia Cooldown
      if (targetStatus === NOTION_STATES.HECHO && req.body.actionable) {
        const actionable = req.body.actionable;
        
        if (supabase) {
          // 1. Cooldown insert
          try {
            const entityName = actionable.where || actionable.title || 'Unknown Entity';
            const cooldownDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('entity_states').insert([{
              account: actionable.client,
              entity_name: entityName,
              cooldown_until: cooldownDate
            }]);
            console.log("Cooldown applied for entity:", entityName);
          } catch(err) {
            console.error("Error applying cooldown", err);
          }

          // 2. Semantic memory
          if (ai) {
            try {
              const textToEmbed = `Título: ${actionable.title || ''}\nJustificación: ${actionable.why || ''}\nResolución: ${actionable.where || ''}\nNota: ${resolutionNote || ''}`;
              const embedRes = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: textToEmbed
              });
              const embedding = embedRes.embeddings[0].values;
              await supabase.from('actionables_memory').insert([{
                notion_id: req.params.id,
                client: actionable.client,
                title: actionable.title,
                justificacion: actionable.why,
                resolucion: actionable.where,
                embedding: embedding
              }]);
              console.log("Memory vector saved for actionable:", req.params.id);
            } catch(err) {
              console.error("Error creating memory embedding", err);
            }
          }
        }
      }

      res.json({ success: true, data: response });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/notion/actionables/:id/recent_changes", async (req, res) => {
    try {
      const client = req.query.client as string;
      if (!client) return res.status(400).json({ error: 'Client required' });
      
      if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });
      
      // Consultar v_todos_los_cambios con las 3 fuentes (change_events, snapshot, operador)
      const { data, error } = await supabase
        .from('v_todos_los_cambios')
        .select('*')
        .ilike('account', client)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false })
        .limit(30);
        
      if (error) {
        console.error("Error consultando v_todos_los_cambios:", error);
        return res.json({ changes: [] });
      }
      res.json({ changes: data || [] });
    } catch(e) {
      res.json({ changes: [] });
    }
  });

  // Endpoint para registrar cambios manuales del operador
  app.post("/api/operator_log", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase missing' });
    try {
      const { account, que_cambio, donde, valor_anterior, valor_nuevo, por_que, accionable_notion_id } = req.body;
      if (!account || !que_cambio) {
        return res.status(400).json({ error: 'account y que_cambio son requeridos' });
      }
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toTimeString().split(' ')[0];

      const { data, error } = await supabase.from('operator_log').insert([{
        account,
        fecha: today,
        hora: nowTime,
        que_cambio,
        donde: donde || 'conversiones',
        valor_anterior: valor_anterior || null,
        valor_nuevo: valor_nuevo || null,
        por_que: por_que || '',
        accionable_notion_id: accionable_notion_id || null
      }]).select();

      if (error) {
        console.error("Error insertando en operator_log:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        res.status(500).json({ error: e.message });
    }
  });

  // Fetch page blocks (for full brief content)
  const getPageBlocksHandler = async (req: any, res: any) => {
    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return res.json({ blocks: [], error: "Missing NOTION_API_KEY" });
    try {
      const notion = new NotionClient({ auth: notionKey });
      const response = await notion.blocks.children.list({ block_id: req.params.id, page_size: 100 });
      
      // Simple block to text mapping for preview purposes
      const blocks = response.results.map((block: any) => {
        let text = '';
        let type = block.type;
        if (block[type]?.rich_text) {
          text = block[type].rich_text.map((rt: any) => rt.plain_text).join('');
        }
        return { type, text };
      });
      
      res.json({ blocks });
    } catch (e: any) {
      console.warn('Failed to fetch Notion blocks:', e.message);
      res.json({ blocks: [], error: e.message });
    }
  };

  app.get("/api/notion/page/:id/blocks", getPageBlocksHandler);
  app.get("/api/notion/briefs/:id/blocks", getPageBlocksHandler);

  
  

  app.post("/api/mutations/revert", async (req, res) => {
    try {
      const { actionable } = req.body;
      
      
      
      if (supabase) {
         
         await supabase.from('pending_mutations').insert([{
            action_type: 'UNDO_CHANGE',
            campaign_name: actionable.where || '',
            keyword_text: actionable.title || '',
            status: 'APPROVED',
            client: actionable.client
         }]);
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error(`[500] ${(req as any)?.method || ""} ${(req as any)?.originalUrl || ""} — ${e.message}`);
        res.status(500).json({ error: e.message });
    }
  });

  // Module 2: Generador de RSA con Compliance Guard
  app.post("/api/generate-rsa", async (req, res) => {
    try {
      const { client, searchTerms } = req.body;
      
      if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

      let complianceRule = "";
      if (client === 'BHI') {
        complianceRule = "REGLA ESTRICTA DE COMPLIANCE PARA BHI: PROHIBIDO USAR las palabras 'póliza', 'seguro', 'vender', o 'contratar'. El texto será rechazado si contiene estas palabras.";
      }

      
      
      const rsaSchemaConfig = {
        type: "OBJECT",
        properties: {
          headlines: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Lista de 3 a 5 títulos para el anuncio, máximo 30 caracteres cada uno."
          },
          descriptions: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Lista de 2 a 4 descripciones para el anuncio, máximo 90 caracteres cada una."
          }
        },
        required: ["headlines", "descriptions"]
      };

      const { termMetrics, topAssets } = req.body as { termMetrics?: any[]; topAssets?: any[] };
      const metricsTxt = Array.isArray(termMetrics) && termMetrics.length
        ? '\n\nMétricas de esos términos (conversiones, clics, gasto):\n' + termMetrics.map((m: any) => `- "${m.term}": ${m.conv} conv, ${m.clicks} clics, ${m.cost} gasto`).join('\n')
        : '';
      const assetsTxt = Array.isArray(topAssets) && topAssets.length
        ? '\n\nAssets actuales que Google califica por rendimiento (no repetir los BEST literalmente; superar los LOW):\n' + topAssets.map((a: any) => `- [${a.label}] ${a.tipo}: "${a.texto}"`).join('\n')
        : '';
      const rules = getClientContext(client) || '';
      const prompt = `Actúa como un experto en Google Ads. Genera textos para un Responsive Search Ad (RSA) basado en estos términos de búsqueda exitosos: ${searchTerms.join(', ')}.${metricsTxt}${assetsTxt}\n\nReglas de la cuenta:\n${rules}\n\nPriorizá los términos con más conversiones. Cada headline debe ser distinto en ángulo, no en sinónimos.
${complianceRule}
Los títulos no deben superar los 30 caracteres.
Las descripciones no deben superar los 90 caracteres.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: rsaSchemaConfig as any,
        }
      });
      
      if (!response.text) throw new Error("No response text");
      
      // Zod Validation Estricta
      const rsaZodSchema = z.object({
        headlines: z.array(z.string()),
        descriptions: z.array(z.string())
      });

      const parsedData = rsaZodSchema.parse(JSON.parse(response.text));
      
      // Enforce limits with JS truncation
      const result = {
        headlines: parsedData.headlines.map(h => h.length > 30 ? h.substring(0, 30) : h),
        descriptions: parsedData.descriptions.map(d => d.length > 90 ? d.substring(0, 90) : d)
      };

      res.json({ success: true, data: result });

    } catch (e: any) {
      console.error('Error generating RSA:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Module 3: CRM Webhooks
  app.use('/api/webhooks', webhooksRouter);

  // Explicit 404 handler for all unmatched API routes to prevent returning HTML index.html

  // Vite middleware for development


  // ================================================================
  // INTELIGENCIA: anomalías, objetivos, escalera de valor
  // ================================================================

  // Anomalías diarias con explicación: alimenta el gráfico de Semana
  app.get("/api/anomalias", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      const days = Number(req.query.days) || 14;
      if (!client) return res.status(400).json({ error: 'client requerido' });
      const from = new Date(); from.setDate(from.getDate() - days);
      const fromStr = from.toISOString().slice(0, 10);

      const [serie, explicadas] = await Promise.all([
        supabase.from('v_anomalias_diarias').select('*').eq('account', client).gte('date', fromStr).order('date'),
        supabase.from('v_anomalia_explicada').select('*').eq('account', client).gte('date', fromStr).order('date')
      ]);
      if (serie.error) return res.status(500).json({ error: serie.error.message });

      // Título como hallazgo: la frase que el usuario debería sacar del gráfico
      const criticas = (explicadas.data || []).filter((a: any) => a.severidad === 'critica');
      const altas = (explicadas.data || []).filter((a: any) => a.severidad === 'alta');
      const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
      let titulo = `${days} días dentro de lo normal`;
      if (criticas.length) {
        const dias = criticas.map((a: any) => fmt(a.date)).join(' y ');
        const met = criticas[0].metrica_anomala || 'gasto';
        const dir = criticas[0][met === 'cpa' ? 'cpa_direccion' : 'gasto_direccion'] === 'sube' ? 'se disparó' : 'se derrumbó';
        titulo = `${met.toUpperCase()} ${dir} ${dias}: ${criticas[0].explicacion.toLowerCase()}`;
      } else if (altas.length) {
        titulo = `${altas.length} día(s) fuera de lo habitual: ${altas[0].explicacion.toLowerCase()}`;
      }

      res.json({ serie: serie.data, anomalias: explicadas.data || [], titulo });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });



  // Conversiones por grupo y día: en qué grupo cayeron. Desde script v3 (6 sep).
  app.get("/api/conversiones-grupo", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      const days = Number(req.query.days) || 14;
      const desde = new Date(); desde.setDate(desde.getDate() - days);
      const { data, error } = await supabase.from('v_conversiones_por_grupo')
        .select('date, ad_group, conversion_action, conversions, madurez')
        .eq('account', client).gte('date', desde.toISOString().slice(0, 10)).order('date');
      if (error) return res.status(500).json({ error: error.message });
      // Pivot: fecha × grupo
      const grupos = Array.from(new Set((data || []).map((r: any) => r.ad_group))).sort();
      const porFecha: Record<string, any> = {};
      for (const r of data || []) {
        porFecha[r.date] = porFecha[r.date] || { date: r.date, madurez: r.madurez };
        porFecha[r.date][r.ad_group] = (porFecha[r.date][r.ad_group] || 0) + Number(r.conversions);
      }
      // Hallazgo: grupo que se apagó (convertía y dejó de hacerlo 2+ días)
      const filas = Object.values(porFecha).sort((a: any, b: any) => a.date.localeCompare(b.date));
      const apagados: string[] = [];
      for (const g of grupos) {
        const serie = filas.map((f: any) => f[g] || 0);
        const conConv = serie.filter(v => v > 0).length;
        if (conConv >= 3) {
          let racha = 0, maxRacha = 0;
          for (const v of serie) { racha = v === 0 ? racha + 1 : 0; maxRacha = Math.max(maxRacha, racha); }
          if (maxRacha >= 2) apagados.push(`${g} (${maxRacha} días seguidos en cero)`);
        }
      }
      res.json({ grupos, filas, hallazgo: apagados.length ? `Se apagó: ${apagados.join('; ')}` : null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Mapa de calor hora x día de la última semana cerrada
  app.get("/api/hora-dia", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      if (!client) return res.status(400).json({ error: 'client requerido' });
      const { data, error } = await supabase.from('v_hora_dia').select('*').eq('account', client).order('dow_num').order('hour');
      if (error) return res.status(500).json({ error: error.message });
      const rows = data || [];
      // Hallazgos: mejor y peor franja
      const conConv = rows.filter((r: any) => Number(r.conversiones) > 0);
      const sinConv = rows.filter((r: any) => Number(r.gasto) > 0 && Number(r.conversiones) === 0);
      const mejor = conConv.sort((a: any, b: any) => Number(a.cpa) - Number(b.cpa))[0];
      const peor = sinConv.sort((a: any, b: any) => Number(b.gasto) - Number(a.gasto))[0];
      res.json({
        celdas: rows,
        semana: rows[0]?.week_start,
        mejor: mejor ? { dia: mejor.dia, hora: mejor.hour, cpa: mejor.cpa, conv: mejor.conversiones } : null,
        peor_sin_conv: peor ? { dia: peor.dia, hora: peor.hour, gasto: peor.gasto } : null
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Assets RSA con etiqueta de rendimiento de Google (BEST / GOOD / LOW / LEARNING)
  app.get("/api/rsa-assets", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      const { data, error } = await supabase.from('rsa_assets').select('field_type, asset_text, performance_label, impressions, clicks, ctr, conversions, ad_group')
        .eq('account', client).order('conversions', { ascending: false }).limit(60);
      if (error) return res.status(500).json({ error: error.message });
      // Los BEST primero, después por conversiones
      const rank: Record<string, number> = { BEST: 0, GOOD: 1, LEARNING: 2, LOW: 3 };
      res.json((data || []).sort((a: any, b: any) => (rank[a.performance_label] ?? 9) - (rank[b.performance_label] ?? 9) || Number(b.conversions) - Number(a.conversions)));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });


  // Entidades por rango: como Google Ads. Cualquier rango de fechas, desde la capa diaria.
  app.get("/api/entidades/:entidad", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const { entidad } = req.params;
      const client = (req.query.client as string) || (req.query.account as string);
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!client || !from || !to) return res.status(400).json({ error: 'client, from y to son obligatorios' });
      const { data, error } = await supabase.rpc('get_entidades', {
        p_entidad: entidad, p_account: client, p_from: from, p_to: to,
        p_search: (req.query.search as string) || null,
        p_order_by: (req.query.orderBy as string) || 'cost',
        p_order_dir: (req.query.orderDir as string) || 'desc',
        p_limit: Number(req.query.limit) || 1000,
        p_offset: Number(req.query.offset) || 0
      });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Objetivos y headroom: dónde está la cuenta respecto de lo que el negocio necesita
  app.get("/api/objetivos", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      const q = (t: string) => client ? supabase.from(t).select('*').eq('account', client) : supabase.from(t).select('*');
      const [targets, headroom, proyeccion] = await Promise.all([
        q('account_targets'), q('v_headroom'), q('v_proyeccion_escalamiento')
      ]);
      res.json({
        targets: targets.data || [],
        headroom: headroom.data || [],
        proyeccion: proyeccion.data || []
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Editar objetivos: al hacerlo, el origen pasa a 'negocio'
  app.put("/api/objetivos/:account", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const { account } = req.params;
      const { conversiones_mes_objetivo, cpa_maximo, presupuesto_mes_maximo, ciclo_venta_dias, notas } = req.body;
      const patch: any = { actualizado: new Date().toISOString(), actualizado_por: 'Andres (app)' };
      if (conversiones_mes_objetivo != null) { patch.conversiones_mes_objetivo = conversiones_mes_objetivo; patch.conversiones_mes_origen = 'negocio'; }
      if (cpa_maximo != null) { patch.cpa_maximo = cpa_maximo; patch.cpa_maximo_origen = 'negocio'; }
      if (presupuesto_mes_maximo != null) patch.presupuesto_mes_maximo = presupuesto_mes_maximo;
      if (ciclo_venta_dias != null) patch.ciclo_venta_dias = ciclo_venta_dias;
      if (notas != null) patch.notas = notas;
      const { data, error } = await supabase.from('account_targets').update(patch).eq('account', account).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Escalera de valor: qué ve Smart Bidding y qué debería ver
  app.get("/api/escalera", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      const q = (t: string) => client ? supabase.from(t).select('*').eq('account', client) : supabase.from(t).select('*');
      const [etapas, recomendada, pendientes] = await Promise.all([
        q('v_escalera_valor').order('stage_order'),
        q('v_primaria_recomendada'),
        q('v_pendientes_subir_google')
      ]);
      res.json({
        etapas: etapas.data || [],
        recomendada: recomendada.data?.[0] || null,
        pendientes_subir: pendientes.data || []
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Registro del operador: el sensor humano
  app.post("/api/operator-log", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const { account, que_cambio, donde, valor_anterior, valor_nuevo, por_que, accionable_notion_id } = req.body;
      if (!account || !que_cambio) return res.status(400).json({ error: 'account y que_cambio son obligatorios' });
      const { data, error } = await supabase.from('operator_log').insert({
        account, que_cambio, donde: donde || 'otro', valor_anterior, valor_nuevo, por_que, accionable_notion_id
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/operator-log", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      let q = supabase.from('operator_log').select('*').order('fecha', { ascending: false }).limit(30);
      if (client) q = q.eq('account', client);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Cambios con nombre de entidad resuelto: para el cruce con accionables
  app.get("/api/cambios", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      const days = Number(req.query.days) || 10;
      const from = new Date(); from.setDate(from.getDate() - days);
      const fromStr = from.toISOString().slice(0, 10);
      let q = supabase.from('v_todos_los_cambios').select('*').gte('fecha', fromStr).order('fecha', { ascending: false }).limit(60);
      if (client) q = q.eq('account', client);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Cierres totales: negocio real, atribuible o no
  app.get("/api/cierres", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const client = req.query.client as string;
      let q = supabase.from('v_cierres_totales').select('*').order('event_date', { ascending: false });
      if (client) q = q.eq('client', client);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      const total = (data || []).reduce((a: number, r: any) => a + Number(r.monto || 0), 0);
      const atribuido = (data || []).filter((r: any) => r.tipo === 'atribuido').reduce((a: number, r: any) => a + Number(r.monto || 0), 0);
      res.json({ cierres: data || [], total, atribuido, sin_atribucion: total - atribuido });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Scorecard de corridas: si el sistema mejora o se degrada
  app.get("/api/scorecard", async (_req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const [runs, tendencia] = await Promise.all([
        supabase.from('v_run_scorecard').select('*').order('run_date', { ascending: false }).limit(30),
        supabase.from('v_run_tendencia').select('*')
      ]);
      res.json({ corridas: runs.data || [], tendencia: tendencia.data || [] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/scorecard/:id", async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
      const { revision_humana } = req.body;
      const { data, error } = await supabase.from('run_quality')
        .update({ revision_humana, revision_humana_fecha: new Date().toISOString().slice(0, 10) })
        .eq('id', req.params.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Trabajador autónomo: detección de anomalías y creación de accionables.
  // En Vercel no hay proceso persistente: lo dispara Vercel Cron (vercel.json)
  // llamando este endpoint. En local se puede invocar a mano.
  app.all("/api/cron/anomalias", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    // Si llego hasta aca, paso el middleware: con CRON_SECRET (Vercel Cron, pg_net),
    // con sesion de la app (prueba manual desde el navegador) o con APP_ACCESS_TOKEN.
    try {
      const r = await runAnomalyWorker();
      res.json({ ok: true, ran_at: new Date().toISOString(), ...r });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });



  // ================================================================
  // CICLO DE APRENDIZAJE SEMANAL: evaluar, diagnosticar, actualizar
  // ================================================================
  // Vercel Cron, lunes 05:30 UTC (antes de las tareas semanales). Cierra el
  // ciclo sin intervencion: sincroniza accionables Hechos desde Notion,
  // calcula su impacto, actualiza los parametros estimados con los reales.
  app.all("/api/cron/aprendizaje", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    // Si llego hasta aca, paso el middleware: con CRON_SECRET (Vercel Cron, pg_net),
    // con sesion de la app (prueba manual desde el navegador) o con APP_ACCESS_TOKEN.
    const resultado: any = { ran_at: new Date().toISOString() };
    try {
      // 1. Sincronizar accionables Hechos con Ejecutado el desde Notion
      if (notion && NOTION_BASES.ACCIONABLES) {
        const pages: any[] = [];
        let cursor: string | undefined;
        do {
          const r: any = await notion.databases.query({
            database_id: NOTION_BASES.ACCIONABLES,
            filter: { and: [ { property: 'Estado', select: { equals: NOTION_STATES.HECHO } }, { property: 'Ejecutado el', date: { is_not_empty: true } } ] },
            start_cursor: cursor, page_size: 100
          });
          pages.push(...r.results); cursor = r.has_more ? r.next_cursor : undefined;
        } while (cursor);

        const filas = [];
        for (const page of pages) {
          const p = page.properties;
          const titulo = p.Accion?.title?.map((t: any) => t.plain_text).join('') || '';
          const client = await resolveNotionClient(notion, p.Cliente || p.Client);
          const verificar = (p['Por que']?.rich_text?.map((t: any) => t.plain_text).join('') || '') + ' ' + titulo;
          // Inferir metrica y direccion del texto del accionable
          const low = (titulo + ' ' + verificar).toLowerCase();
          const metrica = /cpa|costo por/.test(low) ? 'cpa' : /conversi/.test(low) ? 'conversiones' : /ctr/.test(low) ? 'ctr' : /gasto|presupuesto|budget/.test(low) ? 'gasto' : /clic/.test(low) ? 'clics' : null;
          const direccion = /baj|reduc|recort|pausar|quitar|negativ|elimin/.test(low) ? 'baja' : /sub|aument|activ|agregar|crear|escal/.test(low) ? 'sube' : (metrica === 'cpa' ? 'baja' : 'sube');
          filas.push({
            notion_id: page.id, account: client || 'DESCONOCIDO', titulo,
            ejecutado_el: p['Ejecutado el']?.date?.start,
            metrica_objetivo: metrica, direccion_esperada: direccion,
            causa_raiz: p['Causa raiz']?.rich_text?.map((t: any) => t.plain_text).join('') || null,
            naturaleza: p.Naturaleza?.select?.name || null,
            sincronizado_el: new Date().toISOString()
          });
        }
        if (filas.length) {
          const { error } = await supabase.from('accionables_ejecutados').upsert(filas, { onConflict: 'notion_id' });
          resultado.accionables_sincronizados = error ? `error: ${error.message}` : filas.length;
        } else resultado.accionables_sincronizados = 0;
      }

      // 2. Evaluar impacto y escribir Resultado observado en Notion para los que ya tienen veredicto
      const { data: impactos } = await supabase.from('v_impacto_accionables').select('*').not('veredicto', 'like', 'PENDIENTE%');
      let escritos = 0;
      for (const imp of impactos || []) {
        if (!notion) break;
        try {
          const page: any = await notion.pages.retrieve({ page_id: imp.notion_id });
          const ya = page.properties?.['Resultado observado']?.rich_text?.length > 0;
          if (ya) continue;
          const texto = `[AUTO ${new Date().toISOString().slice(0,10)}] ${imp.veredicto}. ${imp.metrica_objetivo || 'metrica'}: ${imp.metrica_objetivo === 'cpa' ? `${imp.cpa_antes} → ${imp.cpa_despues}` : imp.metrica_objetivo === 'gasto' ? `${imp.gasto_antes} → ${imp.gasto_despues}` : imp.metrica_objetivo === 'conversiones' ? `${imp.conv_antes} → ${imp.conv_despues}` : `${imp.ctr_antes} → ${imp.ctr_despues}`} (${imp.variacion_pct ?? '?'}%). Ventana: 14 días antes vs ${imp.dias_despues} días consolidados después.`;
          await notion.pages.update({ page_id: imp.notion_id, properties: { 'Resultado observado': { rich_text: [{ text: { content: texto.slice(0, 1900) } }] } } });
          escritos++;
        } catch (e) { /* seguir con el siguiente */ }
      }
      resultado.resultados_escritos_en_notion = escritos;

      // 2b. Doc maestro: capa consolidada desde Notion (ficha + accionables Bloqueados)
      if (notion && NOTION_BASES.CLIENTES) {
        const fichas: any = await notion.databases.query({ database_id: NOTION_BASES.CLIENTES });
        let sincronizados = 0;
        for (const f of fichas.results) {
          const nombre = f.properties?.Cliente?.title?.map((t: any) => t.plain_text).join('') || f.properties?.Name?.title?.map((t: any) => t.plain_text).join('') || '';
          const cts = await cuentasActivas();
          const acct = cts.find(c => (c.nombre_cliente || '').toLowerCase() === String(nombre).toLowerCase())?.account
                    || cts.find(c => String(nombre).toLowerCase().includes((c.nombre_cliente || '').split(' ')[0].toLowerCase()))?.account
                    || cts.find(c => String(nombre).toLowerCase().includes(c.account.toLowerCase().replace('_', ' ')))?.account || null;
          if (!acct) continue;
          const aprendizajes = f.properties['Aprendizajes consolidados']?.rich_text?.map((t: any) => t.plain_text).join('') || null;
          const hipotesis = f.properties['Hipotesis abiertas']?.rich_text?.map((t: any) => t.plain_text).join('') || null;
          // Accionables Bloqueados: titulo + que lo confirmaria
          let pendientes: string | null = null;
          if (NOTION_BASES.ACCIONABLES) {
            const bl: any = await notion.databases.query({
              database_id: NOTION_BASES.ACCIONABLES,
              filter: { and: [ { property: 'Estado', select: { equals: NOTION_STATES.BLOQUEADO } }, { property: 'Cliente', relation: { contains: f.id } } ] },
              page_size: 20
            });
            const lineas = bl.results.map((a: any) => {
              const t = a.properties.Accion?.title?.map((x: any) => x.plain_text).join('') || '';
              const q = a.properties['Que lo confirmaria']?.rich_text?.map((x: any) => x.plain_text).join('') || '';
              return `- **${t}**${q ? ` — lo confirmaría: ${q}` : ''}`;
            });
            pendientes = lineas.length ? lineas.join('\n') : null;
          }
          await supabase.from('doc_maestro_consolidado').upsert({ account: acct, aprendizajes, hipotesis_abiertas: hipotesis, pendientes, sincronizado_el: new Date().toISOString() });
          sincronizados++;
        }
        resultado.doc_maestro_consolidado = sincronizados;
      }

      // 3. Actualizar parametros estimados con reales
      const { data: wr } = await supabase.rpc('actualizar_win_rates');
      resultado.win_rates_actualizados = wr || [];
      await supabase.rpc('actualizar_eventos_escalera');

      // 4. Tasa de acierto y reflexiones recurrentes: el resumen del ciclo
      const { data: tasa } = await supabase.from('v_tasa_acierto').select('*');
      const { data: refl } = await supabase.from('v_reflexiones_recurrentes').select('*').limit(10);
      resultado.tasa_acierto = tasa || [];
      resultado.propuestas_de_cambio_al_prompt = refl || [];

      res.json({ ok: true, ...resultado });
    } catch (e: any) { res.status(500).json({ error: e.message, parcial: resultado }); }
  });

  // Lectura de la inteligencia retroactiva para la app
  app.get("/api/aprendizaje", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const client = req.query.client as string;
    const q = (t: string) => client ? supabase!.from(t).select('*').eq('account', client) : supabase!.from(t).select('*');
    const [impacto, tasa, refl, recurrentes] = await Promise.all([
      q('v_impacto_accionables').order('ejecutado_el', { ascending: false }).limit(30),
      q('v_tasa_acierto'),
      q('reflexiones').order('run_date', { ascending: false }).limit(20),
      q('v_reflexiones_recurrentes')
    ]);
    res.json({ impacto: impacto.data || [], tasa_acierto: tasa.data || [], reflexiones: refl.data || [], propuestas: recurrentes.data || [] });
  });

  // Escribir una reflexion (lo usa la tarea semanal via SQL, y la app si Andres quiere anotar)
  app.post("/api/reflexiones", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { account, tipo, que_paso, que_haria_distinto, regla_del_prompt, confianza } = req.body;
    if (!account || !tipo || !que_paso || !que_haria_distinto) return res.status(400).json({ error: 'faltan campos' });
    const { data, error } = await supabase.from('reflexiones').insert({ account, tipo, que_paso, que_haria_distinto, regla_del_prompt, confianza: confianza || 'media' }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });



  // Decisiones estructurales y CPA marginal
  app.get("/api/estrategia", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const client = req.query.client as string;
    const [dec, marg] = await Promise.all([
      client ? supabase.from('v_decision_estructural').select('*').eq('account', client) : supabase.from('v_decision_estructural').select('*'),
      client ? supabase.from('v_cpa_marginal').select('*').eq('account', client).order('campaign').order('escalon') : supabase.from('v_cpa_marginal').select('*').order('account').order('campaign').order('escalon')
    ]);
    if (dec.error) return res.status(500).json({ error: dec.error.message });
    res.json({ decisiones: dec.data || [], cpa_marginal: marg.data || [] });
  });


  // ================================================================
  // REPORTES AL CLIENTE
  // ================================================================
  // Extrae de un brief de Notion las secciones que van al cliente.
  // El brief es una página con headings; busca los que empiezan con las
  // etiquetas conocidas y toma los párrafos hasta el siguiente heading.
  async function extraerSeccionesBrief(pageId: string): Promise<{ resumen: string; cambiamos: string; sigue: string }> {
    // Lee la seccion "Reporte para el cliente" completa, con sus etiquetas
    // (Contexto:, Observaciones:, ...) y vinetas, como un solo texto. Los
    // bloques los parsea parsearBloques() al generar el PDF.
    if (!notion) return { resumen: '', cambiamos: '', sigue: '' };
    let cursor: string | undefined; const bloques: any[] = [];
    do {
      const r: any = await notion.blocks.children.list({ block_id: pageId, page_size: 100, start_cursor: cursor });
      bloques.push(...r.results); cursor = r.has_more ? r.next_cursor : undefined;
    } while (cursor);
    const texto = (b: any) => (b[b.type]?.rich_text || []).map((t: any) => t.plain_text).join('');
    let dentro = false; const lineas: string[] = [];
    for (const b of bloques) {
      const esHeading = /^heading_/.test(b.type);
      const t = texto(b).trim();
      if (esHeading) {
        if (/reporte (para|al) (el )?cliente|client report/i.test(t)) { dentro = true; continue; }
        if (dentro) break; // siguiente heading: termina la seccion
        continue;
      }
      if (!dentro || !t) continue;
      if (b.type === 'bulleted_list_item' || b.type === 'numbered_list_item') lineas.push('- ' + t);
      else lineas.push(t);
    }
    return { resumen: lineas.join('\n'), cambiamos: '', sigue: '' };
  }

  // Crear borrador de reporte para una cuenta y periodo

  // ---- Reportes v2: bloques como fuente; texto legado se parsea una vez ----
  async function bloquesDe(r: any): Promise<any[]> {
    if (Array.isArray(r.bloques) && r.bloques.length) return r.bloques;
    const pdf = await cargarPdf();
    const textoCompleto = [r.resumen_ejecutivo, r.que_cambiamos ? `${r.idioma === 'en' ? 'Changes applied' : 'Cambios aplicados'}:\n${r.que_cambiamos}` : '', r.que_sigue ? `${r.idioma === 'en' ? 'Next steps' : 'Próximos pasos'}:\n${r.que_sigue}` : ''].filter(Boolean).join('\n\n');
    const b = pdf.parsearBloques(textoCompleto || '');
    if (b.length && supabase) await supabase.from('reportes_cliente').update({ bloques: b }).eq('id', r.id);
    return b;
  }
  async function guardarVersion(reporteId: number, bloques: any[], autor: string, motivo?: string) {
    if (!supabase) return;
    const { data: r } = await supabase.from('reportes_cliente').select('version').eq('id', reporteId).single();
    const v = (r?.version || 1) + 1;
    await supabase.from('reportes_versiones').insert({ reporte_id: reporteId, version: v, autor, bloques, motivo });
    await supabase.from('reportes_cliente').update({ version: v, bloques, editado: autor === 'andres', pdf_path: null }).eq('id', reporteId);
    return v;
  }
  // Regenerar UNA seccion con Sonnet 5, con los datos, sin tocar las demas
  async function regenerarSeccion(r: any, cuenta: any, etiqueta: string, instruccion?: string): Promise<{ texto?: string; vinetas?: string[] }> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('Sin ANTHROPIC_API_KEY');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const cli = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const [pulsos, hechos, estado] = await Promise.all([
      supabase!.from('pulso_diario').select('fecha, hallazgo_principal, resumen').eq('account', r.account).gte('fecha', r.periodo_desde).lte('fecha', r.periodo_hasta).order('fecha'),
      supabase!.from('accionables_espejo').select('titulo, ejecutado_el, por_que').eq('account', r.account).eq('estado', 'Hecho').gte('ejecutado_el', r.periodo_desde).lte('ejecutado_el', r.periodo_hasta),
      supabase!.rpc('get_estado_cuenta', { p_account: r.account }),
    ]);
    const idioma = r.idioma === 'en' ? 'inglés' : 'español';
    const otras = (r.bloques || []).filter((b: any) => b.etiqueta !== etiqueta).map((b: any) => `${b.etiqueta}: ${b.texto || ''} ${(b.vinetas || []).map((v: string) => '- ' + v).join(' ')}`).join('\n');
    const prompt = `Reescribí SOLO la sección "${etiqueta}" del reporte al cliente ${cuenta.nombre_cliente}, período ${r.periodo_desde} a ${r.periodo_hasta}, en ${idioma}, primera persona del singular.
${instruccion ? 'INSTRUCCIÓN DE ANDRÉS: ' + instruccion : ''}
LAS OTRAS SECCIONES (no las repitas ni las contradigas): ${otras}
REGLAS: sin guion largo; sin "no es X, es Y"; sin listas de tres forzadas; sin adverbios de intensidad; un número exacto en vez de un adjetivo; prueba del CFO; malas noticias en voz activa y con causa. Entre 1 y 5 viñetas si la sección es de viñetas (Observaciones, Cambios, Atención, Próximos); un párrafo corto si es Contexto.
REGLAS DE LA CUENTA: ${cuenta.reglas_dominio || ''}
DATOS: ${JSON.stringify(r.metricas)} SERIE: ${JSON.stringify(r.serie)} CAMPAÑAS: ${JSON.stringify(r.campanas)}
ANÁLISIS DIARIO DEL PERÍODO: ${JSON.stringify(pulsos.data || [])} CAMBIOS EJECUTADOS: ${JSON.stringify(hechos.data || [])} PLAN Y ABIERTOS: ${JSON.stringify({ plan: estado.data?.plan_vigente?.contexto, abiertos: estado.data?.accionables_abiertos?.map((a: any) => a.titulo) })}
Devolvé SOLO JSON: {"texto": "<párrafo o vacío>", "vinetas": ["...", "..."]}`;
    const msg = await cli.messages.create({ model: 'claude-sonnet-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }], output_config: { effort: 'medium' } as any });
    const raw = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const i = raw.indexOf('{'), j = raw.lastIndexOf('}');
    const o = JSON.parse(raw.slice(i, j + 1));
    return { texto: o.texto || undefined, vinetas: Array.isArray(o.vinetas) && o.vinetas.length ? o.vinetas : undefined };
  }

  // Buscar el brief de una cuenta cuya semana cae en el rango
  async function buscarBriefEnRango(account: string, desde: string, hasta: string): Promise<any | null> {
    if (!notion || !NOTION_BASES.BRIEFS) return null;
    const clienteId = await findNotionClientId(notion, account);
    if (!clienteId) return null;
    const q: any = await notion.databases.query({ database_id: NOTION_BASES.BRIEFS, filter: { and: [ { property: 'Cliente', relation: { contains: clienteId } }, { property: 'Semana', date: { on_or_after: desde } }, { property: 'Semana', date: { on_or_before: hasta } } ] }, sorts: [{ property: 'Semana', direction: 'descending' }], page_size: 4 });
    return q.results[0] || null;
  }

  // Redactar el reporte con Sonnet 5 desde los datos, cuando no hay brief con la seccion
  async function redactarReporte(account: string, cuenta: any, desde: string, hasta: string, datos: any): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('Sin brief para ese rango y sin ANTHROPIC_API_KEY para redactar');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const cli = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const [pulsos, accHechos, estado] = await Promise.all([
      supabase!.from('pulso_diario').select('fecha, hallazgo_principal, resumen').eq('account', account).gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase!.from('accionables_espejo').select('titulo, ejecutado_el, por_que').eq('account', account).eq('estado', 'Hecho').gte('ejecutado_el', desde).lte('ejecutado_el', hasta),
      supabase!.rpc('get_estado_cuenta', { p_account: account }),
    ]);
    const idioma = cuenta.idioma_reporte === 'en' ? 'inglés' : 'español';
    const etiquetas = cuenta.idioma_reporte === 'en' ? 'Context:, Observations:, Changes applied:, Points of attention:, Next steps:' : 'Contexto:, Observaciones:, Cambios aplicados:, Puntos de atención:, Próximos pasos:';
    const prompt = `Escribí la sección de reporte al cliente para ${cuenta.nombre_cliente}, período ${desde} a ${hasta}, en ${idioma}, primera persona del singular (sos el media buyer de NorthSignal).

ESTRUCTURA: bloques con etiqueta en su propia línea seguida de dos puntos y viñetas con guion debajo. Etiquetas exactas: ${etiquetas}. Contexto solo si afecta la lectura. Entre dos y cinco viñetas en Observaciones. Cada bloque con el largo que necesita; las viñetas no miden todas igual.

QUE NO HACER: sin guion largo; sin "no es X, es Y"; sin listas de exactamente tres forzadas; sin adverbios de intensidad; sin "cabe destacar" ni "en este sentido"; sin escalar afirmaciones; un número exacto en vez de un adjetivo; sin tablas; sin keywords sueltas; sin jerga (prueba del CFO). Malas noticias en voz activa y con causa.

REGLAS DE LA CUENTA: ${cuenta.reglas_dominio || ''}

DATOS DEL PERÍODO: ${JSON.stringify(datos.metricas)}
SERIE: ${JSON.stringify(datos.serie)}
CAMPAÑAS Y GRUPOS CON GASTO: ${JSON.stringify({ campanas: datos.campanas, grupos: datos.grupos })}
LO QUE EL ANÁLISIS DIARIO ENCONTRÓ CADA DÍA: ${JSON.stringify(pulsos.data || [])}
CAMBIOS EJECUTADOS EN EL PERÍODO: ${JSON.stringify(accHechos.data || [])}
ACCIONABLES ABIERTOS Y PLAN: ${JSON.stringify({ abiertos: estado.data?.accionables_abiertos, plan: estado.data?.plan_vigente?.contexto, por_que_limitada: estado.data?.por_que_limitada?.por_que })}

Devolvé solo el texto del reporte, sin encabezado ni comentarios.`;
    const msg = await cli.messages.create({ model: 'claude-sonnet-5', max_tokens: 2500, messages: [{ role: 'user', content: prompt }], output_config: { effort: 'medium' } as any });
    return msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
  }

  // Crear borrador: solo cuenta y rango. El brief se busca solo; si no hay, se redacta desde los datos.
  app.post("/api/reportes/generar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    try {
      const { account, desde, hasta, tipo: tipoIn, brief_id, resumen_manual } = req.body || {};
      if (!account || !desde || !hasta) return res.status(400).json({ error: 'account, desde y hasta son obligatorios' });
      if (hasta < desde) return res.status(400).json({ error: 'El rango está al revés' });
      const dias = (new Date(hasta).getTime() - new Date(desde).getTime()) / 864e5 + 1;
      const tipo = tipoIn || (dias > 10 ? 'mensual' : 'semanal');
      const { data: cuenta } = await supabase.from('cuentas').select('*').eq('account', account).single();
      if (!cuenta) return res.status(404).json({ error: 'cuenta no encontrada' });
      // Hay datos para ese rango?
      const { count: nDias } = await supabase.from('v_serie_diaria').select('date', { count: 'exact', head: true }).eq('account', account).gte('date', desde).lte('date', hasta);
      if (!nDias) return res.status(422).json({ error: `No hay datos diarios de ${account} entre ${desde} y ${hasta}. La capa diaria empieza el 22 de agosto de 2026.` });

      const { data: datos, error } = await supabase.rpc('get_reporte_datos', { p_account: account, p_desde: desde, p_hasta: hasta });
      if (error) return res.status(500).json({ error: error.message });

      // Texto: manual > brief indicado > brief encontrado en el rango > redactado desde los datos
      let secciones = { resumen: resumen_manual || '', cambiamos: '', sigue: '' };
      let origen = resumen_manual ? 'manual' : ''; let briefUsado: string | null = brief_id || null;
      if (!secciones.resumen && notion) {
        const brief = brief_id ? { id: brief_id } : await buscarBriefEnRango(account, desde, hasta);
        if (brief) { secciones = await extraerSeccionesBrief(brief.id); briefUsado = brief.id; if (secciones.resumen) origen = 'brief'; }
      }
      if (!secciones.resumen) { secciones.resumen = await redactarReporte(account, cuenta, desde, hasta, datos); origen = 'sonnet-5'; }

      const pdfLib = await cargarPdf();
      const textoInicial = [secciones.resumen, secciones.cambiamos ? `${cuenta.idioma_reporte === 'en' ? 'Changes applied' : 'Cambios aplicados'}:\n${secciones.cambiamos}` : '', secciones.sigue ? `${cuenta.idioma_reporte === 'en' ? 'Next steps' : 'Próximos pasos'}:\n${secciones.sigue}` : ''].filter(Boolean).join('\n\n');
      const bloquesIniciales = pdfLib.parsearBloques(textoInicial);
      const { data: fila, error: e2 } = await supabase.from('reportes_cliente').upsert({
        account, periodo_desde: desde, periodo_hasta: hasta, tipo, idioma: cuenta.idioma_reporte, estado: 'borrador', bloques: bloquesIniciales, version: 1,
        resumen_ejecutivo: secciones.resumen, que_cambiamos: secciones.cambiamos || null, que_sigue: secciones.sigue || null,
        metricas: datos.metricas, serie: datos.serie, campanas: { campanas: datos.campanas, grupos: datos.grupos, accionables: datos.accionables_ejecutados },
        brief_notion_id: briefUsado, escrito_por: origen === 'brief' ? 'opus-5-semanal' : origen === 'sonnet-5' ? 'sonnet-5-desde-datos' : 'andres'
      }, { onConflict: 'account,periodo_desde,tipo' }).select().single();
      if (e2) return res.status(500).json({ error: e2.message });
      await supabase.from('reportes_versiones').upsert({ reporte_id: fila.id, version: 1, autor: origen === 'brief' ? 'opus-5-semanal' : origen === 'sonnet-5' ? 'sonnet-5' : 'andres', bloques: bloquesIniciales, motivo: 'borrador inicial' }, { onConflict: 'reporte_id,version', ignoreDuplicates: true });
      res.json({ ok: true, reporte: fila, origen, dias_con_datos: nDias });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Listar reportes
  app.get("/api/reportes", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const client = req.query.client as string;
    let q = supabase.from('reportes_cliente').select('id, account, periodo_desde, periodo_hasta, tipo, idioma, estado, resumen_ejecutivo, que_cambiamos, que_sigue, metricas, pdf_path, creado, aprobado_el, enviado_el, enviado_a, editado').order('periodo_desde', { ascending: false }).limit(30);
    if (client) q = q.eq('account', client);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // Editar texto (antes de aprobar)
  app.put("/api/reportes/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { bloques, nota_interna, motivo } = req.body || {};
    const { data: r } = await supabase.from('reportes_cliente').select('id, estado').eq('id', req.params.id).single();
    if (!r) return res.status(404).json({ error: 'no encontrado' });
    if (['enviado'].includes(r.estado)) return res.status(409).json({ error: 'Ya se envió; para cambiarlo, creá una versión nueva del período.' });
    if (Array.isArray(bloques)) await guardarVersion(Number(req.params.id), bloques, 'andres', motivo || 'edición');
    if (nota_interna !== undefined) await supabase.from('reportes_cliente').update({ nota_interna }).eq('id', req.params.id);
    const { data } = await supabase.from('reportes_cliente').select('*').eq('id', req.params.id).single();
    res.json(data);
  });
  // Regenerar una sola seccion con instruccion opcional
  app.post("/api/reportes/:id/regenerar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    try {
      const { etiqueta, instruccion } = req.body || {};
      const { data: r } = await supabase.from('reportes_cliente').select('*').eq('id', req.params.id).single();
      if (!r) return res.status(404).json({ error: 'no encontrado' });
      if (r.estado === 'enviado') return res.status(409).json({ error: 'Ya se envió.' });
      const { data: cuenta } = await supabase.from('cuentas').select('*').eq('account', r.account).single();
      r.bloques = await bloquesDe(r);
      const nuevo = await regenerarSeccion(r, cuenta, etiqueta, instruccion);
      const bloques = r.bloques.map((b: any) => b.etiqueta === etiqueta ? { ...b, ...nuevo } : b);
      if (!r.bloques.some((b: any) => b.etiqueta === etiqueta)) bloques.push({ etiqueta, ...nuevo });
      const v = await guardarVersion(r.id, bloques, 'regenerar', `regeneró "${etiqueta}"${instruccion ? ': ' + instruccion : ''}`);
      res.json({ ok: true, bloques, version: v });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  // Versiones de un reporte
  app.get("/api/reportes/:id/versiones", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.from('reportes_versiones').select('id, version, fecha, autor, motivo').eq('reporte_id', req.params.id).order('version', { ascending: false });
    res.json(data || []);
  });
  app.post("/api/reportes/:id/versiones/:v/restaurar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data: ver } = await supabase.from('reportes_versiones').select('bloques').eq('reporte_id', req.params.id).eq('version', req.params.v).single();
    if (!ver) return res.status(404).json({ error: 'version no encontrada' });
    const v = await guardarVersion(Number(req.params.id), ver.bloques, 'andres', `restauró la v${req.params.v}`);
    res.json({ ok: true, version: v, bloques: ver.bloques });
  });

  // Generar el PDF (vista previa o final) y guardarlo en Storage
  async function generarYGuardarPdf(id: number): Promise<any> {
    const req: any = { params: { id } }; const res: any = { status: () => ({ json: (j: any) => { throw new Error(j.error || 'error'); } }), json: (j: any) => j };

      const pdf = await cargarPdf();
      const { data: r } = await supabase.from('reportes_cliente').select('*').eq('id', req.params.id).single();
      if (!r) return res.status(404).json({ error: 'no encontrado' });
      const { data: cuenta } = await supabase.from('cuentas').select('*').eq('account', r.account).single();
      const dias = (new Date(r.periodo_hasta).getTime() - new Date(r.periodo_desde).getTime()) / 864e5 + 1;
      const { data: anteriorCount } = await supabase.from('v_serie_diaria').select('date', { count: 'exact', head: true }).eq('account', r.account)
        .gte('date', new Date(new Date(r.periodo_desde).getTime() - dias * 864e5).toISOString().slice(0, 10)).lt('date', r.periodo_desde);
      const bloquesR = await bloquesDe(r);
      const input: ReporteInput = {
        account: r.account, nombre_cliente: cuenta.nombre_cliente, idioma: r.idioma, moneda: cuenta.moneda, locale: cuenta.locale,
        titulo: (cuenta.encabezado_reporte || '').split('|')[0].trim() || undefined,
        periodo_desde: r.periodo_desde, periodo_hasta: r.periodo_hasta, tipo: r.tipo,
        bloques: bloquesR,
        metricas: r.metricas,
        periodo_anterior_completo: ((anteriorCount as any) ?? 0) >= dias,
        campanas: r.campanas?.campanas || [], grupos: r.campanas?.grupos || [],
        logo: await pdf.descargarLogo()
      };
      const buf = await pdf.generarReportePDF(input);
      const ruta = `${r.account}/${r.tipo}_${r.periodo_desde}_${r.id}.pdf`;
      const { error: up } = await supabase.storage.from('reportes').upload(ruta, buf, { contentType: 'application/pdf', upsert: true });
      if (up) return res.status(500).json({ error: up.message });
      await supabase.from('reportes_cliente').update({ pdf_path: ruta, pdf_bytes: buf.length }).eq('id', r.id);
      return ({ ok: true, pdf_path: ruta, bytes: buf.length });
  }
  app.post("/api/reportes/:id/pdf", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    try { res.json(await generarYGuardarPdf(Number(req.params.id))); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Descargar el PDF guardado
  app.get("/api/reportes/:id/pdf", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data: r0 } = await supabase.from('reportes_cliente').select('account, periodo_desde, pdf_path').eq('id', req.params.id).single();
    if (!r0) return res.status(404).json({ error: 'no encontrado' });
    let r = r0;
    // Sin PDF (o desactualizado tras una edicion): generarlo ahora
    if (!r.pdf_path) { try { const g = await generarYGuardarPdf(Number(req.params.id)); r = { ...r, pdf_path: g.pdf_path }; } catch (e: any) { return res.status(500).json({ error: 'No pude generar el PDF: ' + e.message }); } }
    const { data, error } = await supabase.storage.from('reportes').download(r.pdf_path);
    if (error || !data) return res.status(500).json({ error: error?.message || 'no se pudo descargar' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="NorthSignal_${r.account}_${r.periodo_desde}.pdf"`);
    res.send(Buffer.from(await data.arrayBuffer()));
  });

  // Aprobar: el unico human in the loop del entregable
  app.post("/api/reportes/:id/revisado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    await supabase.from('reportes_cliente').update({ estado: 'revisado' }).eq('id', req.params.id).eq('estado', 'borrador');
    res.json({ ok: true });
  });
  // Enviar: Slack por webhook desde aca; email lo manda el script de briefing (lee estado=aprobado y canal=email)
  app.post("/api/reportes/:id/enviar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data: r } = await supabase.from('reportes_cliente').select('*').eq('id', req.params.id).single();
    if (!r) return res.status(404).json({ error: 'no encontrado' });
    if (r.estado !== 'aprobado') return res.status(409).json({ error: 'Primero aprobalo.' });
    const { data: cuenta } = await supabase.from('cuentas').select('*').eq('account', r.account).single();
    const url = `${process.env.APP_URL || 'https://app-northsignal.vercel.app'}/r/${r.token}`;
    const canal = (req.body || {}).canal || cuenta.canal_reporte;
    if (canal === 'slack') {
      const hook = process.env[`SLACK_WEBHOOK_${r.account}`] || process.env.SLACK_WEBHOOK_URL;
      if (!hook) return res.status(422).json({ error: `Falta SLACK_WEBHOOK_${r.account} en Vercel. Mientras tanto, copiá el link y pegalo en Slack: ${url}` });
      const bloques = await bloquesDe(r);
      const resumen = bloques.slice(0, 2).map((b: any) => `*${b.etiqueta}*\n${b.texto || ''}${(b.vinetas || []).map((v: string) => '\n• ' + v).join('')}`).join('\n\n');
      const m = r.metricas || {};
      const texto = r.idioma === 'en' ? `*Weekly report · ${r.periodo_desde} to ${r.periodo_hasta}*\nSpend ${m.gasto?.actual ?? '-'} · Conversions ${m.conversiones?.actual ?? '-'} · CPA ${m.cpa?.actual ?? '-'}\n\n${resumen}\n\nFull report: ${url}` : `*Reporte semanal · ${r.periodo_desde} al ${r.periodo_hasta}*\nInversión ${m.gasto?.actual ?? '-'} · Conversiones ${m.conversiones?.actual ?? '-'} · CPA ${m.cpa?.actual ?? '-'}\n\n${resumen}\n\nReporte completo: ${url}`;
      const rs = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: texto }) });
      if (!rs.ok) return res.status(500).json({ error: 'Slack respondió ' + rs.status });
      await supabase.from('reportes_cliente').update({ estado: 'enviado', enviado_el: new Date().toISOString(), enviado_a: 'slack' }).eq('id', r.id);
      return res.json({ ok: true, canal: 'slack', url });
    }
    if (canal === 'email') {
      // El script de briefing lo manda con el PDF adjunto en su proxima corrida (9:15) y lo marca enviado
      await supabase.from('reportes_cliente').update({ enviado_a: 'email:pendiente' }).eq('id', r.id);
      return res.json({ ok: true, canal: 'email', pendiente: true, url, nota: 'El script lo manda por mail con el PDF adjunto en la próxima corrida de las 9:15.' });
    }
    return res.json({ ok: true, canal: 'manual', url, nota: 'Canal manual: copiá el link o descargá el PDF.' });
  });
  // El script de briefing pide los reportes aprobados por email pendientes de envio
  app.get("/api/cron/reportes-por-enviar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.from('reportes_cliente').select('id, account, periodo_desde, periodo_hasta, idioma, token, pdf_path, metricas, bloques, resumen_ejecutivo').eq('estado', 'aprobado').eq('enviado_a', 'email:pendiente');
    const out: any[] = [];
    for (const r of data || []) {
      const { data: cuenta } = await supabase.from('cuentas').select('nombre_cliente, destinatarios_reporte, nombre_contacto, encabezado_reporte').eq('account', r.account).single();
      let pdfUrl: string | null = null;
      if (r.pdf_path) { const { data: signed } = await supabase.storage.from('reportes').createSignedUrl(r.pdf_path, 3600); pdfUrl = signed?.signedUrl || null; }
      out.push({ ...r, cuenta, pdf_url: pdfUrl, link: `${process.env.APP_URL || 'https://app-northsignal.vercel.app'}/r/${r.token}` });
    }
    res.json(out);
  });
  app.post("/api/cron/reportes-enviado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { id, a } = req.body || {};
    await supabase.from('reportes_cliente').update({ estado: 'enviado', enviado_el: new Date().toISOString(), enviado_a: 'email:' + (a || '') }).eq('id', id);
    res.json({ ok: true });
  });
  app.post("/api/reportes/:id/aprobar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data, error } = await supabase.from('reportes_cliente').update({ estado: 'aprobado', aprobado_el: new Date().toISOString(), aprobado_por: 'andres' }).eq('id', req.params.id).eq('estado', 'borrador').select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/reportes/:id/descartar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { error } = await supabase.from('reportes_cliente').update({ estado: 'descartado' }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });


  // Cron: lunes 09:15 BA, después de las tareas semanales. Busca el brief de
  // la semana cerrada en Notion por cuenta con frecuencia semanal, y crea el
  // borrador del reporte. Si el brief no tiene la sección, lo registra y sigue.
  app.all("/api/cron/reportes", async (req, res) => {
    if (!supabase || !notion || !NOTION_BASES.BRIEFS) return res.status(503).json({ error: 'Supabase o Notion no configurados' });
    // Si llego hasta aca, paso el middleware: con CRON_SECRET (Vercel Cron, pg_net),
    // con sesion de la app (prueba manual desde el navegador) o con APP_ACCESS_TOKEN.
    const hoy = new Date(); const dow = hoy.getDay(); // 0 dom, 1 lun
    const lunesPrevio = new Date(hoy); lunesPrevio.setDate(hoy.getDate() - ((dow + 6) % 7) - 7);
    const desde = lunesPrevio.toISOString().slice(0, 10);
    const hasta = new Date(lunesPrevio.getTime() + 6 * 864e5).toISOString().slice(0, 10);
    const { data: cuentas } = await supabase.from('cuentas').select('account, frecuencia_reporte').eq('activa', true).in('frecuencia_reporte', ['semanal', 'ninguna']);
    const out: any[] = [];
    for (const c of cuentas || []) {
      try {
        const { data: existe } = await supabase.from('reportes_cliente').select('id').eq('account', c.account).eq('periodo_desde', desde).eq('tipo', 'semanal').maybeSingle();
        if (existe) { out.push({ cuenta: c.account, nota: 'ya existe' }); continue; }
        const q: any = await notion.databases.query({ database_id: NOTION_BASES.BRIEFS, filter: { and: [ { property: 'Semana', date: { equals: desde } }, { property: 'Cliente', relation: { contains: (await findNotionClientId(notion, c.account)) || '' } } ] }, page_size: 1 });
        const brief = q.results[0];
        if (!brief) { out.push({ cuenta: c.account, nota: `sin brief para ${desde}` }); continue; }
        const secciones = await extraerSeccionesBrief(brief.id);
        if (!secciones.resumen) { out.push({ cuenta: c.account, nota: 'brief sin sección de reporte' }); continue; }
        const { data: datos } = await supabase.rpc('get_reporte_datos', { p_account: c.account, p_desde: desde, p_hasta: hasta });
        const { data: cta } = await supabase.from('cuentas').select('idioma_reporte').eq('account', c.account).single();
        await supabase.from('reportes_cliente').insert({
          account: c.account, periodo_desde: desde, periodo_hasta: hasta, tipo: 'semanal', idioma: cta?.idioma_reporte || 'es', estado: 'borrador',
          resumen_ejecutivo: secciones.resumen, que_cambiamos: secciones.cambiamos || null, que_sigue: secciones.sigue || null,
          metricas: datos.metricas, serie: datos.serie, campanas: { campanas: datos.campanas, grupos: datos.grupos, accionables: datos.accionables_ejecutados }, brief_notion_id: brief.id
        });
        out.push({ cuenta: c.account, creado: true, periodo: `${desde} → ${hasta}` });
      } catch (e: any) { out.push({ cuenta: c.account, error: e.message }); }
    }
    res.json({ ok: true, semana: desde, resultados: out });
  });


  // ================================================================
  // ASISTENTE, TICKETS Y ALERTAS
  // ================================================================
  app.post("/api/asistente", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    try {
      const { mensajes, pagina, cuenta } = req.body || {};
      if (!Array.isArray(mensajes) || !mensajes.length) return res.status(400).json({ error: 'mensajes requerido' });
      const r = await responderAsistente(supabase, mensajes.slice(-8), { pagina, cuenta });
      res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/coherencia", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const [e, r] = await Promise.all([supabase.from('escritores').select('*').order('entidad'), supabase.from('reconciliaciones').select('*').order('corrida', { ascending: false }).limit(40)]);
    res.json({ escritores: e.data || [], reconciliaciones: r.data || [] });
  });

  // Tickets: Andres los crea desde cualquier pagina; Claude los lee en Supabase
  app.post("/api/tickets", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { tipo = 'bug', titulo, descripcion, pagina, cuenta, contexto } = req.body || {};
    if (!titulo) return res.status(400).json({ error: 'titulo requerido' });
    const { data, error } = await supabase.from('tickets').insert({ tipo, titulo, descripcion, pagina, cuenta, contexto }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.get("/api/tickets", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data, error } = await supabase.from('tickets').select('*').order('creado', { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // Alertas: listar, marcar vista/resuelta, silenciar con motivo
  app.get("/api/alertas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data, error } = await supabase.from('v_alertas_abiertas').select('*').limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app.post("/api/alertas/:id/:accion", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { accion } = req.params; const { dias, por_que } = req.body || {};
    const upd: any = accion === 'vista' ? { estado: 'vista', vista_el: new Date().toISOString() }
      : accion === 'resolver' ? { estado: 'resuelta', resuelta_el: new Date().toISOString() }
      : accion === 'silenciar' ? { estado: 'silenciada', silenciada_hasta: new Date(Date.now() + (Number(dias) || 7) * 864e5).toISOString().slice(0, 10), silenciada_por_que: por_que || null }
      : null;
    if (!upd) return res.status(400).json({ error: 'accion invalida' });
    const { error } = await supabase.from('alertas').update(upd).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });


  // Sincronizar el espejo de accionables desde Notion (todas las paginas, no solo 50)
  async function sincronizarEspejo(): Promise<number> {
    if (!supabase || !notion || !NOTION_BASES.ACCIONABLES) return 0;
    let cursor: string | undefined; const filas: any[] = [];
    const { parsearAccion } = await import('./src/lib/accion');
    do {
      const r: any = await notion.databases.query({ database_id: NOTION_BASES.ACCIONABLES, page_size: 100, start_cursor: cursor });
      for (const page of r.results) {
        const p = page.properties; const txt = (k: string) => p[k]?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        const cliente = await resolveNotionClient(notion, p.Cliente);
        const parsed = parsearAccion(txt('Accion JSON'));
        let accionError = parsed.error || null;
        // Validar contra la base: la keyword existe activa en esa cuenta
        if (parsed.accion?.objeto?.keyword && ['pausar_keyword', 'cambiar_concordancia', 'reactivar_keyword'].includes(parsed.accion.verbo) && cliente) {
          const { data: rk } = await supabase.rpc('resolver_keyword', { p_account: cliente, p_keyword: parsed.accion.objeto.keyword, p_pista: `${parsed.accion.objeto.grupo || ''} ${parsed.accion.objeto.campana || ''}` });
          if (!rk?.campana) accionError = `keyword "${parsed.accion.objeto.keyword}" no encontrada activa en ${cliente}`;
          else { parsed.accion.objeto.campana = rk.campana; parsed.accion.objeto.grupo = rk.grupo; if (!parsed.accion.objeto.match_type) parsed.accion.objeto.match_type = rk.match_type; }
        }
        // Invariantes: si viola una bloqueante, el accionable queda marcado y comentado
        if (parsed.accion && cliente && !accionError) {
          const { data: inv } = await supabase.rpc('verificar_invariantes', { p_account: cliente, p_accion: parsed.accion });
          const bloq = (inv || []).filter((x: any) => x.bloquea);
          if (bloq.length) {
            accionError = 'INVARIANTE: ' + bloq.map((x: any) => x.detalle).join(' | ');
            const st = p.Estado?.select?.name;
            if (['Propuesto', 'Bloqueado'].includes(st) && !txt('Decision final').includes('[INVARIANTE')) {
              try { await notion.comments.create({ parent: { page_id: page.id }, rich_text: [{ text: { content: `[INVARIANTE ${new Date().toISOString().slice(0, 10)}] Este accionable viola una regla que no se negocia: ${bloq.map((x: any) => x.detalle).join(' | ')}`.slice(0, 1900) } }] }); } catch {}
            }
          }
        }
        filas.push({ notion_id: page.id, account: cliente, titulo: p.Accion?.title?.map((t: any) => t.plain_text).join('') || '', estado: p.Estado?.select?.name || '', prioridad: p.Prioridad?.select?.name || '',
          accion: parsed.accion || null, accion_valida: !!parsed.accion && !accionError, accion_error: accionError,
          naturaleza: p.Naturaleza?.select?.name || '', origen: p.Origen?.select?.name || null, entidad: txt('Entidad') || null, causa_raiz: txt('Causa raiz') || null, por_que: txt('Por que').slice(0, 1000),
          detectado: p.Detectado?.date?.start || null, ejecutado_el: p['Ejecutado el']?.date?.start || null, vence: p.Vence?.date?.start || null, reemplazado_por: p['Reemplazado por']?.relation?.[0]?.id || null,
          semanas_pendiente: p['Semanas pendiente']?.number ?? null, revision_ia: p['Revision IA']?.select?.name || null, ultima_edicion: page.last_edited_time, sincronizado: new Date().toISOString() });
      }
      cursor = r.has_more ? r.next_cursor : undefined;
    } while (cursor);
    // Versionado: comparar con lo que habia; si cambio lo sustantivo, guardar version con diff
    const { createHash } = await import('crypto');
    const campos = ['titulo', 'por_que', 'accion', 'entidad', 'prioridad', 'estado'];
    const { data: previos } = await supabase.from('accionables_espejo').select('notion_id, titulo, por_que, accion, entidad, prioridad, estado, hash, version').in('notion_id', filas.map((f: any) => f.notion_id));
    const prevMap = new Map((previos || []).map((p: any) => [p.notion_id, p]));
    const versiones: any[] = [];
    for (const f of filas) {
      const hash = createHash('sha256').update(JSON.stringify(campos.map(c => f[c] ?? null))).digest('hex').slice(0, 16);
      const prev = prevMap.get(f.notion_id);
      f.hash = hash;
      if (!prev) { f.version = 1; versiones.push({ notion_id: f.notion_id, version: 1, autor: f.origen || 'desconocido', diff: { creado: { antes: null, despues: f.titulo } }, hash }); continue; }
      if (prev.hash === hash) { f.version = prev.version || 1; continue; }
      const diff: any = {};
      for (const c of campos) { const a = prev[c] ?? null, b = f[c] ?? null; if (JSON.stringify(a) !== JSON.stringify(b)) diff[c] = { antes: typeof a === 'string' ? a.slice(0, 600) : a, despues: typeof b === 'string' ? b.slice(0, 600) : b }; }
      f.version = (prev.version || 1) + 1;
      versiones.push({ notion_id: f.notion_id, version: f.version, autor: f.ultima_edicion && Date.now() - new Date(f.ultima_edicion).getTime() < 3 * 3600e3 ? 'reciente' : 'desconocido', diff, hash });
    }
    if (filas.length) { const { error } = await supabase.from('accionables_espejo').upsert(filas, { onConflict: 'notion_id' }); if (error) throw new Error(error.message); }
    if (versiones.length) { const { error: ev } = await supabase.from('accionable_versiones').upsert(versiones, { onConflict: 'notion_id,version', ignoreDuplicates: true }); if (ev) console.error('[versiones] ' + ev.message); else console.log(`[versiones] ${versiones.length} nuevas`); }
    // Conflictos: recalcular tras sincronizar
    try { await supabase.rpc('detectar_conflictos'); } catch (e: any) { console.error('[conflictos] ' + e.message); }
    // Relleno unico: los accionables anteriores a la capa de coherencia no tienen Origen ni Entidad.
    // Sin Entidad el reconciliador no deduplica. Origen = Semanal (todos los viejos son del semanal); Entidad = Donde.
    let rellenados = 0;
    for (const f of filas) {
      if (!['Propuesto', 'Bloqueado', 'En curso'].includes(f.estado)) continue;
      const props: any = {};
      if (!f.origen) props.Origen = { select: { name: 'Semanal' } };
      if (!f.entidad) {
        const r: any = await notion.pages.retrieve({ page_id: f.notion_id });
        const donde = r?.properties?.Donde?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        if (donde.trim()) props.Entidad = { rich_text: [{ text: { content: donde.trim().slice(0, 200) } }] };
      }
      if (Object.keys(props).length) { try { await notion.pages.update({ page_id: f.notion_id, properties: props }); rellenados++; await new Promise(r => setTimeout(r, 350)); } catch (e: any) { console.error('[espejo relleno] ' + e.message); } }
    }
    if (rellenados) console.log(`[espejo] ${rellenados} accionables con Origen/Entidad rellenados`);
    // Politicas: los Propuesto creados en las ultimas 24h que aun no tienen accion aprobada
    const hace24 = new Date(Date.now() - 864e5).toISOString();
    const { data: yaAprobados } = await supabase.from('acciones_aprobadas').select('notion_id');
    const setAprob = new Set((yaAprobados || []).map((x: any) => x.notion_id));
    for (const f of filas) {
      if (f.estado !== 'Propuesto' || setAprob.has(f.notion_id) || !f.ultima_edicion || f.ultima_edicion < hace24) continue;
      try { await aplicarPoliticaAuto(f.account, f.notion_id, f.titulo, f.entidad || '', f.origen || 'Semanal', null, null); } catch (e: any) { console.error('[politica espejo] ' + e.message); }
    }
    return filas.length;
  }
  app.all("/api/cron/espejo", async (req, res) => {
    try { const n = await sincronizarEspejo(); res.json({ ok: true, sincronizados: n }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Reconciliacion: sincroniza el espejo, SQL detecta, esto aplica en Notion. Diario 09:40 UTC.
  app.all("/api/cron/reconciliar", async (req, res) => {
    if (!supabase || !notion) return res.status(503).json({ error: 'Supabase o Notion no configurados' });
    try { await sincronizarEspejo(); } catch (e: any) { console.error('[espejo] ' + e.message); }
    const { data: resumen } = await supabase.rpc('reconciliar');
    const { data: pendientes } = await supabase.from('reconciliaciones').select('*').eq('aplicada', false).order('corrida').limit(50);
    let aplicadas = 0; const errores: string[] = [];
    for (const r of pendientes || []) {
      try {
        const [tipo, id] = String(r.objeto).split(':');
        if (tipo !== 'accionable') continue;
        if (r.accion === 'vencer') {
          await notion.pages.update({ page_id: id, properties: { Estado: { select: { name: NOTION_STATES.DESCARTADO } }, 'Decision final': { rich_text: [{ text: { content: `[RECONCILIADOR ${new Date().toISOString().slice(0, 10)}] ${r.detalle}` } }] } } });
        } else if (r.accion === 'duplicado') {
          const viejo = (String(r.detalle).match(/Misma entidad que ([0-9a-f-]{32,36})/) || [])[1];
          if (viejo) await notion.pages.update({ page_id: id, properties: { 'Reemplazado por': { relation: [{ id: viejo }] } } });
        } else if (r.accion === 'ya_hecho') {
          await notion.comments.create({ parent: { page_id: id }, rich_text: [{ text: { content: `[RECONCILIADOR] ${r.detalle} Si es así, marcalo Hecho con la fecha.` } }] });
        }
        await supabase.from('reconciliaciones').update({ aplicada: true, aplicada_el: new Date().toISOString() }).eq('id', r.id); aplicadas++;
      } catch (e: any) { errores.push(`${r.objeto}: ${e.message}`); }
    }
    res.json({ ok: true, resumen, aplicadas, errores });
  });




  // Resuelve una keyword contra la tabla keywords: devuelve campaña y grupo con sus nombres exactos.
  // Los nombres de campaña tienen barras ("Search | DACH | Karedo 2026"), así que no se puede partir texto por "|".
  async function resolverKeyword(account: string, kw: string, pista: string): Promise<{ campana: string; grupo: string; match_type: string } | null> {
    if (!supabase || !kw) return null;
    const { data } = await supabase.rpc('resolver_keyword', { p_account: account, p_keyword: kw, p_pista: pista || '' });
    return data && data.campana ? data : null;
  }

  // ---- Politicas de ejecucion automatica ----
  // Si un accionable nuevo es de un tipo con politica activa y cumple sus condiciones,
  // va directo a acciones_aprobadas (en el modo de la politica) sin esperar a Andres.
  async function aplicarPoliticaAuto(account: string, notionId: string, titulo: string, entidad: string, origen: string, confianza: number | null, comoHacerlo?: string | null): Promise<string | null> {
    if (!supabase) return null;
    const { detectarTipoAuto, extraerKeyword, concordanciaDestino } = await import('./src/lib/tipoAuto');
    const tipo = detectarTipoAuto(titulo, comoHacerlo);
    if (!tipo) return null;
    const { data: modo } = await supabase.rpc('politica_aplica', { p_account: account, p_tipo: tipo, p_origen: origen, p_confianza: confianza, p_entidad: entidad });
    if (!modo) return null;
    const { data: espA } = await supabase.from('accionables_espejo').select('accion, accion_valida').eq('notion_id', notionId).maybeSingle();
    const lote: string[] | null = espA?.accion_valida && espA.accion?.objeto?.keywords?.length > 1 ? espA.accion.objeto.keywords : null;
    const kw = lote ? lote[0] : extraerKeyword(titulo, entidad);
    if (!kw && tipo !== 'pausar_anuncio') return null;
    const destino = tipo === 'cambiar_concordancia' ? concordanciaDestino(titulo) : null;
    if (tipo === 'cambiar_concordancia' && !destino) return null;
    let loteOk: string[] | null = null;
    if (lote && tipo === 'pausar_keyword') { loteOk = []; for (const k of lote) { const rr = await resolverKeyword(account, k, entidad || ''); if (rr) loteOk.push(k); } if (!loteOk.length) return null; }
    const r = await resolverKeyword(account, kw, `${entidad || ''} ${titulo}`);
    if (!r) return null; // sin resolver, no se ejecuta solo: queda para Andres
    const { data: bloqueo, error: errPv } = await supabase.rpc('prevuelo', { p_notion_id: notionId });
    if (errPv) { console.error('[politica] prevuelo fallo: ' + errPv.message); return null; }
    if (bloqueo) { try { if (notion) await notion.comments.create({ parent: { page_id: notionId }, rich_text: [{ text: { content: `[POLÍTICA] Cumple la regla pero no se ejecuta solo: ${bloqueo}` } }] }); } catch {} return null; }
    await supabase.from('acciones_aprobadas').insert({ account, notion_id: notionId, tipo, campana: r.campana, grupo: loteOk ? null : r.grupo, keyword: loteOk ? null : kw, keywords: loteOk || (lote && tipo.startsWith('negativa') ? lote : null), match_type: tipo === 'cambiar_concordancia' ? 'ANY' : (/exact|exacta/i.test(titulo) ? 'EXACT' : 'PHRASE'), match_type_destino: destino, modo, aprobada_por: 'politica', por_politica: true });
    if (notion) { try {
      await notion.pages.update({ page_id: notionId, properties: { Estado: { select: { name: 'En curso' } } } });
      await notion.comments.create({ parent: { page_id: notionId }, rich_text: [{ text: { content: `[POLÍTICA ${new Date().toISOString().slice(0, 10)}] Cumple la regla de ejecución automática para ${tipo.replace('_', ' ')} (${modo}). El script lo aplica en la próxima hora. Si no querías esto, desactivá la política en Sistema › Automatización.` } }] });
    } catch {} }
    return modo;
  }

  // ================================================================
  // CICLO CERRADO: aprobar y ejecutar, briefing, calibracion, impacto
  // ================================================================
  // Aprobar un accionable para que el script ejecutor lo aplique. Solo negativas y pausas.
  app.post("/api/accionables/:id/aprobar-ejecutar", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const body = req.body || {};
    // La accion estructurada de la base manda siempre; el body solo aporta modo (y datos de respaldo para accionables sin JSON)
    if (supabase) {
      const { data: esp } = await supabase.from('accionables_espejo').select('accion, accion_valida, accion_error, account').eq('notion_id', req.params.id).maybeSingle();
      // Sin accion estructurada valida no se ejecuta nada: el texto no alcanza para tocar la cuenta
      if (!esp?.accion_valida || !esp.accion) return res.status(422).json({ error: `Este accionable no tiene acción estructurada válida${esp?.accion_error ? ` (${esp.accion_error})` : ''}. Ejecutalo a mano con "Cómo hacerlo", o esperá a que la tarea del lunes lo reformule.` });
      {
        const { tipoAutoDesde } = await import('./src/lib/accion');
        const a = esp.accion; const t = tipoAutoDesde(a);
        if (t) { body.account = esp.account; body.tipo = t; body.campana = a.objeto.campana; body.grupo = a.objeto.grupo; body.keyword = a.objeto.keyword || a.objeto.keywords?.[0]; body.keywords = a.objeto.keywords?.length > 1 ? a.objeto.keywords : undefined; body.match_type = a.objeto.match_type || (t.startsWith('negativa') ? (a.parametros?.match_type_destino || 'PHRASE') : 'ANY'); body.match_type_destino = a.parametros?.match_type_destino; body.ad_id = a.objeto.anuncio_id; body.parametros = a.parametros || {}; }
      }
    }
    const { account, tipo, campana, grupo, keyword, match_type, match_type_destino, ad_id, modo } = body;
    const keywordsLote: string[] | undefined = Array.isArray(body.keywords) && body.keywords.length > 1 ? body.keywords : undefined;
    // PRE-VUELO: si hay un conflicto abierto que bloquea, no se encola
    const { data: bloqueo, error: errPrevuelo } = await supabase.rpc('prevuelo', { p_notion_id: req.params.id });
    if (errPrevuelo) return res.status(500).json({ error: `El pre-vuelo falló y no se encola sin él: ${errPrevuelo.message}` });
    if (bloqueo) return res.status(409).json({ error: `No se puede ejecutar todavía: ${bloqueo}`, conflicto: true });
    // Que se puede ejecutar sale del registro capacidades_ejecucion, no de una lista fija:
    // agregar un verbo alla lo habilita aca sin tocar el codigo.
    {
      const viejos: Record<string, string> = { negativa_grupo: 'agregar_negativa', negativa_campana: 'agregar_negativa' };
      const verboReal = viejos[tipo] || tipo;
      const { data: cap } = await supabase.from('capacidades_ejecucion').select('ejecutable, por_que_no, riesgo, requiere').eq('verbo', verboReal).maybeSingle();
      if (!cap) return res.status(400).json({ error: `Verbo desconocido: ${tipo}. Los válidos están en capacidades_ejecucion.` });
      if (!cap.ejecutable) return res.status(400).json({ error: `Esto no lo puede hacer un script: ${cap.por_que_no}`, manual: true, por_que: cap.por_que_no });
    }
    if (tipo === 'cambiar_concordancia' && !match_type_destino) return res.status(400).json({ error: 'No pude leer la concordancia destino del título. Ejecutalo a mano.' });
    if (!account || (!keyword && !ad_id)) return res.status(400).json({ error: 'Faltan account y keyword o ad_id' });
    // Resolver la keyword contra la base: campaña y grupo exactos. Para negativas nuevas (que no existen como keyword) se usa lo que vino.
    let camp = campana, grp = grupo, mt = match_type; let loteResuelto: string[] | undefined;
    if (keywordsLote && tipo === 'pausar_keyword') {
      // Lote de pausas: resolver cada una; las que no existen activas se reportan y se omiten
      const ok: string[] = [], no: string[] = [];
      for (const k of keywordsLote) { const r = await resolverKeyword(account, k, `${campana || ''} ${grupo || ''}`); if (r) { ok.push(k); if (!camp) camp = r.campana; } else no.push(k); }
      if (!ok.length) return res.status(422).json({ error: `Ninguna de las ${keywordsLote.length} keywords está activa en ${account}. Puede que ya estén pausadas.` });
      loteResuelto = ok; grp = null; mt = 'ANY';
      if (no.length) console.log(`[lote] ${no.length} no encontradas: ${no.join(', ')}`);
    } else if (keyword && tipo !== 'negativa_grupo' && tipo !== 'negativa_campana') {
      const r = await resolverKeyword(account, keyword, `${campana || ''} ${grupo || ''}`);
      if (!r) return res.status(422).json({ error: `No encontré la keyword "${keyword}" activa en ${account}. Puede estar escrita distinto o ya pausada. Ejecutalo a mano con "Cómo hacerlo".` });
      camp = r.campana; grp = r.grupo; mt = r.match_type;
    } else if (keyword) {
      // Negativa: el grupo o campaña vienen del texto; si hay pista de grupo, resolver el nombre exacto de la campaña por ese grupo
      const r = await resolverKeyword(account, keyword, `${campana || ''} ${grupo || ''}`);
      if (r) { camp = r.campana; if (!grp) grp = r.grupo; }
      else if (grupo) { const { data: g } = await supabase.from('keywords').select('campaign, ad_group').eq('account', account).ilike('ad_group', `%${grupo}%`).limit(1).maybeSingle(); if (g) { camp = g.campaign; grp = g.ad_group; } }
      if (!camp) return res.status(422).json({ error: 'No pude determinar la campaña. Ejecutalo a mano.' });
    }
    const p = (body.parametros || {}) as any;
    const { data, error } = await supabase.from('acciones_aprobadas').insert({
      account, notion_id: req.params.id, tipo, campana: camp, grupo: grp || null,
      keyword: loteResuelto ? null : (keyword || null),
      keywords: loteResuelto || (keywordsLote && tipo.startsWith('negativa') ? keywordsLote : null),
      match_type: mt || 'PHRASE', match_type_destino: match_type_destino || null, ad_id: ad_id || null,
      nivel: p.nivel || null, estrategia_destino: p.estrategia_destino || null,
      valor_actual: p.valor_actual ?? null, valor_nuevo: p.valor_nuevo ?? null, etiqueta: p.etiqueta || null,
      modo: modo === 'ejecutar' ? 'ejecutar' : 'simular'
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    // Estado en Notion: En curso
    if (notion) { try { await notion.pages.update({ page_id: req.params.id, properties: { Estado: { select: { name: 'En curso' } } } }); await notion.comments.create({ parent: { page_id: req.params.id }, rich_text: [{ text: { content: `[APP ${new Date().toISOString().slice(0, 10)}] Aprobado para ejecución automática (${modo === 'ejecutar' ? 'real' : 'simulación'}). El script ejecutor lo aplica en la próxima hora.` } }] }); } catch {} }
    res.json(data);
  });
  app.get("/api/acciones-aprobadas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.from('acciones_aprobadas').select('*').order('aprobada_el', { ascending: false }).limit(50);
    res.json(data || []);
  });
  // El script ejecutor reporta resultado (Bearer CRON_SECRET)
  app.post("/api/cron/ejecutor-resultado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { id, estado, resultado } = req.body || {};
    if (!id || !estado) return res.status(400).json({ error: 'id y estado' });
    const { data: acc } = await supabase.from('acciones_aprobadas').update({ estado, resultado, ejecutada_el: new Date().toISOString() }).eq('id', id).select().single();
    if (acc?.notion_id && notion && estado === 'ejecutada') {
      try { await notion.pages.update({ page_id: acc.notion_id, properties: { Estado: { select: { name: NOTION_STATES.HECHO } }, 'Ejecutado el': { date: { start: new Date().toISOString().slice(0, 10) } }, 'Decision final': { rich_text: [{ text: { content: `Ejecutado por el script a las ${new Date().toISOString().slice(11, 16)} UTC. ${resultado || ''}`.slice(0, 1900) } }] } } }); } catch {}
      await supabase.from('operator_log').insert({ account: acc.account, fecha: new Date().toISOString().slice(0, 10), hora: new Date().toISOString().slice(11, 16), que_cambio: `${acc.tipo}: ${acc.keywords?.length ? acc.keywords.length + ' keywords: ' + acc.keywords.join(', ').slice(0, 300) : (acc.keyword || acc.ad_id)}`, donde: `${acc.campana}${acc.grupo ? ' › ' + acc.grupo : ''}`, por_que: 'Aprobado en la app, ejecutado por el script', accionable_notion_id: acc.notion_id });
    }
    res.json({ ok: true });
  });

  app.get("/api/limitada", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.from('v_por_que_limitada').select('*').eq('account', req.query.client as string).maybeSingle();
    res.json(data || null);
  });

  app.get("/api/politicas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const [p, g] = await Promise.all([supabase.from('politicas_auto').select('*').order('tipo'), supabase.from('ajustes_sistema').select('valor').eq('clave', 'auto_ejecucion').maybeSingle()]);
    res.json({ politicas: p.data || [], general: g.data?.valor?.activa === true });
  });
  app.put("/api/politicas/general", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { activa } = req.body || {};
    await supabase.from('ajustes_sistema').update({ valor: { activa: !!activa, nota: 'Interruptor general. Si esta en false, ninguna politica ejecuta aunque este activa.' }, actualizado: new Date().toISOString() }).eq('clave', 'auto_ejecucion');
    res.json({ ok: true });
  });
  app.put("/api/politicas/:tipo", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { activa, modo, confianza_min, gasto_max, solo_origen, cuentas } = req.body || {};
    const upd: any = { actualizada: new Date().toISOString() };
    if (activa !== undefined) upd.activa = !!activa; if (modo) upd.modo = modo; if (confianza_min != null) upd.confianza_min = confianza_min;
    if (gasto_max !== undefined) upd.gasto_max = gasto_max; if (solo_origen) upd.solo_origen = solo_origen; if (cuentas) upd.cuentas = cuentas;
    const { error } = await supabase.from('politicas_auto').update(upd).eq('tipo', req.params.tipo);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });


  app.post("/api/invariantes", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { account, accion } = req.body || {};
    const { data, error } = await supabase.rpc('verificar_invariantes', { p_account: account, p_accion: accion });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app.get("/api/relaciones-abiertas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.from('accionable_relaciones').select('a, b, motivo').eq('resuelta', false).eq('severidad', 'bloquea');
    const m: Record<string, string> = {}; for (const r of data || []) { m[r.a] = r.motivo; if (!String(r.b).startsWith('keyword:')) m[r.b] = r.motivo; }
    res.json(m);
  });
  // Historial y relaciones de un accionable: que cambio desde que se propuso, y con que conflicta
  app.get("/api/accionables/:id/contexto", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const id = req.params.id;
    const [v, rel, esp] = await Promise.all([
      supabase.from('accionable_versiones').select('*').eq('notion_id', id).order('version', { ascending: false }).limit(10),
      supabase.from('v_accionable_relaciones').select('*').or(`a.eq.${id},b.eq.${id}`).eq('resuelta', false),
      supabase.from('accionables_espejo').select('version, accion, accion_valida, accion_error, hash').eq('notion_id', id).maybeSingle(),
    ]);
    const { data: bloqueo } = await supabase.rpc('prevuelo', { p_notion_id: id });
    res.json({ versiones: v.data || [], relaciones: rel.data || [], actual: esp.data, bloqueo: bloqueo || null });
  });
  app.post("/api/relaciones/:id/resolver", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    await supabase.from('accionable_relaciones').update({ resuelta: true, resuelta_el: new Date().toISOString(), resuelta_por: 'andres' }).eq('id', req.params.id);
    res.json({ ok: true });
  });


  // Salud del sistema en una consulta. El punto: que Andres no descubra que algo
  // se rompio leyendo la salida de un agente tres dias despues.
  app.get("/api/salud", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data, error } = await supabase.rpc('get_salud_sistema');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/cuentas", async (_req, res) => res.json(await cuentasActivas()));


  // ---- Navegacion de cadena: cinco niveles, agregados en SQL ----
  app.get("/api/cadena/:nivel", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { nivel } = req.params;
    const q = req.query as any;
    const account = q.account || q.client;
    if (!account) return res.status(400).json({ error: 'falta account' });
    const semanas = Math.min(26, Math.max(1, parseInt(q.semanas) || 4));
    const nulo = (v: any) => (v === undefined || v === '' || v === 'todos' ? null : String(v));
    const fns: Record<string, { fn: string; args: any }> = {
      objetivos:  { fn: 'nav_objetivos',  args: { p_account: account, p_semanas: semanas } },
      locales:    { fn: 'v_location_ranking_bayes', args: { p_account: account, p_semanas: semanas } },
      campanas:   { fn: 'nav_campanas',   args: { p_account: account, p_location: nulo(q.local), p_objetivo: nulo(q.objetivo), p_semanas: semanas } },
      grupos:     { fn: 'nav_grupos',     args: { p_account: account, p_location: nulo(q.local), p_campana: nulo(q.campana), p_semanas: semanas } },
      keywords:   { fn: 'nav_keywords',   args: { p_account: account, p_location: nulo(q.local), p_campana: nulo(q.campana), p_grupo: nulo(q.grupo), p_semanas: semanas } },
      terminos:   { fn: 'nav_terminos',   args: { p_account: account, p_location: nulo(q.local), p_campana: nulo(q.campana), p_grupo: nulo(q.grupo), p_semanas: semanas } },
      contadores: { fn: 'nav_contadores', args: { p_account: account, p_semanas: semanas } },
      transversal:{ fn: 'v_keywords_entre_locales', args: { p_account: account, p_semanas: semanas } },
      corporativas:{ fn: 'v_corporativas', args: { p_account: account, p_semanas: semanas } },
    };
    const cfg = fns[nivel];
    if (!cfg) return res.status(400).json({ error: 'nivel invalido: ' + nivel });
    const { data, error } = await supabase.rpc(cfg.fn, cfg.args);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ nivel, filas: data || [], semanas });
  });

  // Briefing: lo que hay para vos hoy. Lo lee el script de briefing (mail) y la app.
  app.get("/api/briefing", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.rpc('get_briefing');
    res.json(data);
  });
  // Calibracion e impacto: el ciclo cerrado visible
  app.get("/api/ciclo", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const client = req.query.client as string;
    const [cal, calg, imp, tasa, pred] = await Promise.all([
      supabase.from('v_calibracion').select('*'),
      supabase.from('v_calibracion_global').select('*').maybeSingle(),
      client ? supabase.from('v_impacto_accionables').select('*').eq('account', client).order('ejecutado_el', { ascending: false }).limit(10) : supabase.from('v_impacto_accionables').select('*').order('ejecutado_el', { ascending: false }).limit(10),
      supabase.from('v_tasa_acierto').select('*'),
      client ? supabase.from('predicciones').select('*').eq('account', client).order('semana', { ascending: false }).limit(8) : supabase.from('predicciones').select('*').order('semana', { ascending: false }).limit(12),
    ]);
    res.json({ calibracion: cal.data || [], global: calg.data, impactos: imp.data || [], tasa_acierto: tasa.data || [], predicciones: pred.data || [] });
  });


  // Propuestas estrategicas: las apuestas grandes. Andres aprueba, descarta, marca en test o adoptada.
  app.get("/api/propuestas", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    let q = supabase.from('propuestas_estrategicas').select('*').order('fecha', { ascending: false }).limit(40);
    if (req.query.client) q = q.eq('account', req.query.client as string);
    const { data } = await q; res.json(data || []);
  });
  // Cambiar estado en cualquier direccion, con nota y con lo que realmente se hizo. Deja historial.
  app.post("/api/propuestas/:id/estado", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { estado, nota, ejecucion_real } = req.body || {};
    if (!['propuesta', 'aprobada', 'en_test', 'adoptada', 'descartada', 'pausada'].includes(estado)) return res.status(400).json({ error: 'estado invalido' });
    const { data, error } = await supabase.rpc('propuesta_cambiar_estado', { p_id: Number(req.params.id), p_estado: estado, p_nota: nota || null, p_ejecucion_real: ejecucion_real || null, p_por: 'andres' });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  // Editar campos de texto (que se hizo realmente, resultado real)
  app.put("/api/propuestas/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { ejecucion_real, resultado_real, decision_andres } = req.body || {};
    const upd: any = {}; if (ejecucion_real !== undefined) upd.ejecucion_real = ejecucion_real; if (resultado_real !== undefined) upd.resultado_real = resultado_real; if (decision_andres !== undefined) upd.decision_andres = decision_andres;
    const { error } = await supabase.from('propuestas_estrategicas').update(upd).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  // Compatibilidad con los botones viejos
  app.post("/api/propuestas/:id/:accion", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const estado: any = { aprobar: 'aprobada', descartar: 'descartada', test: 'en_test', adoptar: 'adoptada', pausar: 'pausada' }[req.params.accion];
    if (!estado) return res.status(400).json({ error: 'accion invalida' });
    const { data, error } = await supabase.rpc('propuesta_cambiar_estado', { p_id: Number(req.params.id), p_estado: estado, p_nota: (req.body || {}).nota || null, p_ejecucion_real: null, p_por: 'andres' });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  // Lo aprendido: lecciones, conocimiento externo, acierto por tipo
  app.get("/api/aprendido", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const client = req.query.client as string | undefined;
    const [lec, con, tipo, brecha] = await Promise.all([
      client ? supabase.from('lecciones').select('*').or(`account.eq.${client},account.is.null`).order('confianza', { ascending: false }).limit(30) : supabase.from('lecciones').select('*').order('confianza', { ascending: false }).limit(40),
      supabase.from('conocimiento_externo').select('*').order('fecha', { ascending: false }).limit(30),
      client ? supabase.from('v_acierto_por_tipo').select('*').eq('account', client) : supabase.from('v_acierto_por_tipo').select('*'),
      supabase.from('v_brecha_objetivo').select('*'),
    ]);
    const { data: inv } = await supabase.from('v_accionables_invalidos').select('*').limit(30);
    res.json({ lecciones: lec.data || [], conocimiento: con.data || [], acierto_por_tipo: tipo.data || [], brecha: brecha.data || [], invalidos: inv || [] });
  });


  // ================================================================
  // NOVEDADES: lo que los agentes hicieron y Andres no vio
  // ================================================================
  async function sincronizarComentarios(): Promise<number> {
    if (!supabase || !notion) return 0;
    const { data: abiertos } = await supabase.from('accionables_espejo').select('notion_id, account, titulo').in('estado', ['Propuesto', 'Bloqueado', 'En curso']).is('reemplazado_por', null);
    let nuevos = 0;
    for (const a of abiertos || []) {
      try {
        const r: any = await notion.comments.list({ block_id: a.notion_id, page_size: 50 });
        for (const c of r.results || []) {
          const texto = (c.rich_text || []).map((t: any) => t.plain_text).join('');
          const m = texto.match(/^\[([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ .·]*?)(?:\s[\d-]+.*?)?\]/);
          const prefijo = m ? m[1].trim() : null;
          const esAndres = /^\[ANDRES/i.test(texto) || (!m && c.created_by?.type === 'person');
          const autor = esAndres ? 'andres' : (m ? 'agente' : 'notion');
          const { data: ins } = await supabase.from('accionable_comentarios').upsert({ comment_id: c.id, notion_id: a.notion_id, account: a.account, autor, prefijo, texto: texto.slice(0, 2000), creado: c.created_time }, { onConflict: 'comment_id', ignoreDuplicates: true }).select('comment_id');
          if (ins?.length && autor !== 'andres') {
            const { data: actorRow } = await supabase.rpc('actor_desde_prefijo', { p: prefijo });
            await supabase.from('novedades').upsert({ tipo: 'comentario', account: a.account, ref_tipo: 'accionable', ref_id: a.notion_id, titulo: `${prefijo ? prefijo.replace(/·.*$/, '').trim() : 'Alguien'} comentó: ${String(a.titulo).slice(0, 70)}`, texto: texto.replace(/^\[[^\]]*\]\s*/, '').slice(0, 300), autor: prefijo || 'notion', actor: actorRow || 'agente', verbo: 'comento', objeto_titulo: a.titulo, creada: c.created_time, clave: 'comentario:' + c.id }, { onConflict: 'clave', ignoreDuplicates: true });
            nuevos++;
          }
        }
        await new Promise(r => setTimeout(r, 350));
      } catch (e: any) { console.error('[comentarios] ' + a.notion_id + ': ' + e.message); }
    }
    return nuevos;
  }

  // Refresca accionables_espejo desde Notion. Antes solo pasaba al abrir la app.
  async function refrescarEspejo(): Promise<number> {
    const notionKey = process.env.NOTION_API_KEY;
    if (!supabase || !notionKey || !NOTION_BASES.ACCIONABLES) return 0;
    const notion = new NotionClient({ auth: notionKey });
    const r: any = await notion.databases.query({ database_id: NOTION_BASES.ACCIONABLES, page_size: 100 });
    const { parsearAccion } = await import('./src/lib/accion');
    const filas: any[] = [];
    for (const page of r.results as any[]) {
      const p = page.properties || {};
      const txt = (x: any) => (x?.rich_text || x?.title || []).map((t: any) => t.plain_text).join('');
      const cuenta = await resolveNotionClient(notion, p.Cliente);
      const accionJson = txt(p['Accion JSON']);
      const parsed = parsearAccion(accionJson);
      filas.push({
        notion_id: page.id, account: cuenta, titulo: txt(p.Accionable || p.Name), estado: p.Estado?.select?.name || null,
        prioridad: p.Prioridad?.select?.name || null, naturaleza: p.Naturaleza?.select?.name || null,
        origen: p.Origen?.select?.name || null, entidad: txt(p.Entidad) || null, causa_raiz: txt(p['Causa raiz']) || null,
        por_que: txt(p['Por que'] || p['Por qué']).slice(0, 1000), detectado: p.Detectado?.date?.start || null,
        ejecutado_el: p['Ejecutado el']?.date?.start || null, vence: p.Vence?.date?.start || null,
        semanas_pendiente: p['Semanas pendiente']?.number ?? null, revision_ia: txt(p['Revision IA']) || null,
        ultima_edicion: page.last_edited_time, sincronizado: new Date().toISOString(),
        accion: parsed.accion || null, accion_valida: !!parsed.accion, accion_error: parsed.error || null
      });
    }
    if (!filas.length) return 0;
    const { error } = await supabase.from('accionables_espejo').upsert(filas, { onConflict: 'notion_id' });
    if (error) throw new Error(error.message);
    return filas.length;
  }

  app.all("/api/cron/novedades", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    try {
      const comentarios = await sincronizarComentarios();
      const { data: otras } = await supabase.rpc('novedades_generar');
      // El espejo se escribia solo cuando alguien abria la app: los agentes leen
      // accionables_vigentes() y encontraban una foto de horas atras. Ahora se
      // refresca cada 30 minutos con las novedades.
      let espejo = 0;
      try { espejo = await refrescarEspejo(); } catch (e: any) { console.error('[espejo] ' + e.message); }
      res.json({ ok: true, comentarios_nuevos: comentarios, otras: otras, espejo_filas: espejo });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/novedades", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.from(req.query.todas ? 'v_novedades_7d' : 'v_novedades').select('*').limit(req.query.todas ? 150 : 60);
    res.json(data || []);
  });
  // Marcar leidas: por objeto (al abrirlo) o todas
  app.post("/api/novedades/leer", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { ref_tipo, ref_id, todas } = req.body || {};
    let q = supabase.from('novedades').update({ leida_el: new Date().toISOString() }).is('leida_el', null);
    if (!todas) { if (!ref_tipo || !ref_id) return res.status(400).json({ error: 'ref_tipo y ref_id, o todas' }); q = q.eq('ref_tipo', ref_tipo).eq('ref_id', String(ref_id)); }
    const { error } = await q; if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  // Comentarios de un accionable desde el espejo (rapido, sin pegarle a Notion)
  app.get("/api/accionables/:id/comentarios", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data } = await supabase.from('accionable_comentarios').select('*').eq('notion_id', req.params.id).order('creado', { ascending: false });
    res.json(data || []);
  });

  // ---- Doc maestro ensamblado ----
  app.get("/api/doc-maestro/:account", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { account } = req.params;
    const [doc, secciones] = await Promise.all([
      supabase.rpc('get_doc_maestro', { p_account: account }),
      supabase.from('doc_maestro_humano').select('seccion, orden, contenido, version, editado_el, editado_por').eq('account', account).eq('vigente', true).order('orden')
    ]);
    if (doc.error) return res.status(500).json({ error: doc.error.message });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ markdown: doc.data, secciones: secciones.data || [] });
  });

  // Editar una seccion de la capa humana: crea version nueva
  app.put("/api/doc-maestro/:account/:seccion", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { account, seccion } = req.params;
    const { contenido } = req.body;
    if (!contenido || typeof contenido !== 'string') return res.status(400).json({ error: 'contenido requerido' });
    const { data, error } = await supabase.rpc('doc_maestro_editar', { p_account: account, p_seccion: seccion, p_contenido: contenido, p_editado_por: 'andres' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ version: data });
  });

  // Historial de versiones de una seccion
  app.get("/api/doc-maestro/:account/:seccion/versiones", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { account, seccion } = req.params;
    const { data, error } = await supabase.from('doc_maestro_humano').select('version, editado_el, editado_por, vigente, contenido').eq('account', account).eq('seccion', seccion).order('version', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });


  // ================================================================
  // PULSO DIARIO: Gemini interpreta ayer, por cuenta
  // ================================================================
  // Vercel Cron, 09:45 UTC (06:45 BA): despues del script diario (06:00) y
  // del recuento de escalera (06:30). Una llamada por cuenta con paquete de
  // tamano constante. Solo escala a Notion y mail si es critico.
  app.all("/api/cron/pulso-diario", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    if (!pulsoDisponible()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurada' });
    // Si llego hasta aca, paso el middleware: con CRON_SECRET (Vercel Cron, pg_net),
    // con sesion de la app (prueba manual desde el navegador) o con APP_ACCESS_TOKEN.

    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const fecha = (req.query.fecha as string) || ayer.toISOString().slice(0, 10);
    const cuentas = (req.query.client as string) ? [req.query.client as string] : (await cuentasActivas()).map(c => c.account);
    const forzar = req.query.forzar === '1';

    // Idempotencia: si ya hay pulso para (cuenta, fecha) y no se fuerza, no se llama al modelo.
    // Permite que Vercel Cron y pg_net disparen ambos sin producir dos pulsos.
    const { data: existentes } = await supabase.from('pulso_diario').select('account').eq('fecha', fecha).in('account', cuentas);
    const yaHechas = new Set((existentes || []).map((e: any) => e.account));
    const pendientes = forzar ? cuentas : cuentas.filter(c => !yaHechas.has(c));
    if (!pendientes.length) return res.json({ ok: true, fecha, resultados: [], nota: 'ya existía pulso para todas las cuentas' });

    // Las cuentas en paralelo: el cron termina en el tiempo de la más lenta,
    // y evita el headersTimeout de Node que aparece con llamadas en serie.
    const resultados = await Promise.allSettled(pendientes.map(async (cuenta) => {
      const { data: input, error } = await supabase!.rpc('get_pulso_input', { p_account: cuenta, p_fecha: fecha });
      if (error) throw new Error(`get_pulso_input: ${error.message}`);
      // La foto unica: lo que todos los agentes leen. Incluye accionables abiertos (para no repetirlos), alertas, cambios del operador.
      const { data: estado } = await supabase!.rpc('get_estado_cuenta', { p_account: cuenta });
      if (estado) { input.estado_cuenta = estado; input.foto_tomada = estado.foto_tomada; }
      const { data: cta } = await supabase!.from('cuentas').select('reglas_dominio').eq('account', cuenta).maybeSingle();
      const reglas = cta?.reglas_dominio || getClientContext(cuenta) || '';
      // Memoria semantica: que se parece a lo de hoy (anomalias, terminos, grupos). Antes de esta fecha, para no encontrarse a si mismo.
      let parecidos: any[] = [];
      try {
        const resumenHoy = [input?.anomalias_2d?.map((a: any) => a.explicacion).join('. '), input?.grupos_ayer?.slice(0, 4).map((g: any) => `${g.grupo} ${g.conv} conv ${g.clics} clics`).join('; '), input?.terminos_nuevos_con_gasto?.slice(0, 3).map((t: any) => t.t).join(', ')].filter(Boolean).join(' | ');
        if (resumenHoy.length > 40) parecidos = await parecidoA(supabase!, resumenHoy, cuenta, 5, fecha);
      } catch {}
      const r = await correrPulso(cuenta, fecha, input, reglas, parecidos);
      if (r.error || !r.parsed) throw new Error(r.error || 'sin salida');
      const p = r.parsed;
      const planId = input?.plan?.id || null;

      await supabase!.from('pulso_diario').upsert({
        account: cuenta, fecha, nivel: p.nivel, resumen: p.resumen, hallazgo_principal: p.hallazgo_principal,
        conecta_con: p.conecta_con, plan_id: planId, evidencia: p.evidencia, hallazgos: p.hallazgos, hipotesis_movidas: p.hipotesis_movidas,
        tokens_in: r.tokens_in, tokens_out: r.tokens_out, costo_usd: r.costo_usd, modelo: 'claude-sonnet-5', foto_leida: input?.foto_tomada || null
      }, { onConflict: 'account,fecha' });

      // Filtro determinista: qué hallazgos pasan a accionable
      const { data: filtrados } = await supabase!.rpc('filtrar_hallazgos_a_accionables', { p_account: cuenta, p_fecha: fecha });
      let creados = 0;
      for (const h of (filtrados || []) as any[]) {
        if (!notion || !NOTION_BASES.ACCIONABLES) break;
        const { tituloDesde } = await import('./src/lib/accion');
        // El pulso devuelve la accion plana; se arma la forma canonica {objeto, parametros, verificar}
        const pl: any = h.accion;
        const accionCanonica = pl ? {
          verbo: pl.verbo,
          objeto: { campana: pl.campana || null, grupo: pl.grupo || null, keyword: pl.keyword || null, match_type: pl.match_type || null },
          parametros: { match_type_destino: pl.match_type_destino || null, nivel: pl.nivel || null, pregunta: pl.pregunta || null, donde: pl.donde || null, que_hacer: pl.que_hacer || null, no_ejecutar_antes_de: pl.no_ejecutar_antes_de || null },
          verificar: pl.verificar_metrica ? { metrica: pl.verificar_metrica, fecha: pl.verificar_fecha || '', esperado: pl.verificar_esperado || '' } : null,
        } : null;
        const tituloBase = accionCanonica ? tituloDesde(accionCanonica as any) : h.titulo;
        const title = `${tituloBase} · ${cuenta}`.slice(0, 200);
        // LEER ANTES DE ESCRIBIR: si hay uno abierto para la misma entidad o causa, comentar en vez de crear
        const entidadClave = String(h.donde || h.entidad || '').slice(0, 200);
        const { data: existenteId } = await supabase!.rpc('accionable_existente', { p_account: cuenta, p_entidad: entidadClave, p_causa: h.causa_raiz || null });
        if (existenteId) {
          try { await notion.comments.create({ parent: { page_id: existenteId }, rich_text: [{ text: { content: `[PULSO ${fecha}] Sigue vigente. ${String(h.evidencia_texto || '').slice(0, 600)}` } }] }); } catch {}
          continue;
        }
        const ex: any = await notion.databases.query({ database_id: actionablesDbSafe(), filter: { property: 'Accion', title: { equals: title } } });
        const activo = ex.results.find((pg: any) => { const st = pg?.properties?.Estado?.select?.name; return st !== NOTION_STATES.HECHO && st !== NOTION_STATES.DESCARTADO; });
        if (activo) continue;
        const clienteId = await findNotionClientId(notion, cuenta);
        const nat = h.naturaleza === 'observacion' ? 'Observacion' : h.naturaleza === 'inferencia' ? 'Inferencia' : 'Hipotesis';
        const vence = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        const props: any = {
          Accion: { title: [{ text: { content: title } }] },
          // Un solo escritor: el pulso PROPONE. Nace Bloqueado; el semanal lo confirma el lunes. Vence en 7 dias si nadie lo toca.
          Estado: { select: { name: NOTION_STATES.BLOQUEADO } },
          Origen: { select: { name: 'Pulso diario' } },
          Entidad: { rich_text: [{ text: { content: entidadClave } }] },
          Vence: { date: { start: vence } },
          Prioridad: { select: { name: h.severidad === 'critica' ? 'Urgente' : h.severidad === 'alta' ? 'Alta' : 'Media' } },
          Naturaleza: { select: { name: nat } },
          'Por que': { rich_text: [{ text: { content: String(h.evidencia_texto || '').slice(0, 1900) } }] },
          'Como hacerlo': { rich_text: [{ text: { content: String(h.como_hacerlo || '').slice(0, 1900) } }] },
          'Accion JSON': { rich_text: [{ text: { content: accionCanonica ? '`' + JSON.stringify(accionCanonica).slice(0, 1880) + '`' : '' } }] },
          'Causa raiz': { rich_text: [{ text: { content: String(h.causa_raiz || p.conecta_con || '').slice(0, 500) } }] },
          Donde: { rich_text: [{ text: { content: String(h.donde || h.entidad || '').slice(0, 300) } }] },
          Detectado: { date: { start: new Date().toISOString().slice(0, 10) } },
          'Semanas pendiente': { number: 0 }
        };
        props['Que lo confirmaria'] = { rich_text: [{ text: { content: `Propuesto por el análisis diario con confianza ${h.confianza}. La tarea del lunes lo confirma con 7 días de evidencia, o lo descarta. Vence el ${vence} si nadie lo toca.` } }] };
        if (clienteId) props.Cliente = { relation: [{ id: clienteId }] };
        const creada: any = await notion.pages.create({ parent: { database_id: actionablesDbSafe() }, properties: props });
        creados++;
        try { await aplicarPoliticaAuto(cuenta, creada.id, title, entidadClave, 'Pulso diario', Number(h.confianza), h.como_hacerlo); } catch (e: any) { console.error('[politica] ' + e.message); }
      }
      return { cuenta, nivel: p.nivel, hallazgo: p.hallazgo_principal, hallazgos_detectados: p.hallazgos.length, accionables_creados: creados, tokens_in: r.tokens_in, tokens_out: r.tokens_out, costo_usd: Number(r.costo_usd.toFixed(5)) };
    }));

    const out = resultados.map((r, i) => r.status === 'fulfilled' ? r.value : { cuenta: pendientes[i], error: (r.reason as Error).message });
    out.filter((r: any) => r.error).forEach((r: any) => console.error(`[pulso] ${r.cuenta}: ${r.error}`));
    // Ingestar a memoria lo nuevo y embeber lo pendiente
    try { await supabase.rpc('memoria_ingestar'); const n = await embeberPendientes(supabase); if (n) console.log(`[memoria] ${n} embebidos`); } catch (e: any) { console.error('[memoria] ' + e.message); }
    res.json({ ok: true, fecha, modelo: 'claude-sonnet-5', resultados: out, costo_total_usd: Number(out.reduce((a: number, r: any) => a + (r.costo_usd || 0), 0).toFixed(5)) });
  });


  // Plan de la semana y evidencia acumulada del diario contra él
  app.get("/api/plan", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const client = req.query.client as string;
    if (!client) return res.status(400).json({ error: 'client requerido' });
    const { data: plan } = await supabase.from('plan_semanal').select('*').eq('account', client).order('semana', { ascending: false }).limit(1).maybeSingle();
    if (!plan) return res.json({ plan: null, pulsos: [] });
    const { data: pulsos } = await supabase.from('pulso_diario').select('fecha, nivel, resumen, hallazgo_principal, conecta_con, evidencia, hipotesis_movidas, hallazgos, costo_usd')
      .eq('account', client).gte('fecha', plan.semana).order('fecha');
    // Por indicador: serie de la semana (valor y cumple por día)
    const ind = (plan.indicadores as any[]).map((i: any, idx: number) => ({
      ...i,
      serie: (pulsos || []).map((p: any) => { const e = (p.evidencia || [])[idx]; return { fecha: p.fecha, valor: e?.valor ?? null, cumple: e?.cumple ?? null, dias: e?.dias_seguidos_cumpliendo ?? 0 }; })
    }));
    res.json({ plan: { ...plan, indicadores: ind }, pulsos: pulsos || [] });
  });

  // Lectura para la app
  app.get("/api/pulso", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const client = req.query.client as string;
    const days = Number(req.query.days) || 7;
    let q = supabase.from('pulso_diario').select('*').order('fecha', { ascending: false }).limit(days * 3);
    if (client) q = q.eq('account', client);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const costoMes = (data || []).filter((p: any) => new Date(p.fecha) >= new Date(Date.now() - 30 * 864e5)).reduce((a: number, p: any) => a + Number(p.costo_usd || 0), 0);
    res.json({ pulsos: data || [], costo_ultimos_30d_usd: Number(costoMes.toFixed(4)) });
  });

  // Mantenimiento semanal: retención por tabla. Vercel Cron, lunes 06:00 UTC.
  app.all("/api/cron/mantenimiento", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    // Si llego hasta aca, paso el middleware: con CRON_SECRET (Vercel Cron, pg_net),
    // con sesion de la app (prueba manual desde el navegador) o con APP_ACCESS_TOKEN.
    try {
      const { data, error } = await supabase.rpc('mantenimiento_semanal');
      if (error) return res.status(500).json({ error: error.message });
      const { data: salud } = await supabase.from('v_salud_sistema').select('tabla, filas, estado').neq('estado', 'OK');
      res.json({ ok: true, ran_at: new Date().toISOString(), borrado: data, alertas: salud || [] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Salud del sistema: tamaño y crecimiento por tabla
  app.get("/api/salud-sistema", async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const { data, error } = await supabase.from('v_salud_sistema').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // Catch-all SIEMPRE al final: cualquier ruta agregada después de esto no existe.
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.originalUrl || req.path}` });
  });

  return app;
}

function actionablesDbSafe(): string { return NOTION_BASES.ACCIONABLES as string; }

async function findNotionClientId(notionClient: any, account: string): Promise<string | null> {
  if (!NOTION_BASES.CLIENTES) return null;
  try {
    const r: any = await notionClient.databases.query({ database_id: NOTION_BASES.CLIENTES });
    for (const p of r.results) {
      const nombre = p.properties?.Cliente?.title?.map((t: any) => t.plain_text).join('') || p.properties?.Name?.title?.map((t: any) => t.plain_text).join('') || '';
      const ct = (await cuentasActivas()).find(c => c.account === account);
      const nm = String(nombre).toLowerCase(), base = (ct?.nombre_cliente || account).toLowerCase();
      if (nm === base || nm.includes(base.split(' ')[0]) || nm.includes(account.toLowerCase().replace('_', ' '))) return p.id;
    }
  } catch {}
  return null;
}

async function runAnomalyWorker() {
  // Lee v_anomalia_explicada (z-score diario contra media movil de 7 dias, con
  // explicacion que considera la hora del primer cambio) y crea un accionable
  // por cada anomalia critica o alta de los ultimos 3 dias consolidados que no
  // tenga ya uno abierto. Reemplaza al worker anterior, que leia la capa
  // semanal con una columna inexistente y nunca corrio.
  const actionablesDbId = NOTION_BASES.ACCIONABLES;
  if (!supabase || !notion || !actionablesDbId) return { creados: 0, motivo: 'sin supabase o notion' };

  const desde = new Date(); desde.setDate(desde.getDate() - 5);
  const { data: anomalias, error } = await supabase
    .from('v_anomalia_explicada').select('*')
    .in('severidad', ['critica', 'alta'])
    .gte('date', desde.toISOString().slice(0, 10))
    .order('date', { ascending: false });
  if (error) { console.error('[anomalias] ' + error.message); return { creados: 0, error: error.message }; }

  let creados = 0, comentados = 0;
  for (const a of anomalias || []) {
    const cuenta = a.account;
    const fecha = a.date;
    const metrica = a.metrica_anomala || (a.gasto_direccion ? 'gasto' : 'cpa');
    const title = `[Anomalía] ${cuenta} · ${metrica} ${a.gasto_direccion || a.cpa_direccion || ''} el ${fecha}`;
    try {
      const existing: any = await notion.databases.query({
        database_id: actionablesDbId,
        filter: { property: 'Accion', title: { equals: title } }
      });
      const activo = existing.results.find((p: any) => {
        const st = p?.properties?.Estado?.select?.name;
        return st !== NOTION_STATES.HECHO && st !== NOTION_STATES.DESCARTADO;
      });
      if (activo) continue; // ya existe, no se repite ni se comenta: la vista es determinista

      // Naturaleza: Observacion si la vista encontro un cambio que lo explica; Hipotesis si no
      const explicado = /Cambio (propio|automático)|registró/.test(a.explicacion || '');
      const naturaleza = explicado ? 'Observacion' : 'Hipotesis';
      const clienteId = await findNotionClientId(notion, cuenta);

      const why = `Desvío estadístico el ${fecha}: severidad ${a.severidad}. ` +
        (a.gasto_z != null ? `Gasto z=${Number(a.gasto_z).toFixed(1)} (${a.gasto} vs baseline ${a.gasto_baseline}). ` : '') +
        (a.cpa_z != null ? `CPA z=${Number(a.cpa_z).toFixed(1)} (${a.cpa} vs baseline ${a.cpa_baseline}). ` : '') +
        (a.campana_principal ? `Campaña principal: ${a.campana_principal}. ` : '') +
        `Explicación de la vista: ${a.explicacion}`;

      // LEER ANTES DE ESCRIBIR: si ya hay uno abierto para la misma campaña, comentar en vez de crear
      const entidadClaveA = a.campana_principal ? String(a.campana_principal) : `${cuenta}|anomalia`;
      const { data: existenteA } = await supabase!.rpc('accionable_existente', { p_account: cuenta, p_entidad: entidadClaveA, p_causa: null });
      if (existenteA) { try { await notion.comments.create({ parent: { page_id: existenteA }, rich_text: [{ text: { content: `[ANOMALIAS ${fecha}] Otro desvío en la misma entidad. ${why}`.slice(0, 600) } }] }); } catch {} continue; }
      // Un solo escritor: anomalias PROPONE. Nace Bloqueado con vencimiento; el semanal decide.
      const props: any = {
        Accion: { title: [{ text: { content: title } }] },
        Estado: { select: { name: NOTION_STATES.BLOQUEADO } },
        Origen: { select: { name: 'Anomalias' } },
        Entidad: { rich_text: [{ text: { content: entidadClaveA } }] },
        Vence: { date: { start: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) } },
        Prioridad: { select: { name: a.severidad === 'critica' ? 'Urgente' : 'Alta' } },
        Naturaleza: { select: { name: naturaleza } },
        'Por que': { rich_text: [{ text: { content: why.slice(0, 1900) } }] },
        'Causa raiz': { rich_text: [{ text: { content: explicado ? 'Un cambio del mismo día explica el desvío' : 'Desvío sin cambio registrado ese día' } }] },
        Donde: { rich_text: [{ text: { content: a.campana_principal ? `Campaña ${a.campana_principal}` : `Cuenta ${cuenta}, el ${fecha}` } }] },
        Detectado: { date: { start: new Date().toISOString().slice(0, 10) } },
        'Semanas pendiente': { number: 0 }
      };
      if (!explicado) props['Que lo confirmaria'] = { rich_text: [{ text: { content: 'Una fila en operator_log de Andrés para ese día, o un diff en v_cambios_detectados, o confirmación de que fue el mercado (mismo día de la semana previa similar).' } }] };
      if (clienteId) props.Cliente = { relation: [{ id: clienteId }] };

      await notion.pages.create({ parent: { database_id: actionablesDbId }, properties: props });
      creados++;
    } catch (e: any) { console.error(`[anomalias] ${title}: ${e.message}`); }
  }
  // ---- Alertas unificadas ----
  try {
    // Datos rotos: data_health con error o integridad con descuadres
    const { data: dh } = await supabase.from('v_data_health').select('account, estado, mensaje');
    for (const d of dh || []) if (d.estado && d.estado !== 'OK') await supabase.rpc('alerta_registrar', { p_account: d.account, p_nivel: 'hoy', p_tipo: 'datos_rotos', p_titulo: `Datos de ${d.account} con problema`, p_detalle: d.mensaje, p_accion: 'Revisar Sistema > Datos por cuenta. Si la extraccion fallo, correr el script en Google Ads a mano.', p_origen: 'watchdog' });
    const { data: integ } = await supabase.from('v_integridad_conversiones').select('account, date, diferencia').limit(3);
    for (const i of integ || []) await supabase.rpc('alerta_registrar', { p_account: i.account, p_nivel: 'semana', p_tipo: 'datos_rotos', p_titulo: `Conversiones descuadradas el ${i.date}`, p_detalle: `Diferencia de ${i.diferencia} entre acciones y campaña.`, p_accion: 'Revisar si el script diario corrio dos veces con claves distintas.', p_origen: 'integridad', p_entidad: null, p_fecha_dato: i.date });
    // Cambios automaticos de Google en las ultimas 24h
    const { data: autos } = await supabase.from('google_live_events').select('account, entity_name, client_type, event_date').eq('event_type', 'AUTO_CHANGE').gte('event_date', new Date(Date.now() - 864e5).toISOString());
    for (const a of autos || []) await supabase.rpc('alerta_registrar', { p_account: a.account, p_nivel: 'hoy', p_tipo: 'cambio_automatico', p_titulo: `Google aplico un cambio solo en ${a.account}`, p_detalle: `${a.entity_name} (${a.client_type})`, p_accion: 'Entrar a Google Ads > Historial de cambios, revisar y revertir si no lo pediste. Despues desactivar Recomendaciones > Aplicar automaticamente.', p_origen: 'centinela', p_entidad: a.entity_name, p_fecha_dato: String(a.event_date).slice(0, 10) });
    // Condiciones del plan cumplidas 3+ dias seguidos
    const { data: pulsos } = await supabase.from('pulso_diario').select('account, fecha, evidencia').gte('fecha', new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10));
    for (const p of pulsos || []) for (const e of (p.evidencia || []) as any[]) if (e.cumple && Number(e.dias_seguidos_cumpliendo) >= 3)
      await supabase.rpc('alerta_registrar', { p_account: p.account, p_nivel: 'semana', p_tipo: 'plan_condicion', p_titulo: `${p.account}: ${e.nombre}${e.grupo ? ' en ' + e.grupo : ''} lleva ${e.dias_seguidos_cumpliendo} dias cumpliendo`, p_detalle: e.nota || null, p_accion: 'Mirar el plan en Hoy: esta condicion habilita una decision el lunes.', p_origen: 'pulso', p_entidad: e.grupo || e.nombre, p_fecha_dato: p.fecha });
  } catch (e: any) { console.error('[alertas] ' + e.message); }
  console.log(`[anomalias] ${(anomalias || []).length} detectadas, ${creados} accionables nuevos`);
  return { detectadas: (anomalias || []).length, creados, comentados };
}

/**
 * Arranque local: Vite en desarrollo, estáticos en producción, y listen.
 * En Vercel este archivo no se ejecuta; se usa api/index.ts.
 */
async function startLocal() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    // Import dinámico: Vite solo se carga en desarrollo local. En Vercel este
    // bloque nunca corre, y un import estático haría crashear la función.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`NorthSignal OS en puerto ${PORT}`));
}

if (!process.env.VERCEL) {
  startLocal();
}
