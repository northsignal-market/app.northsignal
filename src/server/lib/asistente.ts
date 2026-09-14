/**
 * ASISTENTE DE LA APP · Sonnet 5 con herramientas
 * ----------------------------------------------------------------------------
 * Responde preguntas sobre la app (dónde está qué, qué significa X, qué hago
 * con este accionable) y sobre las cuentas (cómo va Karedo, qué dice el plan),
 * consultando Supabase con herramientas en vez de inventar.
 *
 * Reglas de la doc oficial: el contexto grande va en el primer turno de usuario,
 * no en el system; herramientas con schema estricto y descripción precisa;
 * effort ALTO (8 sep 2026). Antes decía "effort bajo porque es conversación, no análisis",
 * y para una consulta suelta era cierto. Pero acá se le preguntan cosas de criterio sobre
 * cuatro cuentas con reglas distintas, y el esfuerzo es justo lo que decide qué herramienta
 * llamar, cuántas encadenar y cómo leer un vacío explicado.
 * high es el DEFAULT de la API: ponerlo se comporta igual que no poner el parámetro.
 *
 * CUIDADO SI ALGUIEN LO VUELVE A TOCAR: el razonamiento y el texto comparten max_tokens.
 * Subir el esfuerzo sin subir max_tokens corta la respuesta a la mitad, y el síntoma es
 * "no devolvió JSON" o una respuesta trunca, que manda a buscar al lugar equivocado.
 * Pasó el 8 de septiembre con el generador de RSA: 4000 tokens, 39 segundos y JSON cortado.
 * Los dos parámetros se mueven juntos o no se mueven.
 */
import Anthropic from '@anthropic-ai/sdk';
import { GLOSARIO } from '../../lib/glosario';
import { NOTION_PRIORITIES } from '../domain/notionSchema';

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Peso real de la prioridad. Ordenar por el texto la ordena alfabéticamente
// (Alta, Baja, Media, Urgente) y deja Urgente ÚLTIMO: con más de un puñado de
// abiertos, los urgentes son los primeros en caerse de la respuesta.
// Es el mismo orden que usa Accionables.tsx, duplicado acá porque aquel vive
// dentro de un componente React que el servidor no puede importar; las
// etiquetas salen de NOTION_PRIORITIES para que no se separen del vocabulario.
const PESO_PRIORIDAD: Record<string, number> = {
  [NOTION_PRIORITIES.URGENTE]: 4,
  [NOTION_PRIORITIES.ALTA]: 3,
  [NOTION_PRIORITIES.MEDIA]: 2,
  [NOTION_PRIORITIES.BAJA]: 1,
};

// Resta días sobre la fecha ISO en UTC: con Date local, un `toISOString()`
// después de las 21:00 de Buenos Aires corre la ventana un día entero.
const menosDias = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - n);
  return t.toISOString().slice(0, 10);
};

