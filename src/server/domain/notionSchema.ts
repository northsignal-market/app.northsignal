export const NOTION_BASES = {
  CLIENTES: 'e5f736fe-b4e5-4e3c-b827-fabc5db8a0c8',
  BRIEFS: process.env.NOTION_BRIEFS_DB_ID || '1aedbb2d-d6e8-42a8-aca7-630cf97c4965',
  ACCIONABLES: process.env.NOTION_ACCIONABLES_DB_ID || '373cde2b-d8c2-47e3-bc89-56c7d7c7e568',
  PIPELINE: '6dcfb06b-c2fc-444c-b10d-f3cc8f485059'
};

export const NOTION_STATES = {
  PROPUESTO: 'Propuesto',
  EN_CURSO: 'En curso',
  HECHO: 'Hecho',
  DESCARTADO: 'Descartado',
  BLOQUEADO: 'Bloqueado'
} as const;

export const NOTION_PRIORITIES = {
  URGENTE: 'Urgente',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja'
} as const;

/** El orden real de las prioridades. Vive acá, al lado del vocabulario que lo
 *  define, porque estaba duplicado en `Accionables.tsx` y en `asistente.ts` y dos
 *  copias de un orden es cómo dos pantallas terminan ordenando distinto. Ordenar
 *  por el TEXTO deja Urgente ÚLTIMO (Alta, Baja, Media, Urgente), que era el bug. */
export const PESO_PRIORIDAD: Record<string, number> = {
  [NOTION_PRIORITIES.URGENTE]: 4,
  [NOTION_PRIORITIES.ALTA]: 3,
  [NOTION_PRIORITIES.MEDIA]: 2,
  [NOTION_PRIORITIES.BAJA]: 1,
};

export const NOTION_REVISION_IA = {
  SIN_REVISAR: 'Sin revisar',
  ANALIZADO: 'Analizado por Gemini',
  COINCIDEN: 'Coinciden',
  EN_DISPUTA: 'En disputa',
  RESUELTO: 'Resuelto'
} as const;

export const NOTION_NATURALEZA = {
  OBSERVACION: 'Observacion',
  INFERENCIA: 'Inferencia',
  HIPOTESIS: 'Hipotesis',
  DATO: 'Dato'
} as const;
