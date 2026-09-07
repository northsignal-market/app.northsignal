/**
 * ESTÁNDAR DE ACCIONABLE · v1
 * ----------------------------------------------------------------------------
 * "Estado estructurado para las máquinas, lenguaje natural para las personas."
 *
 * Un accionable lleva un objeto {verbo, objeto, parametros, verificar}. El
 * verbo es de lista cerrada: no existe "revisar" ni "decidir". El título se
 * deriva del objeto con una plantilla, así todos se leen igual. El botón de
 * ejecutar y las políticas leen el objeto, no el título. El servidor valida
 * el objeto contra la base (la keyword existe, el grupo existe) antes de
 * creerle al modelo: el esquema garantiza forma, no verdad.
 */
import { z } from 'zod';

export const VERBOS = [
  'pausar_keyword', 'reactivar_keyword', 'agregar_negativa', 'quitar_negativa', 'cambiar_concordancia', 'crear_keyword',
  'pausar_anuncio', 'crear_anuncio', 'cambiar_puja', 'cambiar_presupuesto', 'cambiar_estrategia_puja',
  'cambiar_conversion', 'cambiar_landing', 'cambiar_programacion', 'desactivar_automatizacion',
  'preguntar_cliente', 'preguntar_andres',
  'tarea_externa',   // trabajo real fuera de Google Ads: un Sheet, el CRM, la landing, GTM
  // Verbos que el ejecutor SI puede aplicar, agregados el 7 sep 2026 tras verificar
  // la documentacion de AdsApp. El registro completo esta en capacidades_ejecucion.
  'quitar_negativa', 'reactivar_keyword', 'pausar_grupo', 'pausar_campana', 'reactivar_campana',
  'cambiar_estrategia_puja', 'cambiar_objetivo_puja', 'cambiar_presupuesto', 'cambiar_cpc_keyword',
  'aplicar_etiqueta',
] as const;

// Que verbos ejecuta el script. Espejo de capacidades_ejecucion en Supabase:
// si cambia alla, cambia aca. Sirve para que la app muestre el boton correcto
// sin ir a la base en cada render.
export const VERBOS_EJECUTABLES: Record<string, { riesgo: 'bajo' | 'medio'; requiere: string[] }> = {
  agregar_negativa:        { riesgo: 'bajo',  requiere: ['campana', 'keyword'] },
  quitar_negativa:         { riesgo: 'bajo',  requiere: ['campana', 'keyword'] },
  pausar_keyword:          { riesgo: 'bajo',  requiere: ['campana', 'keyword'] },
  reactivar_keyword:       { riesgo: 'bajo',  requiere: ['campana', 'keyword'] },
  pausar_anuncio:          { riesgo: 'bajo',  requiere: ['campana', 'ad_id'] },
  pausar_grupo:            { riesgo: 'bajo',  requiere: ['campana', 'grupo'] },
  cambiar_concordancia:    { riesgo: 'bajo',  requiere: ['campana', 'keyword', 'match_type_destino'] },
  aplicar_etiqueta:        { riesgo: 'bajo',  requiere: ['campana', 'etiqueta'] },
  cambiar_estrategia_puja: { riesgo: 'medio', requiere: ['campana', 'estrategia_destino'] },
  cambiar_objetivo_puja:   { riesgo: 'medio', requiere: ['campana', 'valor_actual'] },
  cambiar_presupuesto:     { riesgo: 'medio', requiere: ['campana', 'valor_actual', 'valor_nuevo'] },
  pausar_campana:          { riesgo: 'medio', requiere: ['campana'] },
  reactivar_campana:       { riesgo: 'medio', requiere: ['campana'] },
  cambiar_cpc_keyword:     { riesgo: 'medio', requiere: ['campana', 'keyword', 'valor_actual', 'valor_nuevo'] },
};

