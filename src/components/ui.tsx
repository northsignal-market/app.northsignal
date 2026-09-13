/**
 * UI · primitivas compartidas del sistema visual
 * ----------------------------------------------------------------------------
 * Una página se arma igual en todos lados: PageShell › Seccion › Tarjeta.
 * Los formatos de moneda, número y fecha viven acá y en ningún otro lado:
 * antes cada vista tenía su copia y Fresh Monkee llegó a mostrarse en CLP.
 *
 * Reglas que estas piezas hacen cumplir solas:
 *  - La ventana que se declara es la que se pidió: RangoFechas devuelve el
 *    rango exacto y lo muestra en palabras ("últimos 14 días · 30 ago – 12 sep").
 *  - Los días que todavía maduran se VEN distintos (banda punteada en el
 *    gráfico): un número provisional que parece final es el bug más caro.
 *  - La moneda sale de la cuenta, nunca de un mapa cableado.
 */
import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceArea, Legend,
} from 'recharts';

// ================================================================
// FORMATO · una sola fuente de verdad
// ================================================================
const LOCALE = 'es-AR';
const SIMBOLO: Record<string, string> = { USD: 'US$', EUR: '€', CLP: '$' };

/** Moneda según la cuenta. CLP sin decimales; USD/EUR con dos. */
export function fmtMoneda(v: number | null | undefined, moneda: string): string {
  if (v == null || isNaN(Number(v))) return '—';
  const dec = moneda === 'CLP' ? 0 : 2;
  return (SIMBOLO[moneda] || moneda + ' ') + Number(v).toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Moneda compacta para ejes y espacios chicos: $1,2 M · US$450. */
export function fmtMonedaCorta(v: number | null | undefined, moneda: string): string {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v), s = SIMBOLO[moneda] || '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return s + (n / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) + ' M';
  if (abs >= 10_000) return s + (n / 1_000).toLocaleString(LOCALE, { maximumFractionDigits: 0 }) + ' mil';
  return s + n.toLocaleString(LOCALE, { maximumFractionDigits: abs < 100 ? 1 : 0 });
}

