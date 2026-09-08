/**
 *  INSTALAR ADENTRO DE FRESH MONKEE (497-723-1137), NO EN EL MCC · lunes 07:00, BACKFILL=false
 */
/**
 * NORTHSIGNAL — EXPORT SEMANAL  ·  v11 (mail con verificacion real, sin links a Sheets)
 * ================================================================
 * MCC NorthSignal (641-902-5021) · lunes 07:00
 *
 * NUEVO EN v6:
 * - Registro de corridas en la tabla run_log de Supabase.
 *   Sin esto no hay forma de saber si los datos que muestra la app son
 *   de esta semana o de la anterior: si el script falla un lunes, todo
 *   sigue mostrando los datos viejos sin ninguna señal.
 * - safe() ahora recibe el nombre de la tabla y registra cada bloque.
 *
 * Verificación después de correr:
 *   select * from v_data_health;      -- frescura y completitud
 *   select * from v_integridad_datos; -- los totales deben cuadrar
 */

// ---------------------------------------------------------------
// RELLENO HISTORICO AUTOMATICO (7 sep 2026)
// BACKFILL = true: en cada corrida, el script pregunta a Supabase que semanas de las
// ultimas BACKFILL_SEMANAS faltan en la tabla campaign para cada cuenta, y las trae
// una por una hasta agotar ~22 minutos. Cuando no falta ninguna, termina en segundos.
// Programalo cada hora una tarde; cuando el mail diga "relleno completo", poné false
// (o dejalo: no hace nada) y volve a la frecuencia semanal del lunes.
// Solo tablas con metricas de periodo. Las fotos de estado (negativas, pujas,
// simulaciones, ads, alertas, brief) no se rellenan: son de hoy.
// ---------------------------------------------------------------
var BACKFILL = false;
var BACKFILL_SEMANAS = 13;          // hasta 3 meses hacia atras
var BACKFILL_MINUTOS = 22;          // presupuesto de tiempo por corrida (Google corta a los 30)
var BACKFILL_WEEKS_BACK = 0;        // uso interno


var CONFIG = {

  NOTIFY_EMAIL: 'biggsandres@gmail.com',
  ROW_LIMIT: 3000,

  SUPABASE: {
    enabled: true,
    url: 'https://djbwxgicosargfobsmqd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnd4Z2ljb3Nhcmdmb2JzbXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTkwNTAsImV4cCI6MjEwMzk3NTA1MH0.zJQxou6UBOJNQ8DtQKKOtFZ43u_y9FKSDZ4inZR_vO0',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnd4Z2ljb3Nhcmdmb2JzbXFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODM5OTA1MCwiZXhwIjoyMTAzOTc1MDUwfQ.QqJg2ccFzBkJI2rZ5mHk0QoJ27Lz4sMfOXuK_czaU98',
    batchSize: 500
  },

  ACCOUNTS: [
    {
      cid: '497-723-1137',
      label: 'FRESH_MONKEE',
      soloCuentaUnica: true,        // el MCC no la ve: la corre el script instalado dentro de la cuenta
      sheetUrl: '',                  // Fresh Monkee no usa Sheet
      // 8 sep 2026: estaban TODOS en cero. kwSpendNoConv en 0 no es "sin configurar":
      // la condicion de la linea de alerta pasa a ser "gasto algo y no convirtio", asi que
      // en una cadena de 46 locales alertaba sobre casi todas las keywords de la semana.
      // Valores semanales, derivados de los diarios del centinela x7 con margen.
      dailyBudget: 150,             // USD/dia: 22 campanas OP activas por ~5 USD
      thresholds: { cpaMax: 12, convMin: 250, imprShareMin: 0, ctrMin: 0, kwSpendNoConv: 60, spendDeviation: 0.3 },
      note: 'Multi-local (cadena). Objetivos distintos por campana: visitas/direcciones, compra online, llamadas. Ver campaign_mapa en Supabase. No mezclar CPA entre objetivos.'
    },
    {
      cid: '913-287-4649',
      label: 'KAREDO',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1WsRnF7cPMOhjR_uyXRZtrUHBh6NIDumcyX0fIJ_UC1A/edit',
      dailyBudget: 135,          // EUR
      thresholds: {
        cpaMax: 45,              // CPA semanal de campana
        convMin: 15,             // conversiones semanales
        imprShareMin: 30,        // cuota de impresiones %
        ctrMin: 25,              // CTR de campana %
        kwSpendNoConv: 60,       // gasto de keyword sin conversiones
        spendDeviation: 0.25     // desvio vs presupuesto semanal esperado
      },
      note: 'Conversiones direccionales: Enhanced Conversions match 0-15%, disparo en clic. conv_value es un valor fijo arbitrario de 20 EUR: NO reportar ROAS'
    },
    {
      cid: '882-940-8394',
      label: 'BHI',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1U8DJiKfQay3v5CUp-nC775nqnwSc44eLjNu9yHFP6jo/edit',
      dailyBudget: 20000,        // CLP
      thresholds: {
        cpaMax: 70000,
        convMin: 2,
        imprShareMin: 0,         // limitada por volumen de busqueda, no aplica
        ctrMin: 7,
        kwSpendNoConv: 40000,    // con CPC ~6.700 CLP, 15.000 se supera con 3 clics
        spendDeviation: 0.20
      },
      note: 'Fuente de verdad del negocio: GoHighLevel, no Google Ads'
    },
    {
      cid: '378-925-9849',
      label: '360',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1_RpUBz5PLHB-rHvspej_7fMMeYbjKWMc2nhfB1JL83Y/edit',
      dailyBudget: 20000,        // CLP (confirmado 6 sep; era 21000 por error)
      thresholds: {
        cpaMax: 60000,
        convMin: 1,
        imprShareMin: 0,
        ctrMin: 6,
        kwSpendNoConv: 50000,
        spendDeviation: 0.75     // gasto bajo 50% del presupuesto tambien alerta
      },
      note: 'conv_value inflada por regla de valor 1,5x. Montos reales en campo Monto de Asana. No reportar all_conversions'
    }
  ],

  // Como se escribe cada tabla en Supabase. Antes esto era implicito: pushToSupabase
  // acotaba el DELETE a la semana SOLO si la tabla tenia columna week_start, y si no la
  // tenia borraba la cuenta ENTERA. change_events no la tiene, asi que cada corrida
  // borraba toda la historia y reinsertaba una semana. Tickets 32 y 42.
  // Ahora cada tabla declara su politica y una que no declare ninguna corta la corrida.
  UPSERT_KEYS: {
    CHANGE_EVENTS: 'account,change_datetime,resource_name,changed_field'
  },
  REEMPLAZO_TOTAL: {   // fotos de hoy: reemplazarlas enteras es lo correcto
    SIMULATIONS: true,
    ACCOUNT_STATE: true
  },

  TABS: {
    CAMPAIGN: ['week_start','week_end','account','campaign','status','channel','bid_strategy','currency',
               'impressions','clicks','ctr','avg_cpc','avg_cpm','cost','conversions','all_conversions',
               'conv_value','cost_per_conv','conv_rate','roas','impr_share','top_impr_share',
               'abs_top_impr_share','lost_is_budget','lost_is_rank','click_share','run_ts'],

    ADGROUP: ['week_start','week_end','account','campaign','campaign_status','ad_group',
              'ad_group_status','ad_group_type','currency','impressions','clicks','ctr','avg_cpc',
              'cost','conversions','all_conversions','conv_value','cost_per_conv','conv_rate',
              'impr_share','run_ts'],

    KEYWORDS: ['week_start','week_end','account','campaign','campaign_status','ad_group',
               'ad_group_status','criterion_id','keyword','match_type','keyword_status',
               'serving_status','approval_status','final_url','currency',
               'effective_cpc_bid','bid_source','est_first_page_cpc','est_top_of_page_cpc',
               'est_first_position_cpc','quality_score','qs_ad_relevance','qs_landing_page',
               'qs_expected_ctr','impressions','clicks','ctr','avg_cpc','cost','conversions',
               'all_conversions','conv_value','cost_per_conv','conv_rate','impr_share',
               'top_impr_share','lost_is_rank','run_ts'],

    BID_TARGETS: ['week_start','week_end','account','level','campaign','ad_group','status',
                  'bid_strategy','target_cpa','target_roas','target_source','cpc_bid_or_budget',
                  'currency','run_ts'],

    SIMULATIONS: ['account','campaign','sim_type','modification_method','start_date','end_date',
                  'target_value','est_conversions','est_conv_value','est_clicks','est_cost',
                  'est_impressions','est_top_slot_impressions','currency','run_ts'],

    NEGATIVES: ['week_start','account','level','campaign','ad_group','negative_keyword',
                'match_type','run_ts'],

    SEARCH_TERMS: ['week_start','week_end','account','campaign','ad_group','search_term','match_type',
                   'triggered_keyword','currency','impressions','clicks','ctr','avg_cpc','cost',
                   'conversions','conv_value','cost_per_conv','run_ts'],

    ADS: ['week_start','week_end','account','campaign','ad_group','ad_id','ad_type','ad_strength','status',
          'currency','impressions','clicks','ctr','avg_cpc','cost','conversions','conv_value',
          'cost_per_conv','run_ts'],

    RSA_ASSETS: ['week_start','week_end','account','campaign','ad_group','field_type','performance_label',
                 'asset_text','currency','impressions','clicks','ctr','cost','conversions','run_ts'],

    CONVERSION_ACTIONS: ['week_start','week_end','account','campaign','conversion_action','category',
                         'currency','conversions','all_conversions','conv_value','all_conv_value','run_ts'],

    DEVICE: ['week_start','week_end','account','campaign','device','currency','impressions','clicks','ctr',
             'avg_cpc','cost','conversions','conv_value','cost_per_conv','conv_rate','run_ts'],

    HOUR_DAY: ['week_start','week_end','account','campaign','day_of_week','hour','currency','impressions',
               'clicks','ctr','cost','conversions','conv_value','cost_per_conv','run_ts'],

    GEO: ['week_start','week_end','account','campaign','location','location_type','currency','impressions',
          'clicks','ctr','cost','conversions','conv_value','cost_per_conv','run_ts'],

    LANDING_PAGES: ['week_start','week_end','account','campaign','landing_page','currency','impressions',
                    'clicks','ctr','cost','conversions','conv_value','cost_per_conv','run_ts'],

    AUDIENCES: ['week_start','week_end','account','campaign','ad_group','audience','type','bid_modifier',
                'currency','impressions','clicks','ctr','cost','conversions','conv_value','run_ts'],

    BUDGET: ['week_start','week_end','account','campaign','daily_budget','expected_week','actual_cost',
             'pacing_pct','delivery_method','currency','lost_is_budget','run_ts'],

    CHANGE_EVENTS: ['change_datetime','account','user_email','client_type','resource_type',
                    'operation','changed_field','old_value','new_value','campaign','ad_group','run_ts',
                    'resource_name','entity_name','campaign_name','ad_group_name'],

    WEEKLY_BRIEF: ['account','week_start','week_end','section','item','detail','value',
                   'prev_value','delta_pct','note','run_ts'],

    ACCOUNT_STATE: ['account','section','item','value','detail','run_ts'],

    ALERTS: ['week_start','week_end','account','severity','type','entity','detail','value','threshold','run_ts']
  }
};

// Registra que este script corrio. Sin esto, si el script deja de dispararse en Google Ads
// nadie se entera: no hay error, simplemente no pasa nada. Es el mismo problema del
// silencio que tiene pg_cron, y se resuelve igual: latido y aviso por ausencia.
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


// ================================================================
// MAIN (PARALELO)
// ================================================================


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
  try { _main(); latir('extraccion_semanal', true); }
  catch (e) { latir('extraccion_semanal', false, e.message); throw e; }
}

