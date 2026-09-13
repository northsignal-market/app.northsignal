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
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
// La v4 de la librería expone Group/Panel/Separator. `Panel` se renombra:
// acá `Panel` ya es la celda del Tablero.
import { Group, Panel as PanelRP, Separator } from 'react-resizable-panels';
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
            {titulo && <h1 className="text-xl text-[#EDEFF3] leading-tight">{titulo}</h1>}
            {subtitulo && <p className="text-xs text-[#F5F7FA] opacity-60 mt-1">{subtitulo}</p>}
          </div>
          {derecha && <div className="flex items-center gap-2 shrink-0">{derecha}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * TABLERO · composición en dos dimensiones.
 * Una vista de operación no es una pila de filas del mismo alto: es un tablero
 * donde el bloque que manda ocupa más y los de contexto acompañan. Grid de 12
 * columnas; cada Panel declara cuánto toma (`col`) y cuántas filas cruza
 * (`filas`). En móvil todo colapsa a una columna sin excepciones.
 */
export function Tablero({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ${className}`}>{children}</div>;
}

const COL: Record<number, string> = {
  3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6',
  7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 12: 'lg:col-span-12',
};
const FILA: Record<number, string> = { 2: 'lg:row-span-2', 3: 'lg:row-span-3' };

/** Celda del tablero. `alto` fija una altura con scroll propio: así una lista
 *  larga no estira la fila entera y el tablero conserva su forma. */
export function Panel({ col = 6, filas, alto, titulo, nota, derecha, hero, sinCaja, children }: {
  col?: number; filas?: number; alto?: number;
  titulo?: React.ReactNode; nota?: React.ReactNode; derecha?: React.ReactNode;
  hero?: boolean; sinCaja?: boolean; children: React.ReactNode;
}) {
  const cuerpo = (
    <>
      {(titulo || derecha) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-[13px] font-medium text-[#EDEFF3] leading-tight">{titulo}</h2>}
            {nota && <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#ADADAD' }}>{nota}</p>}
          </div>
          {derecha && <div className="flex items-center gap-2 shrink-0">{derecha}</div>}
        </div>
      )}
      <div className={alto ? 'overflow-y-auto custom-scrollbar -mr-1 pr-1' : ''} style={alto ? { maxHeight: alto } : undefined}>
        {children}
      </div>
    </>
  );
  const clases = `${COL[col] || 'lg:col-span-6'} ${filas ? FILA[filas] || '' : ''} min-w-0`;
  if (sinCaja) return <section className={clases}>{cuerpo}</section>;
  return (
    <section className={`${clases} tarjeta-pulse ${hero ? 'tarjeta-hero borde-vivo' : ''} p-4 md:p-5`}
      style={{ borderRadius: 'var(--r-tarjeta)' }}>
      {cuerpo}
    </section>
  );
}

/**
 * DOS PANELES REDIMENSIONABLES · el ancho lo decide el operador.
 * En una app de una sola persona la proporción entre la lista y su contexto no
 * la sabe el diseñador: la sabe quien la usa todos los días. Se arrastra una
 * vez y queda (autoSaveId persiste en localStorage al SOLTAR, no en cada frame
 * del puntero: guardar por frame es escribir cientos de veces por arrastre).
 * En móvil no hay dos columnas ni puntero: se apilan y el handle no existe.
 */
export function DosPaneles({ id, izquierda, derecha, defIzq = 74, minIzq = 42, minDer = 15 }: {
  id: string; izquierda: React.ReactNode; derecha: React.ReactNode;
  defIzq?: number; minIzq?: number; minDer?: number;
}) {
  const CLAVE = `ns.paneles.${id}`;
  const [ancho, setAncho] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const r = () => setAncho(window.innerWidth);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  // El Layout de la v4 NO es un array: es un objeto {idDelPanel: porcentaje}.
  // Por eso los paneles llevan id EXPLÍCITO — con los autogenerados (`_r_1_`)
  // la preferencia guardada deja de corresponder apenas cambia el árbol.
  const guardado = useMemo<Record<string, number> | undefined>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      return v && typeof v === 'object' && typeof v.izq === 'number' && typeof v.der === 'number' ? v : undefined;
    } catch { return undefined; }
  }, [CLAVE]);

  if (ancho < 1024) return <div className="space-y-8">{izquierda}{derecha}</div>;
  return (
    <Group orientation="horizontal" className="items-start"
      defaultLayout={guardado || { izq: defIzq, der: 100 - defIzq }}
      // onLayoutChanged dispara al SOLTAR; onLayoutChange lo hace por frame del
      // puntero y está deprecado en la librería justamente por eso.
      onLayoutChanged={(l) => { try { localStorage.setItem(CLAVE, JSON.stringify(l)); } catch { /* modo privado */ } }}
    >
      <PanelRP id="izq" minSize={minIzq} className="min-w-0">{izquierda}</PanelRP>
      <Separator className="group/handle relative w-6 shrink-0 self-stretch flex items-center justify-center cursor-col-resize">
        {/* El hairline de siempre; al pasar el mouse se enciende para avisar
            que se puede mover. */}
        <span className="w-px h-full transition-colors group-hover/handle:bg-[var(--primary-text)]"
          style={{ backgroundColor: 'var(--border)' }} />
        <span className="absolute h-9 w-[3px] rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity"
          style={{ backgroundColor: 'var(--primary-text)' }} />
      </Separator>
      <PanelRP id="der" minSize={minDer} className="min-w-0">{derecha}</PanelRP>
    </Group>
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
          <h2 className="text-[13px] font-medium text-[#EDEFF3] tracking-wide">{titulo}</h2>
          {descripcion && <p className="text-[11px] text-[#F5F7FA] opacity-50 mt-0.5">{descripcion}</p>}
        </div>
        {derecha && <div className="flex items-center gap-2 flex-wrap">{derecha}</div>}
      </div>
      {children}
    </section>
  );
}

// ================================================================
// JERARQUÍA · tres pesos de texto, y uno solo grita
// ================================================================
/**
 * TITULAR · la frase que contesta la pregunta de la vista, arriba de todo.
 *
 * Una pantalla de operación tiene UNA oración que importa ("el gasto se
 * encendió, todavía sin persistir") y veinte que la matizan. Cuando todas se
 * escriben al mismo tamaño, ninguna se lee: el ojo no tiene dónde aterrizar y
 * termina barriendo el bloque entero. Esta primitiva existe para que esa
 * oración esté sola en su peso tipográfico, antes de las cifras.
 *
 * `guia` es la única línea que puede acompañarla. `meta` va en tabular y
 * apagado: fechas, conteos, progreso. Lo demás se pliega o se va a `Pista`.
 */
export function Titular({ estado, children, guia, meta, aviso, derecha }: {
  /** Color del punto de estado. Sin color no hay punto: no se inventa semáforo. */
  estado?: string;
  children: React.ReactNode;
  guia?: React.ReactNode;
  meta?: React.ReactNode;
  aviso?: React.ReactNode;
  derecha?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 space-y-1">
        <div className="flex items-baseline gap-2.5">
          {estado && <span className="w-2 h-2 rounded-full shrink-0 translate-y-[-1px]" style={{ backgroundColor: estado, boxShadow: `0 0 10px -1px ${estado}` }} />}
          <h1 className="text-[17px] md:text-[19px] font-semibold leading-snug text-[#FFFFFF]" style={{ letterSpacing: '-0.2px', maxWidth: '62ch' }}>{children}</h1>
        </div>
        {guia && <p className="text-[12.5px] leading-relaxed pl-[18px]" style={{ color: '#F5F7FA', opacity: 0.8, maxWidth: '68ch' }}>{guia}</p>}
        {(meta || aviso) && (
          <p className="text-[11px] tabular pl-[18px] flex flex-wrap items-center gap-x-2" style={{ color: '#ADADAD' }}>
            {meta}
            {aviso && <span style={{ color: 'var(--warn)' }}>{aviso}</span>}
          </p>
        )}
      </div>
      {derecha && <div className="flex items-center gap-2 shrink-0">{derecha}</div>}
    </div>
  );
}

/** NOTA · la letra chica honesta: cómo se calculó, qué no se puede saber.
 *  Tiene que estar (el sistema no oculta sus límites) y tiene que no competir. */
export function Nota({ children, tono = 'gris' }: { children: React.ReactNode; tono?: 'gris' | 'aviso' }) {
  return (
    <p className="text-[10.5px] leading-relaxed mt-2" style={{ color: tono === 'aviso' ? 'var(--warn)' : '#ADADAD', opacity: tono === 'aviso' ? 0.95 : 0.72, maxWidth: '78ch' }}>
      {children}
    </p>
  );
}

/**
 * PISTA · la leyenda que antes vivía como subtítulo permanente.
 *
 * "punteada = media móvil 7d · fondo azul = anomalía · zona clara = madurando"
 * se lee UNA vez en la vida y después es ruido en cada carga. Acá se guarda
 * detrás de un ⓘ que se abre al pasar por encima o al enfocar con el teclado,
 * y queda en el DOM: el buscador del navegador lo sigue encontrando.
 */
export function Pista({ children, titulo = 'Cómo leer esto' }: { children: React.ReactNode; titulo?: string }) {
  return (
    <span className="relative inline-flex group align-middle">
      <button type="button" aria-label={titulo}
        className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] font-semibold opacity-45 hover:opacity-100 focus:opacity-100 focus:outline-none transition-opacity"
        style={{ border: '1px solid var(--border-strong)', color: '#ADADAD' }}>i</button>
      <span role="tooltip"
        className="pointer-events-none absolute left-0 top-[19px] z-50 w-[280px] p-2.5 rounded-lg text-[11px] leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity glass-dense"
        style={{ color: '#F5F7FA', boxShadow: '0 18px 44px -16px rgba(0,0,0,0.85)' }}>
        {children}
      </span>
    </span>
  );
}

/**
 * RIEL · la columna angosta que acompaña a un bloque ancho.
 *
 * Todo apilado a lo ancho da una pantalla que se lee como una lista de bandas
 * y obliga a scrollear para comparar dos cosas que se miran juntas. El riel
 * pone al lado del gráfico lo que dice si el gráfico está bien o mal, separado
 * por hairlines en vez de por cajas: una caja dentro de otra caja es ruido.
 */
export function Riel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`tarjeta-pulse p-4 md:p-5 divide-y ${className}`}
      style={{ borderRadius: 'var(--r-panel)', borderColor: 'var(--border)', ['--tw-divide-opacity' as any]: 1 } as any}>
      {children}
    </div>
  );
}

/** Cada tramo del riel: rótulo chico arriba, contenido abajo. */
export function RielTramo({ titulo, derecha, children }: { titulo: React.ReactNode; derecha?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-[11px] uppercase tracking-[0.08em]" style={{ color: '#ADADAD' }}>{titulo}</h3>
        {derecha}
      </div>
      {children}
    </div>
  );
}

/** Tarjeta estándar. attention: borde izquierdo azul para lo que pide acción.
 *  hero: top-highlight luminoso — UNA (máx dos) por vista. */
export function Tarjeta({ children, attention, sinPadding, hero, className = '' }: {
  children: React.ReactNode; attention?: boolean; sinPadding?: boolean; hero?: boolean; className?: string;
}) {
  return (
    <div
      className={`tarjeta-pulse ${hero ? 'tarjeta-hero borde-vivo' : ''} ${sinPadding ? '' : 'p-4 md:p-5'} ${className}`}
      style={{ ['--r' as any]: '16px', ['--p' as any]: '16px', borderRadius: 'var(--r-panel)', ...(attention ? { borderLeft: '2px solid var(--primary)' } : {}) }}
    >
      {children}
    </div>
  );
}

/** Fila de cifras SIN cajas: celdas separadas por hairlines verticales
 *  (estructura de la referencia noir — jerarquía por líneas, no por cajas). */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  const colCls = cols === 5 ? 'md:grid-cols-3 lg:grid-cols-5' : cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 ${colCls} divide-x divide-y md:divide-y-0 [&>*]:px-5 [&>*:first-child]:pl-0 [&>*]:py-1`}
      style={{ borderColor: 'var(--border)', ['--tw-divide-opacity' as any]: 1 } as any}>
      {children}
    </div>
  );
}

