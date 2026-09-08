/**
 *  INSTALAR EN EL MCC 641-902-5021 · cada 4 horas
 *  Procesa KAREDO, BHI y 360. Saltea Fresh Monkee, que corre su propia copia.
 */
/**
 * NORTHSIGNAL — CENTINELA INTRADÍA  ·  v13
 * ============================================================================
 * MCC NorthSignal (641-902-5021) · programar CADA 4 HORAS
 *
 * QUÉ HACE Y POR QUÉ
 *
 * 1. Trae los cambios de la cuenta a Supabase varias veces al día.
 *    El script semanal solo extrae change_event los lunes, así que el análisis
 *    ve los cambios de la semana ANTERIOR, no los de esta. Con el centinela al
 *    día, el brief del lunes puede decir "el miércoles sacaste X y el CPA bajó
 *    12% desde entonces", y Gemini puede evaluar un accionable sabiendo si ya
 *    lo tocaste.
 *
 * 2. Avisa por correo SOLO si algo rompe un umbral.
 *    Detectar un pico de gasto es una comparación contra un número, no requiere
 *    un modelo de lenguaje. Cuesta cero tokens y responde al instante.
 *
 * 3. Registra el pulso en google_live_events como serie histórica.
 *
 * CORRECCIÓN CRÍTICA RESPECTO DE LA v5
 * account.getStatsFor().getCost() devuelve el costo YA en unidades monetarias.
 * La versión anterior lo pasaba por cost(), que divide por 10.000 porque está
 * escrita para los micros de GAQL. Resultado verificado en la base: 360 y BHI
 * escribían 0,02 y KAREDO 0. El centinela nunca podía detectar un pico.
 * Acá se usa n2(), que solo redondea.
 */

// v8 (6 sep 2026): vigila los ajustes que Google esta migrando a AI Max este mes
// (broad match a nivel de campana, recursos automaticos) y AI Max mismo. Si alguno
// esta activo en una campana ENABLED, avisa y registra un evento AUTO_CHANGE. Para BHI
// es riesgo regulatorio; para todas, cambia como se emparejan busquedas y se genera copy.

