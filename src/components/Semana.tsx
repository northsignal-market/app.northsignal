import React, { useState, useEffect, useMemo } from 'react';
import { useCuentaActiva, useCuentas } from '../lib/useCuentas';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceArea, Legend,
} from 'recharts';
import { Check, History } from 'lucide-react';
import { Termino } from './Termino';
import { useAppStore } from '../store/useAppStore';
import { Drawer } from './Drawer';
import {
  PageShell, Seccion, Tarjeta, Collapsible, Chips, Vacio, Stat,
  Titular, Nota, Pista, Riel, RielTramo,
  RangoFechas, rangoPreset, type Rango, hoyLocal,
  fmtMoneda, fmtMonedaCorta, fmtNum, fmtFechaCorta, fetchJSON, useJSON,
  Fallo, pedirJSON, motivoFallo,
} from './ui';
import { leerPlan, COLOR_ESTADO, abrirTextoAgente, type PlanLectura } from '../lib/lectura';
import { Bullet, GaugeTicks } from './graficos-pulse';

interface SemanaProps {
  onOpenActionable?: (actionId: string) => void;
}

/**
 * SEMANA · qué pasó y por qué, en una cuenta, día por día.
 * Orden de lectura: el plan (contra qué se mide la semana), la tendencia
 * (el gráfico con anomalías y maduración), los hallazgos del análisis
 * diario, y el detalle plegado (grupos, horas, búsquedas nuevas, cambios).
 */