function _main() {
  if (typeof AdsManagerApp === 'undefined') {
    var cid1 = AdsApp.currentAccount().getCustomerId();
    finalizeExport([resultadoSintetico(processAccount(), cid1)]);
    return;
  }
  var ids = CONFIG.ACCOUNTS.filter(function (a) { return !a.soloCuentaUnica; }).map(function (a) { return a.cid; });

  AdsManagerApp.accounts()
    .withIds(ids)
    .executeInParallel('processAccount', 'finalizeExport');
}

/**
 * Declara a Supabase los umbrales que este script tiene cableados.
 * Antes solo lo hacia el centinela, con p_script fijo. Resultado: los umbrales del
 * semanal eran invisibles para v_umbrales_inconsistentes, que devolvia cero filas
 * mientras FRESH_MONKEE corria con kwSpendNoConv en 0. Un chequeo que solo mira una
 * de las tres copias del dato no es un chequeo.
 */
function declararUmbrales(conf) {
  var th = conf.thresholds || {};
  var pares = [['cpaMax', th.cpaMax], ['convMin', th.convMin],
               ['kwSpendNoConv', th.kwSpendNoConv], ['spendDeviation', th.spendDeviation]];
  for (var i = 0; i < pares.length; i++) {
    if (pares[i][1] === undefined || pares[i][1] === null) continue;
    try {
      UrlFetchApp.fetch(CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/rpc/declarar_umbral', {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ p_account: conf.label, p_script: 'semanal',
          p_umbral: pares[i][0], p_valor: pares[i][1] }),
        headers: { 'apikey': CONFIG.SUPABASE.serviceKey,
                   'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey },
        muteHttpExceptions: true });
    } catch (e) { }
  }
}

function processAccount() {
  var account = AdsApp.currentAccount();
  var log = [];

  var conf = CONFIG.ACCOUNTS.filter(function (a) {
    return a.cid.replace(/-/g, '') === account.getCustomerId().replace(/-/g, '');
  })[0];

  if (!conf) { return 'Cuenta no configurada o saltada: ' + account.getCustomerId(); }

  var tz = account.getTimeZone();
  if (BACKFILL) return backfillAccount(account, conf, tz);
  var ctx = {
    conf: conf,
    label: conf.label,
    range: lastWeek(tz),
    currency: account.getCurrencyCode(),
    stamp: Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm') /* UTC */,
    alerts: [],
    geoCache: {},
    runLog: [],
    supabaseRequests: { deletes: [], inserts: [] }
  };

  // Sheet opcional: sin sheetUrl valido, se trabaja solo contra Supabase
  CURRENT_SS = null; CURRENT_BRIEF_SS = null;
  if (conf.sheetUrl && conf.sheetUrl.indexOf('COMPLETAR') < 0) {
    try { CURRENT_SS = SpreadsheetApp.openByUrl(conf.sheetUrl); CURRENT_BRIEF_SS = getBriefSpreadsheet(conf); }
    catch (e) { return '=== ' + conf.label + ' — ERROR abriendo Sheets: ' + e.message; }
  }

  LABEL_CACHE = null;
  declararUmbrales(conf);
  var backfill = false;
  log.push('=== ' + conf.label + '  (' + ctx.range.start + ' a ' + ctx.range.end + ')');
  log.push('  CAMPAIGN            ' + safe(exportCampaigns, ctx, 'CAMPAIGN'));
  log.push('  ADGROUP             ' + safe(exportAdGroups, ctx, 'ADGROUP'));
  log.push('  KEYWORDS            ' + safe(exportKeywords, ctx, 'KEYWORDS'));
  if (!backfill) log.push('  NEGATIVES           ' + safe(exportNegatives, ctx, 'NEGATIVES'));
  if (!backfill) log.push('  BID_TARGETS         ' + safe(exportBidTargets, ctx, 'BID_TARGETS'));
  if (!backfill) log.push('  SIMULATIONS         ' + safe(exportSimulations, ctx, 'SIMULATIONS'));
  if (!backfill) log.push('  SIMULATIONS grupo   ' + safe(exportAdGroupSimulations, ctx, 'SIMULATIONS'));
  log.push('  SEARCH_TERMS        ' + safe(exportSearchTerms, ctx, 'SEARCH_TERMS'));
  if (!backfill) log.push('  ADS                 ' + safe(exportAds, ctx, 'ADS'));
  if (!backfill) log.push('  RSA_ASSETS          ' + safe(exportRsaAssets, ctx, 'RSA_ASSETS'));
  log.push('  CONVERSION_ACTIONS  ' + safe(exportConversionActions, ctx, 'CONVERSION_ACTIONS'));
  log.push('  DEVICE              ' + safe(exportDevices, ctx, 'DEVICE'));
  log.push('  HOUR_DAY            ' + safe(exportHourDay, ctx, 'HOUR_DAY'));
  log.push('  GEO                 ' + safe(exportGeo, ctx, 'GEO'));
  log.push('  LANDING_PAGES       ' + safe(exportLandingPages, ctx, 'LANDING_PAGES'));
  log.push('  AUDIENCES           ' + safe(exportAudiences, ctx, 'AUDIENCES'));
  if (!backfill) log.push('  BUDGET              ' + safe(exportBudget, ctx, 'BUDGET'));
  log.push('  CHANGE_EVENTS       ' + safe(exportChangeEvents, ctx, 'CHANGE_EVENTS'));
  if (!backfill) log.push('  ACCOUNT_STATE       ' + safe(exportAccountState, ctx, 'ACCOUNT_STATE'));
  if (!backfill) log.push('  ALERTS              ' + safe(flushAlerts, ctx, 'ALERTS'));
  if (!backfill) log.push('  WEEKLY_BRIEF        ' + safe(exportWeeklyBrief, ctx, 'WEEKLY_BRIEF'));

  // Ejecutar todas las llamadas a Supabase de forma concurrente
  log.push('  SUPABASE_SYNC       ' + safe(flushSupabaseAsync, ctx));

  // Registro de la corrida: siempre al final, despues de la sincronizacion
  log.push('  RUN_LOG             ' + flushRunLog(ctx) + ' registros');

  return log.join('\n');
}

function finalizeExport(results) {
  var finalLog = [];

  for (var i = 0; i < results.length; i++) {
    var res = results[i];
    if (res.getStatus() === 'OK') {
      finalLog.push(res.getReturnValue());
    } else {
      finalLog.push('=== ERROR EN CUENTA ' + res.getCustomerId() + ' ===');
      finalLog.push('Estado: ' + res.getStatus() + ' | Detalle: ' + res.getError());
    }
  }

  // Verificacion real contra Supabase: no "verificar", sino verificado.
  if (CONFIG.SUPABASE.enabled) {
    finalLog.push(verificarDataHealth());
  }

  var body = finalLog.join('\n\n');
  Logger.log(body);

  if (CONFIG.NOTIFY_EMAIL) {
    var asunto = (BACKFILL ? (body.indexOf('relleno completo') >= 0 && body.indexOf('faltan') < 0 ? 'NorthSignal relleno COMPLETO · ' : 'NorthSignal relleno en curso · ') : '') + (body.indexOf('ERROR') >= 0 || body.indexOf('ATRASADO') >= 0
      ? 'ATENCION · NorthSignal semanal con errores'
      : 'NorthSignal semanal OK');
    MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, asunto, body);
  }
}

/**
 * Lee v_data_health despues de sincronizar y lo pone en el mail.
 * Antes el mail decia "verificar en Supabase"; ahora dice el resultado.
 */
function verificarDataHealth() {
  try {
    var url = CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/v_data_health?select=account,estado,semana_datos,horas_desde_actualizacion';
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'apikey': CONFIG.SUPABASE.anonKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) { return 'v_data_health: HTTP ' + res.getResponseCode(); }
    var rows = JSON.parse(res.getContentText());
    var out = ['=== SUPABASE v_data_health ==='];
    for (var i = 0; i < rows.length; i++) {
      out.push('  ' + rows[i].account + '  ' + rows[i].estado + '  semana ' + rows[i].semana_datos +
               '  (' + Math.round(rows[i].horas_desde_actualizacion) + ' h desde la ultima actualizacion)');
    }
    return out.join('\n');
  } catch (e) {
    return 'v_data_health: no se pudo leer (' + e.message + ')';
  }
}

/**
 * Corre un bloque, captura errores y registra el resultado.
 * El tercer parametro es el nombre de la tabla: si viene, se registra
 * en run_log. Se omite para bloques que no escriben datos.
 */
function safe(fn, ctx, tabla) {
  var resultado;
  try {
    resultado = fn(ctx) + ' filas';
  } catch (e) {
    resultado = 'ERROR — ' + e.message;
  }
  if (tabla) { logBlock(ctx, tabla, resultado); }
  return resultado;
}


// ================================================================
// REGISTRO DE CORRIDAS
// ================================================================

/** Acumula el resultado de cada bloque para registrarlo al final. */
function logBlock(ctx, tabla, resultado) {
  if (!ctx.runLog) { ctx.runLog = []; }

  var status = 'OK';
  var filas = 0;
  var errorMsg = null;

  if (typeof resultado === 'string' && resultado.indexOf('ERROR') === 0) {
    status = 'ERROR';
    errorMsg = resultado.substring(0, 400);
  } else {
    filas = parseInt(String(resultado).replace(/[^0-9]/g, ''), 10) || 0;
    if (filas === 0) { status = 'VACIO'; }
  }

  ctx.runLog.push([
    ctx.label, ctx.range.start, ctx.range.end,
    tabla, filas, status, errorMsg, ctx.stamp
  ]);
}

/** Envia el registro completo de la corrida a Supabase. */
function flushRunLog(ctx) {
  if (!CONFIG.SUPABASE.enabled) { return 0; }
  if (!ctx.runLog || ctx.runLog.length === 0) { return 0; }

  var cols = ['account','week_start','week_end','tabla','filas','status','error_msg','run_ts'];
  var base = CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/run_log';
  var headers = {
    'apikey': CONFIG.SUPABASE.anonKey,
    'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  var payload = ctx.runLog.map(function (fila) {
    var obj = {};
    for (var i = 0; i < cols.length; i++) {
      obj[cols[i]] = (fila[i] === '' || fila[i] === undefined) ? null : fila[i];
    }
    return obj;
  });

  try {
    var res = UrlFetchApp.fetch(base, {
      method: 'post', headers: headers,
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) {
      Logger.log('run_log HTTP ' + res.getResponseCode() + ': ' +
                 res.getContentText().substring(0, 200));
    }
  } catch (e) {
    Logger.log('run_log: ' + e.message);
  }

  return ctx.runLog.length;
}


// ================================================================
// BLOQUES DE RENDIMIENTO
// ================================================================