var CONFIG = {

  NOTIFY_EMAIL: 'biggsandres@gmail.com',

  SUPABASE: {
    enabled: true,
    url: 'https://djbwxgicosargfobsmqd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnd4Z2ljb3Nhcmdmb2JzbXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTkwNTAsImV4cCI6MjEwMzk3NTA1MH0.zJQxou6UBOJNQ8DtQKKOtFZ43u_y9FKSDZ4inZR_vO0',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnd4Z2ljb3Nhcmdmb2JzbXFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODM5OTA1MCwiZXhwIjoyMTAzOTc1MDUwfQ.QqJg2ccFzBkJI2rZ5mHk0QoJ27Lz4sMfOXuK_czaU98'
  },

  /**
   * Umbrales de aviso inmediato, en la moneda de cada cuenta.
   * Son los mismos del script semanal, adaptados a un día en curso.
   */
  ACCOUNTS: [
    {
      cid: '497-723-1137',
      label: 'FRESH_MONKEE', currency: 'USD',
      soloCuentaUnica: true,        // el MCC no la ve: la corre el script instalado dentro de la cuenta
      sheetUrl: '',                  // Fresh Monkee no usa Sheet
      dailyBudget: 150,             // USD/dia: 22 campanas OP activas por ~5 USD
      spendSpikeFactor: 1.5,        // avisa si el gasto del dia supera 225 USD
      noConvMinSpend: 120,          // avisa si gasto mas de 120 USD sin una sola conversion
      // Umbrales fijados el 8 sep 2026 con datos reales: CPA de compra online 5,44 USD
      // sobre 594 conversiones en 4 semanas. cpaMax en 12 deja margen para un mal dia
      // sin ahogar en avisos. Antes estaban TODOS en cero: el centinela no alertaba nada.
      thresholds: { cpaMax: 12, convMin: 40, imprShareMin: 0, ctrMin: 0, kwSpendNoConv: 25, spendDeviation: 0.3 },
      note: 'Multi-local (cadena). Objetivos distintos por campana: visitas/direcciones, compra online, llamadas. Ver campaign_mapa en Supabase. No mezclar CPA entre objetivos.'
    },
    {
      cid: '913-287-4649', label: 'KAREDO', currency: 'EUR',
      dailyBudget: 135,
      spendSpikeFactor: 1.5,   // avisa si el gasto del día supera 202,5 EUR
      noConvMinSpend: 90,      // avisa si gastó más de 90 y no convirtió nada
      // Umbrales con datos reales al 8 sep 2026: CPA de 4 semanas 38,47 EUR sobre
      // 95 conversiones, p90 en 43. cpaMax en 55 deja margen para una mala semana.
      thresholds: { cpaMax: 55, convMin: 15, imprShareMin: 0, ctrMin: 0, kwSpendNoConv: 45, spendDeviation: 0.3 },
    },
    {
      cid: '882-940-8394', label: 'BHI', currency: 'CLP',
      dailyBudget: 20000,
      spendSpikeFactor: 1.5,   // 30.000 CLP
      noConvMinSpend: 21150,   // p60 del gasto diario. Antes 40.000: IMPOSIBLE, mayor que el maximo de un dia (32.550)
      // CPA real de 4 semanas 15.411 CLP sobre 27 solicitudes, p90 en 19.699.
      // cpaMax en 26.000 avisa cuando se dispara sin ahogar en falsos positivos.
      thresholds: { cpaMax: 26000, convMin: 4, imprShareMin: 0, ctrMin: 0, kwSpendNoConv: 12000, spendDeviation: 0.3 },
    },
    {
      cid: '378-925-9849', label: '360', currency: 'CLP',
      dailyBudget: 20000,      // confirmado 6 sep 2026; era 21000 por error
      spendSpikeFactor: 1.7,   // 34.000 CLP
      noConvMinSpend: 20769,   // p60 del gasto diario. Antes 50.000: IMPOSIBLE, mayor que el maximo de un dia (40.000)
      // CPA real de 4 semanas 41.042 CLP sobre 14 leads. El p90 es 148.740 porque el
      // volumen es bajo y una semana mala lo dispara: por eso cpaMax va en 90.000 y
      // no en el p90, que nunca avisaria. convMin en 2: bajar de ahi si merece mirada.
      thresholds: { cpaMax: 90000, convMin: 2, imprShareMin: 0, ctrMin: 0, kwSpendNoConv: 30000, spendDeviation: 0.3 },
    }
  ]
};

// Registra que este script corrio. Sin esto, si el script deja de dispararse en Google Ads
// nadie se entera: no hay error, simplemente no pasa nada. Es el mismo problema del
// silencio que tiene pg_cron, y se resuelve igual: latido y aviso por ausencia.
// Declara los umbrales que este script tiene cableados, para que Supabase pueda
// contrastarlos. Fresh Monkee corrio meses con todos en cero y nadie lo veia.
function declararUmbrales(conf) {
  var pares = [
    ['dailyBudget', conf.dailyBudget],
    ['spendSpikeFactor', conf.spendSpikeFactor],
    ['noConvMinSpend', conf.noConvMinSpend],
    ['cpaMax', conf.thresholds && conf.thresholds.cpaMax],
    ['convMin', conf.thresholds && conf.thresholds.convMin],
    ['kwSpendNoConv', conf.thresholds && conf.thresholds.kwSpendNoConv]
  ];
  for (var i = 0; i < pares.length; i++) {
    if (pares[i][1] === undefined || pares[i][1] === null) continue;
    try {
      UrlFetchApp.fetch(CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/rpc/declarar_umbral', {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ p_account: conf.label, p_script: 'centinela',
          p_umbral: pares[i][0], p_valor: pares[i][1] }),
        headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey },
        muteHttpExceptions: true });
    } catch (e) { }
  }
}

