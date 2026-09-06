// dotenv PRIMERO: los módulos de lib/ construyen clientes al importarse
// y necesitan las variables ya cargadas.
import 'dotenv/config';
import { webhooksRouter } from './src/server/routes/webhooks';
import { NOTION_BASES, NOTION_STATES, NOTION_PRIORITIES, NOTION_REVISION_IA } from './src/server/domain/notionSchema';
import { VIEW_CONFIGS, validCols, validSearchCols } from './src/server/domain/viewConfig';


import { notion } from './src/server/lib/notion';
import { ai } from './src/server/lib/gemini';
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
async function resolveNotionClient(notion: any, relationProp: any): Promise<string> {
  if (!relationProp?.relation || relationProp.relation.length === 0) return 'Unknown';
  const pageId = relationProp.relation[0].id;
  if (notionClientCache[pageId]) return notionClientCache[pageId];
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const name = page.properties.Cliente?.title?.[0]?.plain_text || 
                 page.properties.Name?.title?.[0]?.plain_text || 'Unknown';
    const normalized = name.split(' ')[0].toUpperCase();
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
      const { data: cambiosDetectados } = await supabase.from('v_cambios_detectados').select('*').order('fecha_actual', { ascending: false }).limit(25);
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
      const clients = response.results.map((p: any) => {
        const name = p.properties.Cliente?.title?.map((t: any) => t.plain_text).join('') || 'Sin nombre';
        const aprendizajes = p.properties['Aprendizajes consolidados']?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        const hipotesis = p.properties['Hipotesis abiertas']?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        const semanas = p.properties['Semanas analizadas']?.number ?? 0;
        const status = p.properties.Estado?.select?.name || 'Activo';
        const moneda = p.properties.Moneda?.select?.name || (name.toUpperCase().includes('KAREDO') ? 'EUR' : 'CLP');
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
          accounts.map(acc => supabase.rpc('get_weekly_package', { p_account: acc }))
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
        const sortCol = order_by || defaultOrderBy[view] || (view === 'v_keyword_tendencia' ? 'gasto_total' : 'cost');
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
        p_order_by: order_by || defaultOrderBy[view],
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
      const sortCol = order_by || defaultOrderBy[view];
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
          causa_raiz: props['Causa raiz']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
          relacionado_con: props['Relacionado con']?.relation?.map((rel: any) => rel.id) || [],
          semanas_pendiente: props['Semanas pendiente']?.number ?? (props['Semanas pendiente']?.formula?.number ?? 0),
          comments_count,
          created_at: page.created_time,
          url: page.url
        };
      }));
      res.json({ data });
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
        
        const { data: pkg } = await supabase.rpc('get_weekly_package', { p_account: client });
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
        rich_text: [
          {
            text: {
              content: text
            }
          }
        ]
      });
      
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
        naturaleza, que_lo_confirmaria, causa_raiz, confirmar_hipotesis
      } = req.body;
      
      const properties: any = {};
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
  app.post("/api/cron/anomalias", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.authorization;
    if (secret && auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await runAnomalyWorker();
      res.json({ ok: true, ran_at: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.originalUrl || req.path}` });
  });


  // ================================================================
  // CICLO DE APRENDIZAJE SEMANAL: evaluar, diagnosticar, actualizar
  // ================================================================
  // Vercel Cron, lunes 05:30 UTC (antes de las tareas semanales). Cierra el
  // ciclo sin intervencion: sincroniza accionables Hechos desde Notion,
  // calcula su impacto, actualiza los parametros estimados con los reales.
  app.post("/api/cron/aprendizaje", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
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
          const acct = /karedo/i.test(nombre) ? 'KAREDO' : /bhi|best health/i.test(nombre) ? 'BHI' : /360/.test(nombre) ? '360' : null;
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

  // Mantenimiento semanal: retención por tabla. Vercel Cron, lunes 06:00 UTC.
  app.post("/api/cron/mantenimiento", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
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

  return app;
}

async function runAnomalyWorker() {
    console.log('Running autonomous worker: Z-Score Anomalies Check');
    
    
    const actionablesDbId = NOTION_BASES.ACCIONABLES;
    if (!supabase || !notion || !actionablesDbId) return;
    const clients = ['360', 'BHI', 'KAREDO'];

    for (const client of clients) {
      const { data, error } = await supabase
        .from('v_campaign_analisis')
        .select('*')
        .eq('account', client)
        .order('date_start', { ascending: false })
        .limit(9);

      if (!error && data && data.length >= 4) {
        const current = data[0];
        const history = data.slice(1, 9);
        const metrics = ['cpa', 'gasto', 'conversiones', 'ctr_promedio'];
        
        for (const m of metrics) {
          const vals = history.map((r: any) => Number(r[m]) || 0);
          const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
          const sqDiffs = vals.map((v: number) => Math.pow(v - avg, 2));
          const stdDev = Math.sqrt(sqDiffs.reduce((a: number, b: number) => a + b, 0) / vals.length);
          const currVal = Number(current[m]) || 0;

          if (stdDev > 0) {
            const zScore = Math.abs((currVal - avg) / stdDev);
            if (zScore >= 2) {
              const direction = currVal > avg ? 'up' : 'down';
              const task_hash = `ANOMALY-${client}-${m}-${current.week_start || new Date().toISOString().split('T')[0]}`;
              
              try {
                const title = `[Anomalía] Pico de ${m.toUpperCase()} (${direction}) en ${client}`;
                // Check if card exists by title
                const existing = await notion.databases.query({
                  database_id: actionablesDbId,
                  filter: {
                    property: 'Accion',
                    title: { equals: title }
                  }
                });

                const isCompletedOrDiscarded = (page: any) => {
                  const state = page?.properties?.Estado?.select?.name;
                  return state === NOTION_STATES.HECHO || state === NOTION_STATES.DESCARTADO;
                };

                const activeCard = existing.results.find(p => !isCompletedOrDiscarded(p));

                if (activeCard) {
                  // Add comment
                  await notion.comments.create({
                    parent: { page_id: activeCard.id },
                    rich_text: [{ text: { content: `Actualización del Centinela: La anomalía en ${m.toUpperCase()} (${direction}) persiste. Z-Score actual: ${zScore.toFixed(2)}.` } }]
                  });
                  console.log(`Added comment to existing actionable for anomaly: ${title}`);
                } else {
                  // Create card
                  const why = `Se detectó una desviación estadística con un Z-Score de ${zScore.toFixed(2)}. El valor actual es ${currVal.toFixed(2)} frente a un promedio histórico de ${avg.toFixed(2)}.`;
                  
                  await notion.pages.create({
                    parent: { database_id: actionablesDbId },
                    properties: {
                      'Accion': { title: [{ text: { content: title } }] },
                      'Cliente': { select: { name: client } },
                      'Prioridad': { select: { name: NOTION_PRIORITIES.ALTA } },
                      'Estado': { select: { name: NOTION_STATES.PROPUESTO } },
                      'Por que': { rich_text: [{ text: { content: why } }] }
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
