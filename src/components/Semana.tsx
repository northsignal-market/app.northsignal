import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import { 
  Calendar, Clock, Plus, Check, RefreshCw, FileText, 
  AlertCircle, History, ArrowRight, ExternalLink 
} from 'lucide-react';
import { Termino } from './Termino';
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

  // La capa diaria cubre 14 días (ventana móvil del script). Dos rangos: 7 y 14.
  const [range, setRange] = useState<'7d' | '14d' | 'custom'>('14d');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  // Hallazgos reales de la semana: pulsos diarios + titular del brief
  const [hallazgosSemana, setHallazgosSemana] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/pulso?client=${activeClient}&days=14`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => d && setHallazgosSemana(d.pulsos || [])).catch(() => {});
  }, [activeClient]);

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
  const [horaDia, setHoraDia] = useState<any>({ celdas: [], mejor: null, peor_sin_conv: null });
  const [convGrupo, setConvGrupo] = useState<any>({ grupos: [], filas: [], hallazgo: null });

  useEffect(() => {
    fetch(`/api/conversiones-grupo?client=${activeClient}&days=14`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => d && setConvGrupo(d)).catch(() => {});
  }, [activeClient]);

  useEffect(() => {
    fetch(`/api/hora-dia?client=${activeClient}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => d && setHoraDia(d)).catch(() => {});
  }, [activeClient]);
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
    let base: any[];
    if (range === 'custom' && customDesde && customHasta) {
      base = dailyData.filter((d: any) => d.date >= customDesde && d.date <= customHasta);
      // Días del rango sin datos: fila vacía marcada, para que se vea el hueco
      const porFecha: Record<string, any> = {}; base.forEach((d: any) => { porFecha[d.date] = d; });
      const out: any[] = []; const ini = new Date(customDesde + 'T12:00:00'); const fin = new Date(customHasta + 'T12:00:00');
      for (let t = ini.getTime(); t <= fin.getTime(); t += 864e5) { const f = new Date(t).toISOString().slice(0, 10); out.push(porFecha[f] || { date: f, sin_datos: true, gasto: null, cpa: null, conversiones: null, clics: null, ctr: null, cpc: null }); }
      base = out;
    } else {
      const limit = range === '7d' ? 7 : 14;
      base = dailyData.slice(-limit);
    }
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
  }, [dailyData, range, customDesde, customHasta, anomalias]);

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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              {(['7d', '14d', 'custom'] as const).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${range === r ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'}`}>
                  {r === '7d' ? '7 días' : r === '14d' ? '14 días' : 'Elegir fechas'}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={customDesde} max={customHasta || undefined} onChange={e => setCustomDesde(e.target.value)} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-xs text-[#FFFFFF]" style={{ colorScheme: 'dark' }} />
                <span className="text-xs text-[#F5F7FA] opacity-50">a</span>
                <input type="date" value={customHasta} min={customDesde || undefined} onChange={e => setCustomHasta(e.target.value)} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-xs text-[#FFFFFF]" style={{ colorScheme: 'dark' }} />
                <span className="text-[10px] text-[#F5F7FA] opacity-40">La capa diaria guarda 14 días; antes de eso, usá Datos con rango.</span>
              </div>
            )}
          </div>
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
                    tickFormatter={(v) => activeClient === 'KAREDO' ? `${Math.round(v)}€` : `$${Math.round(v/1000)}k`}
                    label={{ value: 'Gasto', angle: -90, position: 'insideLeft', fill: 'rgba(245,247,250,0.5)', fontSize: 10 }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="rgba(245, 247, 250, 0.5)" 
                    fontSize={11} 
                    tickLine={false}
                    tickFormatter={(v) => activeClient === 'KAREDO' ? `${Math.round(v)}€` : `$${Math.round(v/1000)}k`}
                    label={{ value: 'CPA', angle: 90, position: 'insideRight', fill: 'rgba(245,247,250,0.5)', fontSize: 10 }}
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
                    dataKey="gasto" 
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
                  <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(245,247,250,0.7)' }} iconType="plainline" />
                </LineChart>
              ) : lens === 'conv_clics' ? (
                <BarChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                  <CartesianGrid stroke="rgba(245, 247, 250, 0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} tickFormatter={(str) => str ? str.slice(5) : ''} />
                  <YAxis yAxisId="left" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} label={{ value: 'Conversiones', angle: -90, position: 'insideLeft', fill: 'rgba(245,247,250,0.5)', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} label={{ value: 'Clics', angle: 90, position: 'insideRight', fill: 'rgba(245,247,250,0.5)', fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-strong)', borderRadius: '8px', fontSize: '12px', color: '#FFFFFF' }} />
                  <Bar yAxisId="left" dataKey="conversiones" name="Conversiones" fill="#0062CC" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="clics" name="Clics" fill="rgba(245, 247, 250, 0.4)" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(245,247,250,0.7)' }} />
                </BarChart>
              ) : (
                <LineChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                  <CartesianGrid stroke="rgba(245, 247, 250, 0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} tickFormatter={(str) => str ? str.slice(5) : ''} />
                  <YAxis yAxisId="left" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} label={{ value: 'CTR', angle: -90, position: 'insideLeft', fill: 'rgba(245,247,250,0.5)', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="rgba(245, 247, 250, 0.5)" fontSize={11} tickLine={false} label={{ value: 'CPC', angle: 90, position: 'insideRight', fill: 'rgba(245,247,250,0.5)', fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-strong)', borderRadius: '8px', fontSize: '12px', color: '#FFFFFF' }} />
                  <Line yAxisId="left" type="monotone" dataKey="ctr" name="CTR" stroke="#0062CC" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="cpc" name="CPC" stroke="#FFFFFF" strokeWidth={1.5} dot={false} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(245,247,250,0.7)' }} iconType="plainline" />
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


      {/* Conversiones por grupo y día: en qué grupo cayeron */}
      {convGrupo.grupos.length > 0 && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: convGrupo.hallazgo ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">{convGrupo.hallazgo || 'Conversiones por grupo'}</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Últimos 14 días · desagregar por grupo antes de buscar causas externas</p>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead><tr className="text-[#F5F7FA] opacity-60 text-left" style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="py-1.5 px-2">Día</th>
                {convGrupo.grupos.map((g: string) => <th key={g} className="py-1.5 px-2 text-right">{g}</th>)}
              </tr></thead>
              <tbody>
                {convGrupo.filas.map((f: any) => (
                  <tr key={f.date} style={{ borderBottom: '1px solid var(--border)' }} className={f.madurez === 'provisional' ? 'opacity-50' : ''}>
                    <td className="py-1 px-2 tabular text-[#F5F7FA]">{new Date(f.date + 'T12:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit' })}{f.madurez === 'provisional' ? ' ·' : ''}</td>
                    {convGrupo.grupos.map((g: string) => {
                      const v = f[g] || 0;
                      return <td key={g} className={`py-1 px-2 tabular text-right ${v === 0 ? 'text-[#F5F7FA] opacity-30' : 'text-[#FFFFFF] font-medium'}`}>{v === 0 ? '·' : v}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mapa de calor: hora x día de la última semana cerrada */}
      <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Cuándo convierte: hora y día</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">
              Última semana cerrada{horaDia.semana ? ` · desde ${horaDia.semana}` : ''} · intensidad = <Termino t="Gasto">gasto</Termino> · punto = conversión
            </p>
          </div>
          {(horaDia.mejor || horaDia.peor_sin_conv) && (
            <div className="text-[11px] text-[#F5F7FA] opacity-80 space-y-0.5">
              {horaDia.mejor && <div>Mejor CPA: {horaDia.mejor.dia} {String(horaDia.mejor.hora).padStart(2,'0')}:00 · {formatCurrency(Number(horaDia.mejor.cpa), activeClient)}</div>}
              {horaDia.peor_sin_conv && <div>Mayor gasto sin conv.: {horaDia.peor_sin_conv.dia} {String(horaDia.peor_sin_conv.hora).padStart(2,'0')}:00 · {formatCurrency(Number(horaDia.peor_sin_conv.gasto), activeClient)}</div>}
            </div>
          )}
        </div>
        {horaDia.celdas?.length ? (() => {
          const maxGasto = Math.max(...horaDia.celdas.map((c: any) => Number(c.gasto) || 0), 1);
          const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
          const grid: Record<string, any> = {};
          horaDia.celdas.forEach((c: any) => { grid[`${c.dow_num}-${c.hour}`] = c; });
          return (
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[720px]">
                <div className="grid text-[9px] text-[#F5F7FA] opacity-50 tabular" style={{ gridTemplateColumns: '36px repeat(24, 1fr)' }}>
                  <div />
                  {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-center">{h}</div>)}
                </div>
                {dias.map((d, i) => (
                  <div key={d} className="grid gap-[2px] mb-[2px]" style={{ gridTemplateColumns: '36px repeat(24, 1fr)' }}>
                    <div className="text-[11px] text-[#F5F7FA] opacity-70 flex items-center">{d}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const c = grid[`${i + 1}-${h}`];
                      const g = c ? Number(c.gasto) : 0;
                      const conv = c ? Number(c.conversiones) : 0;
                      const op = g > 0 ? 0.12 + (g / maxGasto) * 0.78 : 0;
                      return (
                        <div key={h} title={c ? `${d} ${h}:00 · ${formatCurrency(g, activeClient)} · ${c.clics} clics · ${conv} conv` : ''}
                          className="h-5 rounded-sm relative"
                          style={{ backgroundColor: op ? `color-mix(in oklab, #0062CC ${Math.round(op * 100)}%, var(--surface-2))` : 'var(--surface-2)' }}>
                          {conv > 0 && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-[#FFFFFF] font-bold">●</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })() : <p className="text-xs text-[#F5F7FA] opacity-50 py-4 text-center">Sin datos de hora y día para esta cuenta.</p>}
      </div>
      </div>

      {/* Qué pasó: hallazgos reales del análisis diario, con fecha */}
      <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF]">Qué encontró el análisis diario, día por día</h2>
          <p className="text-xs text-[#F5F7FA] opacity-60">Cada mañana a las 6:45 el sistema lee el día anterior contra el plan de la semana. Esto es lo que escribió. El análisis de fondo llega el lunes en el brief.</p>
        </div>
        {hallazgosSemana.length === 0 ? (
          <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Todavía no hay análisis diarios para {activeClient}. El primero aparece mañana a las 6:45.</p>
        ) : (
          <div className="space-y-2">
            {hallazgosSemana.slice(0, range === '7d' ? 7 : 14).map((p: any) => (
              <div key={p.fecha} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: p.nivel === 'critico' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#FFFFFF] tabular">{new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  <span className={`text-[10px] uppercase tracking-wide ${p.nivel === 'critico' ? 'text-[#0062CC] font-bold' : 'text-[#F5F7FA] opacity-50'}`}>{p.nivel === 'critico' ? 'Requiere acción' : p.nivel === 'atencion' ? 'Para mirar el lunes' : 'Día normal'}</span>
                </div>
                {p.hallazgo_principal && <p className="text-xs text-[#FFFFFF] font-medium mb-1">{p.hallazgo_principal}</p>}
                <p className="text-[11px] text-[#F5F7FA] opacity-75 leading-relaxed">{p.resumen}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Términos nuevos: solo los que importan, con la decisión al lado */}
      {(() => {
        const conGasto = newTerms.filter((t: any) => Number(t.gasto_acumulado || 0) > 0);
        const sinConv = conGasto.filter((t: any) => Number(t.conversiones_acumuladas || 0) === 0).sort((x: any, y: any) => Number(y.gasto_acumulado) - Number(x.gasto_acumulado));
        const conConv = conGasto.filter((t: any) => Number(t.conversiones_acumuladas || 0) > 0).sort((x: any, y: any) => Number(y.conversiones_acumuladas) - Number(x.conversiones_acumuladas));
        const gastoSinConv = sinConv.reduce((acc: number, t: any) => acc + Number(t.gasto_acumulado || 0), 0);
        return (
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="text-[15px] font-medium text-[#FFFFFF]">Búsquedas nuevas de los últimos 14 días</h2>
                <p className="text-xs text-[#F5F7FA] opacity-60">
                  Lo que la gente escribió por primera vez y disparó un anuncio. Las que gastan sin convertir son candidatas a negativa; las que convierten, a keyword propia.
                </p>
              </div>
              <span className="text-xs text-[#F5F7FA] opacity-60 tabular">{conGasto.length} con gasto</span>
            </div>
            {loadingTerms ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Cargando…</p>
            ) : conGasto.length === 0 ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Ninguna búsqueda nueva con gasto en los últimos 14 días. Es buena señal: las negativas están cubriendo.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-[#FFFFFF]">Gastan y no convierten</span>
                    <span className="text-[11px] text-[#F5F7FA] opacity-60 tabular">{sinConv.length} · {formatCurrency(gastoSinConv, activeClient)}</span>
                  </div>
                  {sinConv.length === 0 ? <p className="text-[11px] text-[#F5F7FA] opacity-50 italic">Ninguna.</p> : sinConv.slice(0, 8).map((t: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#FFFFFF] truncate">{t.search_term || t.termino}</div>
                        <div className="text-[10px] text-[#F5F7FA] opacity-50 truncate">la disparó <span className="opacity-100">{t.keyword_disparadora || '—'}</span>{t.ad_group ? ` en ${t.ad_group}` : ''}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs tabular text-[#FFFFFF]">{formatCurrency(Number(t.gasto_acumulado || 0), activeClient)}</div>
                        <div className="text-[10px] tabular text-[#F5F7FA] opacity-50">{t.clics_acumulados ?? 0} clics</div>
                      </div>
                    </div>
                  ))}
                  {sinConv.length > 0 && <p className="text-[10px] text-[#F5F7FA] opacity-40 pt-1">Antes de agregar una negativa, buscá el término en Datos › Términos con 30 días: si alguna variante convirtió, la bloquearía también.</p>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-[#FFFFFF]">Convierten</span>
                    <span className="text-[11px] text-[#F5F7FA] opacity-60 tabular">{conConv.length}</span>
                  </div>
                  {conConv.length === 0 ? <p className="text-[11px] text-[#F5F7FA] opacity-50 italic">Ninguna todavía.</p> : conConv.slice(0, 8).map((t: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--surface-2)', borderLeft: '2px solid var(--primary)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#FFFFFF] truncate">{t.search_term || t.termino}</div>
                        <div className="text-[10px] text-[#F5F7FA] opacity-50 truncate">la disparó <span className="opacity-100">{t.keyword_disparadora || '—'}</span>{t.match_type ? ` (${String(t.match_type).toLowerCase()})` : ''}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs tabular text-[#FFFFFF]">{Number(t.conversiones_acumuladas)} conv</div>
                        <div className="text-[10px] tabular text-[#F5F7FA] opacity-50">{t.cpa ? formatCurrency(Number(t.cpa), activeClient) : formatCurrency(Number(t.gasto_acumulado || 0), activeClient)}</div>
                      </div>
                    </div>
                  ))}
                  {conConv.length > 0 && <p className="text-[10px] text-[#F5F7FA] opacity-40 pt-1">Si una convierte varias veces, vale como keyword exacta propia: así dejás de depender de la amplia.</p>}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Cambios de la semana: lo lee el análisis; para vos, colapsado con el resumen a la vista */}
      <details className="group/cambios">
        <summary className="cursor-pointer list-none p-4 rounded-2xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div>
            <span className="text-[15px] font-medium text-[#FFFFFF]">Cambios en la cuenta esta semana</span>
            <p className="text-xs text-[#F5F7FA] opacity-60">
              {(() => { const c = Array.isArray(changesList) ? changesList : []; const auto = c.filter((x: any) => /RECOMMENDATION|AUTO/i.test(String(x.client_type || x.origen || ''))).length; const propios = c.length - auto;
                return c.length === 0 ? 'Ninguno registrado. El análisis lo usa para explicar movimientos; vos solo necesitás mirarlo si hay uno automático de Google.'
                  : `${propios} tuyo${propios !== 1 ? 's' : ''}${auto ? ` y ${auto} automático${auto !== 1 ? 's' : ''} de Google` : ', ninguno automático de Google'}. Abrí solo si querés el detalle.`; })()}
            </p>
          </div>
          <span className="text-[#F5F7FA] opacity-50 group-open/cambios:rotate-180 transition-transform">▾</span>
        </summary>
      <div 
        className="p-5 rounded-2xl space-y-3 mt-2"
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
      </details>

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