/** Cifra con etiqueta, delta con flecha, nota y sparkline. Celda limpia:
 *  label 12px gris sentence case, cifra 24px/500, sin fondo ni borde propio.
 *  Tipos medidos de la referencia (13/9). */
export function Stat({ label, valor, delta, deltaBuenoSiBaja, nota, provisional, spark, heroe }: {
  label: string; valor: React.ReactNode; delta?: number | null; deltaBuenoSiBaja?: boolean; nota?: string; provisional?: boolean; spark?: (number | null)[];
  /** UNA cifra-héroe por vista lleva el gradiente de luz y el glow de su
   *  sparkline; el resto va plano. La firma se protege no repitiéndola. */
  heroe?: boolean;
}) {
  const d = delta == null || isNaN(Number(delta)) ? null : Number(delta);
  const bueno = d == null ? null : (deltaBuenoSiBaja ? d < 0 : d > 0);
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs truncate" style={{ color: '#ADADAD', letterSpacing: '0.3px' }}>{label}</span>
        {d != null && (
          <span className="inline-flex items-center gap-1 text-[11px] tabular shrink-0" style={{ color: bueno ? '#4ADE80' : 'var(--bad)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {d >= 0 ? <path d="M3 17 9 11 13 15 21 7 M15 7h6v6" /> : <path d="M3 7 9 13 13 9 21 17 M15 17h6v-6" />}
            </svg>
            {d > 0 ? '+' : ''}{fmtNum(d, Math.abs(d) < 10 ? 1 : 0)}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div className={`text-2xl font-medium tabular leading-none ${heroe ? 'cifra-luz' : 'text-[#FAFAFA]'}`} style={{ letterSpacing: '-0.6px' }}>{valor}</div>
        {spark && spark.filter(v => v != null).length >= 3 && <Sparkline datos={spark} glow={heroe} />}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1.5 min-h-[14px]">
        {nota && <span className="text-[11px] truncate" style={{ color: '#ADADAD', opacity: 0.85 }}>{nota}</span>}
        {provisional && <span className="text-[10px] shrink-0" style={{ color: '#ADADAD', opacity: 0.7 }} title="Los días recientes maduran: este número todavía se mueve">· madurando</span>}
      </div>
    </div>
  );
}

/** Sparkline mínima: la forma de la serie, nada más. SVG a mano — recharts para
 *  56×16 píxeles es pagar un contenedor responsivo que acá no hace falta. */
function Sparkline({ datos, glow }: { datos: (number | null)[]; glow?: boolean }) {
  const vals = datos.map(v => (v == null || isNaN(Number(v)) ? null : Number(v)));
  const presentes = vals.filter((v): v is number => v != null);
  if (presentes.length < 3) return null;
  const min = Math.min(...presentes), max = Math.max(...presentes);
  const rango = max - min || 1;
  const W = 56, H = 16;
  const pts = vals.map((v, i) => v == null ? null : `${(i / (vals.length - 1)) * W},${H - 1.5 - ((v - min) / rango) * (H - 3)}`).filter(Boolean).join(' ');
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true" style={glow ? { filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.55))' } : undefined}>
      <polyline points={pts} fill="none" stroke={glow ? 'var(--acc-cyan)' : 'rgba(245,247,250,0.55)'} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.85" />
    </svg>
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

/** fetchJSON como hook con caché compartida: dedupe entre componentes que piden
 *  la misma URL, revalidación al volver a la pestaña, y refetchInterval opcional.
 *  Misma semántica de fallback — el que consume nunca ve un error, ve "vacío".
 *  La queryKey ES la URL: una URL, un dato, una entrada de caché. */
export function useJSON<T>(url: string | null, fallback: T, opts?: { refetchMs?: number }): { data: T; refetch: () => void } {
  const q = useQuery({
    queryKey: ['json', url],
    queryFn: () => fetchJSON<T>(url as string, fallback),
    enabled: url != null,
    refetchInterval: opts?.refetchMs,
  });
  return { data: (q.data ?? fallback) as T, refetch: q.refetch };
}

// ================================================================
// COLAPSABLE · un solo patrón para lo plegable
// ================================================================
export function Collapsible({ titulo, resumen, abiertoInicial = false, children }: {
  titulo: React.ReactNode; resumen?: React.ReactNode; abiertoInicial?: boolean; children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <div style={{ borderRadius: 'var(--r-panel)', backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
      <button onClick={() => setAbierto(a => !a)} className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3 text-left">
        <span className="text-[13px] font-medium text-[#EDEFF3]">{titulo}</span>
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
          className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${valor === o.id ? 'bg-[#0062CC] text-[#EDEFF3] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}>
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
            className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${activo === p ? 'bg-[#0062CC] text-[#EDEFF3] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}>
            {LABELS[p] || p}
          </button>
        ))}
        <button onClick={() => { setDDesde(valor.desde); setDHasta(valor.hasta); setAbierto(a => !a); }}
          className={`px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 transition-colors ${!activo ? 'bg-[#0062CC] text-[#EDEFF3] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}>
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
            className="px-2.5 py-1 rounded-md text-[11px] bg-[#0062CC] text-[#EDEFF3] disabled:opacity-40">
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

  // Trazo doble: sólido hasta el último día firme, punteado desde ahí (empalman
  // en ese punto). La banda dice "acá maduran"; el punteado lo dice EN la línea,
  // que es donde el ojo está mirando. Solo líneas y áreas: las barras ya quedan
  // dentro de la banda.
  const { datosPlot, ultimoSolido } = useMemo(() => {
    if (!primeraProvisional || !datos?.length) return { datosPlot: datos, ultimoSolido: null as string | null };
    const previos = datos.filter(d => String(d[xClave]) < String(primeraProvisional));
    const us = previos.length ? String(previos[previos.length - 1][xClave]) : null;
    if (!us) return { datosPlot: datos, ultimoSolido: null };
    const enriquecidos = datos.map(d => {
      const f = String(d[xClave]);
      const extra: any = {};
      for (const s of series) {
        if (s.tipo === 'barra') continue;
        extra[s.clave + '__sol'] = f <= us ? d[s.clave] : null;
        extra[s.clave + '__prov'] = f >= us ? d[s.clave] : null;
      }
      return { ...d, ...extra };
    });
    return { datosPlot: enriquecidos, ultimoSolido: us };
  }, [datos, series, primeraProvisional, xClave]);

  if (!datos?.length) return <Vacio>Sin datos en esta ventana.</Vacio>;

  return (
    <div style={{ width: '100%', height: alto }}>
      <ResponsiveContainer>
        <ComposedChart data={datosPlot} margin={{ top: 8, right: conDerecho ? 4 : 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xClave} tickFormatter={fmtFechaCorta} tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis yAxisId="izq" tickFormatter={(v: number) => series.find(s => !s.ejeDerecho)?.formato === 'moneda' ? fmtMonedaCorta(v, moneda) : fmtNum(v)} tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
          {conDerecho && <YAxis yAxisId="der" orientation="right" tickFormatter={(v: number) => series.find(s => s.ejeDerecho)?.formato === 'moneda' ? fmtMonedaCorta(v, moneda) : fmtNum(v)} tick={{ fill: 'rgba(245,247,250,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />}
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)' }}
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 11, color: '#F5F7FA' }}
            labelFormatter={(l: any) => {
              const esProv = primeraProvisional && String(l) >= String(primeraProvisional);
              return fmtFechaCorta(String(l)) + (esProv ? ' · madurando' : '');
            }}
            formatter={(v: any, nombre: any) => {
              const limpio = String(nombre).replace(' · madurando', '');
              const s = series.find(x => x.nombre === limpio);
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
            const base = { yAxisId: s.ejeDerecho ? 'der' : 'izq', name: s.nombre, stroke: color, strokeWidth: 1.5, dot: false as const, isAnimationActive: false };
            if (s.tipo === 'barra') return <Bar key={s.clave} {...base} dataKey={s.clave} fill={color} fillOpacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={18} />;
            // Sin días provisionales: una sola pieza, como siempre.
            if (!ultimoSolido) {
              if (s.tipo === 'linea') return <Line key={s.clave} {...base} dataKey={s.clave} type="monotone" />;
              return <Area key={s.clave} {...base} dataKey={s.clave} type="monotone" fill={color} fillOpacity={0.12} />;
            }
            const prov = { ...base, name: s.nombre + ' · madurando', strokeDasharray: '4 3', legendType: 'none' as const };
            if (s.tipo === 'linea') return (
              <React.Fragment key={s.clave}>
                <Line {...base} dataKey={s.clave + '__sol'} type="monotone" />
                <Line {...prov} dataKey={s.clave + '__prov'} type="monotone" />
              </React.Fragment>
            );
            return (
              <React.Fragment key={s.clave}>
                <Area {...base} dataKey={s.clave + '__sol'} type="monotone" fill={color} fillOpacity={0.12} />
                <Area {...prov} dataKey={s.clave + '__prov'} type="monotone" fill={color} fillOpacity={0.05} />
              </React.Fragment>
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
