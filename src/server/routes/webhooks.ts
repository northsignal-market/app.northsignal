import { Router } from 'express';
import * as crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { AsanaWebhookPayload } from '../domain/contracts';

export const webhooksRouter = Router();

// Define status constants
const STATUS_RECEIVED = 'RECEIVED';
const STATUS_PROCESSED = 'PROCESSED';
const STATUS_QUARANTINED = 'QUARANTINED';
const STATUS_FAILED = 'FAILED';

webhooksRouter.post('/asana', async (req, res) => {
  try {
    // 1. Asana Webhook Handshake
    const secret = req.headers['x-hook-secret'];
    if (secret) {
       res.setHeader('X-Hook-Secret', secret);
       return res.status(200).send();
    }

    // 2. Validate Signature (Fail-closed)
    const asanaSecret = process.env.ASANA_WEBHOOK_SECRET;
    if (!asanaSecret) {
       console.error('ASANA_WEBHOOK_SECRET no configurado. Webhook rechazado.');
       return res.status(503).json({ error: 'Webhook no configurado' });
    }

    const signature = req.headers['x-hook-signature'];
    const rawBody = (req as any).rawBody;
    
    if (!signature || !rawBody) {
        return res.status(401).json({ error: 'Missing signature or raw body' });
    }
    
    const hash = crypto.createHmac('sha256', asanaSecret).update(rawBody).digest('hex');
    
    const sigBuf = Buffer.from(signature as string, 'utf8');
    const hashBuf = Buffer.from(hash, 'utf8');
    
    if (sigBuf.length !== hashBuf.length || !crypto.timingSafeEqual(sigBuf, hashBuf)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 3. Confirm reception immediately to avoid timeouts
    res.status(200).json({ received: true });

    // 4. Validate payload with Zod
    const payload = req.body;
    let parsedPayload;
    try {
      parsedPayload = AsanaWebhookPayload.parse(payload);
    } catch (zodError: any) {
      if (supabase) {
        const { error: quarErr } = await supabase.from('webhook_events').insert([{
          source: 'asana',
          payload,
          status: STATUS_QUARANTINED,
          error_msg: zodError.message,
          received_at: new Date().toISOString()
        }]);
        if (quarErr) console.error('Failed to log quarantined event', quarErr);
      }
      return; // Already responded 200, stop processing
    }

    if (!parsedPayload.events || parsedPayload.events.length === 0) return;

    // Process events
    for (const event of parsedPayload.events) {
      if (event.resource?.resource_type !== 'task') continue;
      if (event.action !== 'changed' && event.action !== 'added') continue;

      const taskGid = event.resource.gid;

      if (supabase) {
        // Log received
        const { data: webhookLog, error: logErr } = await supabase.from('webhook_events').insert([{
          source: 'asana',
          external_id: taskGid,
          payload: event,
          status: STATUS_RECEIVED,
          received_at: new Date().toISOString()
        }]).select('id').single();
        if (logErr) throw new Error(`Supabase log error: ${logErr.message}`);

        let logId = webhookLog?.id;

        try {
          const asanaPat = process.env.ASANA_PAT;
          if (!asanaPat) throw new Error('ASANA_PAT no configurado');

          const resp = await fetch(
            `https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=name,completed,memberships.section.name,custom_fields.name,custom_fields.number_value,custom_fields.text_value`,
            { headers: { Authorization: `Bearer ${asanaPat}` } }
          );
          
          if (!resp.ok) {
            throw new Error(`Asana API error: ${resp.status}`);
          }
          
          const { data: task } = await resp.json();

          const monto = task.custom_fields?.find((f: any) => f.name === 'Monto')?.number_value;
          const gclid = task.custom_fields?.find((f: any) => f.name === 'GCLID')?.text_value;
          const seccion = task.memberships?.[0]?.section?.name;

          if (seccion === 'Cerrado ganado' && monto && gclid) {
             const { error: upsertErr } = await supabase.from('true_roas_events').upsert({
               client: '360',
               source: 'asana',
               external_id: taskGid,
               gclid,
               monto,
               event_date: task.modified_at || new Date().toISOString()
             }, { onConflict: 'client,gclid,external_id' });
             
             if (upsertErr) throw new Error(`Supabase upsert error: ${upsertErr.message}`);
          }
          
          if (logId) {
            await supabase.from('webhook_events').update({
              status: STATUS_PROCESSED,
              processed_at: new Date().toISOString()
            }).eq('id', logId);
          }

        } catch (procErr: any) {
          if (logId) {
            await supabase.from('webhook_events').update({
              status: STATUS_FAILED,
              error_msg: procErr.message,
              processed_at: new Date().toISOString()
            }).eq('id', logId);
          }
        }
      }
    }
  } catch (e: any) {
    console.error('Asana webhook top-level error:', e);
  }
});

webhooksRouter.post('/gohighlevel', async (req, res) => {
  try {
    const ghlSecret = process.env.GHL_WEBHOOK_SECRET;
    if (!ghlSecret) {
      console.error('GHL_WEBHOOK_SECRET no configurado. Webhook rechazado.');
      return res.status(503).json({ error: 'Webhook no configurado' });
    }
    
    if (req.headers['authorization'] !== `Bearer ${ghlSecret}`) {
       return res.status(401).json({ error: 'Invalid signature' });
    }

    res.status(200).json({ received: true });

    const payload = req.body;
    
    if (supabase) {
       const externalId = payload.contact_id || payload.locationId || 'unknown';
       
       const { data: webhookLog, error: logErr } = await supabase.from('webhook_events').insert([{ 
         source: 'gohighlevel', 
         external_id: externalId,
         payload,
         status: STATUS_RECEIVED,
         received_at: new Date().toISOString()
       }]).select('id').single();
        if (logErr) throw new Error(`Supabase log error: ${logErr.message}`);

       let logId = webhookLog?.id;
       
       try {
         // Future: process GHL payload and upsert to true_roas_events
         // For now, mark as processed since we received it successfully
         if (logId) {
           await supabase.from('webhook_events').update({
             status: STATUS_PROCESSED,
             processed_at: new Date().toISOString()
           }).eq('id', logId);
         }
       } catch (procErr: any) {
         if (logId) {
           await supabase.from('webhook_events').update({
             status: STATUS_FAILED,
             error_msg: procErr.message,
             processed_at: new Date().toISOString()
           }).eq('id', logId);
         }
       }
    }
  } catch (e: any) {
    console.error('GHL webhook top-level error:', e);
  }
});
