/**
 *  SOLO FRESH MONKEE · A MANO. Correr primero con MODO='simular'.
 */
/**
 * NORTHSIGNAL · ETIQUETADOR v1
 * ----------------------------------------------------------------------------
 * Escribe en Google Ads la taxonomia que el sistema resuelve en Supabase, como
 * etiquetas. No renombra nada: renombrar 81 campañas reinicia el aprendizaje de
 * Smart Bidding en todas a la vez. Las etiquetas dan la misma estructura y son
 * reversibles, se filtran en la interfaz y las lee cualquiera que entre a la cuenta.
 *
 * Etiquetas que aplica, todas con prefijo ns: para que se distingan de las del cliente:
 *   ns:loc=Austin        el local al que pertenece la campaña
 *   ns:obj=compra_online el objetivo (compra_online, visitas, apertura, franquicia)
 *   ns:tipo=search       el tipo de campaña
 *
 * MODO: 'simular' escribe en el log lo que haria, sin tocar la cuenta. Correlo asi
 * la primera vez y revisá la lista. 'ejecutar' aplica.
 * Corre a mano, no programado. Una vez que las campañas estan etiquetadas, solo
 * hace falta volver a correrlo cuando se crean campañas nuevas.
 * ----------------------------------------------------------------------------
 */

var CONFIG = {
  MODO: 'simular',                       // 'simular' | 'ejecutar'
  ACCOUNT: 'FRESH_MONKEE',               // la cuenta en Supabase
  SUPABASE: {
    url: 'https://djbwxgicosargfobsmqd.supabase.co',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnd4Z2ljb3Nhcmdmb2JzbXFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODM5OTA1MCwiZXhwIjoyMTAzOTc1MDUwfQ.QqJg2ccFzBkJI2rZ5mHk0QoJ27Lz4sMfOXuK_czaU98'
  },
  NOTIFY_EMAIL: 'biggsandres@gmail.com',
  MAX_CAMBIOS: 300                       // tope de seguridad por corrida
};

function latir(t, ok, err) {
  try {
    UrlFetchApp.fetch(CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/rpc/latir', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ p_tarea: t, p_ok: ok !== false, p_error: err || null }),
      headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey },
      muteHttpExceptions: true });
  } catch (x) { }
}

function main() {
  try { _main(); latir('etiquetador', true); }
  catch (err) { latir('etiquetador', false, err.message); throw err; }
}

function _main() {
  var mapa = leerMapa();
  if (!mapa.length) { Logger.log('Sin mapa en Supabase: cargá campaign_mapa y locations primero.'); return; }
  Logger.log(mapa.length + ' reglas de mapeo leidas');

  var existentes = {};
  var itL = AdsApp.labels().get();
  while (itL.hasNext()) { existentes[itL.next().getName()] = true; }

  var log = [], cambios = 0, saltadas = 0;
  var it = AdsApp.campaigns().withCondition('Status != REMOVED').get();
  while (it.hasNext()) {
    if (cambios >= CONFIG.MAX_CAMBIOS) { log.push('Tope de ' + CONFIG.MAX_CAMBIOS + ' cambios alcanzado; el resto en la proxima corrida'); break; }
    var c = it.next(), nombre = c.getName();
    var r = resolver(nombre, mapa);
    if (!r) { saltadas++; log.push('  SIN MAPEO  ' + nombre); continue; }

    var quiere = [];
    if (r.location) quiere.push('ns:loc=' + r.location);
    if (r.objetivo) quiere.push('ns:obj=' + r.objetivo);
    if (r.tipo) quiere.push('ns:tipo=' + r.tipo);

    var tiene = {};
    var itc = c.labels().get();
    while (itc.hasNext()) { tiene[itc.next().getName()] = true; }

    var poner = [], sacar = [];
    for (var i = 0; i < quiere.length; i++) { if (!tiene[quiere[i]]) poner.push(quiere[i]); }
    // Quitar etiquetas ns: viejas que ya no corresponden
    for (var k in tiene) { if (k.indexOf('ns:') === 0 && quiere.indexOf(k) < 0) sacar.push(k); }
    if (!poner.length && !sacar.length) continue;

    if (CONFIG.MODO === 'simular') {
      log.push('  ' + nombre + (poner.length ? '  +[' + poner.join('] +[') + ']' : '') + (sacar.length ? '  -[' + sacar.join('] -[') + ']' : ''));
    } else {
      for (var j = 0; j < poner.length; j++) {
        if (!existentes[poner[j]]) { AdsApp.createLabel(poner[j]); existentes[poner[j]] = true; }
        c.applyLabel(poner[j]);
      }
      for (var m = 0; m < sacar.length; m++) { c.removeLabel(sacar[m]); }
      log.push('  ' + nombre + '  ' + poner.length + ' puestas, ' + sacar.length + ' quitadas');
    }
    cambios++;
  }

  var cabecera = (CONFIG.MODO === 'simular' ? 'SIMULACION, no se toco nada' : 'APLICADO') +
    ': ' + cambios + ' campañas con cambios, ' + saltadas + ' sin mapeo.';
  var cuerpo = cabecera + '\n\n' + log.join('\n');
  Logger.log(cuerpo);
  if (CONFIG.NOTIFY_EMAIL) MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'NorthSignal etiquetador · ' + cabecera.substring(0, 60), cuerpo.substring(0, 20000));
}

function resolver(nombre, mapa) {
  var mejor = null;
  for (var i = 0; i < mapa.length; i++) {
    var m = mapa[i];
    try { if (new RegExp(m.patron, 'i').test(nombre)) { if (!mejor || m.prioridad < mejor.prioridad) mejor = m; } } catch (e) { }
  }
  return mejor;
}

function leerMapa() {
  var url = CONFIG.SUPABASE.url + '/rest/v1/campaign_mapa?select=patron,prioridad,location_codigo,objetivo,tipo_campana&account=eq.' +
    encodeURIComponent(CONFIG.ACCOUNT) + '&activa=is.true&order=prioridad';
  var res = UrlFetchApp.fetch(url, { headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) { Logger.log('Supabase ' + res.getResponseCode() + ': ' + res.getContentText().substring(0, 200)); return []; }
  return JSON.parse(res.getContentText()).map(function (r) {
    return { patron: r.patron, prioridad: r.prioridad || 100, location: r.location_codigo, objetivo: r.objetivo, tipo: r.tipo_campana };
  });
}
