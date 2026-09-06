/**
 * ASISTENTE DE LA APP · Sonnet 5 con herramientas
 * ----------------------------------------------------------------------------
 * Responde preguntas sobre la app (dónde está qué, qué significa X, qué hago
 * con este accionable) y sobre las cuentas (cómo va Karedo, qué dice el plan),
 * consultando Supabase con herramientas en vez de inventar.
 *
 * Reglas de la doc oficial: el contexto grande va en el primer turno de usuario,
 * no en el system; herramientas con schema estricto y descripción precisa;
 * effort bajo porque es conversación, no análisis.
 */
import Anthropic from '@anthropic-ai/sdk';
import { GLOSARIO } from '../../lib/glosario';

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const MAPA_APP = `
SECCIONES DE LA APP (menú izquierdo, tres grupos):
- Operar: Inicio (resumen de las tres cuentas al entrar), Hoy (lo que pasó ayer, plan de la semana, accionables que esperan tu criterio, pulso intradía), Accionables (todos, con filtros; al abrir uno ves Por qué, Cómo hacerlo con pasos en Google Ads, y podés marcarlo Hecho), Semana (gráfico de 14 días con lentes gasto/CPA, conversiones/clics, CTR/CPC; rango 7, 14 o fechas a elección; conversiones por grupo; mapa de calor hora×día; qué encontró el análisis diario cada día; búsquedas nuevas que gastan sin convertir o que convierten; cambios en la cuenta colapsados).
- Entender: Briefs (el análisis semanal completo que escribe la tarea del lunes, con handoff y lecciones), Datos (tablas por campaña, grupo, keyword, término con cualquier rango de fechas; exportar PDF), Clientes (memoria de cada cuenta: ficha, objetivos, escalera de valor, decisiones estructurales, reportes al cliente para aprobar, doc maestro editable).
- Mantener: Herramientas (RSA Factory para escribir anuncios desde términos que convierten; playbook), Sistema (salud de datos, calidad de cada análisis, aprendizaje, alertas, tickets, bitácora de cambios que hiciste a mano).
- Arriba: selector de cuenta (Karedo, BHI, 360). Casi todo responde a la cuenta seleccionada. Cmd+K abre la paleta para saltar a cualquier lado.

CÓMO FUNCIONA EL SISTEMA: scripts en Google Ads extraen a Supabase (diario 6:00, semanal lunes 7:00). Cada mañana 6:45 Sonnet 5 lee el día anterior contra el plan de la semana y escribe el pulso. Cada lunes Opus 5 en Cowork analiza la semana, escribe el brief, accionables, reporte al cliente y el plan siguiente. Andrés ejecuta los accionables en Google Ads y aprueba los reportes. Nada cambia en Google Ads sin que él lo haga.

REGLAS DE ESTADO DE ACCIONABLES: Propuesto = listo para ejecutar. Bloqueado = es una deducción, espera confirmación de Andrés. Hecho = ejecutado, con fecha. Descartado = decidió no hacerlo. Naturaleza: Observación (dato visto), Inferencia (deducido), Hipótesis (explicación posible).
`;

