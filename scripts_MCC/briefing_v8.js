/**
 *  MCC · DIARIO 09:15 · Orden del dia por esfuerzo, alertas agrupadas.
 */
/**
 * NORTHSIGNAL · BRIEFING v7
 * ----------------------------------------------------------------------------
 * Un mail a las 9:15 BA con lo que hay para vos hoy. Si no hay nada, no manda.
 * Lee get_briefing() de Supabase. Corre en el MCC, diario.
 *
 * v2: ademas manda al cliente los reportes aprobados por email, con el PDF adjunto y el
 * link, y los marca enviados. Andres aprueba en la app; el script entrega.
 *
 * v4 (7 sep 2026): OBSERVADOR EXTERNO. El modo de falla de pg_cron es el silencio: si
 * Supabase tiene un incidente o toca el techo de conexiones, las 18 tareas se detienen
 * sin una sola alerta y el historial solo muestra un hueco. Y la salud del sistema, la
 * auditoria y este mismo correo dependian de esas tareas.
 *
 * Este script corre en la infraestructura de Google, no en Supabase. Por eso puede ser
 * el observador: si la base no responde, MANDA EL CORREO IGUAL diciendo que no responde.
 * Eso es lo que antes no pasaba: la base se caia y el sistema que avisa se caia con ella.
 * ----------------------------------------------------------------------------
 */

var CONFIG = {
  APP: { url: 'https://app-northsignal.vercel.app', cronSecret: '0dQmIC25MphBVHyndfaeQgjEfx70anls3btp1JvwVHA' },
  SUPABASE: { url: 'https://djbwxgicosargfobsmqd.supabase.co', serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnd4Z2ljb3Nhcmdmb2JzbXFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODM5OTA1MCwiZXhwIjoyMTAzOTc1MDUwfQ.QqJg2ccFzBkJI2rZ5mHk0QoJ27Lz4sMfOXuK_czaU98' },
  APP_URL: 'https://app-northsignal.vercel.app',
  NOTIFY_EMAIL: 'biggsandres@gmail.com'
};

// Devuelve la salud, o un objeto que declara que la base NO RESPONDE.
// La diferencia importa: null se confunde con "todo bien".
function leerOrdenDelDia() {
  try {
    var r = UrlFetchApp.fetch(CONFIG.SUPABASE.url + '/rest/v1/rpc/orden_del_dia', {
      method: 'post', contentType: 'application/json', payload: '{}',
      headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey },
      muteHttpExceptions: true });
    return r.getResponseCode() < 300 ? JSON.parse(r.getContentText()) : null;
  } catch (e) { return null; }
}

function leerSalud() {
  for (var intento = 1; intento <= 3; intento++) {
    try {
      var r = UrlFetchApp.fetch(CONFIG.SUPABASE.url + '/rest/v1/rpc/get_salud_sistema', {
        method: 'post', contentType: 'application/json', payload: '{}',
        headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey },
        muteHttpExceptions: true });
      if (r.getResponseCode() < 300) { return JSON.parse(r.getContentText()); }
      if (intento < 3) { Utilities.sleep(intento * 5000); continue; }
      return { veredicto: 'la base no responde', codigo: r.getResponseCode(),
               detalle: String(r.getContentText()).substring(0, 300), sin_respuesta: true };
    } catch (e) {
      if (intento < 3) { Utilities.sleep(intento * 5000); continue; }
      return { veredicto: 'la base no responde', detalle: e.message, sin_respuesta: true };
    }
  }
}

// Si Supabase no responde, el briefing tampoco puede leer nada mas. Manda el correo
// con lo unico que sabe: que no responde. Es el caso que justifica todo este script.
function avisarBaseCaida(salud) {
  var cuerpo = 'El sistema NO PUDO LEER SUPABASE esta manana.\n\n' +
    'Detalle: ' + (salud.detalle || 'sin detalle') + (salud.codigo ? ' (codigo ' + salud.codigo + ')' : '') + '\n\n' +
    'Que significa: si la base no responde, las 18 tareas programadas tampoco corrieron, y no hay ' +
    'ninguna alerta de eso porque las alertas viven en la misma base. Este correo llega igual porque ' +
    'el script corre en Google Ads, no en Supabase.\n\n' +
    'Que revisar, en orden:\n' +
    '  1. https://status.supabase.com\n' +
    '  2. El panel del proyecto: puede haber tocado el techo de conexiones.\n' +
    '  3. Cuando vuelva, mirar v_tareas_en_silencio para saber que no corrio.\n\n' +
    CONFIG.APP_URL;
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'NorthSignal · LA BASE NO RESPONDE', cuerpo);
  Logger.log('Aviso de base caida enviado');
}

