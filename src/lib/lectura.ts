/**
 * LECTURA · las frases del sistema, calculadas — nunca inventadas.
 *
 * Regla de la casa (docs/investigacion_frontend/00_PLAN_CAPA_LECTURA.md):
 * los hechos los computa la base (plan_lectura); acá SOLO se eligen frases
 * enteras de un catálogo cerrado. Cero LLM, cero parseo del texto del agente,
 * cero concatenación de fragmentos. Una frase nueva = una variante nueva acá,
 * y el switch exhaustivo obliga al compilador a exigirla.
 */

export type EstadoPlan = 'tranquilo' | 'observando' | 'atencion' | 'sin_senal' | 'vencido';

export interface SenalLectura {
  nombre: string;
  grupo: string | null;
  direccion: string;
  umbral: number | null;
  habilita: string | null;
  hoy: 'encendida' | 'apagada' | 'sin_dato';
  racha: number;
  evaluables: number;
  dias_encendida: number;
  dias_sin_dato: number;
  ultimo_valor: number | null;
  ultima_fecha_evaluable: string | null;
  nota_agente: string | null;
}

export interface PlanLectura {
  semana: string;
  dias_transcurridos: number;
  dias_restantes: number;
  evaluables_totales: number;
  estado: 'tranquilo' | 'observando' | 'atencion' | 'sin_senal';
  senales_encendidas_hoy: number;
  senales_persistentes: number;
  senales_sin_dato_hoy: number;
  total_senales: number;
  senales_sin_cruce: number;
  senales: SenalLectura[];
}

const dias = (n: number) => `${n} día${n === 1 ? '' : 's'}`;
const senales = (n: number) => `${n} señal${n === 1 ? '' : 'es'}`;

/** Nombre legible de un indicador técnico. Tabla cerrada; lo desconocido pasa tal cual. */
const NOMBRE_SENAL: Record<string, string> = {
  gasto: 'el gasto', conversiones: 'las conversiones', clics: 'los clics',
  cpc: 'el CPC', ctr: 'el CTR', cpa: 'el CPA', impresiones: 'las impresiones',
  lost_is_budget: 'la cuota perdida por presupuesto', lost_is_rank: 'la cuota perdida por ranking',
  pct_terminos_nuevos: 'los términos nuevos', conv_rate: 'la tasa de conversión',
  cpa_marginal: 'el CPA marginal',
};
export const nombreSenal = (tecnico: string) => NOMBRE_SENAL[tecnico] || tecnico.replace(/_/g, ' ');

export interface LecturaPlan {
  estadoId: EstadoPlan;
  /** ≤ 12 palabras, entidad primero. */
  veredicto: string;
  /** El renglón de acción. Si es texto del agente, `guiaDelAgente` = true. */
  guia: string | null;
  guiaDelAgente: boolean;
  /** van · faltan · quedan, con sin-dato declarado. */
  progreso: string;
  /** Señal que motiva el veredicto (para resaltarla en la lista). */
  senalClave: string | null;
  /** Drift: señales del plan que ningún pulso cruzó. >0 = un agente cambió su formato. */
  aviso: string | null;
}

