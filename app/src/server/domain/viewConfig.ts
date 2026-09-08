export const VIEW_CONFIGS = {
  'v_campaign_analisis': { label: 'Campañas', searchCol: 'campaign' },
  'v_adgroup_analisis': { label: 'Grupos', searchCol: 'ad_group' },
  'v_keywords_analisis': { label: 'Keywords', searchCol: 'keyword' },
  'v_search_terms_analisis': { label: 'Términos', searchCol: 'search_term' },
  'v_keywords_daily': { label: 'Keywords Diario', searchCol: 'keyword' },
  'v_search_terms_daily': { label: 'Términos Diario', searchCol: 'search_term' },
  'v_keyword_tendencia': { label: 'Tendencia Keywords', searchCol: 'keyword' },
  'v_conversiones_por_accion': { label: 'Conversiones', searchCol: 'conversion_action' },
  'v_ngrams_sin_conversion': { label: 'N-grams', searchCol: 'palabra' },
  'v_fuzzy_negatives': { label: 'Fuzzy Negatives', searchCol: 'termino_con_gasto' },
  'v_tendencia_semanal': { label: 'Tendencia', searchCol: 'account' }
};

export const validCols: Record<string, string[]> = {
  'v_campaign_analisis': ['campaign', 'status', 'impressions', 'clicks', 'ctr', 'cost', 'conversions', 'cost_per_conv', 'impr_share', 'limitada_por', 'week_start', 'account'],
  'v_adgroup_analisis': ['ad_group', 'campaign', 'ad_group_status', 'impressions', 'clicks', 'ctr', 'cost', 'conversions', 'cost_per_conv', 'impr_share', 'week_start', 'account'],
  'v_keywords_analisis': ['keyword', 'match_type', 'ad_group', 'campaign', 'serving_status', 'impressions', 'clicks', 'ctr', 'cost', 'conversions', 'cost_per_conv', 'quality_score', 'motivo', 'week_start', 'account', 'est_top_of_page_cpc', 'lost_is_budget', 'lost_is_rank', 'qs_ad_relevance', 'qs_landing_page', 'qs_expected_ctr'],
  'v_search_terms_analisis': ['search_term', 'match_type', 'triggered_keyword', 'ad_group', 'campaign', 'impressions', 'clicks', 'ctr', 'cost', 'conversions', 'clasificacion', 'week_start', 'account'],
  'v_keywords_daily': ['date', 'keyword', 'match_type', 'ad_group', 'impressions', 'clicks', 'cost', 'conversions', 'cost_per_conv', 'quality_score', 'madurez', 'motivo', 'account', 'campaign'],
  'v_search_terms_daily': ['date', 'search_term', 'ad_group', 'impressions', 'clicks', 'cost', 'conversions', 'clasificacion', 'madurez', 'account', 'campaign'],
  'v_keyword_tendencia': ['keyword', 'campaign', 'ad_group', 'dias_con_actividad', 'gasto_total', 'conversiones_total', 'cpa_periodo', 'qs_promedio', 'account'],
  'v_conversiones_por_accion': ['conversion_action', 'category', 'campaign', 'primarias', 'total_incluyendo_secundarias', 'solo_secundarias', 'week_start', 'account'],
  'v_ngrams_sin_conversion': ['palabra', 'campaign', 'terminos_distintos', 'costo_total', 'clics_totales', 'week_start', 'account'],
  'v_fuzzy_negatives': ['termino_con_gasto', 'negativa_similar', 'campaign', 'letras_de_diferencia', 'gasto_perdido', 'clicks', 'concordancia_negativa', 'week_start', 'account'],
  'v_tendencia_semanal': ['week_start', 'gasto', 'conversiones', 'cpa', 'ctr_promedio', 'impr_share_promedio', 'perdido_presupuesto', 'perdido_ranking', 'account']
};

export const validSearchCols: Record<string, string[]> = {
  'v_campaign_analisis': ['campaign'],
  'v_adgroup_analisis': ['campaign', 'ad_group'],
  'v_keywords_analisis': ['campaign', 'ad_group', 'keyword'],
  'v_search_terms_analisis': ['campaign', 'ad_group', 'search_term'],
  'v_keywords_daily': ['keyword', 'ad_group', 'campaign'],
  'v_search_terms_daily': ['search_term', 'ad_group', 'campaign'],
  'v_keyword_tendencia': ['keyword', 'ad_group', 'campaign'],
  'v_conversiones_por_accion': ['campaign', 'conversion_action'],
  'v_ngrams_sin_conversion': ['palabra', 'campaign'],
  'v_fuzzy_negatives': ['termino_con_gasto', 'negativa_similar', 'campaign'],
  'v_tendencia_semanal': ['account']
};

