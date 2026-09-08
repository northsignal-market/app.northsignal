import { NOTION_STATES, NOTION_NATURALEZA } from './server/domain/notionSchema';
export { NOTION_STATES, NOTION_NATURALEZA };

export type NotionStateType = typeof NOTION_STATES[keyof typeof NOTION_STATES];
export type NotionNaturalezaType = typeof NOTION_NATURALEZA[keyof typeof NOTION_NATURALEZA];

export interface Actionable {
  id: string;
  client: string;
  account?: string;
  history?: any[];
  title: string;
  description: string;
  status: string;
  priority?: string;
  why?: string;
  where?: string;
  url?: string;
  created_at: string;
  entities: string[];
  tags?: string[];
  revision_ia?: string;
  punto_disputa?: string;
  decision_final?: string;
  comments_count?: number;
  isDone?: boolean;
  semanasPendiente?: number;
  semanas_pendiente?: number;
  detectado?: string;
  ejecutado_el?: string;
  resultado_observado?: string;
  brief_id?: string;
  segunda_opinion?: any;
  // Campos auditados de Notion
  naturaleza?: 'Observacion' | 'Inferencia' | 'Hipotesis' | 'Dato';
  que_lo_confirmaria?: string;
  como_hacerlo?: string;
  origen?: string;
  accion?: any;
  accion_error?: string | null;
  entidad?: string;
  vence?: string | null;
  reemplazado_por?: string | null;
  causa_raiz?: string;
  relacionado_con?: string[];
  relacionados_details?: { id: string; title: string; status: string; client?: string }[];
}

export interface Brief {
  id: string;
  client: string;
  account?: string;
  history?: any[];
  week: string;
  summary: string;
  alerts: string[];
  metrics: {
    spend: number;
    conversions: number;
    cpa: number;
    roas?: number;
  };
  semana?: string;
  title?: string;
  created_at?: string;
  brief_anterior?: string | null;
  brief_siguiente?: string | null;
  handoff?: string;
  lecciones?: string;
  dias_provisionales?: number;
}

export type NotionBrief = Brief;

export interface DailyMetric {
  account: string;
  date: string;
  gasto: number;
  conversiones: number;
  cpa: number | null;
  ctr: number;
  clics?: number;
  impresiones?: number;
  cpc?: number;
  perdido_presupuesto?: number;
  perdido_ranking?: number;
  madurez: 'consolidado' | 'madurando' | 'provisional';
  dia_semana: number;
  cambios_ese_dia?: number;
  hubo_cambio_automatico?: boolean;
  campos_tocados?: string | null;
  cpa_dia_previo?: number | null;
  delta_cpa?: number | null;
}

export interface PulseData {
  account: string;
  gasto_hasta_ahora: number;
  conversiones_hasta_ahora: number;
  medido_a_las: string;
  minutos_desde_medicion: number;
}

export interface NotionClientInfo {
  id: string;
  name: string;
  status: string;
  aprendizajes_consolidados: string;
  hipotesis_abiertas: string;
  semanas_analizadas: number;
  moneda: string;
  country?: string;
  daily_budget?: number;
  customer_id?: string;
  url?: string;
}

export interface UnifiedChangeEntry {
  account: string;
  fecha: string;
  hora?: string;
  fuente: 'change_events' | 'snapshot' | 'operador' | string;
  ambito?: string;
  detalle: string;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  por_que?: string | null;
  automatico?: boolean;
}

export interface OperatorLogEntry {
  id?: number;
  account: string;
  fecha?: string;
  hora?: string;
  que_cambio: string;
  donde: string; // ambito: conversiones / campana / presupuesto / negativas / landing / otro
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  por_que: string;
  accionable_notion_id?: string | null;
  created_at?: string;
}

export interface RunScorecard {
  id?: number;
  account: string;
  run_date: string;
  semana_analizada: string;
  puntos: number;
  puntos_posibles: number;
  revision_humana?: string;
  revision_humana_fecha?: string;
  que_fallo?: string;
  preguntas_a_andres?: number;
  tiempo_estimado_min?: number | null;
  corrida_previa?: any;
}

export interface RunTendencia {
  account: string;
  corridas: number;
  cumplimiento_promedio_pct: number;
  peor: number;
  mejor: number;
  preguntas_acumuladas: number;
  errores_marcados_por_andres: number;
}

export interface DataIntegrityItem {
  account: string;
  week_start: string;
  cost_campaign: number;
  cost_adgroup: number;
  cost_keywords: number;
  dif_campana_vs_grupo: number;
  dif_campana_vs_keyword: number;
  diagnostico: string;
}

export interface ConfigChangeItem {
  account: string;
  fecha_anterior: string;
  fecha_actual: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  campo: string;
  valor_anterior: string;
  valor_nuevo: string;
}

