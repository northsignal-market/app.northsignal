export const CLIENT_RULES = {
  KAREDO: {
    currency: 'EUR', locale: 'de-DE', dailyBudget: 135,
    forbiddenMetrics: ['conv_value', 'roas', 'all_conversions'],
    aiContext: `
CUENTA: Karedo GmbH · SaaS B2B de software para tutela legal · Alemania · EUR
Presupuesto: 135 EUR/día · Solo Search

REGLAS QUE NO PODÉS VIOLAR:
- NUNCA menciones ROAS ni valor de conversión. El valor está fijado
  arbitrariamente en 20 EUR por registro: cualquier ROAS derivado no significa nada.
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
    currency: 'CLP', locale: 'es-CL', dailyBudget: 20000,
    forbiddenMetrics: ['conv_value', 'roas'],
    aiContext: `
CUENTA: Best Health International · Asesoría en salud internacional · Chile · CLP
Presupuesto: 20.000 CLP/día · Solo Search · ABC1 en cinco comunas de Santiago

REGLAS QUE NO PODÉS VIOLAR:
- RIESGO REGULATORIO: el DFL 251 Art. 46 prohíbe a aseguradoras offshore vender
  o intermediar seguros en Chile. Nunca uses ni sugieras las palabras vender,
  contratar, cotizar, póliza, precios, su seguro ni opciones de cobertura. El
  vocabulario es de asesoría, orientación y acompañamiento.
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
    currency: 'CLP', locale: 'es-CL', dailyBudget: 21000,
    forbiddenMetrics: ['conv_value', 'roas', 'all_conversions'],
    aiContext: `
CUENTA: 360 Producciones · Productora de eventos corporativos · Chile · CLP
Presupuesto: 21.000 CLP/día · Solo Search · Ticket de 3 a 25 millones CLP

REGLAS QUE NO PODÉS VIOLAR:
- Los montos de negocio salen del campo Monto de Asana, NUNCA de Google Ads. El
  valor de conversión está inflado por una regla de 1,5x.
- NUNCA uses all_conversions. Suma clics a WhatsApp, mail y llamadas que no son
  negocio: en una semana medida fueron 4 conversiones reales contra 10 totales.
- El Quality Score está limitado por la landing, no por los anuncios. Es un techo
  estructural que no se resuelve con pujas.
- Volumen bajo: unos 14 formularios y 0,5 cierres al mes.
- En julio de 2026 un paquete de recomendaciones automáticas de Google revirtió
  meses de trabajo sin ser detectado. Cualquier cambio auto-aplicado es crítico.`
  }
} as const;

export function getClientContext(client: string): string {
  return CLIENT_RULES[client as keyof typeof CLIENT_RULES]?.aiContext || 'Sin contexto específico de negocio.';
}
