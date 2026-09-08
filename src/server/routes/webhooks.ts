import { Router } from 'express';
import { verifyHmacSha256, comparacionSegura } from '../lib/signatures';
import { supabase } from '../lib/supabase';
import { AsanaWebhookPayload } from '../domain/contracts';

export const webhooksRouter = Router();

const STATUS_RECEIVED = 'RECEIVED';
const STATUS_PROCESSED = 'PROCESSED';
const STATUS_QUARANTINED = 'QUARANTINED';
const STATUS_FAILED = 'FAILED';
const STATUS_SIN_MAPEO = 'SIN_MAPEO';

/**
 * TRES ARREGLOS DE FONDO (8 sep 2026)
 *
 * 1. NINGUNO DE LOS DOS HANDLERS ESCRIBIA EN funnel_events, y esa es justo la tabla que
 *    mira estado_de_los_flujos() para decidir si el flujo "Cierres reales del negocio"
 *    esta VIVO o NUNCA RECIBIO NADA. Con Asana funcionando perfecto, el flujo iba a
 *    seguir en rojo para siempre, porque el indicador vigila una tabla que nadie escribia.
 *
 * 2. EL HANDLER DE GOHIGHLEVEL NO ESCRIBIA NADA Y MARCABA PROCESSED. Decia
 *    "Future: process GHL payload". Conectar el webhook de BHI habria puesto el flujo en
 *    VIVO con v_cierres_totales vacia, que es peor que el rojo de hoy: hoy el sistema
 *    sabe que no sabe. Ahora, si el evento no se puede mapear a una etapa, queda en
 *    SIN_MAPEO con el motivo, y NUNCA en PROCESSED. Un evento que no produjo un dato no
 *    esta procesado.
 *
 * 3. LOS DOS RESPONDIAN 200 ANTES DE TRABAJAR. En Vercel la funcion puede congelarse
 *    apenas se manda la respuesta: el trabajo posterior no esta garantizado. Ahora se
 *    escribe primero y se responde despues. La llamada externa a Asana, que es la unica
 *    parte lenta, va con timeout para no agotar el webhook.
 *
 * Ademas: la seccion de una tarea de Asana se buscaba en memberships[0]. Una tarea en
 * dos proyectos devolvia la seccion equivocada. Ahora se recorren todas y se busca la
 * que corresponde a una etapa declarada.
 */

const TIMEOUT_ASANA_MS = 8000;

type Etapa = {
  account: string;
  stage_order: number;
  stage_name: string;
  stage_value: number | null;
  currency: string | null;
  google_conversion_action: string | null;
};

/** Etapas declaradas de una cuenta. La verdad de que es cada etapa vive en funnel_stages. */
async function etapasDe(account: string, source: string): Promise<Etapa[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('funnel_stages')
    .select('account, stage_order, stage_name, stage_value, currency, google_conversion_action, external_id, source')
    .eq('account', account)
    .eq('source', source);
  return (data || []) as any;
}