function latir(tarea, ok, error) {
  try {
    UrlFetchApp.fetch(CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/rpc/latir', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ p_tarea: tarea, p_ok: ok !== false, p_error: error || null }),
      headers: { 'apikey': CONFIG.SUPABASE.serviceKey || CONFIG.SUPABASE.anonKey,
                 'Authorization': 'Bearer ' + (CONFIG.SUPABASE.serviceKey || CONFIG.SUPABASE.anonKey) },
      muteHttpExceptions: true });
  } catch (e) { }
}



// ---------------------------------------------------------------
// MODO CUENTA UNICA (7 sep 2026): si el script corre DENTRO de una cuenta
// (sin MCC), AdsManagerApp no existe. Se procesa la cuenta actual y se
// finaliza con un resultado sintetico. Mismo codigo, misma salida.
// Requisito: la cuenta esta en CONFIG.ACCOUNTS con su CID.
// ---------------------------------------------------------------
function resultadoSintetico(valor, cid) {
  return { getStatus: function () { return 'OK'; }, getReturnValue: function () { return valor; }, getCustomerId: function () { return cid; }, getError: function () { return ''; } };
}

function main() {
  try { _main(); latir('centinela', true); }
  catch (e) { latir('centinela', false, e.message); throw e; }
}

function _main() {
  if (typeof AdsManagerApp === 'undefined') {
    var cid1 = AdsApp.currentAccount().getCustomerId();
    finalizeCentinela([resultadoSintetico(processCentinela(), cid1)]);
    return;
  }
  var ids = CONFIG.ACCOUNTS.filter(function (a) { return !a.soloCuentaUnica; }).map(function (a) { return a.cid; });
  AdsManagerApp.accounts().withIds(ids)
    .executeInParallel('processCentinela', 'finalizeCentinela');
}


// Estado de AI Max ya conocido: se consulta una vez por corrida contra Supabase.
var AI_MAX_CACHE = null;
function aiMaxConocido(cuenta, entidad, firma) {
  if (AI_MAX_CACHE === null) {
    AI_MAX_CACHE = {};
    try {
      var url = CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/ai_max_estado?select=entidad,firma&account=eq.' + encodeURIComponent(cuenta) + '&limit=500';
      var res = UrlFetchApp.fetch(url, { headers: { 'apikey': CONFIG.SUPABASE.anonKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey }, muteHttpExceptions: true });
      if (res.getResponseCode() < 300) { JSON.parse(res.getContentText()).forEach(function (r) { AI_MAX_CACHE[r.entidad] = r.firma; }); }
    } catch (e) { }
  }
  var previo = AI_MAX_CACHE[entidad];
  if (previo === firma) return true;
  // Nuevo o cambiado: se registra el estado para no volver a avisar
  try {
    UrlFetchApp.fetch(CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/ai_max_estado',
      { method: 'post', contentType: 'application/json',
        headers: { 'apikey': CONFIG.SUPABASE.anonKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey, 'Prefer': 'resolution=merge-duplicates' },
        payload: JSON.stringify([{ account: cuenta, entidad: entidad, firma: firma, visto_el: new Date().toISOString() }]), muteHttpExceptions: true });
    AI_MAX_CACHE[entidad] = firma;
  } catch (e) { }
  return false;
}

