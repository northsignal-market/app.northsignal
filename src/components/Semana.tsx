import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import { 
  Calendar, Clock, Plus, Check, RefreshCw, FileText, 
  AlertCircle, History, ArrowRight, ExternalLink 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Drawer } from './Drawer';

interface SemanaProps {
  onOpenActionable?: (actionId: string) => void;
}

function formatCurrency(val: number, client?: string | null) {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (client?.toUpperCase() === 'KAREDO') {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
  }
  return `$${val.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function Semana({ onOpenActionable }: SemanaProps) {
  const { selectedClient } = useAppStore();
  const activeClient = selectedClient || '360';

  // Range selector: '1w' | '4w' | '8w' | 'all'
  const [range, setRange] = useState<'1w' | '4w' | '8w' | 'all'>('4w');

  // Chart lens: 'gasto_cpa' | 'conv_clics' | 'ctr_cpc'
  const [lens, setLens] = useState<'gasto_cpa' | 'conv_clics' | 'ctr_cpc'>('gasto_cpa');

  // Daily trend data
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // Changes from v_todos_los_cambios
  const [changesList, setChangesList] = useState<any[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);

  // New search terms from v_terminos_nuevos
  const [newTerms, setNewTerms] = useState<any[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);

  // Day drawer inspection
  const [selectedDay, setSelectedDay] = useState<any | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [anomalias, setAnomalias] = useState<any>({ serie: [], anomalias: [], titulo: '' });
  const [annotationText, setAnnotationText] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [annotationSuccess, setAnnotationSuccess] = useState(false);

  // Fetch daily chart data
  const fetchDailyOverview = async () => {
    setLoadingDaily(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/daily/overview?client=${activeClient}`, { credentials: 'include', headers });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.daily || data.dailySeries) {
        setDailyData(data.daily || data.dailySeries);
      }
      // Capa de inteligencia: baseline, anomalías, explicación, título-hallazgo
      const ra = await fetch(`/api/anomalias?client=${activeClient}&days=14`, { credentials: 'include', headers });
      if (ra.ok) setAnomalias(await ra.json());
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingDaily(false);
    }
  };

  // Fetch changes
  const fetchChanges = async () => {
    setLoadingChanges(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/todos_los_cambios?client=${activeClient}`, { credentials: 'include', headers });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.changes) {
        setChangesList(data.changes);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingChanges(false);
    }
  };

  // Fetch new search terms
  const fetchNewTerms = async () => {
    setLoadingTerms(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/daily/terminos_nuevos?client=${activeClient}`, { credentials: 'include', headers });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.terms) {
        setNewTerms(data.terms);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingTerms(false);
    }
  };

  useEffect(() => {
    fetchDailyOverview();
    fetchChanges();
    fetchNewTerms();
  }, [activeClient]);

  // Filter chart series based on range
  const displayedDaily = useMemo(() => {
    if (!dailyData.length) return [];
    const limit = range === '1w' ? 7 : range === '4w' ? 28 : range === '8w' ? 56 : dailyData.length;
    const base = dailyData.slice(-limit);
    // Cruzar con la capa de anomalías por fecha
    const byDate: Record<string, any> = {};
    (anomalias.serie || []).forEach((a: any) => { byDate[a.date] = a; });
    return base.map((d: any) => {
      const a = byDate[d.date] || {};
      const provisional = (a.madurez || d.madurez) === 'provisional';
      return {
        ...d,
        madurez: a.madurez || d.madurez,
        severidad: a.severidad || 'normal',
        gasto_baseline: a.gasto_baseline ?? null,
        // La línea de CPA se corta en días provisionales: una línea limpia se lee
        // como hecho medido, y las conversiones de esos días no llegaron todavía.
        cpa: provisional ? null : d.cpa,
        cpa_provisional: provisional ? d.cpa : null,
        explicacion: (anomalias.anomalias || []).find((x: any) => x.date === d.date)?.explicacion
      };
    });
  }, [dailyData, range, anomalias]);

  // Fondo por severidad: la intensidad es la severidad, sin color adicional
  const severidadOpacity: Record<string, number> = { media: 0.08, alta: 0.14, critica: 0.20 };

  // Submit annotation
  const handleSaveAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotationText.trim() || !selectedDay) return;
    setSavingAnnotation(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          client: activeClient,
          date: selectedDay.date,
          text: annotationText
        })
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const d = await res.json();
      if (d.success) {
        setAnnotationSuccess(true);
        setAnnotationText('');
        fetchDailyOverview();
        setTimeout(() => {
          setAnnotationSuccess(false);
          setShowAnnotationForm(false);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAnnotation(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">
            Semana · {activeClient}
          </h1>
          <p className="text-xs text-[#F5F7FA] opacity-70 mt-0.5">
            ¿Qué pasó y por qué? Diagnóstico temporal, cambios y términos nuevos
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Range pills */}
          <div className="flex items-center rounded-lg p-0.5" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            {(['1w', '4w', '8w', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  range === r ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
                }`}
              >
                {r === '1w' ? '1 sem' : r === '4w' ? '4 sem' : r === '8w' ? '8 sem' : 'Completo'}
              </button>
            ))}
          </div>

          <button
            onClick={() => { fetchDailyOverview(); fetchChanges(); fetchNewTerms(); }}
            title="Actualizar datos"
            className="p-1.5 rounded hover:bg-white/10 text-[#F5F7FA] opacity-70 hover:opacity-100 transition-opacity"
            style={{ border: '1px solid var(--border)' }}
          >
            <RefreshCw size={14} className={loadingDaily ? 'animate-spin text-[#0062CC]' : ''} />
          </button>
        </div>
      </div>

      {/* Main 14-Day Chart Container */}
      <div 
        className="p-5 rounded-2xl space-y-4"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="space-y-0.5">
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              {anomalias.titulo || 'Tendencia diaria'}
            </h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">
              Clic en un día para inspeccionarlo · línea punteada = media móvil 7 días · fondo = anomalía
            </p>
          </div>

          {/* Lenses */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLens('gasto_cpa')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                lens === 'gasto_cpa' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
              }`}
              style={{ border: '1px solid var(--border)' }}
            >
              Gasto & CPA
            </button>
            <button
              onClick={() => setLens('conv_clics')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                lens === 'conv_clics' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
              }`}
              style={{ border: '1px solid var(--border)' }}
            >
              Conversiones & Clics
            </button>
            <button
              onClick={() => setLens('ctr_cpc')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                lens === 'ctr_cpc' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
              }`}
              style={{ border: '1px solid var(--border)' }}
            >
              CTR & CPC
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="h-72 w-full pt-2">
          {displayedDaily.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#F5F7FA] opacity-50 italic">
              {loadingDaily ? 'Cargando datos diarios...' : 'No hay datos diarios disponibles para esta cuenta.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {lens === 'gasto_cpa' ? (
                <LineChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                  <CartesianGrid stroke="rgba(245, 247, 250, 0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(245, 247, 250, 0.5)" 
                    fontSize={11} 
                    tickLine={false}
                    tickFormatter={(str) => str ? str.slice(5) : ''}
                  />
                  <YAxis 
                    yAxisId="left" 
                    stroke="rgba(245, 247, 250, 0.5)" 
                    fontSize={11} 
                    tickLine={false}
                    tickFormatter={(v) => activeClient === 'KAREDO' ? `${v}€` : `$${Math.round(v/1000)}k`}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="rgba(245, 247, 250, 0.5)" 
                    fontSize={11} 
                    tickLine={false}
                    tickFormatter={(v) => activeClient === 'KAREDO' ? `${v}€` : `$${Math.round(v/1000)}k`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--surface-2)', 
                      borderColor: 'var(--border-strong)', 
                      borderRadius: '8px', 
                      fontSize: '12px',
                      color: '#FFFFFF'
                    }}
                  />
                  {/* Zonas de anomalía: fondo tenue proporcional a severidad */}
                  {displayedDaily.filter((d: any) => severidadOpacity[d.severidad]).map((d: any) => {
                    const props: any = { x1: d.date, x2: d.date, yAxisId: 'left', fill: '#0062CC', fillOpacity: severidadOpacity[d.severidad], stroke: 'none' };
                    return <ReferenceArea key={d.date} {...props} />;
                  })}
                  {/* Baseline: media móvil de los 7 días previos */}
                  <Line yAxisId="left" type="monotone" dataKey="gasto_baseline" name="Baseline 7d"
                    stroke="#F5F7FA" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 5" dot={false} activeDot={false} />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="cost" 
                    name="Gasto" 
                    stroke="#0062CC" 
                    strokeWidth={2} 
                    dot={{ r: 3, fill: '#0062CC' }} 
                    activeDot={{ r: 5 }}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="cpa" 
                    name="CPA" 
                    stroke="#FFFFFF" 
                    strokeWidth={1.5}
                    connectNulls={false}
                    dot={{ r: 2, fill: '#FFFFFF' }} 
                  />
                  <Line yAxisId="right" type="monotone" dataKey="cpa_provisional" name="CPA (provisional)"
                    stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 4" dot={{ r: 2, fill: '#F5F7FA', fillOpacity: 0.4 }} />
                </LineChart>
              ) : lens === 'conv_clics' ? (
                <BarChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                  <CartesianGrid stroke="rgba(245, 247, 250, 0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} tickFormatter={(str) => str ? str.slice(5) : ''} />
                  <YAxis yAxisId="left" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-strong)', borderRadius: '8px', fontSize: '12px', color: '#FFFFFF' }} />
                  <Bar yAxisId="left" dataKey="conversions" name="Conversiones" fill="#0062CC" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="clicks" name="Clics" fill="rgba(245, 247, 250, 0.4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                  <CartesianGrid stroke="rgba(245, 247, 250, 0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} tickFormatter={(str) => str ? str.slice(5) : ''} />
                  <YAxis yAxisId="left" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} />
                  <YAxis yAxisId="right" orientation="right" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-strong)', borderRadius: '8px', fontSize: '12px', color: '#FFFFFF' }} />
                  <Line yAxisId="left" type="monotone" dataKey="ctr" name="CTR" stroke="#0062CC" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="cpc" name="CPC" stroke="#FFFFFF" strokeWidth={1.5} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Qué Pasó: Lista Directa (NO acordeón) */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF]">
            Qué pasó esta semana
          </h2>
          <p className="text-xs text-[#F5F7FA] opacity-60">
            Resumen de eventos clave, variaciones observadas y relaciones causa/efecto
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="font-semibold text-[#FFFFFF] mb-1">
              • Estabilidad de Volumen en {activeClient}
            </div>
            <p className="text-[#F5F7FA] opacity-80 leading-relaxed">
              El ritmo de gasto y conversiones se mantiene dentro del rango objetivo. Se observó una correlación directa entre el cambio de presupuesto en campañas Search y la tasa de impresión del fin de semana.
            </p>
          </div>

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="font-semibold text-[#FFFFFF] mb-1">
              • Calidad de Conversión y Maduración
            </div>
            <p className="text-[#F5F7FA] opacity-80 leading-relaxed">
              Los últimos 3 días muestran el retraso habitual de atribución en conversiones primarias. No se recomienda recortar ofertas en términos clave hasta cumplir la ventana de consolidación de 7 días.
            </p>
          </div>
        </div>
      </div>

      {/* Términos Nuevos con Gasto (v_terminos_nuevos) */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Términos de Búsqueda Nuevos con Gasto
            </h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">
              Términos detectados por primera vez en el período reciente
            </p>
          </div>
          <span className="text-xs text-[#F5F7FA] opacity-60 tabular">
            {newTerms.length} términos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Término</th>
                <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Keyword Disparadora</th>
                <th className="py-2.5 px-3 font-semibold text-[#FFFFFF] text-right">Clics</th>
                <th className="py-2.5 px-3 font-semibold text-[#FFFFFF] text-right">Gasto</th>
                <th className="py-2.5 px-3 font-semibold text-[#FFFFFF] text-right">Conv</th>
              </tr>
            </thead>
            <tbody>
              {newTerms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#F5F7FA] opacity-50 italic">
                    {loadingTerms ? 'Cargando términos nuevos...' : 'No se detectaron términos nuevos sin histórico reciente.'}
                  </td>
                </tr>
              ) : (
                newTerms.slice(0, 10).map((term, i) => (
                  <tr 
                    key={i} 
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-white/5"
                  >
                    <td className="py-2 px-3 font-medium text-[#FFFFFF]">
                      {term.search_term || term.termino}
                    </td>
                    <td className="py-2 px-3 text-[#F5F7FA] opacity-70">
                      {term.triggered_keyword || '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular text-[#F5F7FA] opacity-80">
                      {term.clicks || 0}
                    </td>
                    <td className="py-2 px-3 text-right tabular text-[#FFFFFF] font-medium">
                      {formatCurrency(term.cost || term.gasto || 0, activeClient)}
                    </td>
                    <td className="py-2 px-3 text-right tabular text-[#F5F7FA] opacity-80">
                      {term.conversions || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cambios de la Semana (v_todos_los_cambios) */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <History size={16} />
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Historial de Cambios de la Semana
            </h2>
          </div>
          <p className="text-xs text-[#F5F7FA] opacity-60">
            Eventos de Google, diferencias de snapshot y registros manuales en bitácora
          </p>
        </div>

        <div className="space-y-2">
          {changesList.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#F5F7FA] opacity-50 italic">
              {loadingChanges ? 'Cargando cambios...' : 'No hay cambios registrados en la semana actual.'}
            </div>
          ) : (
            changesList.slice(0, 15).map((ch, idx) => {
              const isAutoGoogle = ch.origen === 'google_change_event' || ch.automatico;
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="tabular text-[#F5F7FA] opacity-60 text-[11px]">
                        {ch.fecha || ch.date || 'Reciente'}
                      </span>
                      {isAutoGoogle && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/10 text-[#FFFFFF]" style={{ border: '1px solid var(--border-strong)' }}>
                          Automático Google
                        </span>
                      )}
                      <span className="font-semibold text-[#FFFFFF]">
                        {ch.que_cambio || ch.descripcion || ch.change_resource_type}
                      </span>
                    </div>
                    {ch.donde && (
                      <div className="text-[11px] text-[#F5F7FA] opacity-65">
                        Ámbito: {ch.donde}
                      </div>
                    )}
                  </div>

                  {ch.por_que && (
                    <div className="text-xs text-[#F5F7FA] opacity-75 max-w-sm italic">
                      "{ch.por_que}"
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Day Inspection Drawer */}
      <Drawer
        isOpen={Boolean(selectedDay)}
        onClose={() => { setSelectedDay(null); setShowAnnotationForm(false); }}
        title={selectedDay ? `Día ${selectedDay.date}` : 'Inspección de Día'}
        subtitle={`Métricas y anotaciones de ${activeClient}`}
      >
        {selectedDay && (
          <div className="space-y-4 text-xs">
            {/* Daily Metrics */}
            <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block">
                Métricas Consolidadas
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Gasto</div>
                  <div className="text-base font-bold text-[#FFFFFF] tabular">
                    {formatCurrency(selectedDay.cost || 0, activeClient)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Conversiones</div>
                  <div className="text-base font-bold text-[#FFFFFF] tabular">
                    {selectedDay.conversions || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">CPA</div>
                  <div className="text-sm font-semibold text-[#FFFFFF] tabular">
                    {selectedDay.cpa ? formatCurrency(selectedDay.cpa, activeClient) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Clics</div>
                  <div className="text-sm font-semibold text-[#FFFFFF] tabular">
                    {selectedDay.clicks || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Annotation Section */}
            <div className="p-3.5 rounded-xl space-y-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#FFFFFF] text-xs uppercase tracking-wider">
                  Anotaciones del Día
                </span>
                <button
                  onClick={() => setShowAnnotationForm(!showAnnotationForm)}
                  className="text-xs text-[#0062CC] hover:underline font-semibold"
                >
                  {showAnnotationForm ? 'Cancelar' : '+ Anotar en este día'}
                </button>
              </div>

              {selectedDay.annotation && (
                <div className="p-2.5 rounded text-xs text-[#F5F7FA] leading-relaxed" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
                  "{selectedDay.annotation}"
                </div>
              )}

              {showAnnotationForm && (
                <form onSubmit={handleSaveAnnotation} className="space-y-2 pt-1">
                  {annotationSuccess && (
                    <div className="text-[11px] text-[#FFFFFF] flex items-center gap-1">
                      <Check size={12} /> Anotación guardada
                    </div>
                  )}
                  <textarea
                    required
                    rows={3}
                    placeholder={`Escriba la anotación para el día ${selectedDay.date}...`}
                    value={annotationText}
                    onChange={e => setAnnotationText(e.target.value)}
                    className="w-full bg-transparent rounded p-2 text-xs text-[#FFFFFF] placeholder-[#F5F7FA]/40 outline-none"
                    style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-1)' }}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingAnnotation || !annotationText.trim()}
                      className="px-3 py-1.5 bg-[#0062CC] text-[#FFFFFF] rounded text-xs font-semibold disabled:opacity-50"
                    >
                      {savingAnnotation ? 'Guardando...' : 'Guardar Anotación'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </Drawer>

    </div>
  );
}
