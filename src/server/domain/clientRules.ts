/**
 * REGLAS DE DOMINIO POR CUENTA · respaldo del system prompt del pulso
 * ----------------------------------------------------------------------------
 * Esto entra al prompt como "REGLAS DE LA CUENTA (no negociables)" cuando
 * `cuentas.reglas_dominio` está vacío. Es un respaldo, y un respaldo que se usa
 * tiene que estar tan bien como la fuente.
 *
 * ACÁ NO VAN NÚMEROS QUE VIVEN EN LA BASE. Había tres presupuestos diarios
 * cableados (135, 20000, 21000) y el modelo razonaba sobre ellos: un
 * presupuesto inventado dentro de un prompt es peor que su ausencia, porque
 * nadie lo ve envejecer. El presupuesto real es `cuentas.presupuesto_diario`.
 * Misma regla para objetivos de CPA, topes y cualquier cifra operativa: si
 * cambia en la base, no puede estar duplicada acá.
 *
 * Lo que sí va: lo que no cambia de una semana a la otra y no se deduce de una
 * métrica — regulación, cómo se mide de verdad el negocio, qué métrica miente
 * en esta cuenta, qué no se puede hacer nunca.
 */
export const CLIENT_RULES = {
  KAREDO: {
    currency: 'EUR', locale: 'de-DE',
    forbiddenMetrics: ['conv_value', 'roas', 'all_conversions'],
    aiContext: `
CUENTA: Karedo GmbH · SaaS B2B de software para tutela legal · Alemania · EUR
Solo Search · Presupuesto diario: el de cuentas.presupuesto_diario, no hay otro.
Los anuncios van en alemán.

REGLAS QUE NO PODÉS VIOLAR:
- NUNCA menciones ROAS ni valor de conversión. El valor está fijado
  arbitrariamente en 20 EUR por registro: cualquier ROAS derivado no significa nada.
  Esta cuenta se juzga por CPA.
- Las conversiones son DIRECCIONALES. Enhanced Conversions tiene 0-15% de
  coincidencia y dispara al hacer clic en "Registrieren", no al completar el
  registro. La dirección del error es DESCONOCIDA: no afirmes que están
  subestimadas ni sobrestimadas.
- No propongas cambios de puja salvo que se apoyen en datos de simulación o en
  un problema estructural evidente.
- Hay una conversión primaria sin datos ("sin conexión (subida)") que corrompe
  la señal de Smart Bidding. Es el problema abierto de mayor prioridad.
- Hay cinco acciones de conversión SIGNUP activas simultáneamente.`
  },

  BHI: {
    currency: 'CLP', locale: 'es-CL',
    forbiddenMetrics: ['conv_value', 'roas'],
    aiContext: `
CUENTA: Best Health International · Asesoría en salud internacional · Chile · CLP
Solo Search · ABC1 en cinco comunas de Santiago
Presupuesto diario: el de cuentas.presupuesto_diario, no hay otro.

REGLAS QUE NO PODÉS VIOLAR:
- RIESGO REGULATORIO: el DFL 251 Art. 46 prohíbe a aseguradoras offshore vender
  o intermediar seguros en Chile. Nunca uses ni sugieras las palabras vender,
  contratar, cotizar, póliza, precios, su seguro ni opciones de cobertura. El
  vocabulario es de asesoría, orientación y acompañamiento. La lista vigente de
  palabras prohibidas está en cuentas.reglas_dominio.
- Nada de copy generado automáticamente: acá el texto lo mira un humano por
  regulación CMF, no por gusto.
- Cualquier señal de AI Max, recursos generados automáticamente o auto-apply es
  un problema de CUMPLIMIENTO LEGAL, no de rendimiento.
- Las conversiones de Google NO son la fuente de verdad del negocio. El pipeline
  real vive en GoHighLevel. Nunca las llames solicitudes ni leads.
- Hay tres conversiones marcadas como primarias, lo que reparte la señal de
  Smart Bidding en objetivos de peso muy distinto.
- Subir presupuesto SÍ genera más volumen, pero a un CPA 55% mayor.
- Ciclo de venta largo: un movimiento semanal casi nunca es significativo.`
  },

  '360': {
    currency: 'CLP', locale: 'es-CL',
    forbiddenMetrics: ['conv_value', 'roas', 'all_conversions'],
    aiContext: `
CUENTA: 360 Producciones · Productora de eventos corporativos · Chile · CLP
Solo Search · Ticket de 3 a 25 millones CLP
Presupuesto diario: el de cuentas.presupuesto_diario, no hay otro.

REGLAS QUE NO PODÉS VIOLAR:
- Los montos de negocio salen del campo Monto de Asana, NUNCA de Google Ads. El
  valor de conversión está inflado por una regla de 1,5x.
- Los cierres llegan por CRM: sin ese dato, un cierre no existe para el análisis.
- NUNCA uses all_conversions. Suma clics a WhatsApp, mail y llamadas que no son
  negocio: en una semana medida fueron 4 conversiones reales contra 10 totales.
- El Quality Score está limitado por la landing, no por los anuncios. Es un techo
  estructural que no se resuelve con pujas.
- Volumen bajo: unos 14 formularios y 0,5 cierres al mes.
- En julio de 2026 un paquete de recomendaciones automáticas de Google revirtió
  meses de trabajo sin ser detectado. Cualquier cambio auto-aplicado es crítico.`
  },

  // Faltaba entera, y era la peor ausencia posible: sin ella el pulso de la
  // cuenta de 46 locales corría con las reglas no negociables EN BLANCO,
  // incluida la única que no se puede violar acá. Lo de abajo sale de CLAUDE.md;
  // todo número operativo (presupuesto por local, objetivo, los grupos de pares)
  // sale de la base, y por eso no está escrito acá.
  FRESH_MONKEE: {
    currency: 'USD', locale: 'en-US',
    aiContext: `
CUENTA: Fresh Monkee · Cadena de batidos · Estados Unidos · USD · 46 locales
Perfil de análisis: cadena. Cada local es un negocio con su propio presupuesto.
Presupuesto diario: el de cuentas.presupuesto_diario. Cuánto le toca a cada
local sale de la base, no de acá: si no lo tenés, decí que no lo podés saber.

REGLAS QUE NO PODÉS VIOLAR:
- EL PRESUPUESTO DE UN LOCAL NO SE MUEVE A OTRO. Nunca propongas financiar un
  local con lo que le sobra a otro, ni "reasignar entre locales", ni un tope
  común: no es una optimización, es plata de otro dueño.
- Un local se compara SOLO contra su grupo de pares. Nunca contra el promedio de
  la cadena, contra el mejor local ni contra un local de otro grupo. Si no sabés
  a qué grupo pertenece, no lo compares con nada.
- El radio de la acción tiene que ser el radio de la evidencia: un veredicto
  calculado sobre un local no autoriza un cambio a nivel cuenta ni sobre otro
  local. Vale para negativas, pausas y presupuestos.
- Con 46 locales, un promedio de la cadena casi nunca significa algo: el número
  que sirve es por local o por grupo de pares.
- Si hay visitas a tienda, son MODELADAS por Google. Que no aparezcan no es
  cero, y no se suman a las conversiones como si fueran del mismo tipo.
- Qué métricas no valen en esta cuenta (por ejemplo si el valor de conversión
  está cargado de verdad) no se puede saber desde este archivo: sale de
  cuentas.reglas_dominio y del doc maestro. No supongas que todas sirven.`
  }
} as const;

export function getClientContext(client: string): string {
  const reglas = CLIENT_RULES[client as keyof typeof CLIENT_RULES]?.aiContext;
  if (reglas) return reglas;
  // "Sin contexto específico de negocio" se lee como "esta cuenta no tiene
  // reglas", que es una afirmación, y falsa: lo que pasa es que no las tenemos.
  // Un prompt sin reglas tiene que decir que no las tiene y frenar, no seguir.
  return `SIN REGLAS DE DOMINIO PARA ${client}.
No es que esta cuenta no tenga reglas: es que no llegaron ni de cuentas.reglas_dominio
ni del respaldo del repo. Trabajá como si hubiera restricciones que no ves: no propongas
cambios de presupuesto, de puja ni de copy, y decí explícitamente que faltan las reglas
de la cuenta antes de cualquier recomendación.`;
}