function exportCampaigns(ctx) {
  var q =
    'SELECT campaign.name, campaign.status, campaign.advertising_channel_type, ' +
    'campaign.bidding_strategy_type, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.average_cpm, ' +
    'metrics.cost_micros, metrics.conversions, metrics.all_conversions, metrics.conversions_value, ' +
    'metrics.cost_per_conversion, metrics.conversions_from_interactions_rate, ' +
    'metrics.search_impression_share, metrics.search_top_impression_share, ' +
    'metrics.search_absolute_top_impression_share, metrics.search_budget_lost_impression_share, ' +
    'metrics.search_rank_lost_impression_share, metrics.search_click_share ' +
    'FROM campaign ' + dateFilter(ctx) + ' AND campaign.status != "REMOVED"';

  return write('CAMPAIGN', q, ctx, function (r) {
    var m = r.metrics, t = ctx.conf.thresholds;
    var cpa = cost(m.costPerConversion), conv = n2(m.conversions);
    var ctr = pct(m.ctr), is = pct(m.searchImpressionShare);
    var spend = cost(m.costMicros), value = n2(m.conversionsValue);
    var roas = spend > 0 ? Math.round((value / spend) * 100) / 100 : 0;

    if (r.campaign.status !== 'ENABLED') {
      return [
        ctx.range.start, ctx.range.end, ctx.label,
        r.campaign.name, r.campaign.status, r.campaign.advertisingChannelType,
        r.campaign.biddingStrategyType, ctx.currency,
        n(m.impressions), n(m.clicks), ctr, cost(m.averageCpc), cost(m.averageCpm),
        spend, conv, n2(m.allConversions), value,
        cpa, pct(m.conversionsFromInteractionsRate), roas,
        is, pct(m.searchTopImpressionShare), pct(m.searchAbsoluteTopImpressionShare),
        pct(m.searchBudgetLostImpressionShare), pct(m.searchRankLostImpressionShare),
        pct(m.searchClickShare), ctx.stamp
      ];
    }

    if (conv === 0 && spend > 0) {
      alert(ctx, 'ALTA', 'Gasto sin ninguna conversion primaria', r.campaign.name,
            'Gasto semanal con 0 conversiones', spend, 0);
    }
    if (conv > 0 && cpa > t.cpaMax) {
      alert(ctx, 'ALTA', 'CPA sobre umbral', r.campaign.name,
            'CPA semanal de campaña', cpa, t.cpaMax);
    }
    if (conv > 0 && conv < t.convMin) {
      alert(ctx, 'ALTA', 'Conversiones bajo umbral', r.campaign.name,
            'Conversiones en la semana', conv, t.convMin);
    }
    if (ctr < t.ctrMin) {
      alert(ctx, 'MEDIA', 'CTR bajo umbral', r.campaign.name,
            'CTR de campaña %', ctr, t.ctrMin);
    }
    if (t.imprShareMin > 0 && is > 0 && is < t.imprShareMin) {
      alert(ctx, 'MEDIA', 'Cuota de impresiones baja', r.campaign.name,
            'Impression share %', is, t.imprShareMin);
    }
    if (pct(m.searchBudgetLostImpressionShare) > 20) {
      alert(ctx, 'MEDIA', 'Cuota perdida por presupuesto', r.campaign.name,
            'Lost IS budget %', pct(m.searchBudgetLostImpressionShare), 20);
    }

    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.campaign.status, r.campaign.advertisingChannelType,
      r.campaign.biddingStrategyType, ctx.currency,
      n(m.impressions), n(m.clicks), ctr, cost(m.averageCpc), cost(m.averageCpm),
      spend, conv, n2(m.allConversions), value,
      cpa, pct(m.conversionsFromInteractionsRate), roas,
      is, pct(m.searchTopImpressionShare), pct(m.searchAbsoluteTopImpressionShare),
      pct(m.searchBudgetLostImpressionShare), pct(m.searchRankLostImpressionShare),
      pct(m.searchClickShare), ctx.stamp
    ];
  });
}

function exportAdGroups(ctx) {
  var metricsMap = {};
  var qMetrics =
    'SELECT ad_group.id, metrics.impressions, metrics.clicks, metrics.ctr, ' +
    'metrics.average_cpc, metrics.cost_micros, metrics.conversions, ' +
    'metrics.all_conversions, metrics.conversions_value, metrics.cost_per_conversion, ' +
    'metrics.conversions_from_interactions_rate, metrics.search_impression_share ' +
    'FROM ad_group ' + dateFilter(ctx);

  var mres = AdsApp.search(qMetrics);
  while (mres.hasNext()) {
    var mr = mres.next();
    metricsMap[mr.adGroup.id] = mr.metrics;
  }

  var qInventory =
    'SELECT campaign.name, campaign.status, ad_group.id, ad_group.name, ad_group.status, ' +
    'ad_group.type ' +
    'FROM ad_group WHERE ad_group.status != "REMOVED"';

  var sheet = getSheet('ADGROUP');
  var results = AdsApp.search(qInventory);
  var rows = [];

  while (results.hasNext() && rows.length < CONFIG.ROW_LIMIT) {
    var r = results.next();
    var m = metricsMap[r.adGroup.id] || {};
    var impr = n(m.impressions);
    var activo = (r.adGroup.status === 'ENABLED' && r.campaign.status === 'ENABLED');

    if (activo && impr === 0) {
      alert(ctx, 'MEDIA', 'Grupo activo sin impresiones', r.adGroup.name,
            'Campaña ' + r.campaign.name, 0, 1);
    }

    rows.push([
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.campaign.status, r.adGroup.name, r.adGroup.status,
      r.adGroup.type, ctx.currency,
      impr, n(m.clicks), pct(m.ctr), cost(m.averageCpc), cost(m.costMicros),
      n2(m.conversions), n2(m.allConversions), n2(m.conversionsValue),
      cost(m.costPerConversion), pct(m.conversionsFromInteractionsRate),
      pct(m.searchImpressionShare), ctx.stamp
    ]);
  }

  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS.ADGROUP.length).setValues(rows); }
    pushToSupabase(ctx, 'ADGROUP', rows);
  }
  return rows.length;
}

function exportKeywords(ctx) {
  var metricsMap = {};
  var qMetrics =
    'SELECT ad_group.id, ad_group_criterion.criterion_id, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, ' +
    'metrics.cost_micros, metrics.conversions, metrics.all_conversions, ' +
    'metrics.conversions_value, metrics.cost_per_conversion, ' +
    'metrics.conversions_from_interactions_rate, metrics.search_impression_share, ' +
    'metrics.search_top_impression_share, metrics.search_rank_lost_impression_share ' +
    'FROM keyword_view ' + dateFilter(ctx);

  var mres = AdsApp.search(qMetrics);
  while (mres.hasNext()) {
    var mr = mres.next();
    metricsMap[mr.adGroup.id + '|' + mr.adGroupCriterion.criterionId] = mr.metrics;
  }

  var qInventory =
    'SELECT campaign.name, campaign.status, ad_group.id, ad_group.name, ad_group.status, ' +
    'ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ' +
    'ad_group_criterion.keyword.match_type, ad_group_criterion.status, ' +
    'ad_group_criterion.system_serving_status, ad_group_criterion.approval_status, ' +
    'ad_group_criterion.final_urls, ' +
    'ad_group_criterion.effective_cpc_bid_micros, ad_group_criterion.effective_cpc_bid_source, ' +
    'ad_group_criterion.position_estimates.first_page_cpc_micros, ' +
    'ad_group_criterion.position_estimates.top_of_page_cpc_micros, ' +
    'ad_group_criterion.position_estimates.first_position_cpc_micros, ' +
    'ad_group_criterion.quality_info.quality_score, ' +
    'ad_group_criterion.quality_info.creative_quality_score, ' +
    'ad_group_criterion.quality_info.post_click_quality_score, ' +
    'ad_group_criterion.quality_info.search_predicted_ctr ' +
    'FROM ad_group_criterion ' +
    'WHERE ad_group_criterion.type = "KEYWORD" ' +
    'AND ad_group_criterion.negative = FALSE ' +
    'AND ad_group_criterion.status != "REMOVED"';

  var sheet = getSheet('KEYWORDS');
  var results = AdsApp.search(qInventory);
  var rows = [];
  var inventoryCount = 0, withData = 0;
  var sinImpresiones = {}, bajoVolumen = {};

  while (results.hasNext() && rows.length < CONFIG.ROW_LIMIT) {
    var r = results.next();
    var c = r.adGroupCriterion;
    var qi = c.qualityInfo || {}, pe = c.positionEstimates || {};
    var m = metricsMap[r.adGroup.id + '|' + c.criterionId] || {};

    inventoryCount++;
    var impr = n(m.impressions);
    if (impr > 0) { withData++; }

    var spend = cost(m.costMicros), conv = n2(m.conversions);
    var topCpc = cost(pe.topOfPageCpcMicros);
    var effBid = cost(c.effectiveCpcBidMicros);
    var activa = (c.status === 'ENABLED' && r.adGroup.status === 'ENABLED'
                  && r.campaign.status === 'ENABLED');

    if (conv === 0 && spend > ctx.conf.thresholds.kwSpendNoConv) {
      alert(ctx, 'ALTA', 'Keyword gastando sin convertir', c.keyword.text,
            'Gasto semanal sin conversiones', spend, ctx.conf.thresholds.kwSpendNoConv);
    }
    if (c.approvalStatus && c.approvalStatus.indexOf('DISAPPROVED') >= 0) {
      alert(ctx, 'ALTA', 'Keyword rechazada', c.keyword.text,
            'approval_status ' + c.approvalStatus, 0, 1);
    }
    if (qi.qualityScore && Number(qi.qualityScore) <= 4 && spend > 0) {
      alert(ctx, 'MEDIA', 'Quality Score bajo', c.keyword.text,
            'QS con gasto activo', Number(qi.qualityScore), 5);
    }
    if (effBid > 0 && topCpc > 0 && effBid < topCpc && impr > 0) {
      alert(ctx, 'BAJA', 'Puja bajo el estimado de tope de pagina', c.keyword.text,
            'Puja efectiva vs top_of_page_cpc', effBid, topCpc);
    }

    var key = r.campaign.name + ' > ' + r.adGroup.name;
    if (activa && impr === 0) {
      bucket(sinImpresiones, key, c.keyword.text);
    }
    if (c.systemServingStatus === 'RARELY_SERVED') {
      bucket(bajoVolumen, key, c.keyword.text);
    }

    rows.push([
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.campaign.status, r.adGroup.name, r.adGroup.status,
      c.criterionId, c.keyword.text, c.keyword.matchType, c.status,
      c.systemServingStatus || '', c.approvalStatus || '',
      (c.finalUrls && c.finalUrls.length) ? c.finalUrls[0] : '',
      ctx.currency,
      effBid, c.effectiveCpcBidSource || '',
      cost(pe.firstPageCpcMicros), topCpc, cost(pe.firstPositionCpcMicros),
      qi.qualityScore || '', qi.creativeQualityScore || '',
      qi.postClickQualityScore || '', qi.searchPredictedCtr || '',
      impr, n(m.clicks), pct(m.ctr), cost(m.averageCpc), spend,
      conv, n2(m.allConversions), n2(m.conversionsValue),
      cost(m.costPerConversion), pct(m.conversionsFromInteractionsRate),
      pct(m.searchImpressionShare), pct(m.searchTopImpressionShare),
      pct(m.searchRankLostImpressionShare), ctx.stamp
    ]);
  }

  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS.KEYWORDS.length).setValues(rows); }
    pushToSupabase(ctx, 'KEYWORDS', rows);
  }

  emitBuckets(ctx, sinImpresiones, 'MEDIA', 'Keywords activas sin impresiones');
  emitBuckets(ctx, bajoVolumen, 'MEDIA', 'Keywords de bajo volumen (RARELY_SERVED)');

  alert(ctx, 'INFO', 'Inventario de keywords', 'cuenta completa',
        inventoryCount + ' keywords existentes, ' + withData + ' con impresiones esta semana',
        inventoryCount, withData);

  return rows.length;
}

function bucket(store, key, item) {
  if (!store[key]) { store[key] = []; }
  store[key].push(item);
}

function emitBuckets(ctx, store, severity, type) {
  for (var key in store) {
    if (!store.hasOwnProperty(key)) { continue; }
    var list = store[key];
    var full = list.join(' · ');
    if (full.length > 4000) {
      full = full.substring(0, 3950) + ' … (lista truncada, ver KEYWORDS)';
    }
    alert(ctx, severity, type, key, full, list.length, 0);
  }
}

function exportSearchTerms(ctx) {
  var q =
    'SELECT campaign.name, ad_group.name, search_term_view.search_term, ' +
    'segments.search_term_match_type, segments.keyword.info.text, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value, metrics.cost_per_conversion ' +
    'FROM search_term_view ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  return write('SEARCH_TERMS', q, ctx, function (r) {
    var m = r.metrics, spend = cost(m.costMicros);
    var kw = (r.segments && r.segments.keyword && r.segments.keyword.info)
             ? r.segments.keyword.info.text : '';

    if (n2(m.conversions) === 0 && spend > ctx.conf.thresholds.kwSpendNoConv) {
      alert(ctx, 'ALTA', 'Término de búsqueda a revisar como negativo',
            r.searchTermView.searchTerm,
            'Gasto semanal sin conversiones', spend, ctx.conf.thresholds.kwSpendNoConv);
    }

    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.adGroup.name,
      r.searchTermView.searchTerm, r.segments.searchTermMatchType, kw, ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.averageCpc), spend,
      n2(m.conversions), n2(m.conversionsValue), cost(m.costPerConversion), ctx.stamp
    ];
  });
}

