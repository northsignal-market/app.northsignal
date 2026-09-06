export const NOTION_BASES = {
  CLIENTES: 'e5f736fe-b4e5-4e3c-b827-fabc5db8a0c8',
  BRIEFS: process.env.NOTION_BRIEFS_DB_ID || '24cb7596-2bdf-460d-8d74-a8d042f55512',
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
