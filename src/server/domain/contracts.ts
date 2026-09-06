import { z } from 'zod';

export const AsanaWebhookEvent = z.object({
  action: z.enum(['added', 'changed', 'removed', 'deleted', 'undeleted']),
  created_at: z.string().optional(),
  resource: z.object({
    gid: z.string(),
    resource_type: z.string()
  }).optional(),
  parent: z.object({ gid: z.string() }).nullable().optional(),
  change: z.object({ field: z.string(), action: z.string() }).optional()
}).passthrough();

export const AsanaWebhookPayload = z.object({
  events: z.array(AsanaWebhookEvent).optional()
}).passthrough();

export const GHLWebhookPayload = z.object({
  type: z.string().optional(),
  locationId: z.string().optional(),
  contact_id: z.string().optional()
}).passthrough();
