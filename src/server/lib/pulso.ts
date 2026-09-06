/**
 * PULSO DIARIO · Sonnet 5
 * ----------------------------------------------------------------------------
 * El ciclo rápido del sistema. Cada mañana lee el plan que Opus 5 escribió el
 * lunes y reporta EVIDENCIA contra él: un valor por indicador, si cumple el
 * umbral, cuántos días seguidos. Detecta hallazgos con cobertura (no filtra);
 * el filtro a accionable lo hace SQL en filtrar_hallazgos_a_accionables().
 *
 * Reglas de la API (doc oficial de Sonnet 5, sep 2026):
 *  - effort: 'medium' (≈ Sonnet 4.6 high). A medium acota su trabajo a lo pedido.
 *  - sin temperature/top_p: devuelven 400.
 *  - adaptive thinking on por defecto; max_tokens con margen porque cuenta.
 *  - salida estructurada con zodOutputFormat: parsed_output ya validado.
 *  - la respuesta se lee por tipo de bloque, no por posición.
 *  - separar detección de filtrado: el prompt pide cobertura con confianza.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Precio Sonnet 5, permanente desde el 10 ago 2026
const PRECIO_IN = 2 / 1e6, PRECIO_OUT = 10 / 1e6;

export const PulsoSchema = z.object({
  nivel: z.enum(['normal', 'atencion', 'critico']),
  resumen: z.string().describe('3 a 5 líneas en español. La primera dice qué pasó.'),
  hallazgo_principal: z.string().nullable(),
  conecta_con: z.string().nullable().describe('Patrón anterior al que se parece, o null'),
  evidencia: z.array(z.object({
    nombre: z.string(),
    grupo: z.string().nullable(),
    valor: z.number().nullable(),
    umbral: z.number(),
    direccion: z.enum(['sube', 'baja', 'cruza']),
    cumple: z.boolean(),
    tendencia_3d: z.enum(['sube', 'baja', 'plana', 'sin_datos']),
    dias_seguidos_cumpliendo: z.number().int().min(0),
    nota: z.string().nullable().describe('Una línea si hay algo que decir sobre este indicador hoy')
  })).describe('Un objeto por cada indicador del plan, en el mismo orden'),
  hipotesis_movidas: z.array(z.object({
    id: z.string(),
    movimiento: z.enum(['confirma', 'descarta', 'sin_cambio']),
    evidencia_texto: z.string()
  })),
  hallazgos: z.array(z.object({
    titulo: z.string().describe('Como acción: "Pausar X", "Revisar Y", no como problema'),
    severidad: z.enum(['baja', 'media', 'alta', 'critica']),
    confianza: z.number().min(0).max(1),
    entidad: z.string().describe('Campaña, grupo, keyword o término con nombre exacto'),
    evidencia_texto: z.string().describe('Los números que lo sostienen, con fechas'),
    naturaleza: z.enum(['observacion', 'inferencia', 'hipotesis'])
  })).describe('Cobertura completa: todo lo que encontraste, incluso con confianza baja. No filtres.')
});
export type PulsoOut = z.infer<typeof PulsoSchema>;

export interface PulsoResultado {
  cuenta: string; fecha: string; nivel?: string; hallazgo?: string | null;
  tokens_in: number; tokens_out: number; costo_usd: number; error?: string; parsed?: PulsoOut;
}

export function pulsoDisponible(): boolean { return !!anthropic; }

export async function correrPulso(cuenta: string, fecha: string, input: any, reglasCuenta: string): Promise<PulsoResultado> {
  if (!anthropic) return { cuenta, fecha, tokens_in: 0, tokens_out: 0, costo_usd: 0, error: 'ANTHROPIC_API_KEY no configurada' };

  const plan = input?.plan;
  const sinPlan = !plan;

  const system = `Sos el analista diario de la cuenta de Google Ads ${cuenta}. Sos el ciclo rápido de un sistema de dos ciclos: el lunes, un analista semanal escribió un PLAN con indicadores a vigilar, umbrales, hipótesis y condiciones de escalamiento. Tu trabajo es reportar EVIDENCIA contra ese plan para el día ${fecha}, no reinterpretar la estrategia.

REGLAS DE LA CUENTA (no negociables):
${reglasCuenta}

PRINCIPIOS:
- Lo observado se escribe como hecho; lo inferido como hipótesis con qué lo confirmaría.
- Una discrepancia no es hallazgo hasta descartar operador, reloj y configuración. Si operator_log o cambios_google explican el movimiento, decilo.
- Los días provisionales (madurez ≠ consolidado) no sostienen conclusiones sobre conversiones.
- Ante un deterioro, mirá primero conv_por_grupo: ¿es un grupo o toda la cuenta?
- Una caída de volumen (impresiones, clics) y una caída de tasa (conv_rate) son dos preguntas con dos causas posibles.
- Si pulsos_previos ya señalaron lo mismo, decí que continúa y contá los días; no lo presentes como nuevo.
- Con 1 conversión/día de promedio, un día en cero es normal. Lo dice el plan.
- Fechas explícitas siempre.
- Con lo leading se dirige; con lo lagging se califica. No alertes por CPA de un día.

SOBRE EVIDENCIA: por cada indicador del plan, un objeto con el valor de hoy (de leading_7d o grupos_ayer según corresponda), si cumple el umbral en la dirección indicada, la tendencia de 3 días, y cuántos días seguidos lo viene cumpliendo (contando pulsos_previos). Si el indicador es conv_rate_grupo, el valor sale de grupos_ayer para ese grupo.

SOBRE HALLAZGOS: reportá todo lo que encontrás, incluidos los de confianza baja o severidad baja. No decidas qué importa: un filtro posterior lo hace con umbrales. Tu trabajo es cobertura. Cada hallazgo con entidad nombrada exacta y los números que lo sostienen. Severidad critica solo si: cambio automático de Google, primaria sin datos con gasto normal, o gasto sin conversión sobre el CPA máximo en un grupo que antes convertía.

SOBRE NIVEL: critico si hay un hallazgo critica con confianza ≥ 0,8. atencion si alguna condición del plan lleva 2+ días cumpliéndose o hay un hallazgo alta con confianza ≥ 0,7. normal en cualquier otro caso.
${sinPlan ? '\nNO HAY PLAN para esta semana. Reportá evidencia sobre los cuatro indicadores base (clics, conv_rate, cpc, lost_is_budget) con umbrales de la mediana de los 7 días, y marcá en el resumen que falta el plan.' : ''}`;

  const user = `DATOS DEL ${fecha}:\n${JSON.stringify(input)}`;

  try {
    const msg = await anthropic.messages.parse({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'medium', format: zodOutputFormat(PulsoSchema) }
    });
    const parsed = msg.parsed_output;
    if (!parsed) throw new Error('Sin parsed_output: ' + (msg.stop_reason || 'desconocido'));
    const tin = msg.usage.input_tokens || 0;
    const tout = msg.usage.output_tokens || 0;
    return { cuenta, fecha, nivel: parsed.nivel, hallazgo: parsed.hallazgo_principal, tokens_in: tin, tokens_out: tout, costo_usd: tin * PRECIO_IN + tout * PRECIO_OUT, parsed };
  } catch (e: any) {
    return { cuenta, fecha, tokens_in: 0, tokens_out: 0, costo_usd: 0, error: e.message };
  }
}