function processCentinela() {
  AI_MAX_CACHE = null;
  MAPA_IDS = null;
  var nAiMaxYaConocidos = 0;
  var account = AdsApp.currentAccount();
  var cid = account.getCustomerId();

  var conf = CONFIG.ACCOUNTS.filter(function (a) {
    return a.cid.replace(/-/g, '') === cid.replace(/-/g, '');
  })[0];
  if (!conf) { return 'Cuenta no configurada: ' + cid; }

  var tz = account.getTimeZone();
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  var hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var payload = [];
  var alertas = [];
  var log = [conf.label + ' (' + hoy + ')'];

  // ---------------------------------------------------------------
  // 1. Gasto y conversiones del día
  // ---------------------------------------------------------------
  var gasto = 0, conv = 0;
  try {
    var stats = account.getStatsFor('TODAY');
    gasto = n2(stats.getCost());          // getCost() YA viene en la moneda
    conv  = n2(stats.getConversions());

    payload.push({
      account: conf.label,
      event_type: 'METRICS',
      spend_today: gasto,
      conversions_today: conv,
      event_date: stamp
    });
    log.push('  gasto ' + gasto + ' ' + conf.currency + ' · conv ' + conv);

    // --- umbral: pico de gasto
    declararUmbrales(conf);
  var tope = conf.dailyBudget * conf.spendSpikeFactor;
    if (gasto > tope) {
      alertas.push('PICO DE GASTO · ' + conf.label + ': ' + gasto + ' ' +
                   conf.currency + ' hoy, sobre un tope esperado de ' +
                   Math.round(tope) + '. Presupuesto diario: ' + conf.dailyBudget + '.');
    }

    // --- umbral: gasto alto sin ninguna conversión
    if (conv === 0 && gasto > conf.noConvMinSpend) {
      alertas.push('SIN CONVERSIONES · ' + conf.label + ': ' + gasto + ' ' +
                   conf.currency + ' gastados hoy sin una sola conversión.');
    }

  } catch (e) {
    log.push('  metricas no disponibles: ' + e.message);
  }

  // ---------------------------------------------------------------
  // 2. Cambios del día
  //
  // Se traen TODOS, no solo los automáticos. Los cambios propios son el dato
  // que permite que el analisis semanal sepa que se ejecuto durante la semana,
  // y que un accionable ya resuelto se pueda cerrar sin esperar al lunes.
  // ---------------------------------------------------------------
  try {
    var q =
      'SELECT change_event.change_date_time, change_event.user_email, ' +
      'change_event.client_type, change_event.change_resource_type, ' +
      'change_event.resource_change_operation, change_event.changed_fields, ' +
      'change_event.campaign, change_event.ad_group ' +
      'FROM change_event ' +
      'WHERE change_event.change_date_time DURING TODAY ' +
      'ORDER BY change_event.change_date_time DESC LIMIT 100';

    var res = AdsApp.search(q);
    var nCambios = 0, nAuto = 0;

    while (res.hasNext()) {
      var ce = res.next().changeEvent;
      var clientType = ce.clientType || '';
      var esAuto = clientType.indexOf('RECOMMENDATION') >= 0 ||
                   clientType.indexOf('GOOGLE_FIRST_PARTY') >= 0;
      nCambios++;

      payload.push({
        account: conf.label,
        event_type: esAuto ? 'AUTO_CHANGE' : 'USER_CHANGE',
        entity_name: ce.changeResourceType +
                     (ce.campaign ? ' · ' + shortName(ce.campaign) : '') +
                     (ce.changedFields ? ' [' + ce.changedFields + ']' : ''),
        client_type: clientType,
        user_email: ce.userEmail || 'Google',
        event_date: ce.changeDateTime || stamp
      });

      // Solo los automáticos generan aviso. Los propios ya los conocés.
      if (esAuto) {
        nAuto++;
        alertas.push('CAMBIO AUTOMÁTICO DE GOOGLE · ' + conf.label + ': ' +
                     ce.changeResourceType + ' · ' + clientType +
                     (ce.changedFields ? ' · campos: ' + ce.changedFields : ''));
      }
    }
  log.push('  cambios ' + nCambios + ' (' + nAuto + ' automáticos)');

  } catch (e) {
    log.push('  change_event sin actividad o no disponible');
  }


  // ---------------------------------------------------------------
  // 2b. Ajustes que Google migra a AI Max en septiembre 2026
  // ---------------------------------------------------------------
  try {
    var qAi = 'SELECT campaign.name, campaign.status, campaign.keyword_match_type, ' +
      'campaign.asset_automation_settings, campaign.ai_max_setting.enable_ai_max ' +
      'FROM campaign WHERE campaign.status = "ENABLED" AND campaign.advertising_channel_type = "SEARCH"';
    var itAi = AdsApp.search(qAi);
    while (itAi.hasNext()) {
      var rAi = itAi.next();
      var c = rAi.campaign || {};
      var nombre = c.name || '';
      var broadCampana = (c.keywordMatchType || '') === 'BROAD';
      var aiMax = c.aiMaxSetting && (c.aiMaxSetting.enableAiMax === true || c.aiMaxSetting.enableAiMax === 'true');
      var aca = false;
      var aas = c.assetAutomationSettings || [];
      for (var k = 0; k < aas.length; k++) {
        if (aas[k].assetAutomationType === 'TEXT_ASSET_AUTOMATION' && aas[k].assetAutomationStatus === 'OPTED_IN') aca = true;
      }
      var hallado = [];
      if (aiMax) hallado.push('AI Max ACTIVO');
      if (broadCampana) hallado.push('broad match a nivel de campana (migra a AI Max en septiembre)');
      if (aca) hallado.push('recursos creados automaticamente (migra a AI Max en septiembre)');
      if (hallado.length) {
        // Estado, no evento: AI Max activo no cambia de una corrida a otra. Avisar en cada
        // corrida serian 16 alertas x 24 corridas = 384 mails por dia en Fresh Monkee.
        // Solo se avisa cuando el estado es NUEVO o CAMBIO respecto de lo ya registrado.
        var firma = hallado.join(' + ');
        var yaConocido = aiMaxConocido(conf.label, nombre, firma);
        if (!yaConocido) {
          // La fila se escribe SOLO la primera vez. Reescribirla cada corrida ensuciaba
          // google_live_events (16 filas por hora) y hacia que corrida_redundante nunca
          // pudiera dar true: la tarea semanal se creia con datos nuevos siempre.
          payload.push({ account: conf.label, event_type: 'AUTO_CHANGE', entity_name: nombre, client_type: 'AI_MAX_SETTING', user_email: 'google-migration', spend_today: gasto, conversions_today: conv, event_date: stamp });
          var msgAi = 'AJUSTE QUE MIGRA A AI MAX en "' + nombre + '": ' + firma +
            (conf.label === 'BHI' ? '. RIESGO CMF: AI Max genera copy que puede usar vocabulario de venta. Desactivar hoy.' : '. Revisar: cambia la concordancia y genera copy. Configuracion > AI Max / Recursos automaticos.');
          alertas.push(msgAi);
          log.push('  NUEVO · ' + msgAi);
        } else {
          nAiMaxYaConocidos++;
        }
      }
    }
    if (nAiMaxYaConocidos) { log.push('  AI Max: ' + nAiMaxYaConocidos + ' campanas con estado ya conocido, sin aviso nuevo'); }
  } catch (e) {
    log.push('  ajustes AI Max no consultables: ' + e.message);
  }

  // ---------------------------------------------------------------
  // 3. Persistir y avisar
  // ---------------------------------------------------------------
  if (CONFIG.SUPABASE.enabled && payload.length > 0) {
    log.push('  supabase: ' + pushToSupabase(payload) + ' filas');
  }

  if (alertas.length > 0 && CONFIG.NOTIFY_EMAIL) {
    MailApp.sendEmail(
      CONFIG.NOTIFY_EMAIL,
      'ALERTA · ' + conf.label + ' · ' + hoy,
      alertas.join('\n\n') + '\n\n---\nCentinela NorthSignal · ' + stamp
    );
    log.push('  AVISO ENVIADO: ' + alertas.length + ' alerta(s)');
  }

  return log.join('\n');
}


