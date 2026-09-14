import React from 'react';

/**
 * GRÁFICOS PULSE · las formas nuevas del informe 13, hechas a mano.
 * Cada una existe para UNA oración; si la oración no se puede escribir,
 * el gráfico no va. Estética común: series desaturadas 20-30%, halo con
 * blur DEBAJO y el dato nítido encima, radios ≤3px en barras de datos.
 * El cyan es "dato en foco", nunca "bien".
 */

const LABEL = { color: '#ADADAD', letterSpacing: '0.3px' } as const;

// Franjas del impression share. Suman 100: lo que se ganó, lo que se perdió
// por plata y lo que se perdió por calidad. Desaturadas para dark (informe 13 §6).
export const IS_COLORES = {
  ganado: 'rgba(77, 157, 255, 0.72)',
  budget: 'rgba(226, 180, 83, 0.66)',
  rank: 'rgba(245, 247, 250, 0.30)',
} as const;

/** Una franja ausente NO es cero: `null` significa "no se midió". Google no
 *  reporta impression share perdido con poco volumen, y repartir ese hueco
 *  entre las franjas que sí vinieron es afirmar que se ganó lo que nadie midió. */
const franjaValida = (v: number | null | undefined): number | null =>
  (v == null || !isFinite(Number(v)) ? null : Math.max(0, Number(v)));

// Lo no medido se raya, no se pinta: una textura que no se confunde con una serie.
const RAYADO = 'repeating-linear-gradient(45deg, rgba(245,247,250,0.20) 0 3px, rgba(245,247,250,0.05) 3px 6px)';

/** Mediana de verdad sobre una lista YA ordenada: con n par es el promedio del
 *  par central, no el valor de arriba. Importa porque esta cifra es la raya de
 *  referencia del barcode Y el umbral del ×1.5 que decide quién se salió de la
 *  manada: quedarse con el mayor corría el umbral hacia arriba y tapaba casos.
 *  La exporta para que quien calcula el umbral use exactamente la misma. */
export const medianaDe = (ordenados: number[]): number | null => {
  const n = ordenados.length;
  if (!n) return null;
  return n % 2 ? ordenados[(n - 1) / 2] : (ordenados[n / 2 - 1] + ordenados[n / 2]) / 2;
};

/** Barra horizontal apilada al 100%. La oración: "de cada 100 impresiones
 *  posibles, ganó X, perdió Y por presupuesto y Z por ranking".
 *  Si falta alguna franja el eje deja de ser la suma de las partes y pasa a ser
 *  el 0-100 real: lo que falta queda rayado en vez de estirar lo conocido. */
export function BarraApilada100({ partes, alto = 10 }: {
  partes: { valor: number | null | undefined; color: string; titulo?: string }[]; alto?: number;
}) {
  const vals = partes.map(p => franjaValida(p.valor));
  const faltan = partes.filter((_, i) => vals[i] == null);
  const suma = vals.reduce((s: number, v) => s + (v ?? 0), 0);
  if (vals.every(v => v == null)) return <div className="text-[10px]" style={LABEL}>sin dato</div>;
  if (suma <= 0) return <div className="text-[10px]" style={LABEL}>{faltan.length ? 'sin dato' : '—'}</div>;
  // Con alguna franja en null el denominador es 100 (o la suma, si se pasó por
  // el promedio sin ponderar de la vista), nunca la suma de lo que sí vino.
  const total = faltan.length ? Math.max(100, suma) : suma;
  const hueco = total - suma;
  const tituloHueco = `sin dato: ${faltan.map(p => p.titulo).filter(Boolean).join(' · ') || 'franja no reportada'}`;
  const ultima = vals.reduce((acc: number, v, i) => (v == null ? acc : i), -1);
  return (
    <div className="w-full flex overflow-hidden" style={{ height: alto, borderRadius: 3, backgroundColor: 'var(--surface-2)' }}>
      {partes.map((p, i) => vals[i] == null ? null : (
        <div key={i} title={p.titulo}
          style={{ width: `${(vals[i]! / total) * 100}%`, backgroundColor: p.color, borderRight: (i < ultima || hueco > 0) ? '1px solid var(--navy)' : undefined }} />
      ))}
      {hueco > 0 && (
        <div title={tituloHueco} style={{ width: `${(hueco / total) * 100}%`, backgroundImage: RAYADO }} />
      )}
    </div>
  );
}

/** Columnas apiladas 100% por semana: la evolución de las tres franjas.
 *  La oración: "lo perdido por presupuesto viene creciendo (o no)". */