const TOOLS: Anthropic.Tool[] = [
  { name: 'estado_cuenta', description: 'Resumen actual de una cuenta: veredicto de headroom, CPA de 7 y 14 días, conversiones, plan de la semana vigente, último pulso diario. Usar cuando pregunten "cómo va X" o "qué dice el plan de X".', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ['KAREDO', 'BHI', '360'] } }, required: ['cuenta'] } },
  { name: 'accionables_abiertos', description: 'Lista los accionables Propuestos y Bloqueados de una cuenta con título, prioridad, naturaleza y por qué. Usar cuando pregunten qué hay pendiente o qué hacer.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ['KAREDO', 'BHI', '360'] } }, required: ['cuenta'] } },
  { name: 'salud_datos', description: 'Estado de los datos: última extracción, semana disponible, integridad, crons. Usar cuando pregunten si los datos están al día o por qué falta algo.', input_schema: { type: 'object', properties: {} } },
  { name: 'doc_maestro', description: 'Devuelve una sección del doc maestro de una cuenta: identidad, objetivos, restricciones, descartado, reporte, riesgos, vacios. Usar para preguntas sobre el cliente, sus reglas o su historia.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ['KAREDO', 'BHI', '360'] }, seccion: { type: 'string', enum: ['identidad', 'objetivos', 'restricciones', 'descartado', 'reporte', 'riesgos', 'vacios'] } }, required: ['cuenta', 'seccion'] } },
];

export async function responderAsistente(supabase: any, mensajes: { role: 'user' | 'assistant'; content: string }[], contexto: { pagina?: string; cuenta?: string }) {
  if (!anthropic) return { texto: 'El asistente necesita ANTHROPIC_API_KEY en Vercel.', costo_usd: 0 };
  const glosarioTxt = Object.entries(GLOSARIO).map(([k, v]) => `${k}: ${v}`).join('\n');
  const primerTurno = `CONTEXTO DE LA APP NORTHSIGNAL (leelo antes de responder)\n${MAPA_APP}\nGLOSARIO:\n${glosarioTxt}\n\nAHORA MISMO: el usuario está en la sección "${contexto.pagina || 'desconocida'}" con la cuenta ${contexto.cuenta || 'sin seleccionar'}.\n\nCÓMO RESPONDÉS: en español rioplatense, corto, directo, sin guion largo, sin listas de tres forzadas. Si la pregunta es sobre datos de una cuenta, usá las herramientas; nunca inventes un número. Si es sobre dónde está algo en la app, decí la sección y qué hacer. Si es sobre un término, usá el glosario. Si no sabés, decilo y sugerí crear un ticket desde Sistema.\n\nPREGUNTA: ${mensajes[mensajes.length - 1]?.content || ''}`;
  const historial = mensajes.slice(0, -1).map(m => ({ role: m.role, content: m.content })) as Anthropic.MessageParam[];
  const msgs: Anthropic.MessageParam[] = [...historial, { role: 'user', content: primerTurno }];

  let costo = 0; let vueltas = 0;
  while (vueltas++ < 4) {
    const res = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 1500, system: 'Sos el asistente de NorthSignal, la app de operación de cuentas de Google Ads de Andrés. Ayudás a navegar la app y a entender los datos. No ejecutás cambios.', messages: msgs, tools: TOOLS, output_config: { effort: 'low' } as any });
    costo += (res.usage.input_tokens || 0) * 2 / 1e6 + (res.usage.output_tokens || 0) * 10 / 1e6;
    const toolUses = res.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
    if (!toolUses.length || res.stop_reason !== 'tool_use') {
      const texto = res.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('\n').trim();
      return { texto, costo_usd: costo };
    }
    msgs.push({ role: 'assistant', content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      let out: any;
      try {
        const inp: any = tu.input;
        if (tu.name === 'estado_cuenta') {
          const [h, s7, plan, pulso] = await Promise.all([
            supabase.from('v_headroom').select('*').eq('account', inp.cuenta).maybeSingle(),
            supabase.from('v_serie_diaria').select('date,gasto,conversiones,cpa,madurez').eq('account', inp.cuenta).order('date', { ascending: false }).limit(14),
            supabase.from('plan_semanal').select('semana,contexto,indicadores,hipotesis').eq('account', inp.cuenta).order('semana', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('pulso_diario').select('fecha,nivel,hallazgo_principal,resumen').eq('account', inp.cuenta).order('fecha', { ascending: false }).limit(1).maybeSingle(),
          ]);
          const d = s7.data || []; const sum = (arr: any[], k: string) => arr.reduce((a, r) => a + Number(r[k] || 0), 0);
          const c7 = d.slice(0, 7), c14 = d;
          out = { headroom: h.data, ultimos_7d: { gasto: sum(c7, 'gasto'), conversiones: sum(c7, 'conversiones'), cpa: sum(c7, 'conversiones') ? sum(c7, 'gasto') / sum(c7, 'conversiones') : null }, ultimos_14d: { gasto: sum(c14, 'gasto'), conversiones: sum(c14, 'conversiones'), cpa: sum(c14, 'conversiones') ? sum(c14, 'gasto') / sum(c14, 'conversiones') : null }, plan: plan.data, ultimo_pulso: pulso.data };
        } else if (tu.name === 'accionables_abiertos') {
          out = { nota: 'Los accionables viven en Notion; la app los muestra en Accionables. Filtrá por cuenta ahí.', cuenta: inp.cuenta };
        } else if (tu.name === 'salud_datos') {
          const [dh, integ, snaps] = await Promise.all([supabase.from('v_data_health').select('*'), supabase.from('v_integridad_conversiones').select('*').limit(5), supabase.from('v_snapshots_disponibles').select('*')]);
          out = { data_health: dh.data, descuadres: integ.data, snapshots: snaps.data };
        } else if (tu.name === 'doc_maestro') {
          const r = await supabase.from('doc_maestro_humano').select('contenido').eq('account', inp.cuenta).eq('seccion', inp.seccion).eq('vigente', true).maybeSingle();
          out = r.data?.contenido || 'Sección vacía.';
        } else out = { error: 'herramienta desconocida' };
      } catch (e: any) { out = { error: e.message }; }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: typeof out === 'string' ? out : JSON.stringify(out).slice(0, 6000) });
    }
    msgs.push({ role: 'user', content: results });
  }
  return { texto: 'No pude cerrar la respuesta en cuatro pasos. Probá una pregunta más acotada.', costo_usd: costo };
}
