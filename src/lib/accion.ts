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
] as const;
export type Verbo = typeof VERBOS[number];

/** Los que el script puede ejecutar solo. Todo lo demás es a mano o es una pregunta. */
export const VERBOS_EJECUTABLES: Verbo[] = ['pausar_keyword', 'agregar_negativa', 'cambiar_concordancia', 'pausar_anuncio'];

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
  }
}

/** Tipo de acción automática que corresponde a este objeto, si alguna. */
export function tipoAutoDesde(a: Accion): 'negativa_grupo' | 'negativa_campana' | 'pausar_keyword' | 'pausar_anuncio' | 'cambiar_concordancia' | null {
  if (a.verbo === 'agregar_negativa') return a.parametros?.nivel === 'campana' ? 'negativa_campana' : a.parametros?.nivel === 'lista' ? null : 'negativa_grupo';
  if (a.verbo === 'pausar_keyword' && !a.objeto.keywords?.length) return 'pausar_keyword';
  if (a.verbo === 'pausar_anuncio') return 'pausar_anuncio';
  if (a.verbo === 'cambiar_concordancia' && a.parametros?.match_type_destino) return 'cambiar_concordancia';
  return null;
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
  return { accion: a };
}