export function ColumnasApiladas100({ semanas, alto = 96 }: {
  semanas: { etiqueta: string; partes: { valor: number | null | undefined; color: string }[]; titulo?: string }[]; alto?: number;
}) {
  if (!semanas.length) return null;
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: alto }}>
        {semanas.map((s, i) => {
          // Mismo criterio que la barra: una franja en null no se reparte entre
          // las otras. Si falta alguna, la columna se mide sobre 100 y el resto
          // queda rayado — "no reportado" tiene que verse distinto de "cero".
          const vals = s.partes.map(p => franjaValida(p.valor));
          const suma = vals.reduce((a: number, v) => a + (v ?? 0), 0);
          const faltan = vals.some(v => v == null);
          const total = faltan ? Math.max(100, suma) : suma;
          return (
            <div key={i} title={s.titulo} className="flex-1 min-w-0 h-full flex flex-col overflow-hidden" style={{ borderRadius: 2 }}>
              {suma <= 0 ? <div className="h-full" style={{ border: '1px dashed var(--border)', borderRadius: 2 }} title={`${s.etiqueta}: sin datos`} /> : (<>
                {faltan && <div style={{ height: `${((total - suma) / total) * 100}%`, backgroundImage: RAYADO }} title={`${s.etiqueta}: parte de la semana sin dato`} />}
                {s.partes.map((p, k) => vals[k] == null ? null : (
                  <div key={k} style={{ height: `${(vals[k]! / total) * 100}%`, backgroundColor: p.color, borderTop: (faltan || k > vals.findIndex(v => v != null)) ? '1px solid var(--navy)' : undefined }} />
                ))}
              </>)}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[9px] tabular" style={LABEL}>
        <span>{semanas[0].etiqueta}</span>
        <span>{semanas[semanas.length - 1].etiqueta}</span>
      </div>
    </div>
  );
}

/** Barcode / strip: cada raya un ítem sobre un eje común. La oración:
 *  "¿este local está fuera de su manada?" — los pares en gris, el que se
 *  salió en cyan con su nombre. La mediana es la raya de referencia. */
export function Barcode({ items, formato, alto = 30 }: {
  items: { id: string; valor: number; foco?: boolean; titulo?: string }[];
  formato: (v: number) => string; alto?: number;
}) {
  const dibujables = items.filter(i => i.valor != null && isFinite(Number(i.valor)));
  const vals = dibujables.map(i => Number(i.valor));
  if (vals.length < 2) return <div className="text-[10px]" style={LABEL}>—</div>;
  const min = Math.min(...vals), max = Math.max(...vals);
  const orden = [...vals].sort((a, b) => a - b);
  const mediana = medianaDe(orden) as number; // con 2+ valores nunca es null
  const span = max - min || 1;
  // Margen del 4% a cada lado para que las rayas extremas no se corten.
  const x = (v: number) => 4 + ((v - min) / span) * 92;
  return (
    <div>
      <div className="relative w-full" style={{ height: alto, backgroundColor: 'var(--surface-2)', borderRadius: 3 }}>
        <div className="absolute top-0 bottom-0" title={`mediana ${formato(mediana)}`}
          style={{ left: `${x(mediana)}%`, width: 1, backgroundColor: 'rgba(245,247,250,0.28)' }} />
        {dibujables.map(it => (
          <div key={it.id} title={it.titulo}
            className="absolute"
            style={{
              left: `${x(it.valor)}%`, top: 4, bottom: 4, width: 2, borderRadius: 1,
              backgroundColor: it.foco ? 'var(--acc-cyan)' : 'rgba(245,247,250,0.45)',
              // Halo debajo, dato nítido encima: el glow solo en el que se salió.
              boxShadow: it.foco ? '0 0 7px rgba(34, 211, 238, 0.55)' : undefined,
              zIndex: it.foco ? 2 : 1,
            }} />
        ))}
      </div>
      <div className="flex justify-between mt-0.5 text-[9px] tabular" style={LABEL}>
        <span>{formato(min)}</span>
        <span style={{ opacity: 0.7 }}>mediana {formato(mediana)}</span>
        <span>{formato(max)}</span>
      </div>
    </div>
  );
}

/** Bullet: barra = lo real, banda = el rango predicho, tick = el centro del
 *  rango. La oración: "la semana viene dentro (o fuera) de lo predicho". */
export function Bullet({ real, min, max, formato }: {
  real: number | null; min: number; max: number; formato: (v: number) => string;
}) {
  // Dominio desde cero: magnitudes. El techo deja aire para un real pasado del rango.
  const techo = Math.max(max, real ?? 0) * 1.12 || 1;
  const x = (v: number) => Math.min(100, Math.max(0, (v / techo) * 100));
  const centro = (min + max) / 2;
  const fuera = real != null && (real < min || real > max);
  return (
    <div className="relative w-full" style={{ height: 18 }}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: 12, borderRadius: 3, backgroundColor: 'var(--surface-2)' }} />
      <div className="absolute top-1/2 -translate-y-1/2" title={`rango predicho ${formato(min)} – ${formato(max)}`}
        style={{ left: `${x(min)}%`, width: `${Math.max(0.5, x(max) - x(min))}%`, height: 12, borderRadius: 2, backgroundColor: 'rgba(0, 98, 204, 0.30)' }} />
      <div className="absolute top-1/2 -translate-y-1/2" title={`centro del rango ${formato(centro)}`}
        style={{ left: `${x(centro)}%`, width: 1.5, height: 16, backgroundColor: 'rgba(245,247,250,0.75)' }} />
      {real != null && (
        <div className="absolute top-1/2 -translate-y-1/2" title={`real ${formato(real)}`}
          style={{
            left: 0, width: `${Math.max(0.8, x(real))}%`, height: 5, borderRadius: 2,
            backgroundColor: fuera ? 'var(--warn)' : '#4D9DFF',
            boxShadow: fuera ? 'none' : '0 0 6px rgba(77, 157, 255, 0.4)',
          }} />
      )}
    </div>
  );
}