// Por que un verbo NO se puede ejecutar. Se muestra en la app para que quede claro
// que es un limite de la plataforma, no una falta del sistema.
export const POR_QUE_MANUAL: Record<string, string> = {
  crear_anuncio: 'AdsApp solo crea expanded text ads, que Google retiró. Los RSA se hacen en la interfaz.',
  editar_anuncio: 'Un anuncio no se edita: se crea uno nuevo y se pausa el viejo, y los RSA no se crean por script.',
  cambiar_conversion_primaria: 'Las acciones de conversión no están en AdsApp. Se cambian en Objetivos › Conversiones.',
  cambiar_segmentacion: 'AdsApp lee la segmentación pero no la cambia de forma confiable.',
  cambiar_landing: 'La URL final no se edita: hay que recrear el anuncio.',
  preguntar_andres: 'Es una pregunta, no un cambio.',
  preguntar_cliente: 'Es una pregunta, no un cambio.',
  tarea_externa: 'Es trabajo fuera de Google Ads.',
  investigar: 'Es diagnóstico, no un cambio.',
};
export type Verbo = typeof VERBOS[number];

/** Lista plana de los ejecutables, derivada del mapa de arriba. */
export const VERBOS_EJECUTABLES_LISTA: string[] = Object.keys(VERBOS_EJECUTABLES);
/** Si el script puede ejecutar este verbo. */
export function esEjecutable(verbo?: string | null): boolean { return !!verbo && verbo in VERBOS_EJECUTABLES; }

export const AccionSchema = z.object({
  verbo: z.enum(VERBOS),
  objeto: z.object({
    campana: z.string().min(1).nullable().optional(),
    grupo: z.string().nullable().optional(),
    keyword: z.string().nullable().optional(),
    match_type: z.enum(['EXACT', 'PHRASE', 'BROAD']).nullable().optional(),
    anuncio_id: z.string().nullable().optional(),
    accion_conversion: z.string().nullable().optional(),
    keywords: z.array(z.string()).nullable().optional(),   // para lotes: pausar 21 keywords
  }),
  parametros: z.object({
    match_type_destino: z.enum(['EXACT', 'PHRASE', 'BROAD']).nullable().optional(),
    nivel: z.enum(['grupo', 'campana', 'lista']).nullable().optional(),
    valor_nuevo: z.union([z.number(), z.string()]).nullable().optional(),
    valor_actual: z.union([z.number(), z.string()]).nullable().optional(),
    a_quien: z.string().nullable().optional(),               // preguntar_*
    donde: z.string().nullable().optional(),                 // tarea_externa: que sistema
    que_hacer: z.string().nullable().optional(),             // tarea_externa: la tarea
    estrategia_destino: z.string().nullable().optional(),    // cambiar_estrategia_puja
    etiqueta: z.string().nullable().optional(),              // aplicar_etiqueta
    // Fecha AAAA-MM-DD antes de la cual no se ejecuta. Una condicion de secuencia
    // escrita en el texto no retiene nada: el 7 de septiembre de 2026 un accionable
    // que pedia esperar al 21 se ejecuto el mismo dia. Acá el pre-vuelo la hace cumplir.
    no_ejecutar_antes_de: z.string().nullable().optional(),
    pregunta: z.string().nullable().optional(),
    dato_que_falta: z.string().nullable().optional(),
  }).default({}),
  verificar: z.object({
    metrica: z.string(),
    fecha: z.string(),                                        // YYYY-MM-DD
    esperado: z.string(),
  }).nullable().optional(),
});
export type Accion = z.infer<typeof AccionSchema>;

const MT: Record<string, string> = { EXACT: 'exacta', PHRASE: 'frase', BROAD: 'amplia' };
const fmtKw = (k?: string | null, mt?: string | null) => k ? (mt === 'EXACT' ? `[${k}]` : mt === 'PHRASE' ? `"${k}"` : k) : '';
const donde = (o: Accion['objeto']) => [o.grupo, o.campana].filter(Boolean).join(' · ');

