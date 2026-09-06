import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { 
  Search, ChevronDown, ChevronUp, Download, AlertCircle, AlertTriangle,
  Settings2, X, Filter, Activity, Database, Layers, FileText, TrendingUp
} from 'lucide-react';
import { Termino } from './Termino';
import { useAppStore } from '../store/useAppStore';
import { Drawer } from './Drawer';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


const formatDatePretty = (dateStr: string) => {
  if (!dateStr) return '?';
  try {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) { return dateStr; }
};

const getEndOfWeek = (dateStr: string) => {
  if (!dateStr) return '?';
  try {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d) + 6);
    return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) { return dateStr; }
};

const VIEW_CONFIGS = {
  'v_campaign_analisis': { grupo: 'Por semana', label: 'Campañas', searchCol: 'campaign' },
  'v_adgroup_analisis': { grupo: 'Por semana', label: 'Grupos', searchCol: 'ad_group' },
  'v_keywords_analisis': { grupo: 'Por semana', label: 'Keywords', searchCol: 'keyword' },
  'v_search_terms_analisis': { grupo: 'Por semana', label: 'Términos de búsqueda', searchCol: 'search_term' },
  'v_conversiones_por_accion': { grupo: 'Por semana', label: 'Conversiones por acción', searchCol: 'conversion_action' },
  'v_tendencia_semanal': { grupo: 'Por semana', label: 'Tendencia', searchCol: 'account' },
  'v_keywords_daily': { grupo: 'Por día', label: 'Keywords', searchCol: 'keyword' },
  'v_search_terms_daily': { grupo: 'Por día', label: 'Términos de búsqueda', searchCol: 'search_term' },
  'v_keyword_tendencia': { grupo: 'Por día', label: 'Tendencia por keyword', searchCol: 'keyword' },
  'v_ngrams_sin_conversion': { grupo: 'Diagnóstico', label: 'Palabras que gastan sin convertir', searchCol: 'palabra' },
  'v_fuzzy_negatives': { grupo: 'Diagnóstico', label: 'Negativas que bloquean de más', searchCol: 'termino_con_gasto' },
};

const DEFAULT_COLS: Record<string, string[]> = {
  'ent_campaign': ['campaign','status','impressions','clicks','ctr','avg_cpc','cost','conversions','cost_per_conv','conv_rate','impr_share','lost_is_budget','lost_is_rank','limitada_por','dias_con_datos'],
  'ent_adgroup': ['ad_group','campaign','ad_group_status','impressions','clicks','ctr','avg_cpc','cost','conversions','cost_per_conv','conv_rate','impr_share','dias_con_datos'],
  'ent_keyword': ['keyword','match_type','ad_group','keyword_status','impressions','clicks','ctr','avg_cpc','cost','conversions','cost_per_conv','conv_rate','quality_score','impr_share','dias_con_datos'],
  'ent_search_term': ['search_term','match_type','triggered_keyword','ad_group','impressions','clicks','ctr','avg_cpc','cost','conversions','cost_per_conv','clasificacion','dias_con_datos'],
  'v_campaign_analisis': ['campaign','status','impressions','clicks','ctr','cost','conversions','cost_per_conv','impr_share','limitada_por'],
  'v_adgroup_analisis':  ['ad_group','campaign','ad_group_status','impressions','clicks','ctr','cost','conversions','cost_per_conv','impr_share'],
  'v_keywords_analisis': ['keyword','match_type','ad_group','serving_status','impressions','clicks','ctr','cost','conversions','cost_per_conv','quality_score','motivo'],
  'v_search_terms_analisis': ['search_term','match_type','triggered_keyword','ad_group','impressions','clicks','ctr','cost','conversions','clasificacion'],
  'v_conversiones_por_accion': ['conversion_action','category','campaign','primarias','total_incluyendo_secundarias','solo_secundarias'],
  'v_ngrams_sin_conversion': ['palabra','terminos_distintos','costo_total','clics_totales'],
  'v_fuzzy_negatives': ['termino_con_gasto','negativa_similar','letras_de_diferencia','gasto_perdido','clicks','concordancia_negativa'],
  'v_tendencia_semanal': ['week_start','gasto','conversiones','cpa','ctr_promedio','impr_share_promedio','perdido_presupuesto','perdido_ranking'],
  'v_keywords_daily': ['date','keyword','match_type','ad_group','impressions','clicks','cost','conversions','cost_per_conv','quality_score','madurez','motivo'],
  'v_search_terms_daily': ['date','search_term','ad_group','impressions','clicks','cost','conversions','clasificacion','madurez'],
  'v_keyword_tendencia': ['keyword','campaign','ad_group','dias_con_actividad','gasto_total','conversiones_total','cpa_periodo','qs_promedio']
};

const COL_TERMINO: Record<string, string> = {
  cost_per_conv: 'CPA', cpa: 'CPA', avg_cpc: 'CPC', ctr: 'CTR', conv_rate: 'Conv. rate', impressions: 'Impresiones', cost: 'Gasto',
  impr_share: 'IS', lost_is_budget: 'Lost IS budget', lost_is_rank: 'Lost IS rank', limitada_por: 'Limitada por',
  quality_score: 'QS', madurez: 'Madurez', dias_con_datos: 'Días con datos', match_type: 'Concordancia',
  triggered_keyword: 'Keyword disparadora', keyword_disparadora: 'Keyword disparadora', clasificacion: 'Término nuevo'
};
const COL_LABELS: Record<string, string> = {
  dias_con_datos: 'Días',
  date: 'Fecha',
  madurez: 'Madurez',
  dias_con_actividad: 'Días activos',
  gasto_total: 'Gasto total',
  conversiones_total: 'Conv. total',
  cpa_periodo: 'CPA período',
  qs_promedio: 'QS prom.',
  cost: 'Costo',
  gasto: 'Gasto',
  costo: 'Costo',
  gasto_perdido: 'Gasto Perdido',
  cost_per_conv: 'CPA',
  cpa: 'CPA',
  impr_share: 'Cuota Impr.',
  impr_share_promedio: 'Cuota Impr. Prom.',
  serving_status: 'Estado Entrega',
  est_top_of_page_cpc: 'CPC Tope Pág.',
  match_type: 'Concordancia',
  quality_score: 'Nivel Calidad',
  conversions: 'Conversiones',
  conversiones: 'Conversiones',
  impressions: 'Impresiones',
  clicks: 'Clics',
  ctr: 'CTR',
  ctr_promedio: 'CTR Prom.',
  conv_rate: 'Tasa Conv.',
  lost_is_budget: 'Perd. Presup.',
  lost_is_rank: 'Perd. Ranking',
  perdido_presupuesto: 'Perd. Presup.',
  perdido_ranking: 'Perd. Ranking',
  limitada_por: 'Limitada por',
  clasificacion: 'Clasificación',
  primarias: 'Primarias',
  total_incluyendo_secundarias: 'Total (con secundarias)',
  solo_secundarias: 'Solo secundarias',
  terminos_distintos: 'Términos distintos',
  costo_total: 'Costo total',
  clics_totales: 'Clics',
  letras_de_diferencia: 'Dif. letras',
  negativa_similar: 'Negativa similar',
  termino_con_gasto: 'Término',
  concordancia_negativa: 'Concordancia neg.',
  triggered_keyword: 'Keyword que lo activó',
  ad_group_type: 'Tipo de grupo',
  approval_status: 'Estado aprobación',
  qs_ad_relevance: 'QS relevancia',
  qs_landing_page: 'QS landing',
  qs_expected_ctr: 'QS CTR esperado',
  effective_cpc_bid: 'Puja efectiva',
  click_share: 'Cuota de clics',
  abs_top_impr_share: 'Cuota abs. superior',
  search_term: 'Término de búsqueda',
  ad_group: 'Grupo',
  campaign: 'Campaña',
  keyword: 'Keyword',
  keyword_status: 'Estado',
  status: 'Estado',
  ad_group_status: 'Estado',
  campaign_status: 'Estado',
  motivo: 'Motivo',
  week_start: 'Semana',
  conversion_action: 'Acción de Conversión',
  palabra: 'Palabra'
};