function main() {
  latir('briefing');
  enviarReportesAprobados();
  var res = UrlFetchApp.fetch(CONFIG.SUPABASE.url + '/rest/v1/rpc/get_briefing', {
    method: 'post', contentType: 'application/json', payload: '{}',
    headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey }, muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) { Logger.log('Supabase ' + res.getResponseCode()); return; }
  var b = JSON.parse(res.getContentText());

  var lineas = [];
  // Salud del sistema primero: si algo esta roto, que se sepa por mail y no leyendo
  // la salida de un agente tres dias despues.
  var salud = leerSalud();
  // Caso critico: la base no responde. Se avisa y se corta, porque nada mas se puede leer.
  if (salud && salud.sin_respuesta) { avisarBaseCaida(salud); return; }
  if (salud && (salud.tareas_en_silencio || []).length) {
    lineas.push('TAREAS QUE DEJARON DE CORRER:');
    salud.tareas_en_silencio.forEach(function (t) { lineas.push('  · ' + t.tarea + ': ' + t.estado); });
    lineas.push('  Si son varias a la vez, mira si Supabase tuvo un incidente: pg_cron se detiene entero sin avisar.');
    lineas.push('');
  }
  if (salud && salud.veredicto === 'hay algo roto') {
    lineas.push('EL SISTEMA TIENE ALGO ROTO:');
    (salud.fallas || []).forEach(function (f) { lineas.push('  · [' + f.area + '] ' + (f.cuenta !== '-' ? f.cuenta + ': ' : '') + f.detalle); });
    lineas.push('');
  } else if (salud && (salud.atencion || []).length) {
    lineas.push('Para mirar del sistema:');
    (salud.atencion || []).forEach(function (f) { lineas.push('  · [' + f.area + '] ' + (f.cuenta !== '-' ? f.cuenta + ': ' : '') + f.detalle); });
    lineas.push('');
  }
  if (b.datos_al_dia === false) lineas.push('Los datos tienen un problema. Mirá Sistema > Datos por cuenta antes de nada.');
  (b.alertas_hoy || []).forEach(function (a) { lineas.push('Pide acción hoy [' + a.cuenta + ']: ' + a.titulo + (a.accion ? ' → ' + a.accion : '')); });
  // El orden del dia: separado por lo que cuesta decidir cada cosa. Una lista de
  // 23 cosas mezcladas no dice si son 23 clics o 23 investigaciones, y eso es lo
  // que decide si vale la pena abrir la app ahora o despues.
  var orden = leerOrdenDelDia();
  if (orden && orden.length) {
    var porBloque = {};
    orden.forEach(function (o) { (porBloque[o.bloque] = porBloque[o.bloque] || []).push(o); });
    ['Un clic', 'Responder', 'Esperan una fecha o un conflicto', 'A mano'].forEach(function (bl) {
      var items = porBloque[bl];
      if (!items || !items.length) return;
      lineas.push('');
      lineas.push(bl.toUpperCase() + ' (' + items.length + '):');
      items.slice(0, 6).forEach(function (o) {
        lineas.push('  · [' + o.cuenta + '] ' + o.titulo);
        if (bl !== 'Un clic') lineas.push('      ' + o.cuanto_cuesta);
      });
      if (items.length > 6) lineas.push('  y ' + (items.length - 6) + ' mas.');
    });
  } else if ((b.accionables_listos || []).length) {
    lineas.push('');
    lineas.push('Listos para ejecutar (' + b.accionables_listos.length + '):');
    b.accionables_listos.slice(0, 8).forEach(function (a) { lineas.push('  · [' + a.cuenta + '] ' + a.titulo); });
  }
  if (b.accionables_por_confirmar) lineas.push('Esperan tu confirmación: ' + b.accionables_por_confirmar);
  (b.reportes_por_aprobar || []).forEach(function (r) { lineas.push('Reporte de ' + r.cuenta + ' (' + r.periodo + ') listo para aprobar.'); });
  if ((b.impactos_nuevos || []).length) {
    lineas.push('');
    lineas.push('Qué pasó 14 días después de tus cambios:');
    b.impactos_nuevos.forEach(function (i) { lineas.push('  · [' + i.cuenta + '] ' + i.titulo + ': ' + (i.variacion != null ? (i.variacion > 0 ? '+' : '') + Math.round(i.variacion) + '%' : i.veredicto)); });
  }
  if (b.alertas_semana) lineas.push('Para mirar esta semana: ' + b.alertas_semana + ' alerta(s).');
  if (b.tickets_respondidos) lineas.push('Claude respondió ' + b.tickets_respondidos + ' ticket(s). Sistema > Tickets.');

  var hayAlgo = lineas.filter(function (l) { return l.trim(); }).length > 0;
  if (!hayAlgo) { Logger.log('Nada pendiente; no se manda.'); return; }

  var cabecera = b.es_lunes ? 'Lunes. Los análisis semanales ya corrieron.' : 'Buen día.';
  var cuerpo = cabecera + '\n\n' + lineas.join('\n') + '\n\n' + CONFIG.APP_URL;
  var asunto = 'NorthSignal · ' + b.fecha + ' · ' +
    ((salud && salud.veredicto === 'hay algo roto') ? 'SISTEMA CON FALLA'
     : (b.alertas_hoy || []).length ? 'hay algo urgente'
     : (function () {
         var unClic = (orden || []).filter(function (o) { return o.bloque === 'Un clic'; }).length;
         var total = (orden || []).length;
         if (!total) return 'nada pendiente';
         return unClic ? unClic + ' de un clic, ' + total + ' en total' : total + ' pendiente(s)';
       })());
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, asunto, cuerpo);
  Logger.log('Enviado: ' + asunto);
}