/** Título humano, siempre con la misma forma: verbo, objeto, dónde. */
export function tituloDesde(a: Accion): string {
  const o = a.objeto, p = a.parametros || {};
  const en = donde(o) ? ` en ${donde(o)}` : '';
  switch (a.verbo) {
    case 'pausar_keyword': return o.keywords?.length ? `Pausar ${o.keywords.length} keywords${en}` : `Pausar ${fmtKw(o.keyword, o.match_type)}${en}`;
    case 'reactivar_keyword': return `Reactivar ${fmtKw(o.keyword, o.match_type)}${en}`;
    case 'agregar_negativa': return `Agregar negativa ${fmtKw(o.keyword, p.match_type_destino || o.match_type || 'PHRASE')} a nivel ${p.nivel || 'grupo'}${en}`;
    case 'quitar_negativa': return `Quitar negativa ${fmtKw(o.keyword, o.match_type)}${en}`;
    case 'cambiar_concordancia': return `Cambiar ${o.keyword} de ${MT[o.match_type || ''] || '?'} a ${MT[p.match_type_destino || ''] || '?'}${en}`;
    case 'crear_keyword': return `Crear keyword ${fmtKw(o.keyword, p.match_type_destino || o.match_type)}${en}`;
    case 'pausar_anuncio': return `Pausar anuncio ${o.anuncio_id || ''}${en}`.trim();
    case 'crear_anuncio': return `Crear anuncio${en}`;
    case 'cambiar_puja': return `Cambiar puja${p.valor_actual != null ? ` de ${p.valor_actual}` : ''}${p.valor_nuevo != null ? ` a ${p.valor_nuevo}` : ''}${en}`;
    case 'cambiar_presupuesto': return `Cambiar presupuesto${p.valor_actual != null ? ` de ${p.valor_actual}` : ''}${p.valor_nuevo != null ? ` a ${p.valor_nuevo}` : ''}${o.campana ? ` de ${o.campana}` : ''}`;
    case 'cambiar_estrategia_puja': return `Cambiar estrategia de puja${p.valor_actual ? ` de ${p.valor_actual}` : ''}${p.valor_nuevo ? ` a ${p.valor_nuevo}` : ''}${o.campana ? ` en ${o.campana}` : ''}`;
    case 'cambiar_conversion': return `Cambiar ${o.accion_conversion || 'acción de conversión'}${p.valor_nuevo ? ` a ${p.valor_nuevo}` : ''}`;
    case 'cambiar_landing': return `Cambiar landing${p.valor_nuevo ? ` a ${p.valor_nuevo}` : ''}${en}`;
    case 'cambiar_programacion': return `Cambiar programación de anuncios${o.campana ? ` en ${o.campana}` : ''}`;
    case 'desactivar_automatizacion': return `Desactivar ${p.valor_actual || 'automatización de Google'}${o.campana ? ` en ${o.campana}` : ''}`;
    case 'preguntar_cliente': return `Preguntar a ${p.a_quien || 'cliente'}: ${(p.pregunta || '').slice(0, 80)}`;
    case 'preguntar_andres': return `Decidir: ${(p.pregunta || '').slice(0, 90)}`;
    case 'tarea_externa': return `${(p.que_hacer || 'Tarea').slice(0, 80)}${p.donde ? ` en ${p.donde}` : ''}`;
    case 'quitar_negativa': return `Quitar la negativa ${o.keyword} de ${p.nivel === 'grupo' ? o.grupo : o.campana}`;
    case 'reactivar_keyword': return `Reactivar ${o.keyword} en ${o.grupo || o.campana}`;
    case 'pausar_grupo': return `Pausar el grupo ${o.grupo} en ${o.campana}`;
    case 'pausar_campana': return `Pausar la campaña ${o.campana}`;
    case 'reactivar_campana': return `Reactivar la campaña ${o.campana}`;
    case 'cambiar_estrategia_puja': return `Cambiar la puja de ${o.campana} a ${p.estrategia_destino}`;
    case 'cambiar_objetivo_puja': return p.valor_nuevo == null ? `Quitar el objetivo de puja en ${o.campana}` : `Poner el objetivo de puja de ${o.campana} en ${p.valor_nuevo}`;
    case 'cambiar_presupuesto': return `Cambiar el presupuesto de ${o.campana} de ${p.valor_actual} a ${p.valor_nuevo}`;
    case 'cambiar_cpc_keyword': return `Cambiar el CPC de ${o.keyword} de ${p.valor_actual} a ${p.valor_nuevo}`;
    case 'aplicar_etiqueta': return `Etiquetar ${o.campana} como ${p.etiqueta}`;
  }
}

/** Tipo de acción automática que corresponde a este objeto, si alguna. */
/**
 * Del verbo al tipo que entiende el ejecutor. Devuelve null si el verbo no se
 * puede ejecutar, o si le falta algo obligatorio.
 * Las negativas conservan los nombres viejos (negativa_grupo / negativa_campana)
 * por compatibilidad con las filas ya encoladas.
 */
