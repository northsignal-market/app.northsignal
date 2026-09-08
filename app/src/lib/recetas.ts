/**
 * Recetas: la ruta exacta en Google Ads para cada tipo de accionable.
 * Se usan cuando el accionable no trae "Como hacerlo" desde Notion (los
 * creados antes del 6 sep 2026, o por el pulso diario). Rutas verificadas
 * contra la interfaz de Google Ads de 2026: menú izquierdo Campañas >
 * Keywords > Términos de búsqueda; negativas por grupo, campaña o lista.
 *
 * Cada receta recibe el título del accionable para extraer la entidad
 * (keyword, grupo, término) y devuelve pasos concretos.
 */
export interface Receta { titulo: string; pasos: string[]; nota?: string }

const entre = (t: string, re: RegExp) => { const m = t.match(re); return m ? m[1].trim() : null; };
const comillas = (t: string) => entre(t, /["“'‘]([^"”'’]+)["”'’]/);

export function receta(titulo: string, cliente?: string): Receta | null {
  const t = titulo.toLowerCase();
  const ent = comillas(titulo) || entre(titulo, /(?:keyword|término|termino|grupo|campaña|campana)\s+([^\s,;:]+(?:\s+[^\s,;:]+){0,3})/i);

  // Quitar una negativa: es lo contrario de agregarla y los pasos son distintos.
  // Sin este caso, un accionable de "quitar la negativa X" mostraba los pasos para
  // agregarla, que es exactamente el cambio opuesto al pedido.
  if (/negativ/.test(t) && /quitar|sacar|eliminar|remover|borrar|revertir|deshacer/.test(t)) {
    const nivel = /nivel campa|a nivel de campa|campaign/.test(t) ? 'campaña' : /lista/.test(t) ? 'lista' : 'grupo';
    const pasos = nivel === 'lista'
      ? ['En Google Ads, menú izquierdo: Herramientas > Biblioteca compartida > Listas de palabras clave negativas.', `Abrí la lista que contiene${ent ? ` "${ent}"` : ' el término'}.`, `Tildá la fila${ent ? ` de "${ent}"` : ''} y usá "Quitar" en la barra de arriba.`, 'Guardar. La lista sigue aplicada a las campañas; solo sale ese término.']
      : ['En Google Ads, menú izquierdo: Campañas.', nivel === 'campaña' ? 'Abrí la campaña.' : 'Abrí la campaña y después el grupo de anuncios que dice el accionable.', 'En el submenú del medio: Palabras clave > pestaña "Palabras clave negativas".', `Buscá${ent ? ` "${ent}"` : ' el término'} en el filtro de arriba. Fijate que la concordancia sea la misma que dice el accionable: puede haber más de una fila con el mismo texto.`, 'Tildá la fila y usá "Quitar" en la barra de arriba.'];
    return { titulo: `Quitar una negativa de nivel ${nivel}`, pasos, nota: 'Al quitarla, el término vuelve a poder disparar avisos desde la próxima subasta. Si la sacás porque bloqueaba algo que convertía, mirá el gasto de ese término los siguientes 7 días: si vuelve a gastar sin convertir, la negativa estaba bien puesta.' };
  }
  // Agregar negativas
  if (/negativ/.test(t)) {
    const nivel = /nivel campa|a nivel de campa|campaign/.test(t) ? 'campaña' : /lista/.test(t) ? 'lista' : 'grupo';
    const pasos = nivel === 'lista'
      ? ['En Google Ads, menú izquierdo: Herramientas > Biblioteca compartida > Listas de palabras clave negativas.', `Abrí la lista de ${cliente || 'la cuenta'} o creá una nueva con el botón azul +.`, `Pegá el término${ent ? ` "${ent}"` : ''} y elegí la concordancia. Por defecto Google pone exacta; si querés cubrir variantes, cambiá a frase.`, 'Guardá. Verificá que la lista esté aplicada a la campaña: abajo, "Aplicar a campañas".']
      : ['En Google Ads, menú izquierdo: Campañas.', nivel === 'campaña' ? 'Abrí la campaña.' : 'Abrí la campaña y después el grupo de anuncios que dice el accionable.', 'En el submenú del medio: Palabras clave > pestaña "Palabras clave negativas".', `Botón azul + > escribí${ent ? ` "${ent}"` : ' el término'} > elegí la concordancia (exacta si es una búsqueda puntual, frase si querés bloquear todo lo que la contenga).`, 'Guardar.'];
    return { titulo: `Agregar negativa a nivel ${nivel}`, pasos, nota: 'Antes de guardar, buscá el término en Términos de búsqueda con un rango de 30 días: si alguna variante convirtió, la negativa la bloquearía también.' };
  }
  // Pausar keyword
  if (/pausar/.test(t) && /keyword|palabra/.test(t)) {
    return { titulo: 'Pausar una keyword', pasos: ['En Google Ads: Campañas > la campaña > el grupo de anuncios.', 'Submenú: Palabras clave > pestaña "Palabras clave de búsqueda".', `Buscá${ent ? ` "${ent}"` : ' la keyword'} en el filtro de arriba.`, 'Clic en el círculo verde de estado a la izquierda de la fila > Pausar.'], nota: 'Pausar conserva el historial; eliminar lo borra. Siempre pausar.' };
  }
  // Pausar grupo / anuncio
  if (/pausar/.test(t) && /grupo|ad group/.test(t)) {
    return { titulo: 'Pausar un grupo de anuncios', pasos: ['En Google Ads: Campañas > la campaña > Grupos de anuncios.', `Buscá el grupo${ent ? ` "${ent}"` : ''}.`, 'Clic en el círculo verde de estado > Pausar.'], nota: 'Smart Bidding pierde la señal de ese grupo mientras esté pausado. Si es temporal, anotá la fecha para reactivarlo.' };
  }
  if (/pausar/.test(t) && /anuncio|ad\b/.test(t)) {
    return { titulo: 'Pausar un anuncio', pasos: ['En Google Ads: Campañas > la campaña > el grupo > Anuncios.', 'Ubicá el anuncio por su titular o ID.', 'Círculo de estado > Pausar.'] };
  }
  // Concordancia
  if (/concordancia|match type|frase|exacta|amplia/.test(t) && /cambiar|pasar|ajustar|estrechar|narrow/.test(t)) {
    const a = /frase|phrase/.test(t) ? 'frase' : /exacta|exact/.test(t) ? 'exacta' : null;
    return { titulo: `Cambiar la concordancia${a ? ` a ${a}` : ''}`, pasos: ['En Google Ads: Campañas > la campaña > el grupo > Palabras clave.', `Buscá${ent ? ` "${ent}"` : ' la keyword'}.`, 'Pasá el mouse por la fila > ícono de lápiz > Cambiar tipo de concordancia.', a === 'frase' ? 'Elegí "Concordancia de frase". Se ve con comillas en la lista.' : a === 'exacta' ? 'Elegí "Concordancia exacta". Se ve con corchetes en la lista.' : 'Elegí el tipo que dice el accionable.', 'Guardar.'], nota: 'Google conserva el historial de la keyword al cambiar la concordancia, pero Smart Bidding reaprende unos días.' };
  }
  // Puja / tCPA / presupuesto
  if (/tcpa|cpa objetivo|target cpa/.test(t)) {
    return { titulo: 'Cambiar el CPA objetivo', pasos: ['En Google Ads: Campañas > la campaña > Grupos de anuncios (si el tCPA es por grupo) o Configuración (si es por campaña).', 'Por grupo: pasá el mouse sobre la columna "CPA objetivo" de la fila del grupo > lápiz > nuevo valor > Guardar.', 'Por campaña: Configuración > Puja > Cambiar estrategia de puja > editá el CPA objetivo > Guardar.'], nota: 'Un cambio de más de 20% reinicia el aprendizaje de Smart Bidding. Si podés, en dos pasos con una semana entre medio.' };
  }
  if (/presupuesto|budget/.test(t) && /subir|bajar|cambiar|ajustar|reducir|aumentar/.test(t)) {
    return { titulo: 'Cambiar el presupuesto diario', pasos: ['En Google Ads: Campañas.', 'En la fila de la campaña, columna "Presupuesto" > pasá el mouse > lápiz.', 'Escribí el nuevo valor diario > Guardar.', 'Después, registralo en la app: Sistema > Bitácora, para que el análisis del lunes sepa por qué cambió el gasto.'], nota: 'Google puede gastar hasta el doble del diario en un día; el promedio mensual respeta el presupuesto.' };
  }
  if (/maximizar conversiones|maximize conversions|estrategia de puja|bidding strategy/.test(t)) {
    return { titulo: 'Cambiar la estrategia de puja', pasos: ['En Google Ads: Campañas > la campaña > Configuración.', 'Sección Puja > "Cambiar estrategia de puja".', 'Elegí la que dice el accionable (por ejemplo, Maximizar conversiones, sin CPA objetivo al principio).', 'Guardar.'], nota: 'Smart Bidding entra en aprendizaje una o dos semanas. No juzgar el CPA en ese período.' };
  }
  // Conversiones
  if (/primaria|secundaria|conversi[oó]n.*(principal|objetivo)/.test(t)) {
    return { titulo: 'Cambiar si una conversión es primaria o secundaria', pasos: ['En Google Ads: Objetivos (menú izquierdo) > Conversiones > Resumen.', 'Buscá la acción de conversión por nombre y hacé clic en ella.', 'En "Objetivo y acción", editá "Acción de optimización": Primaria cuenta para las pujas; Secundaria solo se registra.', 'Guardar.'], nota: 'Cambiar la primaria reinicia el aprendizaje de Smart Bidding. Solo si la nueva tiene 15+ eventos al mes.' };
  }
  if (/recuento|counting|una por clic|todas/.test(t)) {
    return { titulo: 'Cambiar el recuento de una conversión', pasos: ['En Google Ads: Objetivos > Conversiones > Resumen > clic en la acción.', 'Configuración > "Recuento": "Una" para leads y registros, "Todas" solo para compras.', 'Guardar.'] };
  }
  // Extensiones de anuncio / sitelinks
  if (/sitelink|extensi[oó]n|recurso|asset/.test(t)) {
    return { titulo: 'Editar un recurso del anuncio', pasos: ['En Google Ads: Campañas > la campaña > Recursos (antes se llamaban extensiones).', 'Filtrá por tipo: Enlaces de sitio, Textos destacados, etc.', 'Pasá el mouse sobre el recurso > lápiz > editá el texto o la URL > Guardar.'] };
  }
  // Anuncio RSA
  if (/rsa|anuncio.*(nuevo|crear)|titulares|descripciones/.test(t)) {
    return { titulo: 'Crear o editar un anuncio de búsqueda', pasos: ['En Google Ads: Campañas > la campaña > el grupo > Anuncios.', 'Botón azul + > Anuncio de búsqueda adaptable, o lápiz sobre el existente.', 'Cargá los titulares y descripciones que dice el accionable. La app los genera en Herramientas > RSA Factory.', 'Guardar. Google lo revisa; puede tardar hasta un día en aprobarlo.'] };
  }
  // Landing
  if (/landing|url final|p[aá]gina de destino/.test(t)) {
    return { titulo: 'Cambiar la página de destino', pasos: ['En Google Ads: Campañas > la campaña > el grupo > Palabras clave (si la URL es por keyword) o Anuncios (si es por anuncio).', 'Lápiz sobre la fila > campo "URL final" > nueva URL > Guardar.'], nota: 'Un cambio de landing reinicia el Quality Score de esa keyword.' };
  }
  // Auto-apply / recomendaciones
  if (/auto.?apl|recomendaci[oó]n|ai max|assets autom/.test(t)) {
    return { titulo: 'Desactivar aplicación automática de recomendaciones', pasos: ['En Google Ads: Recomendaciones (menú izquierdo).', 'Arriba a la derecha: "Aplicar automáticamente".', 'Desmarcá todas las casillas. Guardar.', 'Y en la campaña: Configuración > Otros ajustes > AI Max y Recursos creados automáticamente: desactivados.'], nota: 'Para BHI esto es cumplimiento CMF, no preferencia. Verificalo cada mes: Google a veces lo reactiva con un aviso que es fácil pasar por alto.' };
  }
  // Preguntas al cliente / esperar dato
  if (/preguntar|consultar|pedir|confirmar con|esperar/.test(t)) {
    return { titulo: 'Esto es una pregunta, no un cambio en Google Ads', pasos: ['No hay nada que tocar en la cuenta.', 'Mandá la pregunta al contacto que dice el accionable, por el canal habitual.', 'Cuando responda, anotá la respuesta en "Decisión final" del accionable y marcalo Hecho.'] };
  }
  return null;
}