function finalizeCentinela(results) {
  var log = [];
  var huboAlertas = false;

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.getStatus() === 'OK') {
      var txt = r.getReturnValue();
      log.push(txt);
      if (txt && txt.indexOf('AVISO ENVIADO') >= 0) { huboAlertas = true; }
    } else {
      log.push('ERROR en ' + r.getCustomerId() + ': ' + r.getError());
      huboAlertas = true;
    }
  }

  Logger.log(log.join('\n\n'));

  // Solo se manda resumen si hubo algo. Si todo está normal, silencio:
  // un centinela que avisa cuando no pasa nada deja de mirarse.
  if (huboAlertas && CONFIG.NOTIFY_EMAIL) {
    MailApp.sendEmail(CONFIG.NOTIFY_EMAIL,
      'Centinela NorthSignal · resumen de la corrida',
      log.join('\n\n'));
  }
}


// ================================================================
// SUPABASE
// ================================================================

function pushToSupabase(rows) {
  // PostgREST rechaza un lote si los objetos no tienen exactamente las mismas claves
  // ("All object keys must match"). Los eventos vienen de tres lugares con formas
  // distintas, asi que se completan con null los campos que a cada uno le faltan.
  var CLAVES = ['account', 'event_type', 'entity_name', 'client_type', 'user_email',
                'spend_today', 'conversions_today', 'event_date'];
  rows = rows.map(function (r) {
    var o = {};
    for (var i = 0; i < CLAVES.length; i++) { o[CLAVES[i]] = (r[CLAVES[i]] === undefined) ? null : r[CLAVES[i]]; }
    return o;
  });
  var url = CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/google_live_events';
  var options = {
    method: 'post',
    headers: {
      'apikey': CONFIG.SUPABASE.anonKey,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true
  };

  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code >= 300) {
      Logger.log('Supabase HTTP ' + code + ': ' + res.getContentText().substring(0, 250));
      return 'ERROR ' + code;
    }
    return rows.length;
  } catch (e) {
    Logger.log('Supabase: ' + e.message);
    return 'ERROR';
  }
}