function exportAds(ctx) {
  var q =
    'SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type, ' +
    'ad_group_ad.ad_strength, ad_group_ad.status, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value, metrics.cost_per_conversion ' +
    'FROM ad_group_ad ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  return write('ADS', q, ctx, function (r) {
    var m = r.metrics;
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.adGroup.name, r.adGroupAd.ad.id, r.adGroupAd.ad.type,
      r.adGroupAd.adStrength || '', r.adGroupAd.status, ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.averageCpc), cost(m.costMicros),
      n2(m.conversions), n2(m.conversionsValue), cost(m.costPerConversion), ctx.stamp
    ];
  });
}

function exportRsaAssets(ctx) {
  var m30 = last30(ctx);
  var q =
    'SELECT campaign.name, ad_group.name, ad_group_ad_asset_view.field_type, ' +
    'ad_group_ad_asset_view.performance_label, asset.text_asset.text, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, metrics.conversions ' +
    'FROM ad_group_ad_asset_view ' +
    'WHERE segments.date BETWEEN "' + m30.start + '" AND "' + m30.end + '" ' +
    'AND metrics.impressions > 0';

  return write('RSA_ASSETS', q, ctx, function (r) {
    var m = r.metrics;
    var text = (r.asset && r.asset.textAsset) ? r.asset.textAsset.text : '';
    return [
      m30.start, m30.end, ctx.label,
      r.campaign.name, r.adGroup.name,
      r.adGroupAdAssetView.fieldType, r.adGroupAdAssetView.performanceLabel || '',
      text, ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.costMicros), n2(m.conversions),
      ctx.stamp
    ];
  });
}

function exportConversionActions(ctx) {
  var q =
    'SELECT campaign.name, segments.conversion_action_name, ' +
    'segments.conversion_action_category, ' +
    'metrics.conversions, metrics.all_conversions, ' +
    'metrics.conversions_value, metrics.all_conversions_value ' +
    'FROM campaign ' + dateFilter(ctx);

  return write('CONVERSION_ACTIONS', q, ctx, function (r) {
    var m = r.metrics;
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.segments.conversionActionName,
      r.segments.conversionActionCategory, ctx.currency,
      n2(m.conversions), n2(m.allConversions),
      n2(m.conversionsValue), n2(m.allConversionsValue), ctx.stamp
    ];
  });
}

function exportDevices(ctx) {
  var q =
    'SELECT campaign.name, segments.device, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value, metrics.cost_per_conversion, ' +
    'metrics.conversions_from_interactions_rate ' +
    'FROM campaign ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  return write('DEVICE', q, ctx, function (r) {
    var m = r.metrics;
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.segments.device, ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.averageCpc), cost(m.costMicros),
      n2(m.conversions), n2(m.conversionsValue), cost(m.costPerConversion),
      pct(m.conversionsFromInteractionsRate), ctx.stamp
    ];
  });
}

function exportHourDay(ctx) {
  var q =
    'SELECT campaign.name, segments.day_of_week, segments.hour, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value, metrics.cost_per_conversion ' +
    'FROM campaign ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  return write('HOUR_DAY', q, ctx, function (r) {
    var m = r.metrics;
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.segments.dayOfWeek, r.segments.hour, ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.costMicros),
      n2(m.conversions), n2(m.conversionsValue), cost(m.costPerConversion), ctx.stamp
    ];
  });
}

function exportGeo(ctx) {
  var q =
    'SELECT campaign.name, geographic_view.location_type, segments.geo_target_city, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value, metrics.cost_per_conversion ' +
    'FROM geographic_view ' + dateFilter(ctx) + ' AND metrics.clicks > 0';

  return write('GEO', q, ctx, function (r) {
    var m = r.metrics;
    var city = geoName(r.segments.geoTargetCity, ctx);
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, city, r.geographicView.locationType, ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.costMicros),
      n2(m.conversions), n2(m.conversionsValue), cost(m.costPerConversion), ctx.stamp
    ];
  });
}

function exportLandingPages(ctx) {
  var q =
    'SELECT campaign.name, landing_page_view.unexpanded_final_url, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value, metrics.cost_per_conversion ' +
    'FROM landing_page_view ' + dateFilter(ctx) + ' AND metrics.clicks > 0';

  return write('LANDING_PAGES', q, ctx, function (r) {
    var m = r.metrics;
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.landingPageView.unexpandedFinalUrl, ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.costMicros),
      n2(m.conversions), n2(m.conversionsValue), cost(m.costPerConversion), ctx.stamp
    ];
  });
}

function exportAudiences(ctx) {
  var total = 0;

  var qAdGroup =
    'SELECT campaign.name, ad_group.name, ad_group_criterion.display_name, ' +
    'ad_group_criterion.type, ad_group_criterion.bid_modifier, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value ' +
    'FROM ad_group_audience_view ' + dateFilter(ctx);

  total += write('AUDIENCES', qAdGroup, ctx, function (r) {
    var m = r.metrics;
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, r.adGroup.name,
      r.adGroupCriterion.displayName || '', r.adGroupCriterion.type,
      r.adGroupCriterion.bidModifier || '', ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.costMicros),
      n2(m.conversions), n2(m.conversionsValue), ctx.stamp
    ];
  });

  var qCampaign =
    'SELECT campaign.name, campaign_criterion.display_name, ' +
    'campaign_criterion.type, campaign_criterion.bid_modifier, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value ' +
    'FROM campaign_audience_view ' + dateFilter(ctx);

  total += write('AUDIENCES', qCampaign, ctx, function (r) {
    var m = r.metrics;
    return [
      ctx.range.start, ctx.range.end, ctx.label,
      r.campaign.name, '(nivel campaña)',
      r.campaignCriterion.displayName || '', r.campaignCriterion.type,
      r.campaignCriterion.bidModifier || '', ctx.currency,
      n(m.impressions), n(m.clicks), pct(m.ctr), cost(m.costMicros),
      n2(m.conversions), n2(m.conversionsValue), ctx.stamp
    ];
  });

  return total;
}

function exportBudget(ctx) {
  var q =
    'SELECT campaign.name, campaign_budget.amount_micros, ' +
    'campaign_budget.delivery_method, metrics.cost_micros, ' +
    'metrics.search_budget_lost_impression_share ' +
    'FROM campaign ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  return write('BUDGET', q, ctx, function (r) {
    var daily = cost(r.campaignBudget.amountMicros);
    var expected = daily * 7;
    var actual = cost(r.metrics.costMicros);
    var pacing = expected > 0 ? Math.round((actual / expected) * 10000) / 100 : 0;
    var dev = ctx.conf.thresholds.spendDeviation * 100;

    if (expected > 0 && Math.abs(pacing - 100) > dev) {
      alert(ctx, pacing > 100 ? 'ALTA' : 'MEDIA', 'Desvío de pacing', r.campaign.name,
            'Gasto real vs esperado %', pacing, 100);
    }

    return [
      ctx.range.start, ctx.range.end, ctx.label, r.campaign.name,
      daily, n2(expected), actual, pacing,
      r.campaignBudget.deliveryMethod, ctx.currency,
      pct(r.metrics.searchBudgetLostImpressionShare), ctx.stamp
    ];
  });
}

function exportChangeEvents(ctx) {
  // Google solo expone 30 dias de historial de cambios. Pedir una semana mas vieja
  // devuelve error, no vacio: durante el relleno de 13 semanas eso escribia 29 filas
  // de ERROR en run_log que no eran fallas reales, solo un limite de la fuente.
  var hoyMs = new Date().getTime();
  var inicioMs = new Date(ctx.range.start + 'T00:00:00Z').getTime();
  if (BACKFILL && (hoyMs - inicioMs) / 86400000 > 29) {
    ctx.runLog.push([ctx.label, ctx.range.start, ctx.range.end, 'CHANGE_EVENTS', 0, 'FUERA_DE_VENTANA',
      'Google solo da 30 dias de historial; esta semana queda fuera. No es una falla.', ctx.stamp]);
    return 0;
  }
  // Ventana de 30 dias, no solo la semana analizada (ticket 42). Google conserva 30 y
  // ahora la tabla acumula por upsert, asi que pedir de mas no duplica: rellena. Si una
  // corrida se saltea un lunes, la siguiente tapa el hueco sola. Con la ventana semanal
  // ese hueco quedaba para siempre.
  var desde30 = Utilities.formatDate(new Date(new Date().getTime() - 29 * 86400000), 'UTC', 'yyyy-MM-dd');
  var q =
    'SELECT change_event.change_date_time, change_event.user_email, ' +
    'change_event.client_type, change_event.change_resource_type, ' +
    'change_event.resource_change_operation, change_event.changed_fields, ' +
    'change_event.old_resource, change_event.new_resource, ' +
    'change_event.campaign, change_event.ad_group, change_event.change_resource_name ' +
    'FROM change_event ' +
    'WHERE change_event.change_date_time >= "' + desde30 + '" ' +
    'ORDER BY change_event.change_date_time DESC ' +
    'LIMIT 2000';

  var sheet = getSheet('CHANGE_EVENTS');
  var results = AdsApp.search(q);
  var rows = [];
  var nameCache = {};

  while (results.hasNext() && rows.length < CONFIG.ROW_LIMIT) {
    var r = results.next();
    var ce = r.changeEvent;
    var auto = ce.clientType && ce.clientType.indexOf('RECOMMENDATION') >= 0;

    if (auto) {
      alert(ctx, 'ALTA', 'Cambio auto-aplicado por Google', ce.changeResourceType,
            'client_type ' + ce.clientType + ' — ' + (ce.changedFields || ''), 1, 0);
    }

    var oldRes = unwrap(ce.oldResource, ce.changeResourceType);
    var newRes = unwrap(ce.newResource, ce.changeResourceType);
    var fields = (ce.changedFields || '').split(',')
                   .map(function (s) { return s.trim(); })
                   .filter(function (s) { return s.length > 0; });

    if (fields.length === 0) { fields = ['(sin detalle)']; }

    // Resolver la identidad de lo que cambio. Al modificar, change_event solo
    // trae el campo tocado: "status ENABLED->PAUSED" no dice CUAL keyword.
    // Sin esto, el analisis no puede cruzar el cambio con el accionable.
    var ident = resolveEntity(ce.changeResourceName, ce.changeResourceType,
                              newRes || oldRes, nameCache);
    var campName = resolveName(ce.campaign, 'campaign', nameCache);
    var agName = resolveName(ce.adGroup, 'ad_group', nameCache);

    for (var i = 0; i < fields.length && rows.length < CONFIG.ROW_LIMIT; i++) {
      var f = fields[i];
      rows.push([
        ce.changeDateTime, ctx.label, ce.userEmail || '', ce.clientType,
        ce.changeResourceType, ce.resourceChangeOperation,
        f, readPath(oldRes, f), readPath(newRes, f),
        ce.campaign || '', ce.adGroup || '', ctx.stamp,
        ce.changeResourceName || '', ident, campName, agName
      ]);
    }
  }

  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS.CHANGE_EVENTS.length).setValues(rows); }
    pushToSupabase(ctx, 'CHANGE_EVENTS', rows);
  }
  return rows.length;
}

/**
 * Devuelve un nombre legible para la entidad que cambio.
 * Primero intenta sacarlo del propio resource (si el cambio fue CREATE trae
 * todo). Si no, consulta la cuenta por resource_name. Cachea por corrida.
 */
