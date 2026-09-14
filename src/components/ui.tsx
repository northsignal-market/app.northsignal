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
import { pedirJSON, motivoFallo } from '../lib/red';
// Re-exportadas desde acá porque las vistas ya importan la red de './ui': el
// lugar donde vive el código no tiene por qué ser el lugar donde se pide.
export { pedirJSON, motivoFallo, FalloRed } from '../lib/red';
// Acá vivía `GraficoSerie` y con él la única importación de recharts del arranque.
// No tenía un solo call site: Datos y Semana traen su propio gráfico. Existir sin
// usarse le costaba a la app 417 kB en la primera carga, porque este archivo es
// parte del entry y arrastraba recharts + d3 con él.

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
/**
 * Marco de página: ancho máximo, márgenes y ritmo vertical iguales en toda la app.
 *
 * El tope era 1320px fijo. En un monitor de 1920 eso dejaba 313px sin usar —el 18%
 * del ancho útil— y en uno de 2560, 953px, el 41%. Y no es solo espacio vacío: el
 * contenido que no puede ensancharse se apila hacia abajo, así que el mismo tablero
 * obliga a scrollear más en la pantalla más grande. Al revés de lo que uno espera.
 *
 * Ahora escala por tramos en vez de cortar en seco. El tope existe igual —una línea
 * de texto de 2000px no se lee— pero acompaña la pantalla en vez de ignorarla.
 */
