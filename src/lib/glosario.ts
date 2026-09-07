/**
 * Glosario del sistema. Una fuente para tooltips en tablas, gráficos y veredictos.
 * Cada definición bajo 150 caracteres: es un tooltip, no un manual.
 */
export const GLOSARIO: Record<string, string> = {
  // Métricas base
  'CPA': 'Costo por conversión: gasto dividido por conversiones. Se recalcula sobre sumas, nunca se promedia.',
  'CPC': 'Costo por clic promedio: gasto dividido por clics.',
  'CTR': 'Tasa de clics: clics dividido por impresiones. Mide relevancia del anuncio.',
  'Conv. rate': 'Tasa de conversión: conversiones dividido por clics. Mide la landing y la calidad del tráfico.',
  'Impresiones': 'Veces que el anuncio se mostró. Con cuota constante, refleja la demanda real.',
  'Gasto': 'Costo total en la moneda de la cuenta.',
  // Cuotas
  'Impression share': 'Cuota de impresiones: qué porcentaje de las subastas elegibles ganó el anuncio.',
  'IS': 'Cuota de impresiones: porcentaje de subastas elegibles donde el anuncio apareció.',
  'Lost IS budget': 'Cuota perdida por presupuesto: demanda que existió y no se capturó por falta de dinero.',
  'Lost IS rank': 'Cuota perdida por ranking: demanda que no se capturó por Quality Score o puja baja. Presupuesto no lo arregla.',
  'Limitada por': 'Qué frena a la campaña: presupuesto (falta dinero) o ranking (falta calidad o puja).',
  // Calidad
  'Quality Score': 'Puntaje 1-10 de Google por relevancia, CTR esperado y landing. Baja el CPC cuando sube.',
  'QS': 'Quality Score: puntaje 1-10 de relevancia. Cuanto más alto, menos cuesta cada clic.',
  // Escalamiento
  'CPA marginal': 'Cuánto cuesta cada conversión ADICIONAL al subir presupuesto. Si duplica al promedio, la campaña está saturada.',
  'Headroom': 'Margen para escalar: el siguiente escalón de presupuesto rinde parecido al actual.',
  'Saturada': 'El siguiente peso compra conversiones al doble o más. Subir presupuesto no rinde.',
  'Techo': 'Cuota de impresiones sobre 90%: no queda demanda por capturar.',
  // Datos
  'Madurez': 'Cuán asentado está el dato: provisional (últimos 2 días), madurando (3-7) o consolidado (7+).',
  'Provisional': 'Dato de los últimos 2 días. Las conversiones pueden llegar tarde; no sostiene conclusiones.',
  'Consolidado': 'Dato con 7+ días: las conversiones ya llegaron. Es el que se usa para decidir.',
  'Días con datos': 'Cuántos días del rango tienen extracción. Si es menor al rango, el total es parcial.',
  // Anomalías
  'z-score': 'Desvío contra la media móvil de 7 días, en desviaciones estándar. 2 = raro, 3 = muy raro.',
  'Anomalía': 'Día con desvío estadístico de gasto o CPA contra su media móvil. Los provisionales se ignoran.',
  'Baseline': 'Media móvil de los 7 días previos. La referencia contra la que se mide el desvío.',
  // Estructura
  'Branded': 'Grupo de keywords de marca. Captura demanda existente; no es crecimiento.',
  'Concordancia': 'Cómo Google empareja la búsqueda con la keyword: exacta, frase o amplia.',
  'Término nuevo': 'Búsqueda que apareció por primera vez en los últimos 14 días. Si gasta sin convertir, candidato a negativa.',
  'Keyword disparadora': 'La keyword que hizo que el anuncio apareciera para ese término de búsqueda.',
  'Negativa': 'Palabra que impide que el anuncio aparezca. Se propone; nunca se aplica sola.',
  // Conversiones
  'Primaria': 'Conversión que Smart Bidding usa para optimizar. Debe ser la etapa más profunda con 15+ eventos/mes.',
  'Secundaria': 'Conversión que se registra pero no guía la puja.',
  'Smart Bidding': 'Puja automática de Google. Necesita 15+ conversiones al mes para aprender.',
  'tCPA': 'CPA objetivo: le dice a Smart Bidding cuánto pagar por conversión.',
  'Escalera de valor': 'Etapas del embudo con valor estimado cada una. La primaria debería ser la más profunda con volumen.',
  'GCLID': 'Identificador del clic de Google. Permite subir conversiones offline.',
  'GBRAID': 'Identificador del clic en iOS con privacidad. Equivale al GCLID; Make lo descartaba.',
  'Ventana de 90 días': 'Google solo acepta conversiones offline de clics de hasta 90 días. Un ciclo más largo no se puede atribuir.',
  // Sistema
  'Acción estructurada': 'El accionable como dato: verbo de lista cerrada, objeto, parámetros y qué verificar. El título se deriva de esto y el botón de ejecutar lo lee.',
  'Pre-vuelo': 'Chequeo antes de ejecutar: si otro accionable abierto entra en conflicto con este, no se ejecuta hasta resolverlo.',
  'Versión': 'Cada vez que el cuerpo de un accionable cambia, el sistema guarda qué cambió, cuándo y por qué. Lo ves en el accionable.',
  'Bandeja': 'La cola de lo que espera tu criterio: acción hoy, listos, por confirmar, reportes. Vacía es la meta.',
  'Calibración': 'Si el sistema acierta lo que promete: con 80% de confianza declarada, debería acertar 8 de 10.',
  'Predicción': 'Rango de conversiones o CPA para la semana que empieza, con la probabilidad de caer adentro. Se compara el lunes siguiente.',
  'Pulso diario': 'Interpretación de Sonnet 5 de cada día contra el plan de la semana. Evidencia, no conclusión.',
  'Plan semanal': 'Lo que Opus 5 escribió el lunes: qué vigilar, con qué umbral, qué hipótesis probar.',
  'Leading indicator': 'Métrica que se mueve antes que el resultado. Con lo leading se dirige; con lo lagging se califica.',
  'Reflexión': 'Lo que una corrida escribió sobre qué haría distinto. La siguiente la lee.',
  'Naturaleza': 'Observación (dato), Inferencia (deducción) o Hipótesis (conjetura). Solo las observaciones nacen Propuestas.',
  'Handoff': 'Memoria de trabajo del brief: hipótesis abiertas, cambios cuyo efecto no se ve, datos provisionales.',
  'Veredicto': 'Conclusión calculada, no opinión: HEADROOM, TECHO, LIMITADA POR RANKING, NO ESCALAR, INESTABLE.',
  'Tasa de acierto': 'De los accionables ejecutados, cuántos movieron la métrica en la dirección esperada.',
  'MDE': 'Efecto mínimo detectable: cuánto tendría que moverse una métrica para que un test lo vea. Sobre 35%, no testeable.',
};

export function definir(termino: string): string | undefined {
  return GLOSARIO[termino] ?? GLOSARIO[Object.keys(GLOSARIO).find(k => k.toLowerCase() === termino.toLowerCase()) ?? ''];
}