export function tipoAutoDesde(a: Accion): string | null {
  const p = a.parametros || {} as any;
  switch (a.verbo) {
    case 'agregar_negativa': return p.nivel === 'campana' ? 'negativa_campana' : p.nivel === 'lista' ? null : 'negativa_grupo';
    case 'quitar_negativa': return a.objeto.keyword ? 'quitar_negativa' : null;
    case 'pausar_keyword': return !a.objeto.keywords?.length ? 'pausar_keyword' : null;
    case 'reactivar_keyword': return a.objeto.keyword ? 'reactivar_keyword' : null;
    case 'pausar_anuncio': return 'pausar_anuncio';
    case 'pausar_grupo': return a.objeto.grupo ? 'pausar_grupo' : null;
    case 'pausar_campana': return a.objeto.campana ? 'pausar_campana' : null;
    case 'reactivar_campana': return a.objeto.campana ? 'reactivar_campana' : null;
    case 'cambiar_concordancia': return p.match_type_destino ? 'cambiar_concordancia' : null;
    case 'cambiar_estrategia_puja': return p.estrategia_destino ? 'cambiar_estrategia_puja' : null;
    // Los de riesgo medio necesitan el valor anterior: sin el, no se puede revertir
    case 'cambiar_objetivo_puja': return p.valor_actual != null ? 'cambiar_objetivo_puja' : null;
    case 'cambiar_presupuesto': return (p.valor_actual != null && p.valor_nuevo != null) ? 'cambiar_presupuesto' : null;
    case 'cambiar_cpc_keyword': return (p.valor_actual != null && p.valor_nuevo != null) ? 'cambiar_cpc_keyword' : null;
    case 'aplicar_etiqueta': return p.etiqueta ? 'aplicar_etiqueta' : null;
    default: return null;
  }
}

/** Parsea el texto de la propiedad "Accion JSON". Devuelve la acción o el error legible. */
export function parsearAccion(texto: string | null | undefined): { accion?: Accion; error?: string } {
  if (!texto || !texto.trim()) return { error: 'sin Accion JSON' };
  let raw: any;
  // Tolerante: Notion o el modelo pueden envolverlo en ```json, "json\n", comillas o texto. Se toma de la primera { a la última }.
  const i = texto.indexOf('{'), j = texto.lastIndexOf('}');
  if (i < 0 || j <= i) return { error: 'JSON inválido: sin llaves' };
  try { raw = JSON.parse(texto.slice(i, j + 1)); } catch (e: any) { return { error: 'JSON inválido: ' + String(e.message).slice(0, 80) }; }
  const r = AccionSchema.safeParse(raw);
  if (!r.success) return { error: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
  const a = r.data;
  if (['pausar_keyword', 'cambiar_concordancia', 'reactivar_keyword'].includes(a.verbo) && !a.objeto.keyword && !a.objeto.keywords?.length) return { error: `${a.verbo} sin keyword` };
  if (a.verbo === 'agregar_negativa' && !a.objeto.keyword && !a.objeto.keywords?.length) return { error: 'agregar_negativa sin keyword' };
  if (a.verbo === 'cambiar_concordancia' && !a.parametros?.match_type_destino) return { error: 'cambiar_concordancia sin match_type_destino' };
  if (a.verbo.startsWith('preguntar') && !a.parametros?.pregunta) return { error: `${a.verbo} sin pregunta` };
  if (a.verbo === 'tarea_externa' && !a.parametros?.que_hacer) return { error: 'tarea_externa sin que_hacer' };
  // Los cambios de riesgo medio necesitan el valor anterior: sin el no se puede revertir
  if (['cambiar_presupuesto', 'cambiar_objetivo_puja', 'cambiar_cpc_keyword'].includes(a.verbo) && a.parametros?.valor_actual == null)
    return { error: `${a.verbo} sin valor_actual: sin el valor anterior el cambio no se puede revertir` };
  if (a.verbo === 'cambiar_estrategia_puja' && !a.parametros?.estrategia_destino) return { error: 'cambiar_estrategia_puja sin estrategia_destino' };
  const espera = a.parametros?.no_ejecutar_antes_de;
  if (espera && !/^\d{4}-\d{2}-\d{2}$/.test(espera)) return { error: `no_ejecutar_antes_de debe ser AAAA-MM-DD, llegó "${espera}"` };
  return { accion: a };
}