export function PageShell({ titulo, subtitulo, derecha, children }: {
  titulo?: React.ReactNode; subtitulo?: React.ReactNode; derecha?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="px-5 md:px-8 py-6 max-w-[1320px] min-[1680px]:max-w-[1560px] min-[1920px]:max-w-[1760px] min-[2400px]:max-w-[2000px] mx-auto space-y-8">
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
        className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] font-semibold opacity-80 hover:opacity-100 focus:opacity-100 focus:outline-none transition-opacity"
        style={{ border: '1px solid var(--border-strong)', color: '#ADADAD' }}>i</button>
      {/* El `absolute` vuelve a ser una clase. Estuvo un tiempo forzado en el
          style porque `.glass-dense` declaraba `position: relative` para todo
          el que usara ese vidrio y le ganaba a la utilidad: con el globo en
          flujo, sus 280px empujaban el título a otro renglón y lo truncaban.
          Ese `position` hoy está scopeado a `header.glass-dense` y además el
          bloque vive en `@layer components`, así que el markup manda. */}
      <span role="tooltip"
        className="absolute pointer-events-none left-0 top-[19px] z-50 w-[280px] p-2.5 rounded-lg text-[11px] leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity glass-dense"
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
        <h3 className="text-[11px] uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: '#ADADAD' }}>{titulo}</h3>
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

/** El hueco que NO es un vacío: la consulta falló y no se sabe qué hay del otro
 *  lado. Se ve distinto de `Vacio` a propósito — un vacío es un veredicto y esto
 *  es la ausencia de uno. Nunca insinúa un valor: no dice "0", dice "no sé". */
export function Fallo({ motivo, que, onReintentar }: {
  motivo: string;
  /** Qué no se pudo consultar, en minúscula: "las búsquedas nuevas", "el contexto".
   *  La frase es impersonal ("no se pudo consultar…") justamente para que sirva
   *  igual con singular y con plural, sin que cada llamada invente su redacción. */
  que: string;
  onReintentar?: () => void;
}) {
  return (
    <div className="px-3 py-3 rounded-lg text-xs leading-relaxed" style={{ backgroundColor: 'var(--surface-2)', borderLeft: '2px solid var(--warn)' }}>
      <p className="text-[#EDEFF3]">No se pudo consultar {que}. <span className="opacity-70">{motivo}</span></p>
      <p className="text-[11px] text-[#F5F7FA] opacity-60 mt-1">Esto no quiere decir que no haya nada: quiere decir que no se pudo preguntar.</p>
      {onReintentar && (
        <button onClick={onReintentar} className="mt-2 px-2.5 py-1 rounded-md text-[11px] text-[#F5F7FA] hover:bg-white/10 transition-colors" style={{ border: '1px solid var(--border-strong)' }}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// ================================================================
// RED · fetch con auth y guardas, una sola vez
// ================================================================
/** fetch → JSON con el header de auth y las guardas de siempre. Devuelve
 *  `fallback` ante cualquier falla: las vistas deciden qué es "vacío".
 *  Si lo que necesitás es SABER que falló, usá `pedirJSON` o `useJSON`. */
export async function fetchJSON<T>(url: string, fallback: T): Promise<T> {
  try { return await pedirJSON<T>(url); } catch { return fallback; }
}

/** fetchJSON como hook con caché compartida: dedupe entre componentes que piden
 *  la misma URL, revalidación al volver a la pestaña, y refetchInterval opcional.
 *  La queryKey ES la URL: una URL, un dato, una entrada de caché.
 *
 *  `data` sigue siendo el fallback cuando no hay respuesta —eso no cambió, y por
 *  eso los consumidores viejos siguen andando—, pero ahora el hueco viene con su
 *  causa al lado: `cargando` (todavía no sé), `error` (no pude preguntar) o
 *  ninguno de los dos (pregunté, y esto es lo que hay). Confundir los tres lleva
 *  a veredictos opuestos, así que un vacío sin consultar `error` es un vacío que
 *  todavía no se sabe leer.
 *
 *  Sin reintentos a propósito: el default global son 2, y con eso el estado de
 *  error tardaba segundos en aparecer mientras la pantalla afirmaba un vacío. */
export function useJSON<T>(url: string | null, fallback: T, opts?: {
  refetchMs?: number;
  /** Cuánto vale la respuesta cacheada. Por defecto manda el global (60 s).
   *  `staleMs: 0` = siempre fresco al montar, para las lecturas que autorizan
   *  una escritura: una caché de un minuto ahí es un minuto de dato viejo
   *  decidiendo sobre la cuenta real. */
  staleMs?: number;
}): {
  data: T;
  refetch: () => void;
  /** Motivo de la falla, listo para imprimir. null si la última consulta salió bien. */
  error: string | null;
  /** Primera consulta sin respuesta todavía. Con `url` null nunca está cargando. */
  cargando: boolean;
} {
  const q = useQuery({
    queryKey: ['json', url],
    queryFn: () => pedirJSON<T>(url as string),
    enabled: url != null,
    refetchInterval: opts?.refetchMs,
    staleTime: opts?.staleMs,
    retry: false,
  });
  return {
    data: (q.data ?? fallback) as T,
    refetch: q.refetch,
    error: q.isError ? motivoFallo(q.error) : null,
    cargando: url != null && q.isPending,
  };
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
/**
 * "Este total no cubre el rango que elegiste."
 *
 * El script diario extrae hasta AYER, así que hasta que corre, el último día del
 * rango no está en la base y el total sale más bajo — sin que nada lo diga. El
 * 14/9/2026 faltaba el 13 de septiembre en las cuatro cuentas: en KAREDO eran
 * 94,56 EUR de 1.806,84, un 5% de diferencia contra Google.
 *
 * Va pegado a la cifra, no al pie: el que lee el número tiene que ver en la misma
 * mirada que no cubre todo. `cobertura` en null significa que no se pudo saber, y
 * eso también se dice: no se asume completa.
 */
export function AvisoCobertura({ cobertura }: {
  cobertura?: { dias_pedidos: number; dias_con_dato: number; completa: boolean; dias_faltantes: string[] } | null;
}) {
  if (cobertura === undefined) return null;            // el endpoint no la manda todavía
  if (cobertura === null) return (
    <p className="text-[11px] text-[#4D9DFF] leading-relaxed">
      No se pudo saber cuántos días del rango tienen dato. El total puede no cubrirlo entero.
    </p>
  );
  if (cobertura.completa) return null;
  const f = cobertura.dias_faltantes;
  return (
    <p className="text-[11px] text-[#4D9DFF] leading-relaxed">
      Estas cifras suman <strong>{cobertura.dias_con_dato} de los {cobertura.dias_pedidos} días</strong> del
      rango. {f.length === 1 ? `Falta el ${f[0]}` : `Faltan ${f.length} días: ${f.slice(0, 5).join(', ')}${f.length > 5 ? '…' : ''}`}.
      {' '}No es que no hubo gasto: es que ese día todavía no se extrajo.
    </p>
  );
}

/** Filtro segmentado: una opción activa, estilo píldora. */
/** `opciones` va readonly para que el llamador pueda pasarlo `as const` y los `id`
 *  entren como literales: así T queda en la unión real y no en `string`, y agregar
 *  una opción que el estado no contempla da error de tipos en vez de pasar callado. */
export function Chips<T extends string>({ opciones, valor, onChange }: {
  opciones: readonly { id: T; label: string; title?: string }[]; valor: T; onChange: (v: T) => void;
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
          <span className="text-[11px] text-[#F5F7FA] opacity-60">→</span>
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
      <span className="text-[10px] text-[#F5F7FA] opacity-60 tabular whitespace-nowrap">
        {fueraDeVentana && abierto
          ? `La tabla diaria guarda desde el ${fmtFechaCorta(minDesde!)}: antes de eso no hay dato, habría un hueco.`
          : `${fmtFechaCorta(valor.desde)} – ${fmtFechaCorta(valor.hasta)}${nota ? ` · ${nota}` : ''}`}
      </span>
    </div>
  );
}