export function fmtNum(v: number | null | undefined, dec = 0): string {
  if (v == null || isNaN(Number(v))) return '—';
  return Number(v).toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** '2026-09-12' → '12 sep'. Sin new Date(str): el huso corre la fecha un día. */
export function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${Number(d)} ${MESES[Number(m) - 1] || m}`;
}

/** Fecha local de la máquina (no UTC): "hoy" y "ayer" del operador. */
export function hoyLocal(offsetDias = 0): string {
  const d = new Date(); d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ================================================================
// LAYOUT · página, sección, tarjeta
// ================================================================
/** Marco de página: ancho máximo, márgenes y ritmo vertical iguales en toda la app. */
export function PageShell({ titulo, subtitulo, derecha, children }: {
  titulo?: React.ReactNode; subtitulo?: React.ReactNode; derecha?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="px-5 md:px-8 py-6 max-w-[1320px] mx-auto space-y-8">
      {(titulo || derecha) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {titulo && <h1 className="text-xl text-[#FFFFFF] leading-tight">{titulo}</h1>}
            {subtitulo && <p className="text-xs text-[#F5F7FA] opacity-60 mt-1">{subtitulo}</p>}
          </div>
          {derecha && <div className="flex items-center gap-2 shrink-0">{derecha}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Sección con título chico a la izquierda y controles a la derecha. */
export function Seccion({ titulo, descripcion, derecha, children }: {
  titulo: React.ReactNode; descripcion?: React.ReactNode; derecha?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium text-[#FFFFFF] tracking-wide">{titulo}</h2>
          {descripcion && <p className="text-[11px] text-[#F5F7FA] opacity-50 mt-0.5">{descripcion}</p>}
        </div>
        {derecha && <div className="flex items-center gap-2 flex-wrap">{derecha}</div>}
      </div>
      {children}
    </section>
  );
}

/** Tarjeta estándar. attention: borde izquierdo azul para lo que pide acción. */
export function Tarjeta({ children, attention, sinPadding, className = '' }: {
  children: React.ReactNode; attention?: boolean; sinPadding?: boolean; className?: string;
}) {
  return (
    <div
      className={`glass ${sinPadding ? '' : 'p-4 md:p-5'} ${className}`}
      style={{ ['--r' as any]: '16px', ['--p' as any]: '16px', borderRadius: 'var(--r-tarjeta)', ...(attention ? { borderLeft: '2px solid var(--primary)' } : {}) }}
    >
      {children}
    </div>
  );
}

/** Grilla de tarjetas de cifras. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>;
}

/** Cifra con etiqueta, delta opcional y nota. El delta no grita: signo y tono. */
export function Stat({ label, valor, delta, deltaBuenoSiBaja, nota, provisional }: {
  label: string; valor: React.ReactNode; delta?: number | null; deltaBuenoSiBaja?: boolean; nota?: string; provisional?: boolean;
}) {
  const d = delta == null || isNaN(Number(delta)) ? null : Number(delta);
  const bueno = d == null ? null : (deltaBuenoSiBaja ? d < 0 : d > 0);
  return (
    <div className="surface p-3.5" style={{ borderRadius: 'var(--r-panel)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">{label}</span>
        {provisional && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--primary-faint)', color: 'var(--text-secondary)' }} title="Los días recientes maduran: este número todavía se mueve">madurando</span>}
      </div>
      <div className="text-lg text-[#FFFFFF] tabular mt-1 leading-tight">{valor}</div>
      <div className="flex items-baseline gap-2 mt-0.5 min-h-[14px]">
        {d != null && (
          <span className="text-[11px] tabular" style={{ color: bueno ? 'var(--text-secondary)' : '#E8A13C' }}>
            {d > 0 ? '+' : ''}{fmtNum(d, Math.abs(d) < 10 ? 1 : 0)}%
          </span>
        )}
        {nota && <span className="text-[10px] text-[#F5F7FA] opacity-40 truncate">{nota}</span>}
      </div>
    </div>
  );
}

/** Estado vacío honesto: dice por qué no hay nada, nunca inventa. */
export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[#F5F7FA] opacity-50 italic py-6 text-center">{children}</p>;
}

// ================================================================
// RED · fetch con auth y guardas, una sola vez
// ================================================================
/** fetch → JSON con el header de auth y las guardas de siempre. Devuelve
 *  `fallback` ante cualquier falla: las vistas deciden qué es "vacío". */
export async function fetchJSON<T>(url: string, fallback: T): Promise<T> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const r = await fetch(url, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return fallback;
    return await r.json();
  } catch { return fallback; }
}

// ================================================================
// COLAPSABLE · un solo patrón para lo plegable
// ================================================================
export function Collapsible({ titulo, resumen, abiertoInicial = false, children }: {
  titulo: React.ReactNode; resumen?: React.ReactNode; abiertoInicial?: boolean; children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <div className="glass" style={{ borderRadius: 'var(--r-tarjeta)' }}>
      <button onClick={() => setAbierto(a => !a)} className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3 text-left">
        <span className="text-[13px] font-medium text-[#FFFFFF]">{titulo}</span>
        <span className="flex items-center gap-2 shrink-0">
          {resumen && <span className="text-[11px] text-[#F5F7FA] opacity-50">{resumen}</span>}
          <ChevronDown size={14} className={`text-[#F5F7FA] opacity-50 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {abierto && <div className="px-4 md:px-5 pb-4">{children}</div>}
    </div>
  );
}