function getColumnWidth(col: string) {
  if (['keyword', 'campaign', 'search_term', 'termino_con_gasto', 'palabra', 'conversion_action', 'account'].includes(col)) return 280;
  if (['ad_group', 'match_type', 'concordancia_negativa', 'negativa_similar', 'category', 'triggered_keyword'].includes(col)) return 140;
  if (['impressions', 'impresiones', 'clicks', 'clics_totales', 'conversions', 'conversiones', 'primarias', 'solo_secundarias', 'total_incluyendo_secundarias', 'terminos_distintos', 'letras_de_diferencia'].includes(col)) return 100;
  if (['cost', 'costo', 'gasto', 'gasto_perdido', 'costo_total', 'cost_per_conv', 'cpa', 'avg_cpc', 'avg_cpm', 'est_top_of_page_cpc', 'effective_cpc_bid'].includes(col)) return 120;
  if (['ctr', 'ctr_promedio', 'conv_rate', 'impr_share', 'impr_share_promedio', 'top_impr_share', 'abs_top_impr_share', 'lost_is_budget', 'perdido_presupuesto', 'lost_is_rank', 'perdido_ranking', 'click_share'].includes(col)) return 90;
  return 120; // tags/status and everything else
}

function formatValue(col: string, val: any, currency: string) {
  if (val === null || val === undefined) return '-';
  
  const isCurrency = col.includes('cost') || col.includes('gasto') || col.includes('cpa') || col.includes('cpc');
  const isPercent = col === 'ctr' || col.includes('rate') || col.includes('share') || col.includes('lost_is');
  const isInt = col === 'impressions' || col === 'clicks' || col === 'impresiones';
  const isDecimal = col === 'conversions' || col === 'conversiones';

  if (typeof val === 'number') {
    if (isCurrency) {
      const locale = currency === 'EUR' ? 'de-DE' : 'es-CL';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: currency === 'CLP' ? 0 : 2
      }).format(val);
    }
    if (isPercent) return val.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';
    if (isInt) return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (isDecimal) return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return val;
}