function resolveEntity(resourceName, resourceType, res, cache) {
  if (!resourceName) { return ''; }
  if (cache[resourceName] !== undefined) { return cache[resourceName]; }

  var name = '';
  try {
    // Lo que ya viene en el propio evento
    if (res) {
      if (res.keyword && res.keyword.text) { name = res.keyword.text; }
      else if (res.name) { name = res.name; }
      else if (res.ad && res.ad.responsiveSearchAd && res.ad.responsiveSearchAd.headlines &&
               res.ad.responsiveSearchAd.headlines.length) {
        name = res.ad.responsiveSearchAd.headlines[0].text;
      }
    }

    // Si no vino, consultar la cuenta
    if (!name) {
      var q = null;
      if (resourceType === 'AD_GROUP_CRITERION') {
        q = 'SELECT ad_group_criterion.keyword.text, ad_group_criterion.display_name ' +
            'FROM ad_group_criterion WHERE ad_group_criterion.resource_name = "' + resourceName + '"';
      } else if (resourceType === 'CAMPAIGN_CRITERION') {
        q = 'SELECT campaign_criterion.keyword.text, campaign_criterion.display_name ' +
            'FROM campaign_criterion WHERE campaign_criterion.resource_name = "' + resourceName + '"';
      } else if (resourceType === 'AD_GROUP_AD') {
        q = 'SELECT ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.name ' +
            'FROM ad_group_ad WHERE ad_group_ad.resource_name = "' + resourceName + '"';
      } else if (resourceType === 'AD_GROUP') {
        q = 'SELECT ad_group.name FROM ad_group WHERE ad_group.resource_name = "' + resourceName + '"';
      } else if (resourceType === 'CAMPAIGN') {
        q = 'SELECT campaign.name FROM campaign WHERE campaign.resource_name = "' + resourceName + '"';
      } else if (resourceType === 'CAMPAIGN_BUDGET') {
        q = 'SELECT campaign_budget.name FROM campaign_budget WHERE campaign_budget.resource_name = "' + resourceName + '"';
      }
      if (q) {
        var r = AdsApp.search(q);
        if (r.hasNext()) {
          var row = r.next();
          var obj = row.adGroupCriterion || row.campaignCriterion || row.adGroupAd ||
                    row.adGroup || row.campaign || row.campaignBudget;
          if (obj) {
            if (obj.keyword && obj.keyword.text) { name = obj.keyword.text; }
            else if (obj.displayName) { name = obj.displayName; }
            else if (obj.name) { name = obj.name; }
            else if (obj.ad && obj.ad.responsiveSearchAd && obj.ad.responsiveSearchAd.headlines &&
                     obj.ad.responsiveSearchAd.headlines.length) {
              name = obj.ad.responsiveSearchAd.headlines[0].text;
            } else if (obj.ad && obj.ad.name) { name = obj.ad.name; }
          }
        }
      }
    }
  } catch (e) { /* si no se puede resolver, queda vacio y el cruce se hace por campana/grupo */ }

  cache[resourceName] = name || '';
  return cache[resourceName];
}

/** Resuelve el resource_name de una campana o grupo a su nombre. */
function resolveName(resourceName, kind, cache) {
  if (!resourceName) { return ''; }
  var key = kind + ':' + resourceName;
  if (cache[key] !== undefined) { return cache[key]; }
  var name = '';
  try {
    var q = kind === 'campaign'
      ? 'SELECT campaign.name FROM campaign WHERE campaign.resource_name = "' + resourceName + '"'
      : 'SELECT ad_group.name FROM ad_group WHERE ad_group.resource_name = "' + resourceName + '"';
    var r = AdsApp.search(q);
    if (r.hasNext()) {
      var row = r.next();
      name = kind === 'campaign' ? row.campaign.name : row.adGroup.name;
    }
  } catch (e) {}
  cache[key] = name || '';
  return cache[key];
}

function unwrap(changed, resourceType) {
  if (!changed) { return null; }
  var map = {
    'CAMPAIGN': 'campaign',
    'AD_GROUP': 'adGroup',
    'AD_GROUP_CRITERION': 'adGroupCriterion',
    'CAMPAIGN_CRITERION': 'campaignCriterion',
    'AD_GROUP_AD': 'adGroupAd',
    'CAMPAIGN_BUDGET': 'campaignBudget',
    'AD_GROUP_BID_MODIFIER': 'adGroupBidModifier',
    'CAMPAIGN_ASSET': 'campaignAsset',
    'AD_GROUP_ASSET': 'adGroupAsset',
    'ASSET': 'asset',
    'FEED': 'feed'
  };
  var key = map[resourceType];
  if (key && changed[key]) { return changed[key]; }
  for (var k in changed) {
    if (changed.hasOwnProperty(k)) { return changed[k]; }
  }
  return null;
}

function readPath(obj, path) {
  if (!obj || !path || path.charAt(0) === '(') { return ''; }
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    var camel = parts[i].replace(/_([a-z])/g, function (m, c) { return c.toUpperCase(); });
    if (cur === null || cur === undefined) { return ''; }
    cur = cur[camel];
  }
  if (cur === null || cur === undefined) { return ''; }
  if (typeof cur === 'object') {
    try { return JSON.stringify(cur).substring(0, 200); } catch (e) { return '[objeto]'; }
  }
  if (path.indexOf('micros') >= 0 && !isNaN(Number(cur))) {
    return cost(cur);
  }
  return String(cur).substring(0, 200);
}

function exportBidTargets(ctx) {
  var total = 0;

  var qCampaign =
    'SELECT campaign.name, campaign.status, campaign.bidding_strategy_type, ' +
    'campaign.target_cpa.target_cpa_micros, campaign.target_roas.target_roas, ' +
    'campaign.maximize_conversions.target_cpa_micros, ' +
    'campaign.maximize_conversion_value.target_roas, ' +
    'campaign_budget.amount_micros ' +
    'FROM campaign WHERE campaign.status != "REMOVED"';

  total += write('BID_TARGETS', qCampaign, ctx, function (r) {
    var c = r.campaign;
    var tcpa = cost(pick(c.targetCpa && c.targetCpa.targetCpaMicros,
                         c.maximizeConversions && c.maximizeConversions.targetCpaMicros));
    var troas = pick(c.targetRoas && c.targetRoas.targetRoas,
                     c.maximizeConversionValue && c.maximizeConversionValue.targetRoas);
    return [
      ctx.range.start, ctx.range.end, ctx.label, 'campaign',
      c.name, '', c.status, c.biddingStrategyType,
      tcpa || '', troas ? n2(troas) : '', '',
      cost(r.campaignBudget.amountMicros), ctx.currency, ctx.stamp
    ];
  });

  var qAdGroup =
    'SELECT campaign.name, ad_group.name, ad_group.status, ' +
    'ad_group.cpc_bid_micros, ad_group.target_cpa_micros, ' +
    'ad_group.effective_target_cpa_micros, ad_group.effective_target_cpa_source, ' +
    'ad_group.effective_target_roas, ad_group.effective_target_roas_source ' +
    'FROM ad_group WHERE ad_group.status != "REMOVED"';

  total += write('BID_TARGETS', qAdGroup, ctx, function (r) {
    var g = r.adGroup;
    var eff = cost(g.effectiveTargetCpaMicros);
    var own = cost(g.targetCpaMicros);

    if (eff > 0 && own > 0 && Math.abs(eff - own) > 0.01) {
      alert(ctx, 'BAJA', 'tCPA de grupo distinto del efectivo', g.name,
            'target propio vs efectivo', own, eff);
    }

    return [
      ctx.range.start, ctx.range.end, ctx.label, 'ad_group',
      r.campaign.name, g.name, g.status, '',
      eff || '', g.effectiveTargetRoas ? n2(g.effectiveTargetRoas) : '',
      g.effectiveTargetCpaSource || g.effectiveTargetRoasSource || '',
      cost(g.cpcBidMicros), ctx.currency, ctx.stamp
    ];
  });

  return total;
}

function exportSimulations(ctx) {
  var q =
    'SELECT campaign.name, campaign_simulation.type, ' +
    'campaign_simulation.modification_method, ' +
    'campaign_simulation.start_date, campaign_simulation.end_date, ' +
    'campaign_simulation.target_cpa_point_list.points, ' +
    'campaign_simulation.target_roas_point_list.points, ' +
    'campaign_simulation.budget_point_list.points ' +
    'FROM campaign_simulation';

  var sheet = getSheet('SIMULATIONS');
  var results = AdsApp.search(q);
  var rows = [];

  while (results.hasNext() && rows.length < CONFIG.ROW_LIMIT) {
    var r = results.next();
    var s = r.campaignSimulation;
    var lists = [
      { key: 'targetCpaPointList',  type: 'TARGET_CPA',  field: 'targetCpaMicros', money: true },
      { key: 'targetRoasPointList', type: 'TARGET_ROAS', field: 'targetRoas',      money: false },
      { key: 'budgetPointList',     type: 'BUDGET',      field: 'budgetAmountMicros', money: true }
    ];

    for (var i = 0; i < lists.length; i++) {
      var L = lists[i];
      var pl = s[L.key];
      if (!pl || !pl.points) { continue; }
      for (var j = 0; j < pl.points.length && rows.length < CONFIG.ROW_LIMIT; j++) {
        var p = pl.points[j];
        rows.push([
          ctx.label, r.campaign.name, L.type, s.modificationMethod,
          s.startDate, s.endDate,
          L.money ? cost(p[L.field]) : n2(p[L.field]),
          n2(p.biddableConversions), n2(p.biddableConversionsValue),
          n(p.clicks), cost(p.costMicros), n(p.impressions),
          n(p.topSlotImpressions), ctx.currency, ctx.stamp
        ]);
      }
    }
  }

  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS.SIMULATIONS.length).setValues(rows); }
    pushToSupabase(ctx, 'SIMULATIONS', rows);
  }
  return rows.length;
}

/**
 * Simulaciones a nivel grupo de anuncios. Karedo tiene tCPA por grupo, y en
 * ese caso Google no devuelve campaign_simulation: la curva esta en
 * ad_group_simulation. Sin esto, v_cpa_marginal queda vacia para Karedo.
 * Se guardan en la misma tabla, con ad_group en el nombre de campana como
 * "Campana › Grupo", para que la vista las trate igual.
 */
function exportAdGroupSimulations(ctx) {
  var q =
    'SELECT campaign.name, ad_group.name, ad_group_simulation.type, ' +
    'ad_group_simulation.modification_method, ' +
    'ad_group_simulation.start_date, ad_group_simulation.end_date, ' +
    'ad_group_simulation.target_cpa_point_list.points, ' +
    'ad_group_simulation.cpc_bid_point_list.points ' +
    'FROM ad_group_simulation';

  var sheet = getSheet('SIMULATIONS');
  // Sin try/catch: si Google no expone ad_group_simulation desde Scripts o la
  // consulta tiene un error, safe() lo registra como ERROR con el mensaje.
  // Un 0 silencioso no distingue "sin simulaciones" de "consulta rota".
  var results = AdsApp.search(q);
  var rows = [];

  while (results.hasNext() && rows.length < CONFIG.ROW_LIMIT) {
    var r = results.next();
    var s = r.adGroupSimulation;
    var lists = [
      { key: 'targetCpaPointList', type: 'TARGET_CPA_ADGROUP', field: 'targetCpaMicros', money: true },
      { key: 'cpcBidPointList',    type: 'CPC_BID_ADGROUP',    field: 'cpcBidMicros',    money: true }
    ];
    for (var i = 0; i < lists.length; i++) {
      var L = lists[i];
      var pl = s[L.key];
      if (!pl || !pl.points) { continue; }
      for (var j = 0; j < pl.points.length && rows.length < CONFIG.ROW_LIMIT; j++) {
        var p = pl.points[j];
        rows.push([
          ctx.label, r.campaign.name + ' \u203a ' + r.adGroup.name, L.type, s.modificationMethod,
          s.startDate, s.endDate,
          L.money ? cost(p[L.field]) : n2(p[L.field]),
          n2(p.biddableConversions), n2(p.biddableConversionsValue),
          n(p.clicks), cost(p.costMicros), n(p.impressions),
          n(p.topSlotImpressions), ctx.currency, ctx.stamp
        ]);
      }
    }
  }

  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS.SIMULATIONS.length).setValues(rows); }
    pushToSupabase(ctx, 'SIMULATIONS', rows);
  }
  return rows.length;
}