function normalizar(s: string): string {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function buscarEtapa(etapas: Etapa[], nombre: string): Etapa | null {
  const n = normalizar(nombre);
  if (!n) return null;
  return etapas.find((e) => normalizar(e.stage_name) === n) || null;
}

/**
 * Escribe el hecho de negocio. Tres destinos, y cada uno responde una pregunta distinta:
 *  - funnel_events: paso algo, en que etapa. Es lo que hace que el flujo figure VIVO.
 *  - true_roas_events: paso algo Y se puede atribuir a un clic (hay click id).
 *  - cierres_sin_atribucion: paso algo, con plata, y NO se puede atribuir. Sin esta
 *    tabla un cierre sin gclid desaparece y el win rate real queda subestimado en
 *    silencio, que es peor que un hueco declarado.
 */
async function registrarHecho(opts: {
  account: string;
  etapa: Etapa;
  externalId: string;
  nombre: string | null;
  monto: number | null;
  clickId: string | null;
  clickIdType: string | null;
  fecha: string;
  source: string;
}): Promise<{ ok: boolean; detalle: string }> {
  if (!supabase) return { ok: false, detalle: 'sin supabase' };
  const { account, etapa, externalId, nombre, monto, clickId, clickIdType, fecha, source } = opts;

  const { error: eFunnel } = await supabase.from('funnel_events').upsert(
    {
      account,
      external_id: externalId,
      lead_name: nombre,
      stage_order: etapa.stage_order,
      stage_name: etapa.stage_name,
      stage_value: monto != null ? monto : etapa.stage_value,
      currency: etapa.currency,
      click_id: clickId,
      click_id_type: clickId ? clickIdType || 'gclid' : null,
      reached_at: fecha,
      uploaded_to_google: false,
      source
    },
    { onConflict: 'account,external_id,stage_order' }
  );
  if (eFunnel) return { ok: false, detalle: `funnel_events: ${eFunnel.message}` };

  const partes = [`etapa ${etapa.stage_order} ${etapa.stage_name}`];

  if (monto != null && monto > 0) {
    if (clickId) {
      const { error } = await supabase.from('true_roas_events').upsert(
        {
          client: account,
          source,
          external_id: externalId,
          gclid: clickId,
          click_id_type: clickIdType || 'gclid',
          monto,
          event_date: fecha
        },
        { onConflict: 'client,gclid,external_id' }
      );
      if (error) return { ok: false, detalle: `true_roas_events: ${error.message}` };
      partes.push('con atribucion');
    } else {
      const { error } = await supabase.from('cierres_sin_atribucion').upsert(
        {
          client: account,
          source,
          external_id: externalId,
          nombre_tarea: nombre,
          monto,
          motivo: 'El registro no trae click id. El cierre existe y el monto es real, pero no se puede atribuir a un clic de Google. Cuenta para el negocio, no para el ROAS.',
          event_date: fecha
        },
        { onConflict: 'client,source,external_id' }
      );
      if (error) return { ok: false, detalle: `cierres_sin_atribucion: ${error.message}` };
      partes.push('sin atribucion');
    }
  }

  return { ok: true, detalle: partes.join(', ') };
}

async function marcar(logId: any, status: string, error_msg?: string) {
  if (!supabase || !logId) return;
  await supabase
    .from('webhook_events')
    .update({ status, error_msg: error_msg || null, processed_at: new Date().toISOString() })
    .eq('id', logId);
}

// ============================================================================
// ASANA  ·  360 Producciones
// ============================================================================
webhooksRouter.post('/asana', async (req, res) => {
  try {
    // 1. Handshake de alta del webhook
    const secret = req.headers['x-hook-secret'];
    if (secret) {
      res.setHeader('X-Hook-Secret', secret as string);
      return res.status(200).send();
    }

    // 2. Firma, fail-closed
    const asanaSecret = process.env.ASANA_WEBHOOK_SECRET;
    if (!asanaSecret) {
      console.error('ASANA_WEBHOOK_SECRET no configurado. Webhook rechazado.');
      return res.status(503).json({ error: 'Webhook no configurado' });
    }
    const signature = req.headers['x-hook-signature'];
    const rawBody = (req as any).rawBody;
    if (!signature || !rawBody) return res.status(401).json({ error: 'Missing signature or raw body' });
    if (!verifyHmacSha256(asanaSecret, signature as string, rawBody)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 3. Payload
    const payload = req.body;
    let parsedPayload;
    try {
      parsedPayload = AsanaWebhookPayload.parse(payload);
    } catch (zodError: any) {
      if (supabase) {
        await supabase.from('webhook_events').insert([
          { source: 'asana', payload, status: STATUS_QUARANTINED, error_msg: zodError.message, received_at: new Date().toISOString() }
        ]);
      }
      return res.status(200).json({ received: true, procesados: 0, motivo: 'payload fuera de esquema, en cuarentena' });
    }

    const eventos = (parsedPayload.events || []).filter(
      (e: any) => e.resource?.resource_type === 'task' && (e.action === 'changed' || e.action === 'added')
    );
    if (!eventos.length || !supabase) return res.status(200).json({ received: true, procesados: 0 });

    // 4. TRABAJO ANTES DE RESPONDER. En Vercel, lo que va despues del res puede no correr.
    const etapas = await etapasDe('360', 'asana_section');
    let procesados = 0;
    let sinMapeo = 0;

    for (const event of eventos) {
      const taskGid = event.resource.gid;
      const { data: log } = await supabase
        .from('webhook_events')
        .insert([{ source: 'asana', external_id: taskGid, payload: event, status: STATUS_RECEIVED, received_at: new Date().toISOString() }])
        .select('id')
        .single();
      const logId = log?.id;

      try {
        const asanaPat = process.env.ASANA_PAT;
        if (!asanaPat) throw new Error('ASANA_PAT no configurado');

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), TIMEOUT_ASANA_MS);
        let task: any;
        try {
          const resp = await fetch(
            `https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=name,completed,modified_at,memberships.section.name,memberships.section.gid,custom_fields.name,custom_fields.number_value,custom_fields.text_value`,
            { headers: { Authorization: `Bearer ${asanaPat}` }, signal: ctrl.signal }
          );
          if (!resp.ok) throw new Error(`Asana API error: ${resp.status}`);
          task = (await resp.json()).data;
        } finally {
          clearTimeout(t);
        }

        const campo = (n: string, k: 'number_value' | 'text_value') =>
          task.custom_fields?.find((f: any) => normalizar(f.name) === normalizar(n))?.[k] ?? null;

        const monto = campo('Monto', 'number_value') as number | null;
        const gclid = campo('GCLID', 'text_value') as string | null;

        // Antes se leia memberships[0]. Una tarea en dos proyectos devolvia la seccion
        // equivocada. Se recorren todas y se toma la que coincide con una etapa declarada.
        let etapa: Etapa | null = null;
        let seccionVista = '';
        for (const m of task.memberships || []) {
          const nombre = m?.section?.name;
          if (!nombre) continue;
          seccionVista = seccionVista ? `${seccionVista}, ${nombre}` : nombre;
          const e = buscarEtapa(etapas, nombre);
          if (e) { etapa = e; break; }
        }

        if (!etapa) {
          sinMapeo++;
          await marcar(
            logId,
            STATUS_SIN_MAPEO,
            `La tarea esta en la(s) seccion(es) "${seccionVista || 'ninguna'}" y ninguna coincide con una etapa declarada en funnel_stages para 360. No se escribio nada. Declarar la etapa o corregir el nombre de la seccion.`
          );
          continue;
        }

        const r = await registrarHecho({
          account: '360',
          etapa,
          externalId: taskGid,
          nombre: task.name || null,
          monto,
          clickId: gclid,
          clickIdType: 'gclid',
          fecha: task.modified_at || new Date().toISOString(),
          source: 'asana'
        });

        if (!r.ok) throw new Error(r.detalle);
        procesados++;
        await marcar(logId, STATUS_PROCESSED, r.detalle);
      } catch (procErr: any) {
        await marcar(logId, STATUS_FAILED, procErr.message);
      }
    }

    return res.status(200).json({ received: true, procesados, sin_mapeo: sinMapeo });
  } catch (e: any) {
    console.error('Asana webhook top-level error:', e);
    if (!res.headersSent) return res.status(200).json({ received: true, error: true });
  }
});