export function Datos({ initialSearch, initialView }: { initialSearch?: string; initialView?: string } = {}) {
  const { selectedClient, setIsAuthenticated } = useAppStore();
  const currency = selectedClient === 'KAREDO' ? 'EUR' : 'CLP';
  
  const [activeView, setActiveView] = useState('v_keywords_analisis');
  const [weeks, setWeeks] = useState<string[]>([]);
  
  const [dateRangeMode, setDateRangeMode] = useState<string>('last_week');
  // Las vistas diarias usan días, no semanas. La capa diaria cubre 14 días móviles.
  const isEntidad = activeView.startsWith('ent_');
  const isDailyView = isEntidad || ['v_keywords_daily','v_search_terms_daily','v_campaign_daily','v_adgroup_daily'].includes(activeView);
  const isoDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const [customRange, setCustomRange] = useState<{from: string, to: string}>({from: '', to: ''});
  const [comparePrev, setComparePrev] = useState<boolean>(false);
  
  
  const [data, setData] = useState<any[]>([]);
  const [allCols, setAllCols] = useState<string[]>([]);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  
  const [totals, setTotals] = useState<any>({});
  const [totalCount, setTotalCount] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [annotations, setAnnotations] = useState<{manual: any[], system: any[]}>({manual: [], system: []});
  useEffect(() => {
     if (!selectedClient) return;
     const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
     const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
     fetch(`/api/annotations?client=${selectedClient}`, { credentials: 'include', headers })
       .then(r => r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : { manual: [], system: [] })
       .then(d => setAnnotations(d))
       .catch(console.error);
  }, [selectedClient]);

  
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [burnRate, setBurnRate] = useState<{
    dailyAvg: number;
    projectedTotal: number;
    monthlyBudget: number;
    status: 'over' | 'under' | 'on_track';
  } | null>(null);

    useEffect(() => {
     if (!selectedClient) return;
     const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
     const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
     fetch(`/api/metrics/v_tendencia_semanal?client=${selectedClient}&limit=10`, { credentials: 'include', headers })
       .then(r => r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : { data: [] })
       .then(res => {
          if (res.data && res.data.length >= 4) {
             const current = res.data[0];
             const history = res.data.slice(1, 9);
             
             const metrics = ['cpa', 'gasto', 'conversiones', 'ctr_promedio'];
             const detected = [];
             for (const m of metrics) {
                const vals = history.map((r:any) => Number(r[m]) || 0);
                const avg = vals.reduce((a:number, b:number) => a + b, 0) / vals.length;
                const sqDiffs = vals.map((v:number) => Math.pow(v - avg, 2));
                const stdDev = Math.sqrt(sqDiffs.reduce((a:number, b:number) => a + b, 0) / vals.length);
                const currVal = Number(current[m]) || 0;
                
                if (stdDev > 0) {
                   const zScore = Math.abs((currVal - avg) / stdDev);
                   if (zScore >= 2) {
                      detected.push({
                         metric: m,
                         current: currVal,
                         baseline: avg,
                         zScore: zScore,
                         direction: currVal > avg ? 'up' : 'down'
                      });
                   }
                }
             }
             setAnomalies(detected.sort((a,b) => b.zScore - a.zScore).slice(0, 5));
          } else {
             setAnomalies([]);
          }
       })
       .catch(console.error);
       
     // 2. Fetch MTD spend for Pacing Predictivo
     fetch(`/api/metrics/mtd?client=${selectedClient}`, { credentials: 'include', headers })
       .then(r => r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : ({} as any))
       .then((data: any) => {
          if (data?.success) {
             const today = new Date();
             const currentMonthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
             const dayOfMonth = today.getDate();
             
             const dailyAvg = (Number(data.mtd_spend) || 0) / dayOfMonth;
             const projectedTotal = dailyAvg * currentMonthDays;
             
             let dailyBudget = 0;
             if (selectedClient === 'KAREDO') dailyBudget = 135;
             else if (selectedClient === 'BHI') dailyBudget = 20000;
             else if (selectedClient === '360') dailyBudget = 21000;
             
             if (dailyBudget > 0) {
               const monthlyBudget = dailyBudget * currentMonthDays;
               let status: 'over' | 'under' | 'on_track' = 'on_track';
               if (projectedTotal > monthlyBudget * 1.05) status = 'over';
               else if (projectedTotal < monthlyBudget * 0.95) status = 'under';
               
               setBurnRate({
                 dailyAvg,
                 projectedTotal,
                 monthlyBudget,
                 status
               });
             } else {
               setBurnRate(null);
             }
          }
       }).catch(console.error);
  }, [selectedClient]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(1000);
  const [density, setDensity] = useState<'compact'|'normal'|'comfortable'>('normal');
  useEffect(() => {
    const saved = localStorage.getItem('northsignal.density');
    if (saved) setDensity(saved as any);
  }, []);

  
  
  const [orderBy, setOrderBy] = useState<string>('');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState(initialSearch || '');
  useEffect(() => { if (initialSearch) setSearch(initialSearch); }, [initialSearch]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showColSelector, setShowColSelector] = useState(false);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, col: string) => {
    setDraggedCol(col);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCol: string) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetCol) return;
    
    const newCols = [...visibleCols];
    const draggedIdx = newCols.indexOf(draggedCol);
    const targetIdx = newCols.indexOf(targetCol);
    
    newCols.splice(draggedIdx, 1);
    newCols.splice(targetIdx, 0, draggedCol);
    
    setVisibleCols(newCols);
    localStorage.setItem(`northsignal.cols.${activeView}`, JSON.stringify(newCols));
    setDraggedCol(null);
  };
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [inspectedKeyword, setInspectedKeyword] = useState<string | null>(null);
  const [keywordTrend, setKeywordTrend] = useState<any | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // Drawer de keyword: al hacer clic en una fila de keywords, trae la tendencia
  useEffect(() => {
    if (!inspectedKeyword) { setKeywordTrend(null); return; }
    setLoadingTrend(true);
    const headers: Record<string,string> = {};
    fetch(`/api/metrics/v_keyword_tendencia?client=${selectedClient}&search=${encodeURIComponent(inspectedKeyword)}&searchColumn=keyword&limit=5`, { credentials: 'include', headers })
      .then(r => r.json())
      .then(res => {
        const found = (res.data || []).find((d: any) => d.keyword === inspectedKeyword) || res.data?.[0] || null;
        setKeywordTrend(found);
      })
      .catch(() => setKeywordTrend(null))
      .finally(() => setLoadingTrend(false));
  }, [inspectedKeyword, selectedClient]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [filters, setFilters] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  const addFilter = (col: string, op: string, val: string, type: 'text'|'numeric') => {
    setFilters(prev => [...prev, { col, op, val, type }]);
    setShowFilters(false);
  };
  
  const removeFilter = (idx: number) => {
    setFilters(prev => prev.filter((_, i) => i !== idx));
  };
  
  useEffect(() => {
    setFilters([]);
  }, [activeView, selectedClient]);

  const [groupBy, setGroupBy] = useState<string>('');
  
  useEffect(() => {
    setGroupBy('');
  }, [activeView]);


  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
    let defaultOrder = 'cost';
    if (activeView === 'v_conversiones_por_accion') defaultOrder = 'primarias';
    if (activeView === 'v_ngrams_sin_conversion') defaultOrder = 'costo_total';
    if (activeView === 'v_fuzzy_negatives') defaultOrder = 'gasto_perdido';
    if (activeView === 'v_tendencia_semanal') defaultOrder = 'week_start';
    setOrderBy(defaultOrder);
    setOrderDir('desc');
  }, [activeView, selectedClient, debouncedSearch, dateRangeMode, customRange]);

  // Vistas diarias: arrancar en "últimos 14 días" con fechas reales
  useEffect(() => {
    if (isDailyView && ['last_week','4_weeks','8_weeks','12_weeks','all_time'].includes(dateRangeMode)) {
      setDateRangeMode('last_7d');
    } else if (!isDailyView && ['last_7d','last_14d'].includes(dateRangeMode)) {
      setDateRangeMode('last_week');
    }
  }, [isDailyView]);

  // Fetch Weeks
  useEffect(() => {
    if (!selectedClient) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`/api/metrics/weeks?client=${selectedClient}`, { credentials: 'include', headers })
      .then(r => r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : { weeks: [] })
      .then(d => {
        if (d.weeks && d.weeks.length > 0) {
          setWeeks(d.weeks);
        }
      })
      .catch(console.error);
  }, [selectedClient]);

  // Load Col Preferences
  useEffect(() => {
    if (allCols.length > 0) {
      const saved = localStorage.getItem(`northsignal.cols.${activeView}`);
      if (saved) {
        setVisibleCols(JSON.parse(saved));
      } else {
        const defaults = DEFAULT_COLS[activeView];
        if (defaults) {
          setVisibleCols(defaults.filter(c => allCols.includes(c)));
        } else {
          setVisibleCols(allCols);
        }
      }
    }
  }, [allCols, activeView]);

  const toggleCol = (col: string) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem(`northsignal.cols.${activeView}`, JSON.stringify(next));
      return next;
    });
  };

  // Fetch Data
  useEffect(() => {
    if (!selectedClient) {
      setData([]); setTotalCount(0);
      return;
    }
    const abortController = new AbortController();
    
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const offset = (page - 1) * limit;
        let url = `/api/metrics/${activeView}?client=${selectedClient}&limit=${limit}&offset=${offset}`;
    
    let from_date = '';
    let to_date = '';
    if (dateRangeMode === 'last_week' && weeks.length > 0) { from_date = weeks[0]; to_date = weeks[0]; }
    else if (dateRangeMode === '4_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(3, weeks.length - 1)]; }
    else if (dateRangeMode === '8_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(7, weeks.length - 1)]; }
    else if (dateRangeMode === '12_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(11, weeks.length - 1)]; }
    else if (dateRangeMode === 'all_time' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[weeks.length - 1]; }
    else if (dateRangeMode === 'last_7d') { from_date = isoDaysAgo(7); to_date = isoDaysAgo(1); }
    else if (dateRangeMode === 'last_14d') { from_date = isoDaysAgo(14); to_date = isoDaysAgo(1); }
    else if (dateRangeMode === 'custom') { from_date = customRange.from; to_date = customRange.to; }

    // Entidades por rango: endpoint propio, requiere from/to
    if (isEntidad) {
      const offset = (page - 1) * limit;
      if (!from_date || !to_date) { setData([]); setTotalCount(0); setLoading(false); return; }
      url = `/api/entidades/${activeView.replace('ent_','')}?client=${selectedClient}&from=${from_date}&to=${to_date}&limit=${limit}&offset=${offset}`;
      if (orderBy) url += `&orderBy=${orderBy}&orderDir=${orderDir}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
    }
    if (!isEntidad && orderBy) url += `&orderBy=${orderBy}&orderDir=${orderDir}`;
    const searchCol = VIEW_CONFIGS[activeView as keyof typeof VIEW_CONFIGS]?.searchCol;
    if (!isEntidad) {
      if (debouncedSearch && searchCol) url += `&search=${encodeURIComponent(debouncedSearch)}&searchColumn=${searchCol}`;
      if (from_date) url += `&from=${encodeURIComponent(from_date)}`;
      if (to_date) url += `&to=${encodeURIComponent(to_date)}`;
      if (comparePrev) url += `&compare=true`;
      if (groupBy) url += `&groupBy=${groupBy}`;
      if (filters.length > 0) url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(url, { credentials: 'include', headers, signal: abortController.signal });
        if (res.status === 401) {
          setIsAuthenticated(false);
          throw new Error('Unauthorized');
        }
        const isJson = res.headers.get('content-type')?.includes('application/json');
        if (!res.ok) {
          const errData = isJson ? await res.json().catch(() => ({})) : {};
          throw new Error(errData.error || `Error al cargar métricas (${res.status})`);
        }
        
        const result = isJson ? await res.json() : { data: [] };
        setData(result.data || []);
        setTotalCount(result.total || 0);
        setTotals({ ...(result.totals || {}), _dias_con_datos: result.dias_con_datos, _dias_en_rango: result.dias_en_rango, _rango_completo: result.rango_completo });
        
        if (result.data && result.data.length > 0 && allCols.length === 0) {
          setAllCols(Object.keys(result.data[0]).filter(k => k !== 'account'));
        } else if (result.data && result.data.length > 0) {
           const currentCols = Object.keys(result.data[0]).filter(k => k !== 'account');
           if (currentCols.join(',') !== allCols.join(',')) {
              setAllCols(currentCols);
           }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => abortController.abort();
  }, [selectedClient, activeView, page, orderBy, orderDir, debouncedSearch, dateRangeMode, customRange, comparePrev, groupBy, filters, setIsAuthenticated, weeks]);

  const handleSort = (col: string) => {
    if (orderBy === col) {
      if (orderDir === 'asc') setOrderDir('desc');
      else { setOrderBy(''); setOrderDir('desc'); }
    } else {
      setOrderBy(col); setOrderDir('desc');
    }
  };

  const exportToCSV = async () => {
    if (!selectedClient) return;
    try {
      let url = `/api/metrics/${activeView}?client=${selectedClient}&limit=10000`;
    
    let from_date = '';
    let to_date = '';
    if (dateRangeMode === 'last_week' && weeks.length > 0) { from_date = weeks[0]; to_date = weeks[0]; }
    else if (dateRangeMode === '4_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(3, weeks.length - 1)]; }
    else if (dateRangeMode === '8_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(7, weeks.length - 1)]; }
    else if (dateRangeMode === '12_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(11, weeks.length - 1)]; }
    else if (dateRangeMode === 'all_time' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[weeks.length - 1]; }
    else if (dateRangeMode === 'last_7d') { from_date = isoDaysAgo(7); to_date = isoDaysAgo(1); }
    else if (dateRangeMode === 'last_14d') { from_date = isoDaysAgo(14); to_date = isoDaysAgo(1); }
    else if (dateRangeMode === 'custom') { from_date = customRange.from; to_date = customRange.to; }

    // Entidades por rango: endpoint propio, requiere from/to
    if (isEntidad) {
      const offset = (page - 1) * limit;
      if (!from_date || !to_date) { setData([]); setTotalCount(0); setLoading(false); return; }
      url = `/api/entidades/${activeView.replace('ent_','')}?client=${selectedClient}&from=${from_date}&to=${to_date}&limit=${limit}&offset=${offset}`;
      if (orderBy) url += `&orderBy=${orderBy}&orderDir=${orderDir}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
    }
    if (!isEntidad && orderBy) url += `&orderBy=${orderBy}&orderDir=${orderDir}`;
    const searchCol = VIEW_CONFIGS[activeView as keyof typeof VIEW_CONFIGS]?.searchCol;
    if (!isEntidad) {
      if (debouncedSearch && searchCol) url += `&search=${encodeURIComponent(debouncedSearch)}&searchColumn=${searchCol}`;
      if (from_date) url += `&from=${encodeURIComponent(from_date)}`;
      if (to_date) url += `&to=${encodeURIComponent(to_date)}`;
      if (comparePrev) url += `&compare=true`;
      if (groupBy) url += `&groupBy=${groupBy}`;
      if (filters.length > 0) url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(url, { credentials: 'include', headers });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const result = isJson ? await res.json() : { data: [] };
    const allData = result.data || [];
    if (allData.length === 0) return;
      
      const cols = visibleCols.length > 0 ? visibleCols : allCols;
      const header = cols.map(c => COL_LABELS[c] || c).join(',');
      const rows = allData.map((row: any) => 
        cols.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          return val;
        }).join(',')
      );
      
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const dl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dl;
      a.download = `${selectedClient}_${activeView}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(dl);
    } catch(e) {
      console.error(e);
    }
  };

  const exportToPDF = async () => {
    if (!selectedClient) return;
    try {
      setLoading(true);
      let url = `/api/metrics/${activeView}?client=${selectedClient}&limit=1000`;
    
    let from_date = '';
    let to_date = '';
    if (dateRangeMode === 'last_week' && weeks.length > 0) { from_date = weeks[0]; to_date = weeks[0]; }
    else if (dateRangeMode === '4_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(3, weeks.length - 1)]; }
    else if (dateRangeMode === '8_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(7, weeks.length - 1)]; }
    else if (dateRangeMode === '12_weeks' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[Math.min(11, weeks.length - 1)]; }
    else if (dateRangeMode === 'all_time' && weeks.length > 0) { to_date = weeks[0]; from_date = weeks[weeks.length - 1]; }
    else if (dateRangeMode === 'last_7d') { from_date = isoDaysAgo(7); to_date = isoDaysAgo(1); }
    else if (dateRangeMode === 'last_14d') { from_date = isoDaysAgo(14); to_date = isoDaysAgo(1); }
    else if (dateRangeMode === 'custom') { from_date = customRange.from; to_date = customRange.to; }

    // Entidades por rango: endpoint propio, requiere from/to
    if (isEntidad) {
      const offset = (page - 1) * limit;
      if (!from_date || !to_date) { setData([]); setTotalCount(0); setLoading(false); return; }
      url = `/api/entidades/${activeView.replace('ent_','')}?client=${selectedClient}&from=${from_date}&to=${to_date}&limit=${limit}&offset=${offset}`;
      if (orderBy) url += `&orderBy=${orderBy}&orderDir=${orderDir}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
    }
    if (!isEntidad && orderBy) url += `&orderBy=${orderBy}&orderDir=${orderDir}`;
    const searchCol = VIEW_CONFIGS[activeView as keyof typeof VIEW_CONFIGS]?.searchCol;
    if (!isEntidad) {
      if (debouncedSearch && searchCol) url += `&search=${encodeURIComponent(debouncedSearch)}&searchColumn=${searchCol}`;
      if (from_date) url += `&from=${encodeURIComponent(from_date)}`;
      if (to_date) url += `&to=${encodeURIComponent(to_date)}`;
      if (comparePrev) url += `&compare=true`;
      if (groupBy) url += `&groupBy=${groupBy}`;
      if (filters.length > 0) url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(url, { credentials: 'include', headers });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const result = isJson ? await res.json() : { data: [] };
    const allData = result.data || [];
      if (allData.length === 0) {
        setLoading(false);
        return;
      }

      const doc = new jsPDF('landscape');
      
      // Load Logo
      const imgUrl = "https://djbwxgicosargfobsmqd.supabase.co/storage/v1/object/public/logos/ChatGPT%20Image%204%20sept%202026,%2007_31_34%20p.m..png";
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imgUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      
      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'PNG', 14, 10, 16, 16);
      }

      // Title
      doc.setFontSize(18);
      doc.setTextColor(26, 31, 54);
      doc.text("Reporte de Rendimiento - NorthSignal", 35, 18);
      
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Cliente: ${selectedClient} | Vista: ${VIEW_CONFIGS[activeView as keyof typeof VIEW_CONFIGS]?.label} | Fecha: ${new Date().toLocaleDateString()}`, 35, 26);

      // Totals
      if (totals) {
         doc.setFontSize(10);
         doc.setTextColor(50, 50, 50);
         const docCurrency = selectedClient === 'KAREDO' ? 'EUR' : 'CLP';
         const totalsText = `Inversión: ${formatValue('cost', totals.cost, docCurrency)}  |  Clics: ${totals.clicks}  |  Impr: ${totals.impressions}  |  Conv: ${totals.conversions}  |  CPA: ${formatValue('cpa', totals.cpa, docCurrency)}  |  CTR: ${(totals.ctr || 0).toFixed(2)}%`;
         doc.text(totalsText, 14, 38);
      }

      const cols = visibleCols.length > 0 ? visibleCols : allCols;
      const head = [cols.map(c => COL_LABELS[c] || c)];
      
      const body = allData.map((row: any) => 
        cols.map(col => {
          let val = row[col];
          if (val === null || val === undefined) return '-';
          if (typeof val === 'number') {
            const docCurrency = selectedClient === 'KAREDO' ? 'EUR' : 'CLP';
            return formatValue(col, val, docCurrency);
          }
          return val.toString();
        })
      );

      autoTable(doc, {
        head: head,
        body: body,
        startY: totals ? 45 : 35,
        styles: { fontSize: 8, cellPadding: 2, textColor: [50, 50, 50] },
        headStyles: { fillColor: [0, 98, 204], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { top: 35, bottom: 15 },
        didDrawPage: function (data: any) {
           doc.setFontSize(8);
           doc.setTextColor(150, 150, 150);
           const pageCount = (doc as any).internal.getNumberOfPages();
           doc.text(`Página ${data.pageNumber} de ${pageCount} - Generado por NorthSignal`, data.settings.margin.left, (doc as any).internal.pageSize.height - 10);
        }
      });

      doc.save(`NorthSignal_Report_${selectedClient}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch(e) {
      console.error(e);
      alert('Error generando PDF: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col bg-[#1A1F36] animate-in fade-in duration-500 text-[#F5F7FA] ${isFullscreen ? 'fixed inset-0 z-[200]' : 'h-full'}`}>
      <header className="h-16 border-b border-[#0062CC]/20 flex items-center justify-between px-8 bg-[#1A1F36] shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Database size={20} className="text-[#0062CC]" />
          <h1 className="text-lg font-medium text-[#FFFFFF] tracking-wide">Datos</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#F5F7FA]/60 font-medium">Density:</span>
            <div className="relative">
              <select 
                value={density}
                onChange={(e) => setDensity(e.target.value as any)}
                className="appearance-none bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg pl-3 pr-8 py-1.5 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#0062CC] transition-all cursor-pointer"
              >
                <option value="compact" className="bg-[#1A1F36]">Compacta</option>
                <option value="normal" className="bg-[#1A1F36]">Normal</option>
                <option value="comfortable" className="bg-[#1A1F36]">Cómoda</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-[#F5F7FA]/60 pointer-events-none" size={14} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={exportToPDF}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0062CC]/10 hover:bg-[#0062CC]/20 text-[#FFFFFF] border border-[#0062CC]/30 text-sm transition-colors font-medium shadow-sm"
            >
              <FileText size={14} />
              PDF Report
            </button>
            
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0062CC]/10 hover:bg-[#0062CC]/20 text-[#FFFFFF] border border-[#0062CC]/30 text-sm transition-colors font-medium shadow-sm"
            >
              <Download size={14} />
              CSV
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors font-medium shadow-sm ${isFullscreen ? 'bg-[#0062CC] text-[#FFFFFF] border-[#0062CC]' : 'bg-[#0062CC]/10 hover:bg-[#0062CC]/20 text-[#FFFFFF] border-[#0062CC]/30'}`}
            >
              {isFullscreen ? <X size={14} /> : <Layers size={14} />}
              {isFullscreen ? 'Contraer' : 'Pantalla Completa'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 overflow-hidden bg-[#1A1F36] relative">
      
        

<div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-2">
          <div className="flex gap-2 bg-[#1A1F36]/80 p-1 rounded-xl border border-[#0062CC]/20 overflow-x-auto custom-scrollbar shadow-sm">
            {(['Por semana', 'Por día', 'Diagnóstico'] as const).map(grupo => {
              const items = Object.entries(VIEW_CONFIGS).filter(([, cfg]: any) => (cfg.grupo || 'Por semana') === grupo);
              if (!items.length) return null;
              return (
                <div key={grupo} className="flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-40 px-1.5 whitespace-nowrap">{grupo}</span>
                  {items.map(([val, config]: any) => (
                    <button key={val} onClick={() => setActiveView(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeView === val ? 'bg-[#0062CC] text-[#FFFFFF] shadow-sm' : 'text-[#F5F7FA]/70 hover:text-[#FFFFFF] hover:bg-[#0062CC]/15'}`}>
                      {config.label}
                    </button>
                  ))}
                  <span className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--border)' }} />
                </div>
              );
            })}
          </div>

          {/* Moved Column Selector Next to Trends/Views */}
          <div className="relative z-[60]">
            <button 
              onClick={() => setShowColSelector(!showColSelector)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A1F36] hover:bg-[#0062CC]/15 text-[#FFFFFF] border border-[#0062CC]/30 text-sm transition-colors font-medium shadow-sm"
            >
              <Settings2 size={16} className="text-[#0062CC]" />
              Personalizar Columnas
            </button>
            {showColSelector && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#1A1F36] border border-[#0062CC]/30 rounded-xl shadow-2xl z-[100] p-2">
                 <div className="flex justify-between items-center px-3 py-2 border-b border-[#0062CC]/20 mb-2">
                   <span className="text-xs font-semibold text-[#F5F7FA]/70">Mostrar Columnas</span>
                   <button onClick={() => {
                      const defaults = DEFAULT_COLS[activeView] || allCols;
                      setVisibleCols(defaults);
                      localStorage.setItem(`northsignal.cols.${activeView}`, JSON.stringify(defaults));
                   }} className="text-xs text-[#0062CC] hover:text-[#0062CC]/80 font-semibold">Reset</button>
                 </div>
                 <div className="max-h-64 overflow-y-auto custom-scrollbar">
                   {allCols.map(c => (
                     <label key={c} className="flex items-center gap-3 px-3 py-2 hover:bg-[#0062CC]/15 rounded-lg cursor-pointer transition-colors">
                       <input 
                         type="checkbox"
                         checked={visibleCols.includes(c)}
                         onChange={() => toggleCol(c)}
                         className="rounded border-[#0062CC]/30 bg-[#1A1F36] text-[#0062CC] focus:ring-0 focus:ring-offset-0"
                       />
                       <span className="text-sm text-[#FFFFFF]">{COL_LABELS[c] || c}</span>
                     </label>
                   ))}
                 </div>
              </div>
            )}
          </div>
        </div>

        {VIEW_CONFIGS[activeView]?.description && (
           <div className="mb-4 text-sm text-[#F5F7FA]/70 flex items-center gap-2 shrink-0">
             <Filter size={14} className="text-[#0062CC]" />
             {VIEW_CONFIGS[activeView].description}
           </div>
        )}
        
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 shrink-0">
            {filters.map((f, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-[#0062CC]/20 text-[#0062CC] text-xs px-2.5 py-1 rounded-lg border border-[#0062CC]/30 font-medium">
                {COL_LABELS[f.col]||f.col} {f.op} "{f.val}"
                <button onClick={() => removeFilter(i)} className="hover:text-[#FFFFFF]"><X size={12}/></button>
              </span>
            ))}
          </div>
        )}

        {activeView === 'v_tendencia_semanal' && data.length > 0 && (
          <div className="mb-4 p-5 rounded-2xl bg-[#1A1F36] border border-[#0062CC]/30 shadow-md shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#0062CC]" /> Curva de Tendencia Semanal (Gasto vs CPA)
                </h3>
                <p className="text-xs text-[#F5F7FA]/70">Evolución de inversión vs costo por adquisición semana a semana.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-[#F5F7FA]/70">
                  <span className="w-3 h-3 rounded-sm bg-[#0062CC]" /> Gasto Semanal
                </span>
                <span className="flex items-center gap-1.5 text-[#0062CC]">
                  <span className="w-3 h-0.5 bg-[#0062CC]" /> CPA Ponderado
                </span>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={[...data].reverse()} margin={{ top: 10, right: 30, left: 10, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0062CC" strokeOpacity={0.15} />
                  <XAxis dataKey="week_start" stroke="#F5F7FA" strokeOpacity={0.6} tick={{ fontSize: 10 }} tickFormatter={v => formatDatePretty(v)} />
                  <YAxis yAxisId="left" stroke="#F5F7FA" strokeOpacity={0.6} tick={{ fontSize: 10 }} tickFormatter={v => formatValue('gasto', v, currency)} />
                  <YAxis yAxisId="right" orientation="right" stroke="#0062CC" strokeOpacity={0.8} tick={{ fontSize: 10 }} tickFormatter={v => formatValue('cpa', v, currency)} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1A1F36', borderColor: '#0062CC', borderRadius: '12px' }}
                    labelStyle={{ color: '#FFFFFF', fontWeight: 'bold' }}
                    formatter={(val: any, name: any) => [formatValue(name === 'CPA' ? 'cpa' : 'gasto', Number(val) || 0, currency), name]}
                    labelFormatter={v => `Semana: ${formatDatePretty(String(v))}`}
                  />
                  <Bar yAxisId="left" dataKey="gasto" name="Gasto" fill="#0062CC" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="cpa" name="CPA" stroke="#0062CC" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#1A1F36] border border-[#0062CC]/20 rounded-2xl shadow-sm">
            {loading ? (
              <div className="absolute inset-0 p-4 z-20">
                 {/* Skeleton Loader */}
                 <div className="animate-pulse flex flex-col gap-4">
                   <div className="h-8 bg-[#0062CC]/10 rounded-md w-full"></div>
                   <div className="h-8 bg-[#0062CC]/10 rounded-md w-full"></div>
                   <div className="h-8 bg-[#0062CC]/10 rounded-md w-full"></div>
                   <div className="h-8 bg-[#0062CC]/10 rounded-md w-full"></div>
                 </div>
              </div>
            ) : data.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#F5F7FA]/50 z-20">
                 <Search size={48} className="mb-4 opacity-30 text-[#0062CC]" />
                 <p className="text-lg font-medium text-[#FFFFFF]">No hay filas para este rango. Probá otro rango o quitá el filtro de texto.</p>
                 <p className="text-sm mt-1 text-[#F5F7FA]/70">Ajusta los filtros o cambia de vista.</p>
              </div>
            ) : null}
            
            <table className="w-full text-left border-collapse relative min-w-[800px]">
              <thead className="sticky top-0 z-30 bg-[#1A1F36] border-b border-[#0062CC]/30 shadow-md">
                <tr>
                  {visibleCols.map((col, idx) => {
                    const isSorted = orderBy === col;
                    return (
                      <th 
                      key={col} 
                      onClick={() => handleSort(col)}
                      draggable={idx !== 0}
                      onDragStart={(e) => handleDragStart(e, col)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col)}
                      className={`group ${draggedCol === col ? 'opacity-50' : ''} ${idx === 0 ? 'sticky left-0 z-50 bg-[#1A1F36] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)]' : ''} py-3 px-4 text-xs font-semibold text-[#F5F7FA] opacity-80 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors border-b border-white/10 ${
                          idx === 0 ? 'sticky left-0 bg-[#1A1F36] z-40 border-r border-white/5 max-w-[250px] truncate shadow-[4px_0_12px_rgba(0,0,0,0.5)]' : ''
                        }`} 
                      >
                        <div className={`flex items-center gap-2 ${idx > 0 ? 'justify-end' : ''}`}>
                          {COL_TERMINO[col]
                            ? <Termino t={COL_TERMINO[col]}>{COL_LABELS[col] || col.replace(/_/g, ' ')}</Termino>
                            : (COL_LABELS[col] || col.replace(/_/g, ' '))}
                          {isSorted ? (
                            <span className="text-[#0062CC]">
                              {orderDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </span>
                          ) : (
                            <span className="text-[#F5F7FA] opacity-60 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronDown size={14} />
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((row, i) => {
                  const rowBg = i % 2 === 0 ? 'bg-[#1A1F36]' : 'bg-[var(--surface-1)]';
                  const py = density === 'compact' ? 'py-1.5' : density === 'comfortable' ? 'py-4' : 'py-3';
                  return (
                    <tr 
                      key={i} 
                      onClick={() => {
                        setSelectedRow(row);
                        if (row.keyword && ['v_keywords_analisis','v_keywords_daily','v_keyword_tendencia'].includes(activeView)) {
                          setInspectedKeyword(row.keyword);
                        }
                      }}
                      className={`hover:bg-[var(--surface-2)] transition-colors group cursor-pointer ${rowBg}`}
                    >
                      {visibleCols.map((col, idx) => {
                        const val = row[col];
                        let content = formatValue(col, val, currency);
                        let cellClasses = `${py} px-4 tabular tabular-nums text-[13px] whitespace-nowrap ${
                          idx === 0 
                            ? 'sticky left-0 group-hover:bg-[var(--surface-2)] transition-colors z-20 border-r border-white/5 shadow-[4px_0_12px_rgba(0,0,0,0.5)] max-w-[250px] truncate ' + rowBg 
                            : ''
                        }`;
                        
                        if (typeof val === 'number') {
                           cellClasses += ' text-right text-[#F5F7FA] opacity-80';
                        } else {
                           cellClasses += ' text-left text-[#F5F7FA]';
                        }
                        
                        if (idx === 0) {
                           content = <span title={String(val)}>{content}</span>;
                        }

                        let cellBg = '';
                        let title = '';

                        if (col === 'quality_score' && val !== null) {
                          if (val <= 4) { cellBg = 'bg-[#0062CC]/10 text-[#0062CC]'; }
                          else if (val <= 6) { cellBg = 'bg-[var(--primary-faint)]/10 text-[#F5F7FA]'; }
                          else { cellBg = 'bg-[var(--surface-2)]/10 text-[#FFFFFF]'; }
                        }
                        
                        if (col === 'impr_share' && val !== null && val < 30) {
                          cellBg = 'bg-[var(--primary-faint)]/10 text-[#F5F7FA]';
                        }
                        
                        if (col === 'lost_is_budget' && val > 20) {
                          cellBg = 'bg-[var(--primary-faint)]/10 text-[#F5F7FA]';
                          title = 'acá sí sirve subir presupuesto';
                        }
                        
                        if (col === 'lost_is_rank' && val > 40) {
                          cellBg = 'bg-[#0062CC]/10 text-[#0062CC]';
                          title = 'subir presupuesto NO resuelve esto';
                        }
                        
                        if ((col === 'cost' || col === 'costo' || col === 'gasto') && val > 0 && (row.conversions === 0 || row.conversiones === 0 || row.conversions === null)) {
                          cellBg = 'bg-[var(--primary-faint)]/10 text-[#F5F7FA]';
                          title = 'Gasto sin conversiones';
                        }

                        if (cellBg) {
                           return (
                             <td key={col} className={cellClasses} title={title}>
                               <div className={`px-2 py-0.5 rounded inline-block ${cellBg}`}>{content}</div>
                             </td>
                           );
                        }

                        return (
                          <td key={col} className={cellClasses} title={title}>
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-30">
                 <tr className="bg-[var(--surface-1)]">
                    {visibleCols.map((col, idx) => {
                       if (idx === 0) {
                          const hasFilters = filters.length > 0;
                          return (
                             <td key={col} className="py-3 px-4 sticky left-0 bg-[var(--surface-1)] z-40 border-t-2 border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                                TOTAL {hasFilters ? '(sin filtros de col.)' : ''} <span className="text-[#F5F7FA] opacity-60 text-xs ml-2">{totalCount} filas</span>
                             </td>
                          );
                       }
                       const val = totals[col];
                       return (
                          <td key={col} className="py-3 px-4 text-right tabular tabular-nums text-[13px] border-t-2 border-white/10">
                             {val !== undefined ? formatValue(col, val, currency) : ''}
                          </td>
                       );
                    })}
                 </tr>
              </tfoot>
            </table>
        </div>
        
        {/* Paginación: solo si hay más filas que el límite. Con 1000 por defecto, casi nunca. */}
        <div className="flex items-center justify-between mt-2 shrink-0 px-2">
          <div className="text-xs text-[#F5F7FA]/70 tabular">
            {totalCount} filas
            {totals && (totals as any)._dias_en_rango && (
              <span className={(totals as any)._rango_completo ? ' opacity-60' : ' text-[#0062CC]'}>
                {' · '}{(totals as any)._dias_con_datos} de {(totals as any)._dias_en_rango} días con datos
                {!(totals as any)._rango_completo && ' (rango parcial)'}
              </span>
            )}
          </div>
          {totalCount > limit && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-[#0062CC]/10 hover:bg-[#0062CC]/20 text-[#0062CC] border border-[#0062CC]/30 text-sm disabled:opacity-50 disabled:hover:bg-[#0062CC]/10 font-medium transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs text-[#FFFFFF] font-medium px-2">
              Página {page}
            </span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= totalCount}
              className="px-3 py-1.5 rounded-lg bg-[#0062CC]/10 hover:bg-[#0062CC]/20 text-[#0062CC] border border-[#0062CC]/30 text-sm disabled:opacity-50 disabled:hover:bg-[#0062CC]/10 font-medium transition-colors"
            >
              Siguiente
            </button>
          </div>
          )}
        </div>
      </div>

        {(totals as any).dataHealth && (totals as any).dataHealth.status !== 'OK' && (
           <div className="mb-6 p-4 rounded-xl bg-[var(--primary-faint)]/10 border border-[var(--border-strong)]/30 flex items-start justify-between gap-3 shrink-0 shadow-sm">
             <div className="flex items-start gap-3">
                <AlertTriangle className="text-[#F5F7FA] shrink-0 mt-0.5" size={18} />
                <p className="text-sm font-medium text-[#F5F7FA]">
                  Advertencia de Frescura: Los datos de {selectedClient} son del {(totals as any).dataHealth.last_run ? new Date((totals as any).dataHealth.last_run).toLocaleDateString() : 'desconocido'}. 
                  El script no corrió o falló en la última extracción.
                </p>
             </div>
           </div>
        )}

        {(totals as any).dataIntegrity && ((totals as any).dataIntegrity.diff_adgroup > 0 || (totals as any).dataIntegrity.diff_keyword > 0) && (
           <div className="mb-6 p-4 rounded-xl bg-[#0062CC]/10 border border-[#0062CC]/30 flex items-start justify-between gap-3 shrink-0 shadow-sm">
             <div className="flex items-start gap-3">
                <AlertCircle className="text-[#0062CC] shrink-0 mt-0.5" size={18} />
                <p className="text-sm font-medium text-[#0062CC]">
                  Pérdida de Integridad: El gasto de campaña no coincide con los niveles inferiores. 
                  (Dif. Grupos: {(totals as any).dataIntegrity.diff_adgroup}, Dif. Keywords: {(totals as any).dataIntegrity.diff_keyword}). Posible truncado de datos.
                </p>
             </div>
           </div>
        )}


        
        <div className="grid grid-cols-5 gap-2 mt-3 shrink-0">
          <div className="bg-[#1A1F36] rounded-lg p-2.5 border border-[#0062CC]/20 flex flex-col justify-center shadow-sm">
            <p className="text-xs font-semibold text-[#F5F7FA]/60 uppercase tracking-wider mb-0">Inversión (Filtro)</p>
            <h3 className="text-sm font-semibold text-[#FFFFFF]">{formatValue('cost', totals.cost || 0, currency)}</h3>
          </div>
          <div className="bg-[#1A1F36] rounded-lg p-2.5 border border-[#0062CC]/20 flex flex-col justify-center shadow-sm">
            <p className="text-xs font-semibold text-[#F5F7FA]/60 uppercase tracking-wider mb-0">Conversiones (Filtro)</p>
            <h3 className="text-sm font-semibold text-[#FFFFFF]">{totals.conversions || 0}</h3>
          </div>
          <div className="bg-[#1A1F36] rounded-lg p-2.5 border border-[#0062CC]/20 flex flex-col justify-center shadow-sm">
            <p className="text-xs font-semibold text-[#F5F7FA]/60 uppercase tracking-wider mb-0">CPA (Ponderado)</p>
            <h3 className="text-sm font-semibold text-[#0062CC]">{formatValue('cpa', totals.cpa || 0, currency)}</h3>
          </div>
          <div className="bg-[#1A1F36] rounded-lg p-2.5 border border-[#0062CC]/20 flex flex-col justify-center shadow-sm">
            <p className="text-xs font-semibold text-[#F5F7FA]/60 uppercase tracking-wider mb-0">CPC (Promedio)</p>
            <h3 className="text-sm font-semibold text-[#FFFFFF]">{formatValue('avg_cpc', totals.avg_cpc || 0, currency)}</h3>
          </div>
          <div className="bg-[#1A1F36] rounded-lg p-2.5 border border-[#0062CC]/20 flex flex-col justify-center shadow-sm">
            <p className="text-xs font-semibold text-[#F5F7FA]/60 uppercase tracking-wider mb-1" title={totals.limitacion === 'presupuesto' ? 'Subir presupuesto generará más volumen' : 'Subir presupuesto NO generará más volumen'}>Restricción Principal</p>
            <h3 className="text-lg font-medium text-[#0062CC] line-clamp-1">
              {totals?.limitacion ? String(totals.limitacion).toUpperCase() : 'N/A'}
            </h3>
          </div>
        </div>

        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 mb-2 shrink-0 px-1">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F5F7FA]/50" size={16} />
              <input 
                type="text" 
                placeholder={`Buscar en ${VIEW_CONFIGS[activeView as keyof typeof VIEW_CONFIGS]?.label}...`}
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="w-full bg-[#1A1F36] border border-[#0062CC]/30 rounded-xl pl-9 pr-4 py-2 text-sm text-[#FFFFFF] placeholder-[#F5F7FA]/40 focus:outline-none focus:border-[#0062CC] transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={dateRangeMode} 
                onChange={e => setDateRangeMode(e.target.value)}
                className="appearance-none bg-[#1A1F36] border border-[#0062CC]/30 rounded-xl pl-4 pr-8 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#0062CC] transition-all cursor-pointer"
              >
                {isDailyView ? (<>
                  <option value="last_7d">Últimos 7 días</option>
                  <option value="last_14d">Últimos 14 días</option>
                </>) : (<>
                  <option value="last_week">Última semana</option>
                  <option value="4_weeks">Últimas 4 semanas</option>
                  <option value="8_weeks">Últimas 8 semanas</option>
                  <option value="12_weeks">Últimas 12 semanas</option>
                  <option value="all_time">Todo el histórico</option>
                </>)}
                <option value="custom">Rango personalizado...</option>
              </select>
              
              {dateRangeMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customRange.from} max={customRange.to || undefined}
                    onChange={e => setCustomRange(p => ({...p, from: e.target.value}))}
                    className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-xl px-3 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#0062CC] tabular"
                    style={{ colorScheme: 'dark' }} />
                  <span className="text-[#F5F7FA]/50">→</span>
                  <input type="date" value={customRange.to} min={customRange.from || undefined}
                    onChange={e => setCustomRange(p => ({...p, to: e.target.value}))}
                    className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-xl px-3 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#0062CC] tabular"
                    style={{ colorScheme: 'dark' }} />
                  {!isDailyView && <span className="text-[10px] text-[#F5F7FA] opacity-50">semanas: se usa el lunes de cada fecha</span>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select 
                value={limit} 
                onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                className="appearance-none bg-[#1A1F36] border border-[#0062CC]/30 rounded-xl pl-4 pr-8 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#0062CC] transition-all cursor-pointer"
              >
                <option value={100}>100 filas</option>
                <option value={250}>250 filas</option>
                <option value={500}>500 filas</option>
                <option value={1000}>Todas (hasta 1000)</option>
              </select>
            </div>
          </div>
          
          <div className="text-sm font-medium text-[#F5F7FA]/60 text-right">
             {(() => {
                let text = '';
                if (dateRangeMode === 'last_week' && weeks.length > 0) text = `Semana del ${formatDatePretty(weeks[0])} al ${getEndOfWeek(weeks[0])}`;
                else if (dateRangeMode === '4_weeks' && weeks.length > 0) text = `4 semanas: del ${formatDatePretty(weeks[Math.min(3, weeks.length - 1)])} al ${getEndOfWeek(weeks[0])}`;
                else if (dateRangeMode === '8_weeks' && weeks.length > 0) text = `8 semanas: del ${formatDatePretty(weeks[Math.min(7, weeks.length - 1)])} al ${getEndOfWeek(weeks[0])}`;
                else if (dateRangeMode === '12_weeks' && weeks.length > 0) text = `12 semanas: del ${formatDatePretty(weeks[Math.min(11, weeks.length - 1)])} al ${getEndOfWeek(weeks[0])}`;
                else if (dateRangeMode === 'all_time' && weeks.length > 0) text = `Todo el histórico: del ${formatDatePretty(weeks[weeks.length - 1])} al ${getEndOfWeek(weeks[0])}`;
                else if (dateRangeMode === 'last_7d') text = `Últimos 7 días: del ${formatDatePretty(isoDaysAgo(7))} al ${formatDatePretty(isoDaysAgo(1))}`;
                else if (dateRangeMode === 'last_14d') text = `Últimos 14 días: del ${formatDatePretty(isoDaysAgo(14))} al ${formatDatePretty(isoDaysAgo(1))}`;
                else if (dateRangeMode === 'custom' && customRange.from && customRange.to) text = `Del ${formatDatePretty(customRange.from)} al ${formatDatePretty(customRange.to)}`;
                
                return text ? `${text} · ${totalCount} filas` : '';
             })()}
          </div>
        </div>

      <div className="mt-4 space-y-3">
        {burnRate && (
          <div className="mb-6 p-5 rounded-xl bg-[#1A1F36] border border-[#0062CC]/20 flex items-center justify-between gap-4 shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${burnRate.status === 'over' ? 'bg-[#0062CC]/10 border-[#0062CC]/30 text-[#0062CC]' : burnRate.status === 'under' ? 'bg-[var(--primary-faint)]/10 border-[var(--border-strong)]/30 text-[#F5F7FA]' : 'bg-[var(--surface-2)]/10 border-[#FFFFFF]/30 text-[#FFFFFF]'}`}>
                 <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#FFFFFF]">Pacing Predictivo (Burn Rate)</h3>
                <p className="text-xs text-[#F5F7FA]/70">Proyección fin de mes basada en gasto diario promedio ({formatValue('gasto', burnRate.dailyAvg, selectedClient === 'KAREDO' ? 'EUR' : 'CLP')}/día)</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-[#F5F7FA]/60 font-medium">Proyección Mensual</p>
                <p className={`text-lg font-bold tabular ${burnRate.status === 'over' ? 'text-[#0062CC]' : burnRate.status === 'under' ? 'text-[#F5F7FA]' : 'text-[#FFFFFF]'}`}>
                  {formatValue('gasto', burnRate.projectedTotal, selectedClient === 'KAREDO' ? 'EUR' : 'CLP')}
                </p>
              </div>
              <div className="w-px h-10 bg-[#0062CC]/20"></div>
              <div className="text-right">
                <p className="text-xs text-[#F5F7FA]/60 font-medium">Presupuesto Límite</p>
                <p className="text-lg font-bold tabular text-[#FFFFFF]">
                  {formatValue('gasto', burnRate.monthlyBudget, selectedClient === 'KAREDO' ? 'EUR' : 'CLP')}
                </p>
              </div>
            </div>
          </div>
        )}
        {totals?.limited && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--primary-faint)]/10 border border-[var(--border-strong)]/30 text-[#F5F7FA] text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="text-[#F5F7FA] shrink-0" size={16} />
            <span>Totales sobre las primeras 1000 filas del filtro</span>
          </div>
        )}
      </div>

      {/* Drawer de keyword: tendencia acumulada */}
      <Drawer
        isOpen={Boolean(inspectedKeyword)}
        onClose={() => setInspectedKeyword(null)}
        title={inspectedKeyword || ''}
        subtitle={`Tendencia acumulada · ${selectedClient}`}
      >
        <div className="space-y-4 text-xs">
          {loadingTrend ? (
            <div className="py-6 text-center opacity-50 italic">Cargando tendencia...</div>
          ) : keywordTrend ? (
            <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block">Comportamiento acumulado</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Gasto total</div>
                  <div className="text-base font-bold text-[#FFFFFF] tabular">{formatValue('gasto_total', keywordTrend.gasto_total, currency)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Conversiones</div>
                  <div className="text-base font-bold text-[#FFFFFF] tabular">{keywordTrend.conversiones_total ?? 0}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">CPA del período</div>
                  <div className="text-sm font-semibold text-[#FFFFFF] tabular">{formatValue('cpa', keywordTrend.cpa_periodo, currency)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Días con actividad</div>
                  <div className="text-sm font-semibold text-[#FFFFFF] tabular">{keywordTrend.dias_con_actividad ?? 0}</div>
                </div>
              </div>
              <p className="text-[11px] text-[#F5F7FA] opacity-60 pt-1">
                Días con actividad distingue gasto parejo de gasto concentrado en pocos días. Esa diferencia no se ve en el agregado semanal.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl text-xs text-[#F5F7FA] opacity-70" style={{ backgroundColor: 'var(--surface-2)' }}>
              Este término no tiene historial en los 14 días de la capa diaria.
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