function exportNegatives(ctx) {
  var total = 0;

  var qCampaign =
    'SELECT campaign.name, campaign_criterion.keyword.text, ' +
    'campaign_criterion.keyword.match_type, campaign_criterion.type ' +
    'FROM campaign_criterion ' +
    'WHERE campaign_criterion.negative = TRUE ' +
    'AND campaign_criterion.type = "KEYWORD"';

  total += write('NEGATIVES', qCampaign, ctx, function (r) {
    return [
      ctx.range.start, ctx.label, 'campaign', r.campaign.name, '',
      r.campaignCriterion.keyword.text, r.campaignCriterion.keyword.matchType, ctx.stamp
    ];
  });

  var qAdGroup =
    'SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ' +
    'ad_group_criterion.keyword.match_type ' +
    'FROM ad_group_criterion ' +
    'WHERE ad_group_criterion.negative = TRUE ' +
    'AND ad_group_criterion.type = "KEYWORD"';

  total += write('NEGATIVES', qAdGroup, ctx, function (r) {
    return [
      ctx.range.start, ctx.label, 'ad_group', r.campaign.name, r.adGroup.name,
      r.adGroupCriterion.keyword.text, r.adGroupCriterion.keyword.matchType, ctx.stamp
    ];
  });

  return total;
}


// Catalogo de etiquetas: resource name -> nombre legible. Se arma una vez por corrida.
var LABEL_CACHE = null;
function fISO(d) {
  if (!d || !d.year) { return null; }
  var s = d.year + '-' + ('0' + d.month).slice(-2) + '-' + ('0' + d.day).slice(-2);
  return s === '2037-12-30' ? null : s;
}

function nombreLabel(rn) {
  if (LABEL_CACHE === null) {
    LABEL_CACHE = {};
    try {
      var it = AdsApp.search('SELECT label.resource_name, label.name FROM label');
      while (it.hasNext()) { var r = it.next(); LABEL_CACHE[r.label.resourceName] = r.label.name; }
    } catch (e) { }
  }
  return LABEL_CACHE[rn] || rn.split('/').pop();
}

function exportAccountState(ctx) {
  var rows = [];
  var add = function (section, item, value, detail) {
    rows.push([ctx.label, section, item, value, detail || '', ctx.stamp]);
  };

  var nCamp = 0, nCampActivas = 0;
  var camps = AdsApp.search(
    'SELECT campaign.name, campaign.status, campaign.advertising_channel_type, ' +
    'campaign.bidding_strategy_type, campaign.target_cpa.target_cpa_micros, ' +
    'campaign.maximize_conversions.target_cpa_micros, campaign.target_roas.target_roas, ' +
    'campaign.maximize_conversion_value.target_roas, campaign_budget.amount_micros, ' +
    'campaign.labels ' +
    'FROM campaign WHERE campaign.status != "REMOVED"');
  // Fechas: en Scripts se leen del objeto campaña, no por GAQL (campaign.start_date
  // no existe como campo de consulta y la query entera falla si se pide).
  var fechasCamp = {};
  try {
    var itf = AdsApp.campaigns().withCondition('Status != REMOVED').get();
    while (itf.hasNext()) { var fc = itf.next(); fechasCamp[fc.getName()] = { inicio: fISO(fc.getStartDate()), fin: fISO(fc.getEndDate()) }; }
    if (typeof AdsApp.performanceMaxCampaigns === 'function') {
      var itq = AdsApp.performanceMaxCampaigns().withCondition('Status != REMOVED').get();
      while (itq.hasNext()) { var qc = itq.next(); fechasCamp[qc.getName()] = { inicio: fISO(qc.getStartDate()), fin: fISO(qc.getEndDate()) }; }
    }
  } catch (e) { Logger.log('fechas: ' + e.message); }
  while (camps.hasNext()) {
    var r = camps.next();
    var cc = r.campaign;
    nCamp++;
    if (cc.status === 'ENABLED') { nCampActivas++; }
    var tcpa = cost(pick(cc.targetCpa && cc.targetCpa.targetCpaMicros,
                         cc.maximizeConversions && cc.maximizeConversions.targetCpaMicros));
    var troas = pick(cc.targetRoas && cc.targetRoas.targetRoas,
                     cc.maximizeConversionValue && cc.maximizeConversionValue.targetRoas);
    var det = cc.biddingStrategyType;
    if (tcpa) { det += ' · tCPA ' + tcpa; }
    if (troas) { det += ' · tROAS ' + n2(troas); }
    det += ' · presupuesto ' + cost(r.campaignBudget.amountMicros) + ' ' + ctx.currency;
    // Fechas: una campana ENABLED con end_date pasada esta FINALIZADA, no rota.
    // Google deja el estado en ENABLED aunque la campana ya no entregue.
    var hoyISO = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
    var fx = fechasCamp[cc.name] || {};
    if (fx.inicio) { det += ' · desde ' + fx.inicio; }
    if (fx.fin) { det += ' · hasta ' + fx.fin; }
    var estado = cc.status;
    if (cc.status === 'ENABLED' && fx.fin && fx.fin < hoyISO) { estado = 'FINALIZADA'; det += ' · terminada, sigue en ENABLED'; }
    else if (cc.status === 'ENABLED' && fx.inicio && fx.inicio > hoyISO) { estado = 'PROGRAMADA'; det += ' · todavia no arranco'; }
    // Etiquetas: la forma de dar taxonomia sin renombrar campanas. Google las expone como
    // resource names; el nombre legible se resuelve contra el catalogo de labels.
    var labs = [];
    if (cc.labels && cc.labels.length) { for (var li = 0; li < cc.labels.length; li++) { labs.push(nombreLabel(cc.labels[li])); } }
    if (labs.length) { det += ' · etiquetas: ' + labs.join(', '); }
    add('campanas', cc.name, estado, det);
  }
  add('resumen', 'campanas', nCamp, nCampActivas + ' activas');

  var groups = AdsApp.search(
    'SELECT campaign.name, ad_group.name, ad_group.status, ' +
    'ad_group.effective_target_cpa_micros, ad_group.effective_target_cpa_source, ' +
    'ad_group.effective_target_roas, ad_group.effective_target_roas_source ' +
    'FROM ad_group WHERE ad_group.status != "REMOVED"');
  var nG = 0, nGA = 0;
  while (groups.hasNext()) {
    var g = groups.next();
    nG++;
    if (g.adGroup.status === 'ENABLED') { nGA++; }
    var d = '';
    if (g.adGroup.effectiveTargetCpaMicros) {
      d = 'tCPA ' + cost(g.adGroup.effectiveTargetCpaMicros) +
          ' (' + (g.adGroup.effectiveTargetCpaSource || '') + ')';
    } else if (g.adGroup.effectiveTargetRoas) {
      d = 'tROAS ' + n2(g.adGroup.effectiveTargetRoas) +
          ' (' + (g.adGroup.effectiveTargetRoasSource || '') + ')';
    }
    add('grupos', g.campaign.name + ' > ' + g.adGroup.name, g.adGroup.status, d);
  }
  add('resumen', 'grupos', nG, nGA + ' activos');

  var kws = AdsApp.search(
    'SELECT ad_group_criterion.status, ad_group_criterion.system_serving_status ' +
    'FROM ad_group_criterion WHERE ad_group_criterion.type = "KEYWORD" ' +
    'AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != "REMOVED"');
  var kwCount = {};
  var kwTotal = 0;
  while (kws.hasNext()) {
    var k = kws.next().adGroupCriterion;
    var key = k.status + ' / ' + (k.systemServingStatus || 'n/d');
    kwCount[key] = (kwCount[key] || 0) + 1;
    kwTotal++;
  }
  for (var key in kwCount) {
    if (kwCount.hasOwnProperty(key)) { add('keywords', key, kwCount[key], ''); }
  }
  add('resumen', 'keywords', kwTotal, 'total no eliminadas');

  var negC = countRows(
    'SELECT campaign_criterion.criterion_id FROM campaign_criterion ' +
    'WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = "KEYWORD"');
  var negG = countRows(
    'SELECT ad_group_criterion.criterion_id FROM ad_group_criterion ' +
    'WHERE ad_group_criterion.negative = TRUE AND ad_group_criterion.type = "KEYWORD"');
  add('negativas', 'nivel campana', negC, '');
  add('negativas', 'nivel grupo', negG, '');
  add('resumen', 'negativas', negC + negG, '');

  var convs = AdsApp.search(
    'SELECT conversion_action.name, conversion_action.status, ' +
    'conversion_action.category, conversion_action.primary_for_goal, ' +
    'conversion_action.include_in_conversions_metric ' +
    'FROM conversion_action WHERE conversion_action.status != "REMOVED"');
  while (convs.hasNext()) {
    var ca = convs.next().conversionAction;
    add('conversiones', ca.name, ca.status,
        ca.category + ' · ' +
        (ca.includeInConversionsMetric ? 'PRIMARIA' : 'secundaria'));
  }

  var sheet = getSheet('ACCOUNT_STATE');
  clearAccountRows(sheet, ctx.label);
  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS.ACCOUNT_STATE.length).setValues(rows); }
    pushToSupabase(ctx, 'ACCOUNT_STATE', rows);
  }
  return rows.length;
}

function countRows(query) {
  var res = AdsApp.search(query);
  var c = 0;
  while (res.hasNext()) { res.next(); c++; }
  return c;
}

function clearAccountRows(sheet, label) {
  if (!sheet) return;
  var last = sheet.getLastRow();
  if (last < 2) { return; }
  var data = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] === label) { sheet.deleteRow(i + 2); }
  }
}