export function leerPlan(pl: PlanLectura | null, hoyISO: string): LecturaPlan | null {
  if (!pl) return null;

  // Semana terminada: el plan ya no vigila nada; decirlo vale más que fingir estado.
  const finDeSemana = new Date(pl.semana + 'T12:00:00');
  finDeSemana.setDate(finDeSemana.getDate() + 6);
  const vencido = hoyISO > finDeSemana.toISOString().slice(0, 10);

  const persistentes = pl.senales.filter(s => s.hoy === 'encendida' && s.racha >= 2);
  const top = persistentes[0] ?? pl.senales.find(s => s.hoy === 'encendida') ?? null;
  const estadoId: EstadoPlan = vencido ? 'vencido' : pl.estado;

  let veredicto: string;
  let guia: string | null = null;
  let guiaDelAgente = false;

  switch (estadoId) {
    case 'vencido':
      veredicto = 'La semana del plan terminó.';
      guia = 'El lunes la tarea semanal escribe el plan nuevo.';
      break;
    case 'sin_senal':
      veredicto = 'Sin señal todavía: la semana recién empieza.';
      guia = 'Con dos evaluaciones diarias alcanza para leer el plan.';
      break;
    case 'tranquilo':
      veredicto = `Tranquilo: ninguna de las ${senales(pl.total_senales)} está encendida.`;
      guia = null;
      break;
    case 'observando':
      veredicto = top
        ? `Observando: ${nombreSenal(top.nombre)} se encendió, todavía sin persistir.`
        : `Observando: ${senales(pl.senales_encendidas_hoy)} encendida${pl.senales_encendidas_hoy === 1 ? '' : 's'}, todavía sin persistir.`;
      guia = 'Si mañana sigue encendida, pasa a atención.';
      break;
    case 'atencion': {
      const extra = persistentes.length > 1 ? ` (y ${senales(persistentes.length - 1)} más)` : '';
      veredicto = top
        ? `Atención: ${nombreSenal(top.nombre)} lleva ${dias(top.racha)} encendida${extra}.`
        : `Atención: ${senales(pl.senales_persistentes)} persistente${pl.senales_persistentes === 1 ? '' : 's'}.`;
      // La guía ES el "habilita" que escribió el agente en el plan: texto libre,
      // se muestra tal cual y rotulado. Acá no se resume ni se recorta.
      if (top?.habilita) { guia = top.habilita; guiaDelAgente = true; }
      break;
    }
  }

  const sinDato = pl.senales_sin_dato_hoy > 0 ? ` · ${senales(pl.senales_sin_dato_hoy)} sin dato hoy (no es incumplir)` : '';
  const progreso = vencido
    ? `fueron ${dias(pl.dias_transcurridos)} · ${pl.evaluables_totales} evaluaciones${sinDato}`
    : `van ${dias(pl.dias_transcurridos)} de 7 · quedan ${dias(pl.dias_restantes)} · ${pl.evaluables_totales} evaluaciones${sinDato}`;

  const aviso = pl.senales_sin_cruce > 0
    ? `${senales(pl.senales_sin_cruce)} del plan sin cruce con los pulsos: el agente pudo cambiar su formato. Mirá Sistema › Salud.`
    : null;

  return { estadoId, veredicto, guia, guiaDelAgente, progreso, senalClave: top?.nombre ?? null, aviso };
}

/** Si un texto de agente ES un JSON con claves conocidas (titulo/lectura), lo
 *  abre. JSON.parse no es heurística de texto: parsea o no parsea. Cualquier
 *  otro texto pasa INTACTO — jamás se recorta ni se interpreta. Existe porque
 *  algún pulso escribió su hallazgo como JSON y el front lo pegaba crudo. */
export function abrirTextoAgente(texto: string | null | undefined): { titulo: string | null; cuerpo: string | null } {
  const t = (texto || '').trim();
  if (!t) return { titulo: null, cuerpo: null };
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      const j = JSON.parse(t);
      if (j && typeof j === 'object') {
        const titulo = typeof j.titulo === 'string' ? j.titulo : null;
        const cuerpo = [typeof j.lectura === 'string' ? j.lectura : null, typeof j.numeros === 'string' ? j.numeros : null]
          .filter(Boolean).join(' — ') || null;
        if (titulo || cuerpo) return { titulo, cuerpo };
      }
    } catch { /* no era JSON: sigue como texto tal cual */ }
  }
  return { titulo: null, cuerpo: t };
}

/** Color del estado. Texto SIEMPRE acompaña: el color solo refuerza. */
export const COLOR_ESTADO: Record<EstadoPlan, string> = {
  tranquilo: '#4ADE80',
  observando: 'var(--primary-text)',
  atencion: 'var(--warn)',
  sin_senal: 'var(--border-strong)',
  vencido: 'var(--border-strong)',
};

export const ETIQUETA_ESTADO: Record<EstadoPlan, string> = {
  tranquilo: 'Tranquilo',
  observando: 'Observando',
  atencion: 'Atención',
  sin_senal: 'Sin señal',
  vencido: 'Semana cerrada',
};