const MAPA_APP = `
SECCIONES DE LA APP (menú izquierdo, cinco ítems):
- Bandeja: la pantalla de inicio. Arriba, Novedades: comentarios y ediciones de los agentes en accionables, propuestas nuevas, tickets respondidos, ejecuciones automáticas; se marcan vistas al abrir. Debajo, una cola con lo que espera el criterio de Andrés, en orden: pide acción hoy, listos para ejecutar, esperan confirmación, reportes para aprobar. Cada fila se abre ahí. Cuando está vacía dice "Nada te espera". Debajo, colapsados: ayer en cada cuenta (una línea por cuenta) y qué pasó después (impacto de cambios a 14 días, predicciones acertadas o falladas).
- Cuenta: todo lo de una cuenta, con el selector arriba (Karedo, BHI, 360) y seis pestañas. Semana: gráfico de 14 días con lentes gasto/CPA, conversiones/clics, CTR/CPC; rango 7, 14 o fechas a elección; el plan de la semana con sus indicadores y cuántos días llevan cumpliéndose; qué encontró el análisis diario día por día; colapsados: conversiones por grupo, cuándo convierte (hora y día), búsquedas nuevas, cambios en la cuenta. Diagnóstico: ficha, objetivos y headroom, por qué está donde está (los tres componentes del Quality Score ponderados por gasto), escalera de valor, accionables abiertos, decisiones estructurales. Brief: el análisis completo del lunes con handoff. Accionables: todos, con filtros, incluidos hechos y descartados. Memoria: hipótesis abiertas, aprendizajes, doc maestro editable. Reportes: borradores al cliente para aprobar, editar, ver PDF.
- Datos: tablas por campaña, grupo, keyword, término de búsqueda y conversiones, agrupadas en Por semana, Por día y Diagnóstico; cualquier rango de fechas; exportar PDF.
- Herramientas: RSA Factory (escribir anuncios desde los términos que convierten) y Guía de operación (cómo funciona el ciclo, qué hacer cada lunes, ejecutar un accionable, aprobar un reporte, cuando algo no cuadra).
- Sistema, cuatro grupos: Salud (datos por cuenta, integridad, tamaño); Aprendizaje (calidad de cada análisis, qué pasó después de cada accionable, reflexiones, quién escribe qué y lo que el reconciliador corrigió); Automatización (alertas, ejecuciones aprobadas, cambios de configuración); Soporte (tickets para Claude, bitácora de lo que Andrés cambió a mano, ajustes).
- Cmd+K abre la paleta para saltar a cualquier lado. El botón flotante abajo a la derecha: Preguntar (este asistente) y Reportar (ticket).
- Al abrir un accionable: selectores de Estado (Propuesto, Bloqueado, En curso, Hecho, Descartado) y Prioridad arriba; Por qué, Cómo hacerlo (pasos en Google Ads), Dónde, qué cambió desde que se propuso, con qué se relaciona, y si es negativa, pausa o cambio de concordancia con acción estructurada válida, "Aprobar y que se haga" para que un script lo ejecute en la próxima hora.

CÓMO FUNCIONA EL SISTEMA: scripts en Google Ads extraen a Supabase (diario 6:00, semanal lunes 7:00). Centinela cada 4 horas dentro de Google Ads: el único que ve el día en curso. Cada mañana 6:45 Sonnet 5 lee el día anterior contra el plan de la semana y escribe el pulso, buscando en la memoria semántica episodios parecidos. Cada lunes Opus 5 en Cowork analiza la semana, escribe el brief, accionables con pasos, reporte al cliente, el plan siguiente y dos predicciones con rango y probabilidad. Un reconciliador en SQL cada mañana vence lo que nadie tocó, deduplica por entidad y cierra alertas que cesaron. Andrés ejecuta los accionables (o aprueba que el script ejecute negativas y pausas) y aprueba los reportes. Nada cambia en Google Ads sin que él lo decida.

REGLAS DE ESTADO DE ACCIONABLES: Propuesto = listo para ejecutar. Bloqueado = es una deducción o lo propuso un proceso automático; espera confirmación. En curso = aprobado para ejecución automática. Hecho = ejecutado, con fecha. Descartado = decidió no hacerlo. Origen: Semanal, Pulso diario, Anomalias, Andres, Reconciliador. Naturaleza: Observación, Inferencia, Hipótesis.
`;