// ================================================================
// FILTROS
// ================================================================
/** Filtro segmentado: una opción activa, estilo píldora. */
export function Chips<T extends string>({ opciones, valor, onChange }: {
  opciones: { id: T; label: string; title?: string }[]; valor: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      {opciones.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} title={o.title}
          className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${valor === o.id ? 'bg-[#0062CC] text-[#FFFFFF] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ================================================================
// RANGO DE FECHAS · presets + personalizado, con la ventana real visible
// ================================================================
export type Rango = { desde: string; hasta: string; etiqueta: string };

/** Los presets nacen de las ventanas REALES de las tablas: la diaria guarda ~17
 *  días y la semanal 91. Pedir más que eso es pedir un hueco. */
export function rangoPreset(id: string): Rango {
  const hasta = hoyLocal(-1);   // ayer: hoy nunca está cerrado
  switch (id) {
    case '7d': return { desde: hoyLocal(-7), hasta, etiqueta: 'Últimos 7 días' };
    case '14d': return { desde: hoyLocal(-14), hasta, etiqueta: 'Últimos 14 días' };
    case 'semana': {
      const d = new Date(); const dow = (d.getDay() + 6) % 7;
      const lunes = new Date(d); lunes.setDate(d.getDate() - dow);
      const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      return { desde: fmt(lunes), hasta, etiqueta: 'Esta semana' };
    }
    case 'semana_pasada': {
      const d = new Date(); const dow = (d.getDay() + 6) % 7;
      const lunesPasado = new Date(d); lunesPasado.setDate(d.getDate() - dow - 7);
      const domingoPasado = new Date(lunesPasado); domingoPasado.setDate(lunesPasado.getDate() + 6);
      const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      return { desde: fmt(lunesPasado), hasta: fmt(domingoPasado), etiqueta: 'Semana pasada' };
    }
    default: return { desde: hoyLocal(-7), hasta, etiqueta: 'Últimos 7 días' };
  }
}

/**
 * Selector de rango: presets de un toque + personalizado con dos fechas.
 * Muestra siempre la ventana elegida en palabras. `minDesde` frena pedidos
 * fuera de la retención de la tabla (y lo dice, en vez de devolver un hueco).
 */
export function RangoFechas({ valor, onChange, presets = ['7d', '14d', 'semana', 'semana_pasada'], minDesde, nota }: {
  valor: Rango; onChange: (r: Rango) => void; presets?: string[]; minDesde?: string; nota?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [dDesde, setDDesde] = useState(valor.desde);
  const [dHasta, setDHasta] = useState(valor.hasta);
  const LABELS: Record<string, string> = { '7d': '7 días', '14d': '14 días', semana: 'Esta semana', semana_pasada: 'Semana pasada' };
  const activo = presets.find(p => { const r = rangoPreset(p); return r.desde === valor.desde && r.hasta === valor.hasta; });
  const fueraDeVentana = minDesde && dDesde < minDesde;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        {presets.map(p => (
          <button key={p} onClick={() => { setAbierto(false); onChange(rangoPreset(p)); }}
            className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${activo === p ? 'bg-[#0062CC] text-[#FFFFFF] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}>
            {LABELS[p] || p}
          </button>
        ))}
        <button onClick={() => { setDDesde(valor.desde); setDHasta(valor.hasta); setAbierto(a => !a); }}
          className={`px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 transition-colors ${!activo ? 'bg-[#0062CC] text-[#FFFFFF] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}>
          <Calendar size={11} /> {!activo ? `${fmtFechaCorta(valor.desde)} – ${fmtFechaCorta(valor.hasta)}` : 'Elegir'}
          <ChevronDown size={11} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>
      {abierto && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <input type="date" value={dDesde} min={minDesde} max={dHasta} onChange={e => setDDesde(e.target.value)}
            className="bg-transparent text-[11px] text-[#F5F7FA] outline-none [color-scheme:dark]" />
          <span className="text-[11px] text-[#F5F7FA] opacity-40">→</span>
          <input type="date" value={dHasta} min={dDesde} max={hoyLocal(-1)} onChange={e => setDHasta(e.target.value)}
            className="bg-transparent text-[11px] text-[#F5F7FA] outline-none [color-scheme:dark]" />
          <button
            onClick={() => { if (!fueraDeVentana && dDesde && dHasta && dDesde <= dHasta) { onChange({ desde: dDesde, hasta: dHasta, etiqueta: 'Personalizado' }); setAbierto(false); } }}
            disabled={!!fueraDeVentana || !dDesde || !dHasta || dDesde > dHasta}
            className="px-2.5 py-1 rounded-md text-[11px] bg-[#0062CC] text-[#FFFFFF] disabled:opacity-40">
            Aplicar
          </button>
        </div>
      )}
      <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular whitespace-nowrap">
        {fueraDeVentana && abierto
          ? `La tabla diaria guarda desde el ${fmtFechaCorta(minDesde!)}: antes de eso no hay dato, habría un hueco.`
          : `${fmtFechaCorta(valor.desde)} – ${fmtFechaCorta(valor.hasta)}${nota ? ` · ${nota}` : ''}`}
      </span>
    </div>
  );
}

// ================================================================
// GRÁFICO · una serie temporal, bien hecha una sola vez
// ================================================================
export type SerieDef = {
  clave: string; nombre: string;
  tipo?: 'area' | 'linea' | 'barra';
  /** 'moneda' formatea con la moneda de la cuenta; 'numero' con separador de miles. */
  formato?: 'moneda' | 'numero';
  color?: string;
  ejeDerecho?: boolean;
};

const COLORES = ['#0062CC', '#7FB3E8', '#E8A13C', '#9AE6B4'];

/**
 * Serie temporal estándar: grid sutil, ejes formateados, tooltip de vidrio, y
 * la banda de maduración sombreada — los días desde `provisionalDesde` todavía
 * se mueven (Google atribuye al día del clic, no al de la conversión).
 */
export function GraficoSerie({ datos, series, moneda = 'CLP', provisionalDesde, alto = 240, xClave = 'fecha' }: {
  datos: any[]; series: SerieDef[]; moneda?: string; provisionalDesde?: string; alto?: number; xClave?: string;
}) {
  const conDerecho = series.some(s => s.ejeDerecho);
  const fmtDe = (s: SerieDef) => (v: number) => s.formato === 'moneda' ? fmtMoneda(v, moneda) : fmtNum(v, Math.abs(v) < 10 ? 1 : 0);
  const primeraProvisional = useMemo(() => {
    if (!provisionalDesde || !datos?.length) return null;
    return datos.find(d => String(d[xClave]) >= provisionalDesde)?.[xClave] ?? null;
  }, [datos, provisionalDesde, xClave]);

  if (!datos?.length) return <Vacio>Sin datos en esta ventana.</Vacio>;

  return (
    <div style={{ width: '100%', height: alto }}>
      <ResponsiveContainer>
        <ComposedChart data={datos} margin={{ top: 8, right: conDerecho ? 4 : 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xClave} tickFormatter={fmtFechaCorta} tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis yAxisId="izq" tickFormatter={(v: number) => series.find(s => !s.ejeDerecho)?.formato === 'moneda' ? fmtMonedaCorta(v, moneda) : fmtNum(v)} tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
          {conDerecho && <YAxis yAxisId="der" orientation="right" tickFormatter={(v: number) => series.find(s => s.ejeDerecho)?.formato === 'moneda' ? fmtMonedaCorta(v, moneda) : fmtNum(v)} tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />}
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)' }}
            contentStyle={{ background: 'var(--glass-tint-dense)', border: '1px solid var(--glass-border)', borderRadius: 10, backdropFilter: 'blur(12px)', fontSize: 11, color: '#F5F7FA' }}
            labelFormatter={(l: any) => {
              const esProv = primeraProvisional && String(l) >= String(primeraProvisional);
              return fmtFechaCorta(String(l)) + (esProv ? ' · madurando' : '');
            }}
            formatter={(v: any, nombre: any) => {
              const s = series.find(x => x.nombre === nombre);
              return [s ? fmtDe(s)(Number(v)) : v, nombre];
            }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10, opacity: 0.7 }} iconSize={8} />}
          {primeraProvisional && (
            <ReferenceArea yAxisId="izq" x1={primeraProvisional} x2={datos[datos.length - 1][xClave]}
              {...({ fill: 'var(--primary-faint)', strokeOpacity: 0, label: { value: 'madurando', position: 'insideTopRight', fill: 'rgba(245,247,250,0.35)', fontSize: 9 } } as any)} />
          )}
          {series.map((s, i) => {
            const color = s.color || COLORES[i % COLORES.length];
            const props = { key: s.clave, yAxisId: s.ejeDerecho ? 'der' : 'izq', dataKey: s.clave, name: s.nombre, stroke: color, strokeWidth: 1.5, dot: false as const, isAnimationActive: false };
            if (s.tipo === 'barra') return <Bar {...props} fill={color} fillOpacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={18} />;
            if (s.tipo === 'linea') return <Line {...props} type="monotone" />;
            return <Area {...props} type="monotone" fill={color} fillOpacity={0.12} />;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