export function Semana({ onOpenActionable }: SemanaProps) {
  const { selectedClient } = useAppStore();
  // La cuenta activa sale de las cuentas reales, no de un default cableado.
  const activeClient = useCuentaActiva(selectedClient) || selectedClient || '';
  const { moneda } = useCuentas();
  const M = moneda(activeClient);   // USD · EUR · CLP, desde la ficha de la cuenta

  // La capa diaria guarda ~17 días: el selector no deja pedir más atrás.
  const [rango, setRango] = useState<Rango>(rangoPreset('14d'));
  const minDesde = hoyLocal(-16);

  const [plan, setPlan] = useState<any>(null);
  const [hallazgosSemana, setHallazgosSemana] = useState<any[]>([]);
  const [lens, setLens] = useState<'gasto_cpa' | 'conv_clics' | 'ctr_cpc'>('gasto_cpa');
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [changesList, setChangesList] = useState<any[]>([]);
  const [newTerms, setNewTerms] = useState<any[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [errorTerms, setErrorTerms] = useState<string | null>(null);
  const [anomalias, setAnomalias] = useState<any>({ serie: [], anomalias: [], titulo: '' });
  const [horaDia, setHoraDia] = useState<any>({ celdas: [], mejor: null, peor_sin_conv: null });
  const [convGrupo, setConvGrupo] = useState<any>({ grupos: [], filas: [], hallazgo: null });

  // Drawer de inspección de día
  const [selectedDay, setSelectedDay] = useState<any | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [annotationSuccess, setAnnotationSuccess] = useState(false);

  useEffect(() => { fetchJSON<any>(`/api/plan?client=${activeClient}`, null).then(d => d && setPlan(d)); }, [activeClient]);
  // La lectura del plan: los hechos vienen calculados de la base; acá solo frases.
  const { data: planLecturaData } = useJSON<PlanLectura | null>(`/api/plan-lectura?client=${activeClient}`, null);
  const lecturaPlan = useMemo(() => leerPlan(planLecturaData, hoyLocal(0)), [planLecturaData]);
  useEffect(() => { fetchJSON<any>(`/api/pulso?client=${activeClient}&days=14`, null).then(d => d && setHallazgosSemana(d.pulsos || [])); }, [activeClient]);
  useEffect(() => { fetchJSON<any>(`/api/conversiones-grupo?client=${activeClient}&days=14`, null).then(d => d && setConvGrupo(d)); }, [activeClient]);
  useEffect(() => { fetchJSON<any>(`/api/hora-dia?client=${activeClient}`, null).then(d => d && setHoraDia(d)); }, [activeClient]);

  const fetchDailyOverview = async () => {
    setLoadingDaily(true);
    // Limpiar antes de pedir: al cambiar de cuenta, el gráfico mostraba la
    // anterior hasta que llegara la nueva respuesta (o para siempre si fallaba).
    setDailyData([]);
    const data = await fetchJSON<any>(`/api/daily/overview?client=${activeClient}`, null);
    if (data?.daily || data?.dailySeries) setDailyData(data.daily || data.dailySeries);
    const ra = await fetchJSON<any>(`/api/anomalias?client=${activeClient}&days=14`, null);
    if (ra) setAnomalias(ra);
    setLoadingDaily(false);
  };
  const fetchChanges = async () => {
    setChangesList([]);
    const data = await fetchJSON<any>(`/api/todos_los_cambios?client=${activeClient}`, null);
    if (data?.changes) setChangesList(data.changes);
  };
  // Con fetchJSON, una consulta caída y una lista de verdad vacía llegaban acá
  // iguales, y el panel de abajo firmaba "las negativas están cubriendo" sin
  // haber podido mirar. Ese veredicto es el que hace que nadie revise.
  const fetchNewTerms = async () => {
    setLoadingTerms(true);
    setNewTerms([]);
    setErrorTerms(null);
    try {
      const data = await pedirJSON<any>(`/api/daily/terminos_nuevos?client=${activeClient}`);
      setNewTerms(Array.isArray(data?.terms) ? data.terms : []);
    } catch (e) {
      setErrorTerms(motivoFallo(e));
    } finally {
      setLoadingTerms(false);
    }
  };
  useEffect(() => { fetchDailyOverview(); fetchChanges(); fetchNewTerms(); }, [activeClient]);

  // La serie que se muestra ES la ventana elegida: se filtra por fecha y los
  // días sin datos aparecen como hueco marcado, nunca desaparecen en silencio.
  const displayedDaily = useMemo(() => {
    if (!dailyData.length) return [];
    const porFecha: Record<string, any> = {};
    dailyData.forEach((d: any) => { if (d.date >= rango.desde && d.date <= rango.hasta) porFecha[d.date] = d; });
    const base: any[] = [];
    const ini = new Date(rango.desde + 'T12:00:00');
    const fin = new Date(rango.hasta + 'T12:00:00');
    for (let t = ini.getTime(); t <= fin.getTime(); t += 864e5) {
      const f = new Date(t).toISOString().slice(0, 10);
      base.push(porFecha[f] || { date: f, sin_datos: true, gasto: null, cpa: null, conversiones: null, clics: null, ctr: null, cpc: null });
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
        explicacion: (anomalias.anomalias || []).find((x: any) => x.date === d.date)?.explicacion,
      };
    });
  }, [dailyData, rango, anomalias]);

  const primerProvisional = useMemo(() => displayedDaily.find((d: any) => d.madurez === 'provisional')?.date ?? null, [displayedDaily]);

  // Los cinco números de la ventana, comparados contra la ventana previa del
  // MISMO largo. La ventana que se declara es la que se suma — la nota lo dice.
  // Con menos historia previa que rango, el delta no se muestra: sin base no hay %.
  const kpis = useMemo(() => {
    const en = displayedDaily.filter((d: any) => !d.sin_datos);
    const sum = (arr: any[], k: string) => arr.reduce((s: number, d: any) => s + (Number(d[k]) || 0), 0);
    const dias = Math.round((new Date(rango.hasta + 'T12:00:00').getTime() - new Date(rango.desde + 'T12:00:00').getTime()) / 864e5) + 1;
    const desdeAnt = new Date(new Date(rango.desde + 'T12:00:00').getTime() - dias * 864e5).toISOString().slice(0, 10);
    const hastaAnt = new Date(new Date(rango.desde + 'T12:00:00').getTime() - 864e5).toISOString().slice(0, 10);
    const ant = dailyData.filter((d: any) => d.date >= desdeAnt && d.date <= hastaAnt);
    const hayAnt = ant.length >= Math.max(3, Math.floor(dias * 0.7));
    const delta = (a: number | null, b: number | null) => (hayAnt && a != null && b != null && b > 0) ? ((a - b) / b) * 100 : null;
    const conv = sum(en, 'conversiones'), gasto = sum(en, 'gasto'), clics = sum(en, 'clics');
    const convAnt = sum(ant, 'conversiones'), gastoAnt = sum(ant, 'gasto'), clicsAnt = sum(ant, 'clics');
    const cpa = conv > 0 ? gasto / conv : null, cpaAnt = convAnt > 0 ? gastoAnt / convAnt : null;
    const cpc = clics > 0 ? gasto / clics : null, cpcAnt = clicsAnt > 0 ? gastoAnt / clicsAnt : null;
    const spark = (k: string) => displayedDaily.map((d: any) => (d.sin_datos || d[k] == null ? null : Number(d[k])));
    return {
      dias, provisional: en.some((d: any) => d.madurez === 'provisional'),
      conv, gasto, cpa, clics, cpc,
      dConv: delta(conv, convAnt), dGasto: delta(gasto, gastoAnt), dCpa: delta(cpa, cpaAnt), dClics: delta(clics, clicsAnt), dCpc: delta(cpc, cpcAnt),
      sparkConv: spark('conversiones'), sparkGasto: spark('gasto'), sparkCpa: spark('cpa'), sparkClics: spark('clics'), sparkCpc: spark('cpc'),
    };
  }, [displayedDaily, dailyData, rango]);

  // P5 · La semana contra lo predicho y el mes contra su presupuesto.
  const { data: cicloData } = useJSON<any>(`/api/ciclo?client=${activeClient}`, null);
  const { data: pacing } = useJSON<any>(`/api/pacing?client=${activeClient}`, null);
  // El mercado: ¿caímos nosotros o se achicó la cancha? Y quién entró a pujar.
  const { data: mercado } = useJSON<any>(`/api/mercado?client=${activeClient}`, null);
  const { data: presion } = useJSON<any>(`/api/presion-competitiva?client=${activeClient}`, null);
  const presionReal = useMemo(() => (presion?.campanas || [])
    .filter((c: any) => c.sin_causa_propia && c.salto_ranking >= 8 && !String(c.lectura).startsWith('sin volumen'))
    .sort((a: any, b: any) => b.salto_ranking - a.salto_ranking), [presion]);
  const prediccionesSemana = useMemo(() => {
    const preds = (cicloData?.predicciones || []).filter((p: any) => p.acerto === null);
    if (!preds.length) return [];
    const semana = preds.reduce((mx: string, p: any) => (p.semana > mx ? p.semana : mx), preds[0].semana);
    return preds.filter((p: any) => p.semana === semana);
  }, [cicloData]);
  // El real de la semana que la predicción declara, acumulado desde la diaria.
  // CPA con cero conversiones es null, no cero; CTR sin impresiones, ídem.
  const realSemana = useMemo(() => {
    if (!prediccionesSemana.length || !dailyData.length) return null;
    const desde = prediccionesSemana[0].semana;
    const hastaSem = new Date(new Date(desde + 'T12:00:00').getTime() + 6 * 864e5).toISOString().slice(0, 10);
    const dias = dailyData.filter((d: any) => d.date >= desde && d.date <= hastaSem);
    const sum = (k: string) => dias.reduce((s: number, d: any) => s + (Number(d[k]) || 0), 0);
    const gasto = sum('gasto'), conv = sum('conversiones'), clics = sum('clics'), imp = sum('impresiones');
    return {
      dias: dias.length, gasto, conversiones: conv, clics,
      cpa: conv > 0 ? gasto / conv : null,
      cpc: clics > 0 ? gasto / clics : null,
      conv_rate: clics > 0 ? (conv / clics) * 100 : null,
      ctr: imp > 0 ? (clics / imp) * 100 : null,
    } as Record<string, number | null>;
  }, [prediccionesSemana, dailyData]);
  const fmtMetrica = (met: string) => (v: number) =>
    met === 'gasto' || met === 'cpa' || met === 'cpc' ? fmtMoneda(v, M)
      : met === 'conv_rate' || met === 'ctr' ? `${fmtNum(v, 1)}%`
        : fmtNum(v, v % 1 ? 1 : 0);

  // Fondo por severidad: la intensidad es la severidad, sin color adicional
  const severidadOpacity: Record<string, number> = { media: 0.08, alta: 0.14, critica: 0.20 };

  const ejeMoneda = (v: number) => fmtMonedaCorta(v, M);
  const ejeFecha = (str: string) => fmtFechaCorta(str);
  const tooltipStyle = { background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 11, color: '#F5F7FA' } as const;
  const tooltipMoneda = (v: any, nombre: any) => {
    if (v == null) return ['—', nombre];
    if (/gasto|cpa|cpc/i.test(String(nombre))) return [fmtMoneda(Number(v), M), nombre];
    if (/ctr/i.test(String(nombre))) return [`${Number(v).toFixed(2)}%`, nombre];
    return [fmtNum(Number(v), 1), nombre];
  };

  const handleSaveAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotationText.trim() || !selectedDay) return;
    setSavingAnnotation(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ client: activeClient, date: selectedDay.date, text: annotationText }),
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const d = await res.json();
        if (d.success) {
          setAnnotationSuccess(true); setAnnotationText(''); fetchDailyOverview();
          setTimeout(() => { setAnnotationSuccess(false); setShowAnnotationForm(false); }, 1500);
        }
      }
    } finally { setSavingAnnotation(false); }
  };

  const nombres: Record<string, string> = { clics: 'Clics', conv_rate: 'Conv. rate', impresiones: 'Impresiones', cpc: 'CPC', ctr: 'CTR', lost_is_budget: 'Lost IS budget', lost_is_rank: 'Lost IS rank', pct_terminos_nuevos: 'Término nuevo', cpa_marginal: 'CPA marginal', conversiones: 'Conversiones', gasto: 'Gasto', conv_rate_grupo: 'Conv. rate' };

  return (
    <PageShell
      /* Sin título: la pestaña ya dice "Semana" y el header dice la cuenta.
         Repetirlo costaba una fila entera de la pantalla. */
      derecha={<RangoFechas valor={rango} onChange={setRango} presets={['7d', '14d']} minDesde={minDesde} />}
    >

      {/* EL TITULAR · la frase que contesta "cómo viene la semana", sola arriba.
          Vivía adentro de la tarjeta del plan, al mismo tamaño que la letra
          chica que la matiza, cuatro bloques más abajo que las cifras. Leerla
          costaba encontrarla. Acá manda: el resto de la vista la sustenta. */}
      {lecturaPlan && (
        <Titular
          estado={COLOR_ESTADO[lecturaPlan.estadoId]}
          guia={lecturaPlan.guia}
          aviso={lecturaPlan.aviso}
          meta={<>
            <span>{lecturaPlan.progreso}</span>
            {lecturaPlan.guiaDelAgente && <span className="opacity-60">· lectura del agente</span>}
          </>}
        >
          {lecturaPlan.veredicto}
        </Titular>
      )}

      {/* LOS CINCO NÚMEROS DE LA VENTANA: la métrica norte de la cuenta primero
          (KAREDO se juzga por CPA; el resto por conversiones). Nada más grande
          que esto arriba: si un número no cambia una decisión, no va acá. */}
      {displayedDaily.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x [&>*]:px-5 [&>*:first-child]:pl-0 pb-2" style={{ borderColor: 'var(--border)' }}>
          {(activeClient === 'KAREDO'
            ? ([
              { label: 'CPA', valor: fmtMoneda(kpis.cpa, M), delta: kpis.dCpa, baja: true, spark: kpis.sparkCpa },
              { label: 'Conversiones', valor: fmtNum(kpis.conv, kpis.conv % 1 ? 1 : 0), delta: kpis.dConv, baja: false, spark: kpis.sparkConv },
              { label: 'Gasto', valor: fmtMoneda(kpis.gasto, M), delta: kpis.dGasto, baja: false, spark: kpis.sparkGasto },
              { label: 'Clics', valor: fmtNum(kpis.clics), delta: kpis.dClics, baja: false, spark: kpis.sparkClics },
              { label: 'CPC', valor: fmtMoneda(kpis.cpc, M), delta: kpis.dCpc, baja: true, spark: kpis.sparkCpc },
            ])
            : ([
              { label: 'Conversiones', valor: fmtNum(kpis.conv, kpis.conv % 1 ? 1 : 0), delta: kpis.dConv, baja: false, spark: kpis.sparkConv },
              { label: 'Gasto', valor: fmtMoneda(kpis.gasto, M), delta: kpis.dGasto, baja: false, spark: kpis.sparkGasto },
              { label: 'CPA', valor: fmtMoneda(kpis.cpa, M), delta: kpis.dCpa, baja: true, spark: kpis.sparkCpa },
              { label: 'Clics', valor: fmtNum(kpis.clics), delta: kpis.dClics, baja: false, spark: kpis.sparkClics },
              { label: 'CPC', valor: fmtMoneda(kpis.cpc, M), delta: kpis.dCpc, baja: true, spark: kpis.sparkCpc },
            ])
          ).map((k, idx) => (
            <React.Fragment key={k.label}>
              <Stat heroe={idx === 0} label={k.label} valor={k.valor} delta={k.delta} deltaBuenoSiBaja={k.baja}
                nota={k.delta != null ? `vs ${kpis.dias}d previos` : `${kpis.dias} días`} provisional={kpis.provisional} spark={k.spark} />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* LA FORMA DE LA SEMANA, y al lado si esa forma está dentro de lo
          esperado. El gráfico ocupaba el ancho entero y solo: catorce días de
          gasto no significan nada hasta saber contra qué se comparan, y eso
          estaba dos pantallas más arriba. Ahora se miran juntos, y el riel
          angosto rompe la fila de bandas horizontales que era toda la vista. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <Tarjeta hero className="lg:col-span-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-[13px] font-medium text-[#EDEFF3] truncate">{anomalias.titulo || 'Tendencia diaria'}</h2>
              <Pista>
                Clic en un día para inspeccionarlo. Línea punteada = media móvil de 7 días.
                Fondo azul = anomalía detectada, con más intensidad cuanto más severa.
                Zona clara al final = días que todavía maduran: las conversiones pueden
                tardar en atribuirse y Google las cuenta el día del clic.
              </Pista>
            </div>
            <Chips
              opciones={[
                { id: 'gasto_cpa', label: 'Gasto y CPA' },
                { id: 'conv_clics', label: 'Conversiones y clics' },
                { id: 'ctr_cpc', label: 'CTR y CPC' },
              ]}
              valor={lens}
              onChange={setLens}
            />
          </div>
          <div className="h-[19rem] w-full">
            {displayedDaily.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#F5F7FA] opacity-50 italic">
                {loadingDaily ? 'Cargando datos diarios…' : 'No hay datos diarios disponibles para esta cuenta.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {lens === 'gasto_cpa' ? (
                  <LineChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={ejeFecha} minTickGap={20} />
                    <YAxis yAxisId="left" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={ejeMoneda} width={54}
                      label={{ value: 'Gasto', angle: -90, position: 'insideLeft', fill: 'rgba(245,247,250,0.4)', fontSize: 9 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={ejeMoneda} width={50}
                      label={{ value: 'CPA', angle: 90, position: 'insideRight', fill: 'rgba(245,247,250,0.4)', fontSize: 9 }} />
                    <RechartsTooltip contentStyle={tooltipStyle} formatter={tooltipMoneda}
                      labelFormatter={(l: any) => fmtFechaCorta(String(l)) + (primerProvisional && String(l) >= primerProvisional ? ' · madurando' : '')} />
                    {primerProvisional && (
                      <ReferenceArea yAxisId="left" x1={primerProvisional} x2={displayedDaily[displayedDaily.length - 1].date}
                        {...({ fill: 'var(--primary-faint)', strokeOpacity: 0 } as any)} />
                    )}
                    {displayedDaily.filter((d: any) => severidadOpacity[d.severidad]).map((d: any) => (
                      <ReferenceArea key={d.date} {...({ x1: d.date, x2: d.date, yAxisId: 'left', fill: '#0062CC', fillOpacity: severidadOpacity[d.severidad], stroke: 'none' } as any)} />
                    ))}
                    <Line yAxisId="left" type="monotone" dataKey="gasto_baseline" name="Baseline 7d"
                      stroke="#F5F7FA" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 5" dot={false} activeDot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="gasto" name="Gasto" stroke="#4D9DFF" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 5px rgba(77,157,255,0.45))' }} dot={{ r: 3, fill: '#0062CC' }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" dataKey="cpa" name="CPA" stroke="#FFFFFF" strokeWidth={1.5} connectNulls={false} dot={{ r: 2, fill: '#FFFFFF' }} />
                    <Line yAxisId="right" type="monotone" dataKey="cpa_provisional" name="CPA (provisional)"
                      stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 4" dot={{ r: 2, fill: '#F5F7FA', fillOpacity: 0.4 }} />
                    <Legend wrapperStyle={{ fontSize: 10, opacity: 0.7 }} iconType="plainline" iconSize={10} />
                  </LineChart>
                ) : lens === 'conv_clics' ? (
                  <BarChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={ejeFecha} minTickGap={20} />
                    <YAxis yAxisId="left" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false}
                      label={{ value: 'Conversiones', angle: -90, position: 'insideLeft', fill: 'rgba(245,247,250,0.4)', fontSize: 9 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false}
                      label={{ value: 'Clics', angle: 90, position: 'insideRight', fill: 'rgba(245,247,250,0.4)', fontSize: 9 }} />
                    <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [v == null ? '—' : fmtNum(Number(v)), n]}
                      labelFormatter={(l: any) => fmtFechaCorta(String(l)) + (primerProvisional && String(l) >= primerProvisional ? ' · madurando' : '')} />
                    {primerProvisional && (
                      <ReferenceArea yAxisId="left" x1={primerProvisional} x2={displayedDaily[displayedDaily.length - 1].date}
                        {...({ fill: 'var(--primary-faint)', strokeOpacity: 0 } as any)} />
                    )}
                    <Bar yAxisId="left" dataKey="conversiones" name="Conversiones" fill="#0062CC" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar yAxisId="right" dataKey="clics" name="Clics" fill="rgba(245, 247, 250, 0.4)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Legend wrapperStyle={{ fontSize: 10, opacity: 0.7 }} iconSize={10} />
                  </BarChart>
                ) : (
                  <LineChart data={displayedDaily} onClick={(e: any) => e?.activePayload?.[0]?.payload && setSelectedDay(e.activePayload[0].payload)}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={ejeFecha} minTickGap={20} />
                    <YAxis yAxisId="left" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `${Number(v).toFixed(1)}%`}
                      label={{ value: 'CTR', angle: -90, position: 'insideLeft', fill: 'rgba(245,247,250,0.4)', fontSize: 9 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={ejeMoneda}
                      label={{ value: 'CPC', angle: 90, position: 'insideRight', fill: 'rgba(245,247,250,0.4)', fontSize: 9 }} />
                    <RechartsTooltip contentStyle={tooltipStyle} formatter={tooltipMoneda}
                      labelFormatter={(l: any) => fmtFechaCorta(String(l)) + (primerProvisional && String(l) >= primerProvisional ? ' · madurando' : '')} />
                    {primerProvisional && (
                      <ReferenceArea yAxisId="left" x1={primerProvisional} x2={displayedDaily[displayedDaily.length - 1].date}
                        {...({ fill: 'var(--primary-faint)', strokeOpacity: 0 } as any)} />
                    )}
                    <Line yAxisId="left" type="monotone" dataKey="ctr" name="CTR" stroke="#4D9DFF" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 5px rgba(77,157,255,0.45))' }} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="cpc" name="CPC" stroke="#FFFFFF" strokeWidth={1.5} dot={false} />
                    <Legend wrapperStyle={{ fontSize: 10, opacity: 0.7 }} iconType="plainline" iconSize={10} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </Tarjeta>

        {/* EL RIEL · vertical y angosto, pegado al gráfico. Bullet: barra = real,
            banda = rango predicho (informe 13 §2c). El gauge radial existe SOLO
            acá: una meta, 0–100%, un vistazo — el único uso honesto del radial. */}
        <Riel className="lg:col-span-4">
          <RielTramo titulo="Contra lo predicho"
            derecha={prediccionesSemana.length > 0 ? (
              <Pista titulo="Cómo se lee">
                La barra es el real acumulado al cierre de ayer ({realSemana?.dias ?? 0} día{(realSemana?.dias ?? 0) !== 1 ? 's' : ''}) y la banda
                es el rango que el análisis del lunes predijo al {Math.round(Number(prediccionesSemana[0].probabilidad || 0.8) * 100)}%.
                Las conversiones recientes maduran: la predicción se evalúa recién el lunes.
              </Pista>
            ) : undefined}>
            {prediccionesSemana.length === 0 ? (
              <p className="text-[11px] leading-relaxed" style={{ color: '#ADADAD' }}>Sin predicciones esta semana. Las escribe el análisis del lunes.</p>
            ) : (
              <div className="space-y-3">
                {prediccionesSemana.map((pr: any) => {
                  const fmt = fmtMetrica(pr.metrica);
                  const real = realSemana?.[pr.metrica] ?? null;
                  return (
                    <div key={pr.id} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] text-[#EDEFF3] truncate" title={pr.razonamiento || undefined}>{nombres[pr.metrica] || pr.metrica}</span>
                        <span className="text-[11px] tabular shrink-0" style={{ color: '#ADADAD' }}>
                          {typeof real === 'number' ? <span className="text-[#EDEFF3]">{fmt(real)}</span> : '—'}
                          <span className="opacity-70"> · {fmt(Number(pr.valor_min))}–{fmt(Number(pr.valor_max))}</span>
                        </span>
                      </div>
                      <Bullet real={typeof real === 'number' ? real : null} min={Number(pr.valor_min)} max={Number(pr.valor_max)} formato={fmt} />
                    </div>
                  );
                })}
              </div>
            )}
          </RielTramo>

          <RielTramo titulo="Pacing del mes">
            {pacing?.presupuesto != null && pacing?.consumido_pct != null ? (
              <div className="flex flex-col items-center">
                <GaugeTicks consumidoPct={pacing.consumido_pct} esperadoPct={pacing.esperado_pct ?? 0} />
                <p className="text-[10.5px] tabular text-center" style={{ color: '#ADADAD' }}>
                  {fmtMoneda(pacing.gasto_mes, M)} de {fmtMoneda(pacing.presupuesto, M)} · día {pacing.dia_cerrado} de {pacing.dias_mes}
                </p>
                {pacing.aviso && <p className="text-[10.5px] mt-1 text-center" style={{ color: 'var(--warn)' }}>{pacing.aviso}</p>}
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed" style={{ color: '#ADADAD' }}>
                Sin presupuesto mensual declarado no hay pacing. Se carga en Diagnóstico › Objetivos.
              </p>
            )}
          </RielTramo>
        </Riel>
      </div>

      {/* POR QUÉ VIENE ASÍ · las señales que el plan mira (7 columnas) y, al
          lado, lo que pasa afuera apilado en vertical. La cancha va acá y no
          después del gráfico: explica la forma que ya se vio. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {plan?.plan && (() => {
        const p = plan.plan;
        const dias = plan.pulsos.length;
        return (
          <Tarjeta className="lg:col-span-7">
            {/* El veredicto y su guía ya son el titular de la vista: acá solo
                queda la evidencia que lo sostiene, señal por señal. */}
            <div className="flex items-baseline justify-between gap-3 pb-2.5 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[13px] font-medium text-[#EDEFF3]"><Termino t="Plan semanal">Las señales del plan</Termino></h2>
              <span className="text-[10px] text-[#F5F7FA] opacity-50 tabular shrink-0">
                {dias} día{dias !== 1 ? 's' : ''} · desde {fmtFechaCorta(p.semana)}
              </span>
            </div>
            {/* La "racha GitHub-style" del informe 13 se evaluó y NO va: ese
                patrón presupone un plan de cumplimiento (hábitos, logro diario).
                Este plan es de SEÑALES — cumple=true es evidencia que se
                enciende ("problema de pago", "confirma H10"), no un logro — y
                una racha de "días plenos" leería el peor escenario como hazaña.
                Las pastillas por señal de abajo ya cuentan la historia real. */}
            <div className="space-y-1.5">
              {p.indicadores.map((i: any, idx: number) => {
                const ultimo = i.serie[i.serie.length - 1];
                const cumpliendo = ultimo?.dias || 0;
                return (
                  <div key={idx} className="grid grid-cols-[minmax(140px,1fr)_auto_auto_minmax(200px,2fr)] items-center gap-3 py-1.5 px-2 rounded-lg" style={{ backgroundColor: cumpliendo >= 2 ? 'var(--primary-faint)' : 'var(--surface-2)', boxShadow: lecturaPlan?.senalClave === i.nombre ? 'inset 2px 0 0 var(--warn)' : undefined }}>
                    <div className="text-xs text-[#EDEFF3]">
                      <Termino t={nombres[i.nombre] || i.nombre}>{nombres[i.nombre] || i.nombre}</Termino>
                      {i.grupo && <span className="text-[#F5F7FA] opacity-60"> · {i.grupo}</span>}
                    </div>
                    <div className="text-[11px] tabular text-[#F5F7FA] opacity-70">{i.direccion === 'sube' ? '≥' : i.direccion === 'baja' ? '≤' : '⇄'} {i.umbral}</div>
                    <div className="flex gap-0.5">
                      {i.serie.map((s: any, k: number) => (
                        <span key={k} title={`${s.fecha}: ${s.valor ?? '—'}`} className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.cumple === true ? '#0062CC' : s.cumple === false ? 'var(--surface-1)' : 'transparent', border: '1px solid var(--border)' }} />
                      ))}
                      {Array.from({ length: Math.max(0, 7 - i.serie.length) }, (_, k) => <span key={'e' + k} className="w-3 h-3 rounded-sm" style={{ border: '1px dashed var(--border)' }} />)}
                    </div>
                    <div className="text-[11px] text-[#F5F7FA] opacity-70 truncate" title={i.habilita}>
                      {cumpliendo >= 2 ? <span className="text-[#EDEFF3] font-medium">{cumpliendo} días · </span> : ''}{i.habilita}
                    </div>
                  </div>
                );
              })}
            </div>
            {p.hipotesis?.length > 0 && (
              <div className="pt-2 mt-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
                {p.hipotesis.map((h: any) => {
                  const movs = plan.pulsos.flatMap((pp: any) => (pp.hipotesis_movidas || []).filter((m: any) => m.id === h.id));
                  const confirma = movs.filter((m: any) => m.movimiento === 'confirma').length, descarta = movs.filter((m: any) => m.movimiento === 'descarta').length;
                  return (
                    <div key={h.id} className="text-[11px] text-[#F5F7FA] opacity-80 flex gap-2">
                      <span className="font-bold text-[#EDEFF3] shrink-0">{h.id}</span>
                      <span className="flex-1">{h.texto}</span>
                      <span className="tabular shrink-0 opacity-60">{confirma > 0 ? `+${confirma}` : ''}{descarta > 0 ? ` −${descarta}` : ''}{!confirma && !descarta ? 'sin mov.' : ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* El análisis completo del agente: íntegro, plegado, rotulado.
                details nativo: el buscador del navegador lo encuentra igual. */}
            {p.contexto && (
              <details className="mt-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <summary className="cursor-pointer text-[11px] text-[#F5F7FA] opacity-50 hover:opacity-90 transition-opacity select-none">
                  Análisis del agente · texto libre · {fmtFechaCorta(p.escrito_el || p.semana)}
                </summary>
                <p className="text-[11px] text-[#F5F7FA] opacity-75 leading-relaxed mt-2 whitespace-pre-wrap" style={{ maxWidth: '70ch' }}>{p.contexto}</p>
              </details>
            )}
          </Tarjeta>
        );
      })()}

      {/* LA CANCHA · lo que pasa afuera, apilado en vertical al lado del plan.
          Va junto a las señales y no en su propia franja: son dos respuestas a
          la misma pregunta — por qué la semana tiene la forma que tiene, por
          dentro y por fuera. Cada tarjeta solo aparece si tiene algo que decir. */}
      {(presionReal.length > 0 || mercado?.resumen || mercado?.aviso) && (
        <div className="lg:col-span-5 space-y-4">
          {mercado?.resumen ? (
            <Tarjeta>
              <h2 className="text-[13px] font-medium text-[#EDEFF3] mb-2">El mercado, y vos dentro de él</h2>
              <p className="text-[14px] leading-relaxed text-[#FAFAFA]">{mercado.resumen.lectura}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[11px] tabular" style={{ color: '#ADADAD' }}>
                <span>demanda <span className="text-[#EDEFF3]">{mercado.resumen.var_mercado > 0 ? '+' : ''}{mercado.resumen.var_mercado}%</span></span>
                {mercado.resumen.var_mercado_interanual != null && (
                  <span>interanual <span className="text-[#EDEFF3]">{mercado.resumen.var_mercado_interanual > 0 ? '+' : ''}{mercado.resumen.var_mercado_interanual}%</span></span>
                )}
                {mercado.resumen.var_conv != null && (
                  <span>tus conv. <span className="text-[#EDEFF3]">{mercado.resumen.var_conv > 0 ? '+' : ''}{mercado.resumen.var_conv}%</span></span>
                )}
              </div>
              <Nota>
                {mercado.resumen.como_se_calcula}. Los volúmenes que publica Google son promedios
                redondeados: marcan dirección, no son cifra exacta.
              </Nota>
            </Tarjeta>
          ) : mercado?.aviso ? (
            /* "Vacío" y "bloqueado por permisos" son cosas distintas, y
               confundirlas manda a buscar un bug donde hay un trámite. */
            <Tarjeta>
              <h2 className="text-[13px] font-medium text-[#EDEFF3] mb-1.5">El mercado, y vos dentro de él</h2>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--warn)' }}>{mercado.aviso}</p>
              <Nota>
                Sin esta capa el sistema no puede separar una caída propia de una caída del
                mercado: las dos se ven igual en la tendencia de arriba.
              </Nota>
            </Tarjeta>
          ) : null}

          {presionReal.length > 0 && (
            <Tarjeta>
              <div className="flex items-center gap-2 mb-2.5">
                <h2 className="text-[13px] font-medium text-[#EDEFF3]">Alguien más está pujando</h2>
                <Pista titulo="Qué significa">
                  Estas campañas perdieron ranking en la subasta sin que se tocara nada en la
                  ventana: ni puja, ni presupuesto, ni estado. Google no dice quién entró —la
                  comparativa de subastas no existe por API— pero sí sabemos que el cambio no
                  fue nuestro.
                </Pista>
              </div>
              <div className="space-y-2">
                {presionReal.slice(0, 4).map((c: any) => (
                  <div key={c.campaign} className="px-2.5 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] text-[#EDEFF3] truncate">{c.campaign}</span>
                      <span className="text-[11px] tabular shrink-0" style={{ color: 'var(--warn)' }}>+{c.salto_ranking} pts</span>
                    </div>
                    <div className="text-[10px] mt-0.5 leading-snug" style={{ color: '#ADADAD' }}>
                      perdido por ranking {c.perdido_ranking_antes}% → {c.perdido_ranking_ahora}%
                      {c.cpc_ahora > c.cpc_antes && <> · CPC {fmtMoneda(c.cpc_antes, M)} → {fmtMoneda(c.cpc_ahora, M)}</>}
                    </div>
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}
        </div>
      )}
      </div>

      {/* QUÉ ENCONTRÓ EL ANÁLISIS DIARIO · dos columnas, no catorce tarjetas en
          fila india: son notas cortas de un día cada una y a una columna
          ocupaban media pantalla de scroll para decir "día normal" doce veces. */}
      <Seccion titulo="Qué encontró el análisis diario" descripcion="Una lectura por día, contra el plan.">
        {hallazgosSemana.length === 0 ? (
          <Tarjeta><Vacio>Todavía no hay análisis diarios para {activeClient}. El primero aparece mañana a la mañana.</Vacio></Tarjeta>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 items-start">
            {hallazgosSemana.filter((p: any) => !p.fecha || p.fecha >= rango.desde).map((p: any) => {
              // El hallazgo es LA línea para leer; el resumen completo va plegado.
              // abrirTextoAgente cubre el caso del pulso que escribió JSON crudo.
              const h = abrirTextoAgente(p.hallazgo_principal);
              const r = abrirTextoAgente(p.resumen);
              const titulo = h.titulo || h.cuerpo;
              const cuerpo = [h.titulo ? h.cuerpo : null, r.titulo, r.cuerpo].filter(Boolean).join('\n\n');
              return (
                <div key={p.fecha} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-1)', border: p.nivel === 'critico' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#EDEFF3] tabular">{new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    <span className={`text-[10px] uppercase tracking-wide ${p.nivel === 'critico' ? 'text-[#4D9DFF] font-bold' : 'text-[#F5F7FA] opacity-50'}`}>{p.nivel === 'critico' ? 'Requiere acción' : p.nivel === 'atencion' ? 'Para mirar el lunes' : 'Día normal'}</span>
                  </div>
                  {titulo && <p className="text-xs text-[#EDEFF3] font-medium line-clamp-2" title={titulo}>{titulo}</p>}
                  {cuerpo && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[10px] text-[#F5F7FA] opacity-45 hover:opacity-90 select-none">análisis del día</summary>
                      <p className="text-[11px] text-[#F5F7FA] opacity-75 leading-relaxed mt-1 whitespace-pre-wrap" style={{ maxWidth: '75ch' }}>{cuerpo}</p>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Seccion>

      {/* EL DETALLE, PLEGADO: está cuando hace falta, no estorba cuando no */}
      <div className="space-y-3">
        <Collapsible titulo={convGrupo.hallazgo || 'Conversiones por grupo'} resumen="en qué grupo cayeron, día por día">
          {convGrupo.grupos.length === 0 ? <Vacio>Sin datos por grupo en la ventana.</Vacio> : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead><tr className="text-[#F5F7FA] opacity-60 text-left" style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="py-1.5 px-2">Día</th>
                  {convGrupo.grupos.map((g: string) => <th key={g} className="py-1.5 px-2 text-right">{g}</th>)}
                </tr></thead>
                <tbody>
                  {convGrupo.filas.map((f: any) => (
                    <tr key={f.date} style={{ borderBottom: '1px solid var(--border)' }} className={f.madurez === 'provisional' ? 'opacity-80' : ''}>
                      <td className="py-1 px-2 tabular text-[#F5F7FA]">{new Date(f.date + 'T12:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit' })}{f.madurez === 'provisional' ? ' ·' : ''}</td>
                      {convGrupo.grupos.map((g: string) => {
                        const v = f[g] || 0;
                        // La opacidad de la fila provisional multiplica a la de la celda:
                        // .50 x .30 daban 0,15 efectivo = 1,58:1. Con .80 arriba y .70 acá
                        // el punto de "cero conversiones" queda en 4,81:1 sobre surface-2.
                        return <td key={g} className={`py-1 px-2 tabular text-right ${v === 0 ? 'text-[#F5F7FA] opacity-70' : 'text-[#EDEFF3] font-medium'}`}>{v === 0 ? '·' : v}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Nota>Los días con · al lado siguen madurando.</Nota>
            </div>
          )}
        </Collapsible>

        <Collapsible titulo="Cuándo convierte" resumen={`hora y día de la última semana cerrada${horaDia.semana ? ` · desde ${fmtFechaCorta(horaDia.semana)}` : ''}`}>
          {(horaDia.mejor || horaDia.peor_sin_conv) && (
            <div className="text-[11px] text-[#F5F7FA] opacity-80 space-y-0.5 mb-3">
              {horaDia.mejor && <div>Mejor CPA: {horaDia.mejor.dia} {String(horaDia.mejor.hora).padStart(2, '0')}:00 · {fmtMoneda(Number(horaDia.mejor.cpa), M)}</div>}
              {horaDia.peor_sin_conv && <div>Mayor gasto sin conv.: {horaDia.peor_sin_conv.dia} {String(horaDia.peor_sin_conv.hora).padStart(2, '0')}:00 · {fmtMoneda(Number(horaDia.peor_sin_conv.gasto), M)}</div>}
            </div>
          )}
          {horaDia.celdas?.length ? (() => {
            const maxGasto = Math.max(...horaDia.celdas.map((c: any) => Number(c.gasto) || 0), 1);
            const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
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
                          <div key={h} title={c ? `${d} ${h}:00 · ${fmtMoneda(g, M)} · ${c.clics} clics · ${conv} conv` : ''}
                            className="h-5 rounded-sm relative"
                            style={{ backgroundColor: op ? `color-mix(in oklab, #0062CC ${Math.round(op * 100)}%, var(--surface-2))` : 'var(--surface-2)' }}>
                            {conv > 0 && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-[#EDEFF3] font-bold">●</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <p className="text-[10px] text-[#F5F7FA] opacity-60 pt-2">Intensidad = <Termino t="Gasto">gasto</Termino> · punto = conversión.</p>
                </div>
              </div>
            );
          })() : <Vacio>Sin datos de hora y día todavía. Los trae la extracción semanal de los lunes.</Vacio>}
        </Collapsible>

        <Collapsible titulo="Búsquedas nuevas" resumen="las que gastan sin convertir y las que convierten">
          {(() => {
            const conGasto = newTerms.filter((t: any) => Number(t.gasto_acumulado || 0) > 0);
            const sinConv = conGasto.filter((t: any) => Number(t.conversiones_acumuladas || 0) === 0).sort((x: any, y: any) => Number(y.gasto_acumulado) - Number(x.gasto_acumulado));
            const conConv = conGasto.filter((t: any) => Number(t.conversiones_acumuladas || 0) > 0).sort((x: any, y: any) => Number(y.conversiones_acumuladas) - Number(x.conversiones_acumuladas));
            const gastoSinConv = sinConv.reduce((acc: number, t: any) => acc + Number(t.gasto_acumulado || 0), 0);
            if (loadingTerms) return <Vacio>Cargando…</Vacio>;
            // El error va ANTES del vacío: sin esta línea, un fetch fallado
            // imprimía el veredicto positivo de abajo sobre cero filas.
            if (errorTerms) return <Fallo que="las búsquedas nuevas" motivo={errorTerms} onReintentar={fetchNewTerms} />;
            if (conGasto.length === 0) return <Vacio>Ninguna búsqueda nueva con gasto en los últimos 14 días. Es buena señal: las negativas están cubriendo.</Vacio>;
            return (
              <>
                <p className="text-[11px] text-[#F5F7FA] opacity-50 mb-3">Lo que la gente escribió por primera vez y disparó un anuncio · {conGasto.length} con gasto en 14 días</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-[#EDEFF3]">Gastan y no convierten</span>
                      <span className="text-[11px] text-[#F5F7FA] opacity-60 tabular">{sinConv.length} · {fmtMoneda(gastoSinConv, M)}</span>
                    </div>
                    {sinConv.length === 0 ? <p className="text-[11px] text-[#F5F7FA] opacity-50 italic">Ninguna.</p> : sinConv.slice(0, 8).map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#EDEFF3] truncate">{t.search_term || t.termino}</div>
                          <div className="text-[10px] text-[#F5F7FA] opacity-50 truncate">la disparó <span className="opacity-100">{t.keyword_disparadora || '—'}</span>{t.ad_group ? ` en ${t.ad_group}` : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs tabular text-[#EDEFF3]">{fmtMoneda(Number(t.gasto_acumulado || 0), M)}</div>
                          <div className="text-[10px] tabular text-[#F5F7FA] opacity-50">{t.clics_acumulados ?? 0} clics</div>
                        </div>
                      </div>
                    ))}
                    {sinConv.length > 0 && <p className="text-[10px] text-[#F5F7FA] opacity-60 pt-1">Antes de agregar una negativa, buscá el término en Datos › Términos con 14 días: si alguna variante convirtió, la bloquearía también.</p>}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-[#EDEFF3]">Convierten</span>
                      <span className="text-[11px] text-[#F5F7FA] opacity-60 tabular">{conConv.length}</span>
                    </div>
                    {conConv.length === 0 ? <p className="text-[11px] text-[#F5F7FA] opacity-50 italic">Ninguna todavía.</p> : conConv.slice(0, 8).map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--surface-2)', borderLeft: '2px solid var(--primary)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#EDEFF3] truncate">{t.search_term || t.termino}</div>
                          <div className="text-[10px] text-[#F5F7FA] opacity-50 truncate">la disparó <span className="opacity-100">{t.keyword_disparadora || '—'}</span>{t.match_type ? ` (${String(t.match_type).toLowerCase()})` : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs tabular text-[#EDEFF3]">{Number(t.conversiones_acumuladas)} conv</div>
                          <div className="text-[10px] tabular text-[#F5F7FA] opacity-50">{t.cpa ? fmtMoneda(Number(t.cpa), M) : fmtMoneda(Number(t.gasto_acumulado || 0), M)}</div>
                        </div>
                      </div>
                    ))}
                    {conConv.length > 0 && <p className="text-[10px] text-[#F5F7FA] opacity-60 pt-1">Si una convierte varias veces, vale como keyword exacta propia: así dejás de depender de la amplia.</p>}
                  </div>
                </div>
              </>
            );
          })()}
        </Collapsible>

        <Collapsible
          titulo="Cambios en la cuenta esta semana"
          resumen={(() => {
            const c = Array.isArray(changesList) ? changesList : [];
            const auto = c.filter((x: any) => /RECOMMENDATION|AUTO/i.test(String(x.client_type || x.origen || ''))).length;
            const propios = c.length - auto;
            return c.length === 0 ? 'ninguno registrado'
              : `${propios} tuyo${propios !== 1 ? 's' : ''}${auto ? ` · ${auto} automático${auto !== 1 ? 's' : ''} de Google` : ' · ninguno automático'}`;
          })()}
        >
          <div className="flex items-center gap-2 mb-2 text-[11px] text-[#F5F7FA] opacity-50">
            <History size={12} /> Eventos de Google, diferencias de snapshot y registros manuales en bitácora. El análisis los usa para explicar movimientos.
          </div>
          {changesList.length === 0 ? (
            <Vacio>No hay cambios registrados en la semana actual.</Vacio>
          ) : (
            <div className="space-y-2">
              {changesList.slice(0, 15).map((ch, idx) => {
                const isAutoGoogle = ch.origen === 'google_change_event' || ch.automatico;
                return (
                  <div key={idx} className="p-3 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="tabular text-[#F5F7FA] opacity-60 text-[11px]">{ch.fecha || ch.date || 'Reciente'}</span>
                        {isAutoGoogle && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/10 text-[#EDEFF3]" style={{ border: '1px solid var(--border-strong)' }}>Automático Google</span>
                        )}
                        <span className="font-semibold text-[#EDEFF3]">{ch.que_cambio || ch.descripcion || ch.change_resource_type}</span>
                      </div>
                      {ch.donde && <div className="text-[11px] text-[#F5F7FA] opacity-65">Ámbito: {ch.donde}</div>}
                    </div>
                    {ch.por_que && <div className="text-xs text-[#F5F7FA] opacity-75 max-w-sm italic">"{ch.por_que}"</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Collapsible>
      </div>

      {/* Drawer de inspección de día */}
      <Drawer
        isOpen={Boolean(selectedDay)}
        onClose={() => { setSelectedDay(null); setShowAnnotationForm(false); }}
        title={selectedDay ? `Día ${fmtFechaCorta(selectedDay.date)}` : 'Inspección de día'}
        subtitle={`Métricas y anotaciones de ${activeClient}`}
      >
        {selectedDay && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60">Métricas del día</span>
                {selectedDay.madurez === 'provisional' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--primary-faint)', color: 'var(--text-secondary)' }}>madurando: estas cifras todavía se mueven</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Gasto</div>
                  <div className="text-base font-bold text-[#EDEFF3] tabular">{fmtMoneda(selectedDay.gasto ?? selectedDay.cost ?? 0, M)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Conversiones</div>
                  <div className="text-base font-bold text-[#EDEFF3] tabular">{selectedDay.conversiones ?? selectedDay.conversions ?? 0}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">CPA</div>
                  <div className="text-sm font-semibold text-[#EDEFF3] tabular">{(selectedDay.cpa ?? selectedDay.cpa_provisional) ? fmtMoneda(selectedDay.cpa ?? selectedDay.cpa_provisional, M) : '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">Clics</div>
                  <div className="text-sm font-semibold text-[#EDEFF3] tabular">{selectedDay.clics ?? selectedDay.clicks ?? 0}</div>
                </div>
              </div>
              {selectedDay.explicacion && (
                <p className="text-[11px] text-[#F5F7FA] opacity-70 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  {selectedDay.explicacion}
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider align-middle" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)' }} title="Explicación escrita por el detector de anomalías, sin resumir">análisis del agente</span>
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl space-y-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#EDEFF3] text-xs uppercase tracking-wider">Anotaciones del día</span>
                <button onClick={() => setShowAnnotationForm(!showAnnotationForm)} className="text-xs text-[#4D9DFF] hover:underline font-semibold">
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
                    <div className="text-[11px] text-[#EDEFF3] flex items-center gap-1"><Check size={12} /> Anotación guardada</div>
                  )}
                  <textarea required rows={3} placeholder={`Qué pasó el ${fmtFechaCorta(selectedDay.date)}…`} value={annotationText}
                    onChange={e => setAnnotationText(e.target.value)}
                    className="w-full bg-transparent rounded p-2 text-xs text-[#EDEFF3] placeholder-[#F5F7FA]/40 outline-none"
                    style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-1)' }} />
                  <div className="flex justify-end">
                    <button type="submit" disabled={savingAnnotation || !annotationText.trim()}
                      className="px-3 py-1.5 bg-[#0062CC] text-[#EDEFF3] rounded text-xs font-semibold disabled:opacity-50">
                      {savingAnnotation ? 'Guardando…' : 'Guardar anotación'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </Drawer>

    </PageShell>
  );
}