// Registra que este script corrio. Si el briefing deja de correr, la propia
// v_tareas_en_silencio lo detecta en la proxima corrida de otra cosa.
function latir(tarea) {
  try {
    UrlFetchApp.fetch(CONFIG.SUPABASE.url + '/rest/v1/rpc/latir', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ p_tarea: tarea, p_ok: true }),
      headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey },
      muteHttpExceptions: true });
  } catch (e) { }
}

// ---------------------------------------------------------------
// Reportes aprobados por email: los manda con el PDF y el link, y los marca enviados
// ---------------------------------------------------------------
function enviarReportesAprobados() {
  var res = UrlFetchApp.fetch(CONFIG.APP.url + '/api/cron/reportes-por-enviar', { headers: { 'Authorization': 'Bearer ' + CONFIG.APP.cronSecret }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) { Logger.log('reportes-por-enviar ' + res.getResponseCode()); return; }
  var lista = JSON.parse(res.getContentText());
  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];
    var dest = (r.cuenta && r.cuenta.destinatarios_reporte) ? String(r.cuenta.destinatarios_reporte).split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
    if (!dest.length) { Logger.log('Reporte ' + r.id + ' sin destinatarios en cuentas.destinatarios_reporte; no se manda'); continue; }
    var en = r.idioma === 'en';
    var nombre = r.cuenta.nombre_contacto || '';
    var m = r.metricas || {};
    var kpi = function (k) { return m[k] && m[k].actual != null ? m[k].actual : '-'; };
    // El reporte llega a Andres para que EL lo reenvie al cliente. Por eso el mail
    // trae dos partes: una nota para Andres, y abajo el texto listo para copiar y
    // pegar, en el idioma del cliente. Mandarlo directo al cliente sin que Andres
    // lo lea seria entregar sin revisar.
    var paraCliente = (en
      ? ('Hi' + (nombre ? ' ' + nombre : '') + ',\n\nHere is the performance report for ' + r.periodo_desde + ' to ' + r.periodo_hasta + '.\n\nSpend: ' + kpi('gasto') + '\nConversions: ' + kpi('conversiones') + '\nCPA: ' + kpi('cpa') + '\n\nFull report (web): ' + r.link + '\nThe PDF is attached.\n\nBest,\nAndrés Biggs · NorthSignal')
      : ('Hola' + (nombre ? ' ' + nombre : '') + ',\n\nTe comparto el reporte de rendimiento del ' + r.periodo_desde + ' al ' + r.periodo_hasta + '.\n\nInversión: ' + kpi('gasto') + '\nConversiones: ' + kpi('conversiones') + '\nCPA: ' + kpi('cpa') + '\n\nReporte completo (web): ' + r.link + '\nVa el PDF adjunto.\n\nSaludos,\nAndrés Biggs · NorthSignal'));
    var cuerpo = 'Reporte de ' + (r.cuenta.nombre_cliente || r.account) + ' listo para reenviar.\n' +
      'Período: ' + r.periodo_desde + ' al ' + r.periodo_hasta + '.\n' +
      'Destinatario previsto: ' + (nombre || 'el contacto de la cuenta') + '.\n' +
      'El PDF va adjunto y el link web es ' + r.link + '\n\n' +
      '─────────────────────────────────────────\n' +
      'TEXTO PARA REENVIAR (idioma del cliente: ' + (en ? 'inglés' : 'español') + ')\n' +
      '─────────────────────────────────────────\n\n' + paraCliente;
    var asunto = 'PARA REENVIAR · ' + (r.cuenta.nombre_cliente || r.account) + ' · ' + r.periodo_desde + ' → ' + r.periodo_hasta;
    var opts = { name: 'NorthSignal' };   // sin cc: el destinatario ya es Andres
    try {
      if (r.pdf_url) { var pdf = UrlFetchApp.fetch(r.pdf_url, { muteHttpExceptions: true }); if (pdf.getResponseCode() < 300) opts.attachments = [pdf.getBlob().setName('NorthSignal_' + r.account + '_' + r.periodo_desde + '.pdf')]; }
      MailApp.sendEmail(dest.join(','), asunto, cuerpo, opts);
      UrlFetchApp.fetch(CONFIG.APP.url + '/api/cron/reportes-enviado', { method: 'post', contentType: 'application/json', headers: { 'Authorization': 'Bearer ' + CONFIG.APP.cronSecret }, payload: JSON.stringify({ id: r.id, a: dest.join(',') }), muteHttpExceptions: true });
      Logger.log('Reporte ' + r.id + ' enviado a ' + dest.join(','));
    } catch (e) { Logger.log('Reporte ' + r.id + ' fallo: ' + e.message); }
  }
}
