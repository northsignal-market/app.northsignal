/**
 * NORTHSIGNAL - ALERTA DIARIA DE EMERGENCIA
 * Programar en Google Ads para que corra todos los días a las 08:00 AM.
 * 
 * Propósito: Detectar anomalías graves (caída de conversiones o picos de gasto)
 * al día siguiente, sin esperar al reporte semanal de los lunes.
 */

var NOTIFY_EMAIL = 'biggsandres@gmail.com';
var DAILY_BUDGET = 135; // Presupuesto diario de Karedo

function main() {
  var account = AdsApp.currentAccount();
  var accountName = account.getName();
  
  // Extraer datos de AYER
  var stats = account.getStatsFor('YESTERDAY');
  var cost = stats.getCost();
  var conversions = stats.getConversions();
  
  var alerts = [];
  
  // Regla 1: Gasto descontrolado (50% por encima del límite diario)
  if (cost > (DAILY_BUDGET * 1.5)) {
    alerts.push("⚠️ Pico de gasto detectado: " + cost.toFixed(2) + " EUR (Límite esperado: " + DAILY_BUDGET + ")");
  }
  
  // Regla 2: Día en cero (Si gasta más de 30 EUR y no trae ni 1 conversión)
  if (cost > 30 && conversions === 0) {
    alerts.push("🚨 Día sin conversiones. Se gastaron " + cost.toFixed(2) + " EUR sin resultados.");
  }
  
  // Si hay alguna alerta, enviar email inmediato
  if (alerts.length > 0) {
    var subject = "URGENTE: Anomalía en Google Ads - " + accountName;
    var body = "Revisión de ayer en " + accountName + ":\n\n" +
               alerts.join('\n') + "\n\n" +
               "Gasto total de ayer: " + cost.toFixed(2) + " EUR\n" +
               "Conversiones totales: " + conversions + "\n\n" +
               "Revisa la cuenta lo antes posible.";
               
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
    Logger.log("Alerta enviada: " + alerts.join(' | '));
  } else {
    Logger.log("Todo normal. Gasto: " + cost + ", Conversiones: " + conversions);
  }
}