function exportWeeklyBrief(ctx) {
  var rows = [];
  var add = function (section, item, detail, value, prev, delta, note) {
    rows.push([ctx.label, ctx.range.start, ctx.range.end, section, item,
               detail || '', value, prev === null ? '' : prev,
               delta === null ? '' : delta, note || '', ctx.stamp]);
  };

  var prevRange = shiftWeek(ctx.range, -7);

  var addList = function (section, items) {
    if (!items || items.length === 0) {
      add(section, 'ninguna', '', 0, null, null, '');
      return;
    }
    add(section, 'total', '', items.length, null, null, '');
    for (var b = 0; b < items.length; b += 20) {
      var chunk = items.slice(b, b + 20);
      add(section, 'items ' + (b + 1) + ' a ' + (b + chunk.length), '',
          '', null, null, chunk.join(' · '));
    }
  };

  var cur = accountTotals(ctx.range);
  var pre = accountTotals(prevRange);

  add('periodo', 'semana actual', ctx.range.start + ' a ' + ctx.range.end, '', '', '', '');
  add('periodo', 'semana previa', prevRange.start + ' a ' + prevRange.end, '', '', '', '');

  var metrics = [
    ['gasto', 'cost'], ['conversiones', 'conversions'], ['all_conversions', 'allConv'],
    ['cpa', 'cpa'], ['clics', 'clicks'], ['impresiones', 'impressions'],
    ['ctr', 'ctr'], ['cpc_medio', 'avgCpc']
  ];
  for (var i = 0; i < metrics.length; i++) {
    var name = metrics[i][0], key = metrics[i][1];
    add('totales', name, ctx.currency, cur[key], pre[key], deltaPct(cur[key], pre[key]), '');
  }

  var camps = AdsApp.search(
    'SELECT campaign.name, campaign.status, metrics.cost_micros, metrics.conversions, ' +
    'metrics.cost_per_conversion, metrics.search_impression_share, ' +
    'metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share ' +
    'FROM campaign ' + dateFilter(ctx) + ' AND campaign.status = "ENABLED"');

  var prevCamp = {};
  var pc = AdsApp.search(
    'SELECT campaign.name, metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion ' +
    'FROM campaign WHERE segments.date BETWEEN "' + prevRange.start + '" AND "' +
    prevRange.end + '" AND campaign.status = "ENABLED"');
  while (pc.hasNext()) {
    var p = pc.next();
    prevCamp[p.campaign.name] = {
      cost: cost(p.metrics.costMicros),
      conv: n2(p.metrics.conversions),
      cpa: cost(p.metrics.costPerConversion)
    };
  }

  while (camps.hasNext()) {
    var c = camps.next();
    var nm = c.campaign.name;
    var prevC = prevCamp[nm] || { cost: 0, conv: 0, cpa: 0 };
    var spend = cost(c.metrics.costMicros);
    var conv = n2(c.metrics.conversions);
    var cpa = cost(c.metrics.costPerConversion);
    var restriccion = pct(c.metrics.searchBudgetLostImpressionShare) >
                      pct(c.metrics.searchRankLostImpressionShare)
                      ? 'limitada por presupuesto' : 'limitada por ranking';

    add('campanas', nm, 'gasto', spend, prevC.cost, deltaPct(spend, prevC.cost),
        'IS ' + pct(c.metrics.searchImpressionShare) + '% · ' + restriccion +
        ' (budget ' + pct(c.metrics.searchBudgetLostImpressionShare) + '%, rank ' +
        pct(c.metrics.searchRankLostImpressionShare) + '%)');
    add('campanas', nm, 'conversiones', conv, prevC.conv, deltaPct(conv, prevC.conv), '');
    add('campanas', nm, 'cpa', cpa, prevC.cpa, deltaPct(cpa, prevC.cpa), '');
  }

  var ca = AdsApp.search(
    'SELECT segments.conversion_action_name, segments.conversion_action_category, ' +
    'metrics.conversions, metrics.all_conversions, metrics.conversions_value ' +
    'FROM customer ' + dateFilter(ctx));
  while (ca.hasNext()) {
    var a = ca.next();
    add('conversiones_por_accion', a.segments.conversionActionName,
        a.segments.conversionActionCategory,
        n2(a.metrics.conversions), null, null,
        'all_conversions ' + n2(a.metrics.allConversions) +
        ' · valor ' + n2(a.metrics.conversionsValue));
  }

  var kw = AdsApp.search(
    'SELECT ad_group.name, ad_group_criterion.keyword.text, ' +
    'ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, ' +
    'metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.cost_per_conversion ' +
    'FROM keyword_view ' + dateFilter(ctx) + ' AND metrics.cost_micros > 0 ' +
    'ORDER BY metrics.cost_micros DESC LIMIT 10');
  while (kw.hasNext()) {
    var k = kw.next();
    var qi = k.adGroupCriterion.qualityInfo || {};
    add('top_keywords_por_gasto', k.adGroupCriterion.keyword.text,
        k.adGroup.name + ' · ' + k.adGroupCriterion.keyword.matchType,
        cost(k.metrics.costMicros), null, null,
        n2(k.metrics.conversions) + ' conv · CPA ' + cost(k.metrics.costPerConversion) +
        ' · QS ' + (qi.qualityScore || 'n/d'));
  }

  var st = AdsApp.search(
    'SELECT search_term_view.search_term, segments.search_term_match_type, ' +
    'metrics.cost_micros, metrics.clicks, metrics.impressions ' +
    'FROM search_term_view ' + dateFilter(ctx) +
    ' AND metrics.conversions = 0 AND metrics.cost_micros > 0 ' +
    'ORDER BY metrics.cost_micros DESC LIMIT 10');
  while (st.hasNext()) {
    var s = st.next();
    add('terminos_sin_conversion', s.searchTermView.searchTerm,
        s.segments.searchTermMatchType, cost(s.metrics.costMicros), null, null,
        n(s.metrics.clicks) + ' clics · ' + n(s.metrics.impressions) + ' impresiones');
  }

  var chg = AdsApp.search(
    'SELECT change_event.change_date_time, change_event.user_email, ' +
    'change_event.client_type, change_event.change_resource_type, ' +
    'change_event.resource_change_operation, change_event.changed_fields ' +
    'FROM change_event ' +
    'WHERE change_event.change_date_time >= "' + ctx.range.start + '" ' +
    'AND change_event.change_date_time <= "' + ctx.range.end + ' 23:59:59" ' +
    'ORDER BY change_event.change_date_time DESC LIMIT 200');
  var nChg = 0, autoChg = 0;
  while (chg.hasNext()) {
    var ce = chg.next().changeEvent;
    nChg++;
    if (ce.clientType && ce.clientType.indexOf('RECOMMENDATION') >= 0) {
      autoChg++;
      add('cambios', 'AUTO-APLICADO POR GOOGLE', ce.changeResourceType, 1, null, null,
          ce.clientType + ' · ' + (ce.changedFields || ''));
    }
  }
  add('cambios', 'total de cambios en la semana', '', nChg, null, null,
      nChg === 0 ? 'Sin cambios registrados. Detalle completo en CHANGE_EVENTS'
                 : autoChg + ' auto-aplicados por Google. Detalle en CHANGE_EVENTS');

  var altas = 0, medias = 0;
  for (var j = 0; j < ctx.alerts.length; j++) {
    var al = ctx.alerts[j];
    if (al[3] === 'ALTA') {
      altas++;
      add('alertas_alta', al[4], al[5], al[7], null, null, al[6]);
    } else if (al[3] === 'MEDIA') {
      medias++;
    }
  }
  add('alertas_resumen', 'severidad ALTA', '', altas, null, null, '');
  add('alertas_resumen', 'severidad MEDIA', '', medias, null, null, 'Detalle en ALERTS');

  var kwBajoVol = [], kwQsBajo = [], gruposSinImpr = [];

  var invent = AdsApp.search(
    'SELECT campaign.name, campaign.status, ad_group.name, ad_group.status, ' +
    'ad_group_criterion.keyword.text, ad_group_criterion.status, ' +
    'ad_group_criterion.system_serving_status, ' +
    'ad_group_criterion.quality_info.quality_score ' +
    'FROM ad_group_criterion WHERE ad_group_criterion.type = "KEYWORD" ' +
    'AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = "ENABLED"');

  while (invent.hasNext()) {
    var iv = invent.next();
    if (iv.campaign.status !== 'ENABLED' || iv.adGroup.status !== 'ENABLED') { continue; }
    var etiqueta = iv.adGroup.name + ' > ' + iv.adGroupCriterion.keyword.text;
    if (iv.adGroupCriterion.systemServingStatus === 'RARELY_SERVED') {
      kwBajoVol.push(etiqueta);
    }
    var qs = iv.adGroupCriterion.qualityInfo && iv.adGroupCriterion.qualityInfo.qualityScore;
    if (qs && Number(qs) <= 4) {
      kwQsBajo.push(etiqueta + ' (QS ' + qs + ')');
    }
  }

  var gr = AdsApp.search(
    'SELECT campaign.name, campaign.status, ad_group.id, ad_group.name, ad_group.status ' +
    'FROM ad_group WHERE ad_group.status = "ENABLED"');
  var grMetrics = {};
  var gm = AdsApp.search('SELECT ad_group.id, metrics.impressions FROM ad_group ' + dateFilter(ctx));
  while (gm.hasNext()) {
    var gmr = gm.next();
    grMetrics[gmr.adGroup.id] = n(gmr.metrics.impressions);
  }
  while (gr.hasNext()) {
    var g2 = gr.next();
    if (g2.campaign.status !== 'ENABLED') { continue; }
    if (!grMetrics[g2.adGroup.id]) {
      gruposSinImpr.push(g2.campaign.name + ' > ' + g2.adGroup.name);
    }
  }

  addList('entidades_grupos_sin_impresiones', gruposSinImpr);
  addList('entidades_keywords_bajo_volumen', kwBajoVol);
  addList('entidades_keywords_qs_bajo', kwQsBajo);

  add('pestanas_disponibles', 'ACCOUNT_STATE', 'estructura actual de la cuenta',
      '', null, null, 'Leer siempre');
  add('pestanas_disponibles', 'KEYWORDS', 'inventario completo con QS y pujas',
      '', null, null, 'Leer solo si el brief senala un tema de keywords');
  add('pestanas_disponibles', 'SEARCH_TERMS', 'terminos completos',
      '', null, null, 'Leer solo para armar negativas');
  add('pestanas_disponibles', 'SIMULATIONS', 'curvas de tCPA, tROAS y presupuesto',
      '', null, null, 'Leer solo si se propone cambio de target. Puede estar vacia legitimamente');
  add('pestanas_disponibles', 'NEGATIVES', 'inventario de negativas',
      '', null, null, 'Solo para auditoria, no semanal');
  add('pestanas_disponibles', 'GEO / HOUR_DAY / DEVICE / AUDIENCES / LANDING_PAGES',
      'segmentaciones', '', null, null, 'Leer solo si el brief apunta a ese eje');

  var sheet = getSheet('WEEKLY_BRIEF');
  clearAccountRows(sheet, ctx.label);
  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS.WEEKLY_BRIEF.length).setValues(rows); }
    pushToSupabase(ctx, 'WEEKLY_BRIEF', rows);
  }
  return rows.length;
}

function accountTotals(range) {
  var q =
    'SELECT metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, ' +
    'metrics.cost_micros, metrics.conversions, metrics.all_conversions, ' +
    'metrics.conversions_value, metrics.cost_per_conversion ' +
    'FROM customer WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '"';
  var res = AdsApp.search(q);
  if (!res.hasNext()) {
    return { cost: 0, conversions: 0, allConv: 0, cpa: 0, clicks: 0,
             impressions: 0, ctr: 0, avgCpc: 0 };
  }
  var m = res.next().metrics;
  return {
    cost: cost(m.costMicros),
    conversions: n2(m.conversions),
    allConv: n2(m.allConversions),
    cpa: cost(m.costPerConversion),
    clicks: n(m.clicks),
    impressions: n(m.impressions),
    ctr: pct(m.ctr),
    avgCpc: cost(m.averageCpc)
  };
}

function shiftWeek(range, days) {
  var s = new Date(range.start + 'T12:00:00');
  var e = new Date(range.end + 'T12:00:00');
  return {
    start: Utilities.formatDate(new Date(s.getTime() + days * 86400000), 'UTC', 'yyyy-MM-dd'),
    end: Utilities.formatDate(new Date(e.getTime() + days * 86400000), 'UTC', 'yyyy-MM-dd')
  };
}

function deltaPct(cur, prev) {
  if (!prev || prev === 0) { return cur > 0 ? 'nuevo' : ''; }
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}


// ================================================================
// ALERTAS
// ================================================================

function alert(ctx, severity, type, entity, detail, value, threshold) {
  ctx.alerts.push([
    ctx.range.start, ctx.range.end, ctx.label,
    severity, type, entity, detail, value, threshold, ctx.stamp
  ]);
}

function flushAlerts(ctx) {
  if (ctx.alerts.length === 0) { return 0; }
  var sheet = getSheet('ALERTS');
  ctx.alerts.sort(function (a, b) { return a[3] === b[3] ? 0 : (a[3] === 'ALTA' ? -1 : 1); });
  if (sheet) sheet.getRange(sheet.getLastRow() + 1, 1, ctx.alerts.length, CONFIG.TABS.ALERTS.length)
       .setValues(ctx.alerts);
  pushToSupabase(ctx, 'ALERTS', ctx.alerts);
  return ctx.alerts.length;
}


// ================================================================
// MOTOR Y UTILIDADES
// ================================================================

function write(tabName, query, ctx, mapper) {
  var sheet = getSheet(tabName);
  var results = AdsApp.search(query);
  var rows = [];
  while (results.hasNext() && rows.length < CONFIG.ROW_LIMIT) {
    rows.push(mapper(results.next()));
  }
  if (rows.length > 0) {
    if (sheet) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONFIG.TABS[tabName].length).setValues(rows); }
    pushToSupabase(ctx, tabName, rows);
  }
  return rows.length;
}


// ================================================================
// SUPABASE (MOTOR ASINCRONO)
// ================================================================