/** Gauge radial de ticks: SOLO pacing de presupuesto mensual — una meta,
 *  0-100%, un vistazo (el único uso honesto del radial, informe 13 §2a).
 *  La marca blanca es "hoy": dónde debería estar el consumo a la fecha. */
export function GaugeTicks({ consumidoPct, esperadoPct, size = 124 }: {
  consumidoPct: number; esperadoPct: number; size?: number;
}) {
  const N = 40, SWEEP = 270, DESDE = 135; // de las 7:30 a las 4:30, como un velocímetro
  const c = size / 2;
  const pasado = consumidoPct > 100;
  const visible = Math.min(100, Math.max(0, consumidoPct));
  const encendidos = Math.round((visible / 100) * N);
  const desvio = consumidoPct - esperadoPct;
  const colorOn = pasado || desvio > 12 ? 'var(--warn)' : desvio < -18 ? 'rgba(245,247,250,0.55)' : '#4D9DFF';
  const tick = (i: number, r1: number, r2: number) => {
    const a = ((DESDE + (i / (N - 1)) * SWEEP) * Math.PI) / 180;
    return { x1: c + r1 * Math.cos(a), y1: c + r1 * Math.sin(a), x2: c + r2 * Math.cos(a), y2: c + r2 * Math.sin(a) };
  };
  const iEsperado = Math.round((Math.min(100, Math.max(0, esperadoPct)) / 100) * (N - 1));
  const e = tick(iEsperado, c * 0.62, c * 0.98);
  return (
    <svg width={size} height={size} role="img" aria-label={`Consumido ${consumidoPct}% del presupuesto; esperado a hoy ${esperadoPct}%`}>
      {/* Halo debajo: una sola pasada difusa; los ticks nítidos van encima. */}
      {encendidos > 0 && !pasado && (
        <g style={{ filter: 'blur(4px)', opacity: 0.35 }}>
          {Array.from({ length: encendidos }, (_, i) => { const t = tick(i, c * 0.7, c * 0.92); return <line key={i} {...t} stroke={colorOn} strokeWidth={2.6} strokeLinecap="round" />; })}
        </g>
      )}
      {Array.from({ length: N }, (_, i) => {
        const t = tick(i, c * 0.7, c * 0.92);
        return <line key={i} {...t} stroke={i < encendidos ? colorOn : 'var(--surface-3)'} strokeWidth={2.6} strokeLinecap="round" />;
      })}
      <line {...e} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.9}>
        <title>{`esperado a hoy: ${esperadoPct}%`}</title>
      </line>
      <text x={c} y={c - 2} textAnchor="middle" fontSize={size * 0.19} fontWeight={500}
        fill={pasado ? 'var(--warn)' : '#FAFAFA'} style={{ letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
        {consumidoPct}%
      </text>
      <text x={c} y={c + size * 0.11} textAnchor="middle" fontSize={8.5} fill="#ADADAD" letterSpacing="0.3">
        esperado {esperadoPct}%
      </text>
    </svg>
  );
}