// ============================================================================
// GOHIGHLEVEL  ·  BHI
// ============================================================================
webhooksRouter.post('/gohighlevel', async (req, res) => {
  try {
    const ghlSecret = process.env.GHL_WEBHOOK_SECRET;
    if (!ghlSecret) {
      console.error('GHL_WEBHOOK_SECRET no configurado. Webhook rechazado.');
      return res.status(503).json({ error: 'Webhook no configurado' });
    }

    // Comparacion en tiempo constante: un !== corta al primer caracter distinto y el
    // tiempo de respuesta revela cuantos acerto quien prueba.
    const auth = String(req.headers['authorization'] || '');
    if (!comparacionSegura(auth, `Bearer ${ghlSecret}`)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body || {};
    if (!supabase) return res.status(200).json({ received: true, procesados: 0 });

    const externalId =
      payload.opportunity_id || payload.opportunityId ||
      payload.contact_id || payload.contactId ||
      payload.id || 'desconocido';

    const { data: log } = await supabase
      .from('webhook_events')
      .insert([{ source: 'gohighlevel', external_id: externalId, payload, status: STATUS_RECEIVED, received_at: new Date().toISOString() }])
      .select('id')
      .single();
    const logId = log?.id;

    try {
      // GHL manda el nombre de la etapa en varias formas segun el disparador.
      // Se prueban todas y se busca contra funnel_stages. Si ninguna coincide, el evento
      // NO se marca procesado: queda en SIN_MAPEO con lo que llego, para poder mapearlo.
      const candidatas = [
        payload.pipleline_stage, payload.pipeline_stage, payload.pipelineStage,
        payload.stage, payload.stage_name, payload.status,
        payload.opportunity?.pipeline_stage, payload.opportunity?.stage
      ].filter(Boolean) as string[];

      const etapas = await etapasDe('BHI', 'ghl_stage');
      let etapa: Etapa | null = null;
      for (const c of candidatas) {
        etapa = buscarEtapa(etapas, c);
        if (etapa) break;
      }

      if (!etapa) {
        await marcar(
          logId,
          STATUS_SIN_MAPEO,
          `No se pudo mapear el evento a una etapa. Nombres recibidos: ${candidatas.length ? candidatas.join(' | ') : 'ninguno'}. ` +
            `Etapas declaradas para BHI en funnel_stages: ${etapas.map((e) => e.stage_name).join(', ') || 'ninguna'}. ` +
            'No se escribio nada, a proposito: marcar PROCESSED sin haber escrito un hecho de negocio pone el flujo en VIVO con v_cierres_totales vacia.'
        );
        return res.status(200).json({ received: true, procesados: 0, sin_mapeo: 1 });
      }

      const montoRaw =
        payload.monetary_value ?? payload.monetaryValue ?? payload.value ??
        payload.opportunity?.monetary_value ?? null;
      const monto = montoRaw != null && montoRaw !== '' ? Number(montoRaw) : null;

      const clickId =
        payload.gclid || payload.attribution?.gclid ||
        payload.contact?.gclid || payload.custom_fields?.gclid || null;
      const wbraid = payload.wbraid || payload.attribution?.wbraid || null;
      const gbraid = payload.gbraid || payload.attribution?.gbraid || null;

      const r = await registrarHecho({
        account: 'BHI',
        etapa,
        externalId: String(externalId),
        nombre: payload.full_name || payload.contact?.name || payload.name || null,
        monto: monto != null && !isNaN(monto) ? monto : null,
        clickId: clickId || wbraid || gbraid || null,
        clickIdType: clickId ? 'gclid' : wbraid ? 'wbraid' : gbraid ? 'gbraid' : null,
        fecha: payload.date_added || payload.updated_at || new Date().toISOString(),
        source: 'gohighlevel'
      });

      if (!r.ok) throw new Error(r.detalle);
      await marcar(logId, STATUS_PROCESSED, r.detalle);
      return res.status(200).json({ received: true, procesados: 1 });
    } catch (procErr: any) {
      await marcar(logId, STATUS_FAILED, procErr.message);
      return res.status(200).json({ received: true, procesados: 0, error: procErr.message });
    }
  } catch (e: any) {
    console.error('GHL webhook top-level error:', e);
    if (!res.headersSent) return res.status(200).json({ received: true, error: true });
  }
});