/** Acopia peticiones en memoria en lugar de ejecutarlas de a una. */
function pushToSupabase(ctx, tabName, rows) {
  if (!CONFIG.SUPABASE.enabled) { return; }
  if (!rows || rows.length === 0) { return; }

  var table = tabName.toLowerCase();
  var cols = CONFIG.TABS[tabName];
  var base = CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/' + table;

  // anonKey en el header apikey, serviceKey como token Bearer
  var headers = {
    'apikey': CONFIG.SUPABASE.anonKey,
    'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  // Politica de escritura. Tres casos, y ninguno implicito:
  //   a) clave de upsert declarada  -> se acumula, nunca se borra (change_events)
  //   b) la tabla tiene week_start  -> se borra SOLO esa semana y se reinserta
  //   c) declarada REEMPLAZO_TOTAL  -> foto de hoy, se reemplaza entera a proposito
  // Cualquier otra cosa es el bug de los tickets 32 y 42: un DELETE por cuenta sin
  // fecha que borra toda la historia. Si pasa, no se escribe y queda en el run_log.
  var claveUpsert = CONFIG.UPSERT_KEYS[tabName] || null;
  var tieneSemana = cols.indexOf('week_start') >= 0;

  if (!claveUpsert && !tieneSemana && !CONFIG.REEMPLAZO_TOTAL[tabName]) {
    ctx.runLog.push([ctx.label, ctx.range.start, ctx.range.end, tabName, 0, 'ERROR',
      'Sin politica de escritura: la tabla no tiene week_start, no declara UPSERT_KEYS ' +
      'y no esta en REEMPLAZO_TOTAL. No se escribe nada para no borrar historia. ' +
      'Declararla en CONFIG antes de volver a correr.', ctx.stamp]);
    return;
  }

  if (!ctx.supabaseCleaned) { ctx.supabaseCleaned = {}; }
  if (!claveUpsert && !ctx.supabaseCleaned[table]) {
    ctx.supabaseCleaned[table] = true;
    var filtro = '?account=eq.' + encodeURIComponent(ctx.label);
    if (tieneSemana) { filtro += '&week_start=eq.' + ctx.range.start; }
    ctx.supabaseRequests.deletes.push({
      url: base + filtro,
      method: 'delete',
      headers: headers,
      muteHttpExceptions: true
    });
  }

  for (var i = 0; i < rows.length; i += CONFIG.SUPABASE.batchSize) {
    var lote = rows.slice(i, i + CONFIG.SUPABASE.batchSize).map(function (fila) {
      var obj = {};
      for (var c = 0; c < cols.length; c++) {
        var v = fila[c];
        obj[cols[c]] = (v === '' || v === undefined) ? null : v;
      }
      return obj;
    });

    var headersLote = headers;
    var urlLote = base;
    if (claveUpsert) {
      urlLote = base + '?on_conflict=' + claveUpsert;
      headersLote = {
        'apikey': headers.apikey,
        'Authorization': headers.Authorization,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      };
    }

    ctx.supabaseRequests.inserts.push({
      url: urlLote,
      method: 'post',
      headers: headersLote,
      payload: JSON.stringify(lote),
      muteHttpExceptions: true
    });
  }
}

/** Ejecuta todas las llamadas juntas y revisa si Supabase arroja errores. */
function flushSupabaseAsync(ctx) {
  if (!CONFIG.SUPABASE.enabled) { return 0; }

  if (ctx.supabaseRequests.deletes.length > 0) {
    UrlFetchApp.fetchAll(ctx.supabaseRequests.deletes);
  }

  if (ctx.supabaseRequests.inserts.length > 0) {
    var responses = UrlFetchApp.fetchAll(ctx.supabaseRequests.inserts);

    for (var i = 0; i < responses.length; i++) {
      var code = responses[i].getResponseCode();
      if (code >= 300) {
        Logger.log('ERROR SUPABASE (HTTP ' + code + ') en ' + ctx.label + ' -> ' +
                   responses[i].getContentText().substring(0, 250));
        break;
      }
    }
  }

  return ctx.supabaseRequests.inserts.length;
}


// ================================================================
// UTILIDADES Y FECHAS
// ================================================================

var BRIEF_TABS = { WEEKLY_BRIEF: true, ACCOUNT_STATE: true, ALERTS: true };
var CURRENT_SS = null;
var CURRENT_BRIEF_SS = null;

function getSheet(tabName) {
  var ss = BRIEF_TABS[tabName] ? CURRENT_BRIEF_SS : CURRENT_SS;
  // Sheet OPCIONAL: si la cuenta no tiene sheetUrl, los datos igual van a Supabase.
  // getSheet devuelve null y cada export saltea la escritura a Sheets.
  if (!ss) { return null; }
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) { sheet = ss.insertSheet(tabName); }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONFIG.TABS[tabName]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, CONFIG.TABS[tabName].length).setFontWeight('bold');
  }
  return sheet;
}

function getBriefSpreadsheet(conf) {
  var props = PropertiesService.getScriptProperties();
  var key = 'BRIEF_SS_' + conf.label;
  var id = props.getProperty(key);

  if (id) {
    try { return SpreadsheetApp.openById(id); }
    catch (e) { }
  }

  var ss = SpreadsheetApp.create('NORTHSIGNAL · BRIEF · ' + conf.label);
  props.setProperty(key, ss.getId());
  return ss;
}

function geoName(resourceName, ctx) {
  if (!resourceName) { return ''; }
  if (ctx.geoCache[resourceName]) { return ctx.geoCache[resourceName]; }
  try {
    var res = AdsApp.search(
      'SELECT geo_target_constant.canonical_name FROM geo_target_constant ' +
      'WHERE geo_target_constant.resource_name = "' + resourceName + '"');
    var name = res.hasNext() ? res.next().geoTargetConstant.canonicalName : resourceName;
    ctx.geoCache[resourceName] = name;
    return name;
  } catch (e) {
    ctx.geoCache[resourceName] = resourceName;
    return resourceName;
  }
}

function dateFilter(ctx) {
  return 'WHERE segments.date BETWEEN "' + ctx.range.start + '" AND "' + ctx.range.end + '"';
}


// ---------------------------------------------------------------
// Relleno automatico: que semanas faltan, y traerlas hasta agotar el tiempo
// ---------------------------------------------------------------
function backfillAccount(account, conf, tz) {
  var t0 = Date.now();
  var log = ['=== ' + conf.label + ' [RELLENO]'];
  CURRENT_SS = null; CURRENT_BRIEF_SS = null;
  if (conf.sheetUrl && conf.sheetUrl.indexOf('COMPLETAR') < 0) {
    try { CURRENT_SS = SpreadsheetApp.openByUrl(conf.sheetUrl); CURRENT_BRIEF_SS = getBriefSpreadsheet(conf); } catch (e) { return log.join('\n') + '\n  ERROR abriendo Sheets: ' + e.message; }
  }

  // Semanas que ya estan en Supabase
  var existentes = {};
  try {
    var url = CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/campaign?select=week_start&account=eq.' + encodeURIComponent(conf.label) + '&limit=1000';
    var res = UrlFetchApp.fetch(url, { headers: { 'apikey': CONFIG.SUPABASE.anonKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey }, muteHttpExceptions: true });
    if (res.getResponseCode() < 300) JSON.parse(res.getContentText()).forEach(function (r) { existentes[r.week_start] = true; });
    else log.push('  no pude leer semanas existentes: HTTP ' + res.getResponseCode());
  } catch (e) { log.push('  no pude leer semanas existentes: ' + e.message); }

  var faltan = [];
  for (var w = 1; w <= BACKFILL_SEMANAS; w++) { var r = lastWeek(tz, w); if (!existentes[r.start]) faltan.push({ back: w, range: r }); }
  if (!faltan.length) { log.push('  relleno completo: las ' + BACKFILL_SEMANAS + ' semanas estan'); return log.join('\n'); }
  log.push('  faltan ' + faltan.length + ' semanas: ' + faltan.map(function (f) { return f.range.start; }).join(', '));

  var hechas = 0;
  for (var i = 0; i < faltan.length; i++) {
    var elapsed = (Date.now() - t0) / 60000;
    if (elapsed > BACKFILL_MINUTOS) { log.push('  tiempo agotado (' + Math.round(elapsed) + ' min); las demas en la proxima corrida'); break; }
    var ctx = { conf: conf, label: conf.label, range: faltan[i].range, currency: account.getCurrencyCode(),
      stamp: Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm') /* UTC */, alerts: [], geoCache: {}, runLog: [], supabaseRequests: { deletes: [], inserts: [] } };
    log.push('  semana ' + ctx.range.start + ' a ' + ctx.range.end + ':');
    log.push('    CAMPAIGN            ' + safe(exportCampaigns, ctx, 'CAMPAIGN'));
    log.push('    ADGROUP             ' + safe(exportAdGroups, ctx, 'ADGROUP'));
    log.push('    KEYWORDS            ' + safe(exportKeywords, ctx, 'KEYWORDS'));
    log.push('    SEARCH_TERMS        ' + safe(exportSearchTerms, ctx, 'SEARCH_TERMS'));
    log.push('    CONVERSION_ACTIONS  ' + safe(exportConversionActions, ctx, 'CONVERSION_ACTIONS'));
    log.push('    DEVICE              ' + safe(exportDevices, ctx, 'DEVICE'));
    log.push('    HOUR_DAY            ' + safe(exportHourDay, ctx, 'HOUR_DAY'));
    log.push('    GEO                 ' + safe(exportGeo, ctx, 'GEO'));
    log.push('    LANDING_PAGES       ' + safe(exportLandingPages, ctx, 'LANDING_PAGES'));
    log.push('    AUDIENCES           ' + safe(exportAudiences, ctx, 'AUDIENCES'));
    // Historial de cambios: Google solo lo da para 30 dias; mas atras no se pide
    var diasAtras = Math.round((Date.now() - new Date(ctx.range.start + 'T12:00:00').getTime()) / 86400000);
    if (diasAtras <= 29) log.push('    CHANGE_EVENTS       ' + safe(exportChangeEvents, ctx, 'CHANGE_EVENTS'));
    // Enviar a Supabase AHORA (en la corrida normal se envia al final; en el relleno, por semana)
    log.push('    SUPABASE_SYNC       ' + safe(flushSupabaseAsync, ctx) + ' peticiones');
    try { flushRunLog(ctx); } catch (e) {}
    hechas++;
  }
  log.push('  ' + hechas + ' semana(s) rellenada(s) en ' + Math.round((Date.now() - t0) / 60000) + ' min; faltan ' + (faltan.length - hechas));
  return log.join('\n');
}

function lastWeek(tz, weeksBack) {
  // Fecha local de la cuenta como texto, y de ahi dias calendario a mediodia UTC: sin aritmetica entre husos.
  // (El 7 de septiembre de 2026 a las 00:15, con Chile recien cambiado de horario, la version anterior
  //  produjo semanas de domingo a sabado para BHI y 360.)
  var hoyLocal = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var hoy = new Date(hoyLocal + 'T12:00:00Z');
  var dow = ((hoy.getUTCDay() + 6) % 7) + 1;           // 1 = lunes ... 7 = domingo
  var back = Math.max(0, (weeksBack || 1) - 1);       // 1 = semana pasada; 2 = hace dos; ...
  var end = new Date(hoy.getTime() - (dow + back * 7) * 86400000);   // el domingo de la semana pedida
  var start = new Date(end.getTime() - 6 * 86400000);                // su lunes
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  return { start: iso(start), end: iso(end) };
}

function last30(ctx) {
  var end = ctx.range.end;
  var endDate = new Date(end + 'T12:00:00');
  var start = new Date(endDate.getTime() - 29 * 86400000);
  return {
    start: Utilities.formatDate(start, 'UTC', 'yyyy-MM-dd'),
    end: end
  };
}

function pick(a, b) { return (a !== undefined && a !== null && a !== 0) ? a : b; }
function n(v)    { return v ? Math.round(Number(v)) : 0; }
function n2(v)   { return v ? Math.round(Number(v) * 100) / 100 : 0; }
function cost(v) { return v ? Math.round(Number(v) / 10000) / 100 : 0; }
function pct(v)  { return v ? Math.round(Number(v) * 10000) / 100 : 0; }