// ================================================================
// UTILIDADES
// ================================================================

/** Acorta un resource name de campaña a su ID, para que el log sea legible. */
// De customers/X/campaigns/12345 al NOMBRE de la campana, no al id.
// Antes escribia "CAMPAIGN · 23521858537" y nadie podia saber que campana era:
// no hay ninguna tabla que resuelva ids de Google a nombres.
var MAPA_IDS = null;
function nombreDeRecurso(resourceName) {
  if (!resourceName) { return ''; }
  var id = String(resourceName).split('/').pop();
  if (MAPA_IDS === null) {
    MAPA_IDS = {};
    try {
      var itc = AdsApp.campaigns().withCondition('Status != REMOVED').get();
      while (itc.hasNext()) { var c = itc.next(); MAPA_IDS[String(c.getId())] = c.getName(); }
      if (typeof AdsApp.performanceMaxCampaigns === 'function') {
        var itp = AdsApp.performanceMaxCampaigns().withCondition('Status != REMOVED').get();
        while (itp.hasNext()) { var p = itp.next(); MAPA_IDS[String(p.getId())] = p.getName(); }
      }
      var itg = AdsApp.adGroups().withCondition('Status != REMOVED').get();
      while (itg.hasNext()) { var g = itg.next(); MAPA_IDS[String(g.getId())] = g.getCampaign().getName() + ' > ' + g.getName(); }
    } catch (e) { }
  }
  return MAPA_IDS[id] || id;
}

function shortName(resourceName) { return nombreDeRecurso(resourceName); }

/**
 * Redondeo a 2 decimales, SIN dividir.
 * Usar con valores que ya vienen en la moneda de la cuenta, como los de
 * getStatsFor(). Nunca usar cost() acá: esa función divide por 10.000 porque
 * está escrita para los campos *_micros de GAQL.
 */
function n2(v) { return v ? Math.round(Number(v) * 100) / 100 : 0; }


/* ================================================================
 * PROGRAMACIÓN
 * ================================================================
 * Cada 4 horas. No cada hora.
 *
 * Los datos intradía de Google no están asentados: el gasto se registra
 * rápido pero las conversiones tardan, así que un centinela horario mira
 * ruido y no señal. Y 24 corridas diarias con executeInParallel sobre tres
 * cuentas son 72 ejecuciones por día contra las cuotas del MCC, sin ganar
 * nada respecto de correr cada 4 horas.
 *
 * VERIFICACIÓN tras la primera corrida:
 *
 *   select account, event_type, spend_today, conversions_today, event_date
 *   from google_live_events
 *   where event_date > now() - interval '6 hours'
 *   order by event_date desc;
 *
 * El gasto debe estar en el orden de magnitud real de cada cuenta:
 * cientos de EUR en KAREDO, decenas de miles de CLP en BHI y 360.
 * Si aparece 0,02 el bug volvió.
 * ================================================================ */