function construirHerramientas(cuentas: string[]): Anthropic.Tool[] {
  // Sin respaldo cableado. Si las cuentas no cargan, el enum queda vacío y las
  // herramientas lo dicen, en vez de ofrecer tres de cuatro: el asistente
  // afirmaría que Fresh Monkee no existe, que es peor que decir que no sabe.
  const ENUM = cuentas;
  return [
  { name: 'estado_cuenta', description: 'Resumen actual de una cuenta: veredicto de headroom, gasto, conversiones y CPA de 7 y 14 días, plan de la semana vigente, último pulso diario. Cada ventana viene con las fechas que abarca, cuántos días tenían dato y cuáles todavía maduran: citá esa ventana, no "los últimos 14 días". Usar cuando pregunten "cómo va X" o "qué dice el plan de X".', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ENUM } }, required: ['cuenta'] } },
  { name: 'accionables_abiertos', description: 'Lista los accionables Propuestos y Bloqueados de una cuenta con título, prioridad, naturaleza y por qué. Usar cuando pregunten qué hay pendiente o qué hacer.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ENUM } }, required: ['cuenta'] } },
  { name: 'explicar_accionable', description: 'Todo el razonamiento detras de un accionable: quien lo propuso, con que evidencia, que invariantes toca, si se puede ejecutar y por que no, y que paso con cambios parecidos. Usar SIEMPRE que pregunten por que se propuso algo, si conviene hacerlo, o que pasa si lo hago.', input_schema: { type: 'object', properties: { notion_id: { type: 'string', description: 'El id del accionable. Si no lo tenes, buscalo primero con buscar_accionable.' } }, required: ['notion_id'] } },
  { name: 'ejecutar_accionable', description: 'Encola un accionable para que el ejecutor lo aplique en Google Ads. SOLO usar cuando Andres lo pide explicitamente ("ejecutalo", "dale", "hacelo"). Nunca por iniciativa propia. Antes de llamarla, explicar que va a hacer y esperar confirmacion en el mismo mensaje.', input_schema: { type: 'object', properties: { notion_id: { type: 'string' }, modo: { type: 'string', enum: ['simular','ejecutar'], description: 'simular muestra que haria sin tocar nada; ejecutar lo aplica de verdad' } }, required: ['notion_id','modo'] } },
  { name: 'dejar_nota_para_agente', description: 'Deja una nota que el agente de esa cuenta va a leer en su proxima corrida. Usar cuando Andres pregunta algo que el agente deberia investigar, da una instruccion que cambia como analizar, o corrige algo que el agente asumio mal. Asi la conversacion no muere aca.', input_schema: { type: 'object', properties: { contenido: { type: 'string', description: 'Que tiene que saber el agente, en una o dos frases claras' }, cuenta: { type: 'string', enum: ENUM }, para: { type: 'string', enum: ['semanal','pulso','mensual','cualquiera'] }, tipo: { type: 'string', enum: ['pregunta','instruccion','contexto','correccion'] } }, required: ['contenido'] } },
  { name: 'que_pregunte_andres', description: 'Las notas que Andres ya dejo para los agentes y todavia no fueron atendidas. Usar cuando pregunte si ya avisó algo, o para no repetir una nota que ya existe.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'consultar_datos', description: 'Corre una consulta de lectura sobre una vista del sistema. Usar para preguntas concretas sobre numeros que ninguna otra herramienta responde. Solo lectura: la vista tiene que existir en diccionario_datos. Devuelve el orden con el que vinieron las filas y avisa si se truncaron: si dice que no hay orden determinista, no las presentes como "los datos".', input_schema: { type: 'object', properties: { vista: { type: 'string', description: 'Nombre exacto de la vista, tal como aparece en que_datos_hay' }, cuenta: { type: 'string', enum: ENUM }, limite: { type: 'number' } }, required: ['vista'] } },
  { name: 'que_datos_hay', description: 'Catalogo de las 119 vistas y funciones del sistema con para que sirve cada una y que cuidado tener. Usar cuando pregunten donde esta un dato, si existe algo, o cuando haga falta explorar mas alla de lo obvio.', input_schema: { type: 'object', properties: { buscar: { type: 'string', description: 'Palabra a buscar, por ejemplo "conversiones" o "landing". Vacio devuelve el catalogo entero.' } }, required: [] } },
  { name: 'completitud_de_cuenta', description: 'Que le falta a una cuenta para operar bien: doc maestro, reglas, nucleo, terminos protegidos, objetivo, datos frescos, destinatarios de reporte. Usar cuando pregunten si una cuenta esta lista, que falta cargar, o por que algo no funciona en una cuenta puntual.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ENUM } }, required: ['cuenta'] } },
  { name: 'estado_de_los_flujos', description: 'Cada flujo de datos del sistema: quien lo escribe, cuando fue el ultimo dato, si esta vivo o cortado. Usar SIEMPRE antes de decir que un dato no existe: puede que el flujo que lo trae nunca se haya conectado, que es distinto de que no haya habido nada.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'salud_del_sistema', description: 'Estado del sistema: fallas, cosas para mirar, tareas que dejaron de correr. Usar cuando pregunten si algo anda mal, por que algo no corrio, o para un chequeo general.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'por_que_limitada', description: 'Descompone por que una cuenta pierde subastas: CTR esperado, relevancia del anuncio o experiencia de landing, ponderado por gasto, con las peores keywords. Usar cuando pregunten por que no escala, por que se pierde cuota, o que hacer para mejorar.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ENUM } }, required: ['cuenta'] } },
  { name: 'buscar_accionable', description: 'Busca accionables de una cuenta por palabras del título o del "por qué", en cualquier estado. Usar cuando pregunten por un accionable puntual ("la propuesta de agrupar campañas", "el de las negativas") y haga falta el detalle completo.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ENUM }, texto: { type: 'string', description: 'Palabras a buscar, por ejemplo "agrupar campañas" o "negativas competidores"' } }, required: ['cuenta', 'texto'] } },
  { name: 'propuestas_estrategicas', description: 'Propuestas estratégicas de una cuenta con su estado, qué se propuso, qué se hizo realmente y el resultado esperado. Usar cuando pregunten por una propuesta o una estrategia, que NO son accionables.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ENUM } }, required: ['cuenta'] } },
  { name: 'salud_datos', description: 'Estado de los datos: última extracción, semana disponible, integridad, crons. Usar cuando pregunten si los datos están al día o por qué falta algo.', input_schema: { type: 'object', properties: {} } },
  { name: 'doc_maestro', description: 'Devuelve una sección del doc maestro de una cuenta: identidad, objetivos, restricciones, descartado, reporte, riesgos, vacios. Usar para preguntas sobre el cliente, sus reglas o su historia.', input_schema: { type: 'object', properties: { cuenta: { type: 'string', enum: ENUM }, seccion: { type: 'string', enum: ['identidad', 'objetivos', 'restricciones', 'descartado', 'reporte', 'riesgos', 'vacios'] } }, required: ['cuenta', 'seccion'] } },
  ];
}

export async function responderAsistente(supabase: any, mensajes: { role: 'user' | 'assistant'; content: string }[], contexto: { pagina?: string; cuenta?: string }) {
  // Las cuentas salen de la base, no de una lista fija. Antes el asistente decia
  // "Fresh Monkee no es una de nuestras cuentas" con Fresh Monkee ya activa.
  const { data: filas } = await supabase.from('cuentas').select('account, nombre_cliente, moneda, perfil_analisis').eq('activa', true).order('account');
  const cuentasActivas: string[] = (filas || []).map((c: any) => c.account);
  const TOOLS = construirHerramientas(cuentasActivas);
  const listaCuentas = (filas || []).map((c: any) => `${c.account} (${c.nombre_cliente || c.account}, ${c.moneda}${c.perfil_analisis === 'cadena' ? ', multi-local' : ''})`).join('; ');
  if (!anthropic) return { texto: 'El asistente necesita ANTHROPIC_API_KEY en Vercel.', costo_usd: 0 };
  const glosarioTxt = Object.entries(GLOSARIO).map(([k, v]) => `${k}: ${v}`).join('\n');
  const primerTurno = `CONTEXTO DE LA APP NORTHSIGNAL (leelo antes de responder)\n${MAPA_APP}\nGLOSARIO:\n${glosarioTxt}\n\nAHORA MISMO: el usuario está en la sección "${contexto.pagina || 'desconocida'}" con la cuenta ${contexto.cuenta || 'sin seleccionar'}.\n\nCÓMO RESPONDÉS: en español rioplatense, corto, directo, sin guion largo, sin listas de tres forzadas. Si la pregunta es sobre datos de una cuenta, usá las herramientas; nunca inventes un número. Si es sobre dónde está algo en la app, decí la sección y qué hacer. Si es sobre un término, usá el glosario. Si no sabés, decilo y sugerí crear un ticket desde Sistema.\n\nPREGUNTA: ${mensajes[mensajes.length - 1]?.content || ''}`;
  const historial = mensajes.slice(0, -1).map(m => ({ role: m.role, content: m.content })) as Anthropic.MessageParam[];
  const msgs: Anthropic.MessageParam[] = [...historial, { role: 'user', content: primerTurno }];

  let costo = 0; let vueltas = 0;
  // 7 vueltas: una consulta real puede ser buscar el accionable, explicarlo,
  // verificar invariantes, simular y dejar nota. Con 4 se cortaba a la mitad.
  while (vueltas++ < 7) {
    const res = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 8000, system: `Sos el asistente de NorthSignal, la app con la que Andrés opera cuentas de Google Ads. Hablás con Andrés, que es quien construyó el sistema y conoce cada cuenta: no le expliques lo obvio ni le pidas contexto que ya tiene.

Las cuentas activas hoy son: ${listaCuentas || 'ninguna cargada'}. Esa lista sale de la base en cada consulta, así que es la buena. Nunca digas que una cuenta no existe sin buscarla ahí, ni sugieras abrir un ticket porque una cuenta "debería estar cargada" si figura.

QUÉ PODÉS HACER

Antes de decir que algo no existe, mirá si el flujo que lo trae está vivo con estado_de_los_flujos. Caso concreto y activo: los webhooks de cierres reales nunca recibieron un evento, así que v_cierres_totales y v_win_rates_reales están vacías y van a seguir así hasta que se conecte GoHighLevel y Asana. Eso no es "no hubo cierres": es un flujo sin conectar, y decirlo mal lleva a la conclusión opuesta.

Responder con datos. Todo número, nombre de campaña, keyword o fecha sale de una herramienta. Si no lo trajiste de una herramienta, no lo digas: "no lo tengo, lo busco" es una respuesta correcta y "creo que era alrededor de" no lo es. Cuando una herramienta devuelve vacío, mirá si trae una explicación del porqué antes de concluir nada: no es lo mismo "no hay datos" que "todavía no se puede saber".

Explicar el razonamiento de un accionable. Para eso está explicar_accionable: trae quién lo propuso, con qué evidencia, qué invariantes toca, si se puede ejecutar y por qué no, y qué pasó con cambios parecidos. Si Andrés pregunta por qué se propuso algo o si conviene hacerlo, esa es la herramienta, siempre, antes de opinar.

Ejecutar, si te lo pide. ejecutar_accionable encola un cambio por el mismo camino que el botón de la app: mismo pre-vuelo, mismos guardarraíles, mismo registro. Reglas: solo cuando lo pide explícitamente, nunca por iniciativa propia, y antes de encolar decí en una línea qué va a pasar. Si dudás de si lo está pidiendo, ofrecé simular primero.

Hablarle a los agentes. Si Andrés pregunta algo que el agente debería investigar, da una instrucción que cambia cómo analizar, o corrige algo que un agente asumió mal, usá dejar_nota_para_agente. Sin eso la conversación muere acá y el agente del lunes vuelve a analizar lo de siempre. Decíselo en una línea cuando lo hagas: "le dejé nota al agente semanal de 360".

CÓMO RESPONDER

Directo y conversacional. Sin encabezados ni viñetas salvo que la respuesta sea naturalmente una lista. Castellano rioplatense.

Cuando algo no se puede, decí por qué y de quién es el límite. "Los RSA no se crean por script, eso es de Google" sirve; "no puedo hacer eso" no.

Un número siempre con su ventana: "5,44 USD en las últimas 4 semanas", no "5,44 USD".

Si la pregunta toca varias cuentas, contestá por cuenta: cada una tiene reglas propias y promediarlas da un número que no significa nada.`, messages: msgs, tools: TOOLS, output_config: { effort: 'high' } as any });
    costo += (res.usage.input_tokens || 0) * 2 / 1e6 + (res.usage.output_tokens || 0) * 10 / 1e6;
    const toolUses = res.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
    // Si se cortó por largo, la respuesta que sigue está incompleta y no hay que
    // devolverla como si estuviera entera. Antes caía por la misma rama que una
    // respuesta terminada y el usuario recibía media frase sin saber por qué.
    if (res.stop_reason === 'max_tokens') {
      const parcial = res.content.filter(b => b.type === 'text').map((b: any) => b.text).join('');
      return { texto: (parcial ? parcial + '\n\n' : '') +
        '[La respuesta se cortó por largo. Preguntame algo más acotado, o pedímelo por partes.]',
        costo, vueltas, cortada: true } as any;
    }
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
          // La ventana sale de ventana_metrica y se filtra por FECHA, nunca por
          // cantidad de filas: un .limit(14) devuelve 14 filas, y si a la capa
          // diaria le falta un día son 14 filas repartidas en 15 fechas, que el
          // modelo lee como "los últimos 14 días". Se declara la ventana real
          // y cuántos días tenían dato, que es lo que de verdad se sumó.
          const [h, vent, plan, pulso] = await Promise.all([
            supabase.from('v_headroom').select('*').eq('account', inp.cuenta).maybeSingle(),
            supabase.rpc('ventana_metrica', { p_account: inp.cuenta, p_tipo: 'diaria_real' }),
            supabase.from('plan_semanal').select('semana,contexto,indicadores,hipotesis').eq('account', inp.cuenta).order('semana', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('pulso_diario').select('fecha,nivel,hallazgo_principal,resumen').eq('account', inp.cuenta).order('fecha', { ascending: false }).limit(1).maybeSingle(),
          ]);
          const v: any = Array.isArray(vent.data) ? vent.data[0] : vent.data;
          if (!v?.hasta) {
            // Sin ventana no hay número honesto: antes que un CPA sobre una
            // ventana que no se puede nombrar, va el hueco explicado.
            out = { headroom: h.data, plan: plan.data, ultimo_pulso: pulso.data, ventana: null,
              nota: `No pude establecer la ventana real de la capa diaria de ${inp.cuenta} (ventana_metrica no devolvió nada), así que no hay gasto, conversiones ni CPA de 7 ni de 14 días. Con estos datos no se puede saber; decilo así.` };
          } else {
            const hasta = String(v.hasta).slice(0, 10);
            const desde14 = menosDias(hasta, 13), desde7 = menosDias(hasta, 6);
            const { data: dias } = await supabase.from('v_serie_diaria')
              .select('date,gasto,conversiones,cpa,madurez').eq('account', inp.cuenta)
              .gte('date', desde14).lte('date', hasta).order('date', { ascending: false });
            const d = dias || [];
            const sum = (arr: any[], k: string) => arr.reduce((a, r) => a + Number(r[k] || 0), 0);
            const c7 = d.filter((r: any) => String(r.date).slice(0, 10) >= desde7), c14 = d;
            const resumen = (arr: any[], desde: string, declarados: number) => ({
              ventana: `${desde} a ${hasta}`,
              dias_declarados: declarados,
              dias_con_dato: arr.length,
              gasto: sum(arr, 'gasto'),
              conversiones: sum(arr, 'conversiones'),
              cpa: sum(arr, 'conversiones') ? sum(arr, 'gasto') / sum(arr, 'conversiones') : null,
              // Las conversiones de los días recientes todavía maduran, y Google
              // las atribuye al día del clic: sumarlas sin decirlo es afirmar
              // una caída que puede no existir.
              dias_que_todavia_maduran: arr.filter((r: any) => r.madurez && r.madurez !== 'consolidado')
                .map((r: any) => `${String(r.date).slice(0, 10)} (${r.madurez})`),
            });
            out = {
              headroom: h.data,
              ultimos_7d: resumen(c7, desde7, 7),
              ultimos_14d: resumen(c14, desde14, 14),
              plan: plan.data, ultimo_pulso: pulso.data,
              nota_ventana: `Las ventanas se cuentan desde ${hasta}, el último día que la capa diaria tiene para ${inp.cuenta} (ventana_metrica, fuente ${v.fuente || 'capa diaria'}). Si dias_con_dato es menor que dias_declarados, el total sumó solo esos días: decí la ventana real, no "los últimos 14 días".`,
              nota_madurez: 'En los días provisionales o madurando el gasto ya es definitivo y las conversiones no. Nunca cierres un veredicto de CPA sobre ellos.',
            };
          }
        } else if (tu.name === 'accionables_abiertos') {
          // El espejo tiene el contenido real, sincronizado cada 30 minutos.
          // Antes esta herramienta devolvia un texto que mandaba a buscar a mano.
          // Se traen más de las que viajan y se ordenan por peso de prioridad
          // en memoria: PostgREST ordena el texto, y alfabéticamente Urgente
          // queda último, así que el corte se comía justo lo urgente.
          const TOPE = 30, TRAER = 200;
          const { data: acc } = await supabase.from('accionables_espejo')
            .select('titulo, estado, prioridad, naturaleza, origen, entidad, por_que, detectado, vence, accion, accion_valida, accion_error, url')
            .eq('account', inp.cuenta).in('estado', ['Propuesto', 'Bloqueado', 'Aprobado', 'En curso'])
            .limit(TRAER);
          const ordenados = [...(acc || [])].sort((a: any, b: any) =>
            (PESO_PRIORIDAD[b.prioridad] || 0) - (PESO_PRIORIDAD[a.prioridad] || 0)
            // Desempates deterministas: lo que vence antes, y el título para que
            // dos consultas iguales devuelvan el mismo orden.
            || String(a.vence || '9999-12-31').localeCompare(String(b.vence || '9999-12-31'))
            || String(a.titulo || '').localeCompare(String(b.titulo || '')));
          const visibles = ordenados.slice(0, TOPE);
          const sinPrioridad = ordenados.filter((x: any) => !PESO_PRIORIDAD[x.prioridad]).length;
          out = {
            cuenta: inp.cuenta,
            cuantos: ordenados.length,
            se_muestran: visibles.length,
            orden: 'Por prioridad real (Urgente, Alta, Media, Baja; sin prioridad o con una etiqueta desconocida van al final), después por vencimiento más cercano.',
            sin_prioridad: sinPrioridad,
            accionables: visibles.map((x: any) => ({
              titulo: x.titulo, estado: x.estado, prioridad: x.prioridad, naturaleza: x.naturaleza,
              origen: x.origen, entidad: x.entidad,
              por_que: (x.por_que || '').slice(0, 700),
              detectado: x.detectado, vence: x.vence,
              se_puede_ejecutar: !!x.accion_valida,
              verbo: x.accion?.verbo || null,
              por_que_manual: x.accion_valida ? null : (x.accion_error || 'sin acción estructurada'),
              url: x.url
            })),
            nota: !ordenados.length
              ? 'Esta cuenta no tiene accionables abiertos ahora mismo.'
              : 'Contenido real del espejo de Notion, sincronizado cada 30 minutos. Podés citar títulos y el "por qué" textual.'
                + (ordenados.length > visibles.length ? ` Hay ${ordenados.length} abiertos y viajan los ${visibles.length} de mayor prioridad: no digas que son todos.` : '')
                + (sinPrioridad ? ` ${sinPrioridad} no tienen prioridad cargada y quedaron al final: eso es un dato faltante, no una prioridad baja.` : '')
                + ((acc || []).length >= TRAER ? ` La consulta se cortó en ${TRAER} filas en la base: puede haber más abiertos que ni se contaron.` : '')
          };
        } else if (tu.name === 'explicar_accionable') {
          const { data: exp } = await supabase.rpc('explicar_accionable', { p_notion_id: inp.notion_id });
          out = exp || { error: 'No encontré ese accionable. Buscalo primero con buscar_accionable.' };
        } else if (tu.name === 'ejecutar_accionable') {
          // Pasa por el mismo endpoint que el botón de la app: mismos guardarraíles,
          // mismo pre-vuelo, mismo registro. No hay un camino paralelo sin control.
          // Mismo endpoint que el botón de la app: mismo pre-vuelo, mismos
          // guardarraíles, mismo registro. No hay un camino paralelo sin control.
          const base = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
          let j: any = null, ok = false;
          try {
            const r = await fetch(`${base}/api/accionables/${encodeURIComponent(inp.notion_id)}/aprobar-ejecutar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.APP_ACCESS_TOKEN}` },
              body: JSON.stringify({ modo: inp.modo === 'ejecutar' ? 'ejecutar' : 'simular' })
            });
            ok = r.ok; j = await r.json().catch(() => null);
          } catch (e: any) { j = { error: e?.message || 'no se pudo llamar al endpoint' }; }
          out = ok
            ? { ok: true, modo: inp.modo, resultado: j,
                nota: inp.modo === 'simular'
                  ? 'Simulado: no se tocó nada. El resultado muestra qué haría.'
                  : 'Encolado. El ejecutor de Google Ads lo aplica dentro de la hora.' }
            : { ok: false, error: j?.error || 'No se pudo encolar',
                motivo: j?.por_que || j?.conflicto,
                que_hacer: 'Si dice que no tiene acción estructurada válida, hay que ejecutarlo a mano con los pasos de "Cómo hacerlo".' };
        } else if (tu.name === 'dejar_nota_para_agente') {
          const { data: id } = await supabase.rpc('dejar_nota_para_agente', {
            p_contenido: inp.contenido, p_account: inp.cuenta || null,
            p_para: inp.para || 'semanal', p_tipo: inp.tipo || 'pregunta' });
          out = { ok: true, id, nota: `Anotado para el agente ${inp.para || 'semanal'}${inp.cuenta ? ' de ' + inp.cuenta : ''}. Lo va a leer en su próxima corrida.` };
        } else if (tu.name === 'que_pregunte_andres') {
          const { data: notas } = await supabase.from('v_notas_pendientes').select('*').limit(20);
          out = { pendientes: notas || [] };
        } else if (tu.name === 'consultar_datos') {
          // Solo vistas del catálogo: no se acepta SQL libre.
          const { data: dic } = await supabase.rpc('diccionario_datos');
          const existe = (dic || []).some((d: any) => d.objeto === inp.vista);
          if (!existe) { out = { error: `La vista "${inp.vista}" no existe. Mirá que_datos_hay para el catálogo.` }; }
          else {
            const tope = Math.min(Math.max(Number(inp.limite) || 30, 1), 100);
            // Un limit sin ORDER BY sobre una serie temporal devuelve las filas
            // en el orden que Postgres tenga a mano, y el modelo las reporta
            // como "los datos". Se mira la forma real de la vista (una fila,
            // solo por los nombres de columna: no se adivina ninguno) y se
            // ordena por la primera columna temporal o de id que exista.
            const { data: muestra } = await supabase.from(inp.vista).select('*').limit(1);
            const cols = Object.keys((muestra || [])[0] || {});
            const CANDIDATAS = ['fecha', 'date', 'week_start', 'semana', 'corrida', 'detectado', 'creada_el', 'ejecutado_el', 'ultima_edicion', 'sincronizado', 'created_at', 'id'];
            const orden = CANDIDATAS.find(c => cols.includes(c)) || null;
            // tope + 1 para saber si se truncó sin pedir un count exacto.
            let q = supabase.from(inp.vista).select('*').limit(tope + 1);
            if (orden) q = q.order(orden, { ascending: false });
            if (inp.cuenta) q = q.eq('account', inp.cuenta);
            const { data: filas, error: e } = await q;
            if (e) out = { error: e.message, nota: 'Puede que esa vista no filtre por cuenta.' };
            else {
              const hay = filas || [];
              const visibles = hay.slice(0, tope);
              out = {
                vista: inp.vista,
                cuantas: visibles.length,
                orden: orden
                  ? `${orden} descendente: lo más reciente primero.`
                  : 'SIN ORDEN DETERMINISTA: esta vista no expone ninguna columna de fecha ni de id, así que estas filas son una muestra arbitraria. No las leas como "las primeras", "las últimas" ni como el total.',
                truncado: hay.length > tope,
                filas: visibles,
                nota: hay.length > tope
                  ? `Se cortó en ${tope} filas y hay más. Lo que ves no es el total: no sumes ni saques promedios sobre esto.`
                  : undefined,
              };
            }
          }
        } else if (tu.name === 'que_datos_hay') {
          const { data: dic } = await supabase.rpc('diccionario_datos');
          const q = String(inp.buscar || '').toLowerCase().trim();
          const filas = (dic || []).filter((d: any) => !q
            || `${d.objeto} ${d.usar_para} ${d.cuidado || ''}`.toLowerCase().includes(q));
          out = { encontrados: filas.length, objetos: filas.slice(0, 40),
            nota: filas.length > 40 ? 'Se muestran los primeros 40. Afiná la búsqueda.' : undefined };
        } else if (tu.name === 'completitud_de_cuenta') {
          const { data: comp } = await supabase.rpc('completitud_de_cuenta', { p_account: inp.cuenta });
          out = { cuenta: inp.cuenta, requisitos: comp || [],
            faltan: (comp || []).filter((r: any) => !r.cumple).map((r: any) => r.requisito) };
        } else if (tu.name === 'estado_de_los_flujos') {
          const { data: fl } = await supabase.rpc('estado_de_los_flujos');
          out = { flujos: fl || [],
            cortados: (fl || []).filter((f: any) => f.estado === 'CORTADO' || f.estado === 'NUNCA RECIBIO NADA') };
        } else if (tu.name === 'salud_del_sistema') {
          const { data: s } = await supabase.rpc('get_salud_sistema');
          out = s || { error: 'no disponible' };
        } else if (tu.name === 'por_que_limitada') {
          const { data: p } = await supabase.from('v_por_que_limitada').select('*').eq('account', inp.cuenta).maybeSingle();
          out = p || { cuenta: inp.cuenta, nota: 'Sin datos de cuota perdida para esta cuenta en el periodo.' };
        } else if (tu.name === 'buscar_accionable') {
          const q = String(inp.texto || '').trim();
          const { data: acc } = await supabase.from('accionables_espejo')
            .select('titulo, estado, prioridad, naturaleza, origen, entidad, por_que, detectado, vence, accion, accion_valida, accion_error, ejecutado_el, url')
            .eq('account', inp.cuenta).or(`titulo.ilike.%${q}%,por_que.ilike.%${q}%,entidad.ilike.%${q}%`).limit(10);
          out = (acc || []).length
            ? { cuenta: inp.cuenta, encontrados: acc!.length, accionables: acc!.map((x: any) => ({ ...x, por_que: (x.por_que || '').slice(0, 1500), se_puede_ejecutar: !!x.accion_valida })) }
            : { cuenta: inp.cuenta, encontrados: 0, nota: `No hay accionables de ${inp.cuenta} que mencionen "${q}". Puede estar escrito distinto: probá con una palabra sola.` };
        } else if (tu.name === 'propuestas_estrategicas') {
          const { data: pr } = await supabase.from('propuestas_estrategicas')
            .select('id, tipo, titulo, estado, hipotesis, que_se_propuso, ejecucion_real, resultado_esperado, creada_el, decidida_el')
            .eq('account', inp.cuenta).order('creada_el', { ascending: false }).limit(10);
          out = (pr || []).length ? { cuenta: inp.cuenta, propuestas: pr } : { cuenta: inp.cuenta, nota: 'Esta cuenta no tiene propuestas estratégicas cargadas.' };
        } else if (tu.name === 'salud_datos') {
          const [dh, integ, snaps] = await Promise.all([supabase.from('v_data_health').select('*'), supabase.from('v_integridad_conversiones').select('*').limit(5), supabase.from('v_snapshots_disponibles').select('*')]);
          out = { data_health: dh.data, descuadres: integ.data, snapshots: snaps.data };
        } else if (tu.name === 'doc_maestro') {
          const r = await supabase.from('doc_maestro_humano').select('contenido').eq('account', inp.cuenta).eq('seccion', inp.seccion).eq('vigente', true).maybeSingle();
          out = r.data?.contenido || 'Sección vacía.';
        } else out = { error: 'herramienta desconocida' };
      } catch (e: any) { out = { error: e.message }; }
      // El corte a 6000 deja el JSON partido al medio, y un JSON partido se
      // completa con lo más plausible: se avisa cuando pasa, en vez de que el
      // faltante parezca ausencia de datos.
      const cuerpo = typeof out === 'string' ? out : JSON.stringify(out);
      const CAP = 6000;
      results.push({ type: 'tool_result', tool_use_id: tu.id,
        content: cuerpo.length > CAP
          ? cuerpo.slice(0, CAP) + `\n[CORTADO: la herramienta devolvió ${cuerpo.length} caracteres y viajan los primeros ${CAP}, así que este JSON está incompleto. Lo que falta NO es un vacío: pedí lo mismo más acotado antes de concluir nada.]`
          : cuerpo });
    }
    msgs.push({ role: 'user', content: results });
  }
  return { texto: 'No pude cerrar la respuesta en cuatro pasos. Probá una pregunta más acotada.', costo_usd: costo };
}
