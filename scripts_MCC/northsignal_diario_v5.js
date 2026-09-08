/**
 *  INSTALAR EN EL MCC 641-902-5021 · diario 06:00
 *  Procesa KAREDO, BHI y 360. Saltea Fresh Monkee, que corre su propia copia.
 */
/**
 * NORTHSIGNAL — EXTRACCIÓN DIARIA  ·  v5 (conversiones por grupo)
 * ============================================================================
 * MCC NorthSignal (641-902-5021) · programar TODOS LOS DÍAS a las 06:00
 *
 * QUÉ HACE
 * Extrae rendimiento diario por campaña, grupo, acción de conversión y
 * presupuesto, y lo escribe en Supabase con upsert.
 *
 * POR QUÉ UNA VENTANA MÓVIL Y NO SOLO AYER
 * Los datos de Google no son finales el día que cierra el período: costo y
 * conversiones se mueven durante días por latencia de procesamiento y por
 * ajustes de atribución. La práctica establecida es esperar entre 5 y 7 días
 * antes de tratarlos como definitivos, y volver a traer los períodos recientes
 * para actualizarlos.
 *
 * En BHI y 360 pesa más que el promedio, porque las conversiones offline
 * llegan semanas después del clic.
 *
 * Por eso el script reextrae los últimos LOOKBACK_DAYS días y hace upsert
 * sobre la clave natural. Los días viejos se corrigen solos.
 *
 * POR QUÉ IMPORTA GUARDARLO
 * Desde el 1 de junio de 2026 Google Ads retiene datos granulares (diarios,
 * semanales, por hora) solo 37 meses. Esta base es el archivo permanente:
 * lo que no se guarde acá, se pierde.
 *
 * SOBRE KEYWORDS Y TÉRMINOS
 * Se extraen solo las entidades CON impresiones ese día. De las 224 keywords
 * de Karedo, apenas 24 tuvieron actividad en una semana entera, así que el
 * volumen real es de unas 6.000 filas al año, no 149.000.
 *
 * La ausencia de una keyword en una fecha significa cero actividad ese día,
 * no dato faltante. Importa al calcular promedios.
 */


var CONFIG = {

  NOTIFY_EMAIL: 'biggsandres@gmail.com',

  /**
   * Días hacia atrás que se reextraen en cada corrida.
   * 14 cubre con margen la ventana de 5 a 7 días recomendada, y alcanza
   * para captar la mayoría de las conversiones offline de BHI y 360.
   */
  LOOKBACK_DAYS: 14,

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
      // 8 sep 2026: aca habia una copia de los umbrales, toda en cero, que este script
      // NUNCA usa (grep de thresholds. en el diario: cero resultados). Una tercera copia
      // muerta de un valor es una que va a divergir y confundir a quien la lea. Se saca.
      // Los umbrales del diario, si alguna vez hacen falta, salen de cuentas en Supabase.
      note: 'Multi-local (cadena). Objetivos distintos por campana: visitas/direcciones, compra online, llamadas. Ver campaign_mapa en Supabase. No mezclar CPA entre objetivos.'
    },
    { cid: '913-287-4649', label: 'KAREDO' },
    { cid: '882-940-8394', label: 'BHI' },
    { cid: '378-925-9849', label: '360' }
  ],

  /**
   * Columnas por tabla. El orden importa: es el mismo con el que se arman
   * las filas más abajo, y el que se usa para mapear a objetos JSON.
   */
  TABLES: {
    campaign_daily: ['account','date','campaign','status','channel','bid_strategy','currency',
                     'impressions','clicks','ctr','avg_cpc','avg_cpm','cost','conversions',
                     'cost_per_conv','conv_rate','impr_share','top_impr_share',
                     'abs_top_impr_share','lost_is_budget','lost_is_rank','click_share'],

    adgroup_daily: ['account','date','campaign','campaign_status','ad_group','ad_group_status',
                    'currency','impressions','clicks','ctr','avg_cpc','cost','conversions',
                    'cost_per_conv','conv_rate','impr_share'],

    conversion_actions_daily: ['account','date','campaign','ad_group','conversion_action','category',
                               'currency','conversions'],

    budget_daily: ['account','date','campaign','daily_budget','actual_cost','pacing_pct',
                   'delivery_method','currency','lost_is_budget'],

    keywords_daily: ['account','date','campaign','ad_group','keyword','match_type',
                     'keyword_status','serving_status','currency','quality_score',
                     'qs_ad_relevance','qs_landing_page','qs_expected_ctr',
                     'impressions','clicks','ctr','avg_cpc','cost','conversions',
                     'cost_per_conv','conv_rate','impr_share','top_impr_share','lost_is_rank'],

    search_terms_daily: ['account','date','campaign','ad_group','search_term','match_type',
                         'triggered_keyword','currency','impressions','clicks','ctr',
                         'avg_cpc','cost','conversions','cost_per_conv'],

    config_snapshot: ['account','snapshot_date','entity_type','entity_name','config','config_hash']
  },

  /** Claves únicas para el upsert. Deben coincidir con los índices de Supabase. */
  CONFLICT_KEYS: {
    campaign_daily: 'account,date,campaign',
    adgroup_daily: 'account,date,campaign,ad_group',
    conversion_actions_daily: 'account,date,campaign,ad_group,conversion_action,category',
    budget_daily: 'account,date,campaign',
    // 8 sep 2026, ticket 29. keyword_status ES MUTABLE y estaba aca. Google devuelve los
    // dias historicos con el estado ACTUAL, asi que al pausarse una keyword los 14 dias de
    // LOOKBACK vuelven con PAUSED, no coinciden con las filas en ENABLED y se insertan al
    // lado en vez de actualizarlas: la keyword queda contada dos veces por dia.
    // Medido antes del arreglo: 26 grupos duplicados en KAREDO, 335,92 EUR de mas sobre
    // 2.449,42, o sea 13,7%. El indice unico de Supabase se cambio igual.
    // NO volver a poner keyword_status ni serving_status en esta clave.
    keywords_daily: 'account,date,campaign,ad_group,keyword,match_type',
    search_terms_daily: 'account,date,campaign,ad_group,search_term,match_type,triggered_keyword',
    config_snapshot: 'account,snapshot_date,entity_type,entity_name'
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
// MAIN
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
  try { _main(); latir('extraccion_diaria', true); }
  catch (e) { latir('extraccion_diaria', false, e.message); throw e; }
}

function _main() {
  if (typeof AdsManagerApp === 'undefined') {
    var cid1 = AdsApp.currentAccount().getCustomerId();
    finalizeDaily([resultadoSintetico(processDaily(), cid1)]);
    return;
  }
  var ids = CONFIG.ACCOUNTS.filter(function (a) { return !a.soloCuentaUnica; }).map(function (a) { return a.cid; });
  AdsManagerApp.accounts().withIds(ids)
    .executeInParallel('processDaily', 'finalizeDaily');
}


function processDaily() {
  var account = AdsApp.currentAccount();
  var cid = account.getCustomerId();

  var conf = CONFIG.ACCOUNTS.filter(function (a) {
    return a.cid.replace(/-/g, '') === cid.replace(/-/g, '');
  })[0];
  if (!conf) { return 'Cuenta no configurada: ' + cid; }

  var tz = account.getTimeZone();
  var range = lookbackRange(tz, CONFIG.LOOKBACK_DAYS);

  var ctx = {
    label: conf.label,
    currency: account.getCurrencyCode(),
    range: range,
    rows: { campaign_daily: [], adgroup_daily: [],
            conversion_actions_daily: [], budget_daily: [],
            keywords_daily: [], search_terms_daily: [], config_snapshot: [] }
  };

  var log = ['=== ' + conf.label + '  (' + range.start + ' a ' + range.end + ')'];

  log.push('  campaign_daily            ' + safe(extractCampaignDaily, ctx));
  log.push('  adgroup_daily             ' + safe(extractAdGroupDaily, ctx));
  log.push('  conversion_actions_daily  ' + safe(extractConversionsDaily, ctx));
  log.push('  budget_daily              ' + safe(extractBudgetDaily, ctx));
  log.push('  keywords_daily            ' + safe(extractKeywordsDaily, ctx));
  log.push('  search_terms_daily        ' + safe(extractSearchTermsDaily, ctx));
  log.push('  config_snapshot           ' + safe(extractConfigSnapshot, ctx));
  log.push('  supabase                  ' + safe(flushAll, ctx));

  return log.join('\n');
}


function finalizeDaily(results) {
  var log = [];
  var huboError = false;

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.getStatus() === 'OK') {
      var txt = r.getReturnValue();
      log.push(txt);
      if (txt && txt.indexOf('ERROR') >= 0) { huboError = true; }
    } else {
      log.push('ERROR en ' + r.getCustomerId() + ': ' + r.getError());
      huboError = true;
    }
  }

  log.push('\nVentana reextraida: ultimos ' + CONFIG.LOOKBACK_DAYS + ' dias.');
  log.push('Los dias recientes se corrigen solos en cada corrida a medida que');
  log.push('Google asienta conversiones y ajusta atribucion.');
  log.push('\nVerificar: select * from v_serie_diaria order by date desc limit 20;');

  Logger.log(log.join('\n\n'));

  // Solo avisa si algo falló. Un correo diario que siempre dice "todo bien"
  // deja de leerse a la semana.
  if (huboError && CONFIG.NOTIFY_EMAIL) {
    MailApp.sendEmail(CONFIG.NOTIFY_EMAIL,
      'ERROR · Extraccion diaria NorthSignal', log.join('\n\n'));
  }
}


function safe(fn, ctx) {
  try { return fn(ctx) + ' filas'; }
  catch (e) { return 'ERROR — ' + e.message; }
}


// ================================================================
// EXTRACCIÓN
// ================================================================

function extractCampaignDaily(ctx) {
  var q =
    'SELECT segments.date, campaign.name, campaign.status, ' +
    'campaign.advertising_channel_type, campaign.bidding_strategy_type, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, ' +
    'metrics.average_cpm, metrics.cost_micros, metrics.conversions, ' +
    'metrics.cost_per_conversion, metrics.conversions_from_interactions_rate, ' +
    'metrics.search_impression_share, metrics.search_top_impression_share, ' +
    'metrics.search_absolute_top_impression_share, ' +
    'metrics.search_budget_lost_impression_share, ' +
    'metrics.search_rank_lost_impression_share, metrics.search_click_share ' +
    'FROM campaign ' + dateFilter(ctx) + ' AND campaign.status != "REMOVED"';

  var res = AdsApp.search(q);
  var n = 0;
  while (res.hasNext()) {
    var r = res.next(), m = r.metrics;
    ctx.rows.campaign_daily.push([
      ctx.label, r.segments.date, r.campaign.name, r.campaign.status,
      r.campaign.advertisingChannelType, r.campaign.biddingStrategyType, ctx.currency,
      num(m.impressions), num(m.clicks), pct(m.ctr), cost(m.averageCpc),
      cost(m.averageCpm), cost(m.costMicros), num2(m.conversions),
      cost(m.costPerConversion), pct(m.conversionsFromInteractionsRate),
      pct(m.searchImpressionShare), pct(m.searchTopImpressionShare),
      pct(m.searchAbsoluteTopImpressionShare),
      pct(m.searchBudgetLostImpressionShare), pct(m.searchRankLostImpressionShare),
      pct(m.searchClickShare)
    ]);
    n++;
  }
  return n;
}


function extractAdGroupDaily(ctx) {
  var q =
    'SELECT segments.date, campaign.name, campaign.status, ad_group.name, ' +
    'ad_group.status, metrics.impressions, metrics.clicks, metrics.ctr, ' +
    'metrics.average_cpc, metrics.cost_micros, metrics.conversions, ' +
    'metrics.cost_per_conversion, metrics.conversions_from_interactions_rate, ' +
    'metrics.search_impression_share ' +
    'FROM ad_group ' + dateFilter(ctx) + ' AND ad_group.status != "REMOVED"';

  var res = AdsApp.search(q);
  var n = 0;
  while (res.hasNext()) {
    var r = res.next(), m = r.metrics;
    ctx.rows.adgroup_daily.push([
      ctx.label, r.segments.date, r.campaign.name, r.campaign.status,
      r.adGroup.name, r.adGroup.status, ctx.currency,
      num(m.impressions), num(m.clicks), pct(m.ctr), cost(m.averageCpc),
      cost(m.costMicros), num2(m.conversions), cost(m.costPerConversion),
      pct(m.conversionsFromInteractionsRate), pct(m.searchImpressionShare)
    ]);
    n++;
  }
  return n;
}


function extractConversionsDaily(ctx) {
  // Solo conversiones primarias. all_conversions se omite a proposito:
  // en 360 suma clics a WhatsApp, mail y llamadas, e infla 2,5 veces.
  // Desde ad_group, no campaign: la tarea de Karedo del 6 sep necesito saber
  // en que grupo cayeron las conversiones y no habia columna. Con grupo se
  // puede ver si un deterioro es de Branded, de Industry, o de toda la cuenta.
  var q =
    'SELECT segments.date, campaign.name, ad_group.name, segments.conversion_action_name, ' +
    'segments.conversion_action_category, metrics.conversions ' +
    'FROM ad_group ' + dateFilter(ctx);

  var res = AdsApp.search(q);
  var n = 0;
  while (res.hasNext()) {
    var r = res.next();
    ctx.rows.conversion_actions_daily.push([
      ctx.label, r.segments.date, r.campaign.name, r.adGroup.name,
      r.segments.conversionActionName, r.segments.conversionActionCategory,
      ctx.currency, num2(r.metrics.conversions)
    ]);
    n++;
  }
  return n;
}


function extractBudgetDaily(ctx) {
  var q =
    'SELECT segments.date, campaign.name, campaign_budget.amount_micros, ' +
    'campaign_budget.delivery_method, metrics.cost_micros, ' +
    'metrics.search_budget_lost_impression_share ' +
    'FROM campaign ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  var res = AdsApp.search(q);
  var n = 0;
  while (res.hasNext()) {
    var r = res.next();
    var daily = cost(r.campaignBudget.amountMicros);
    var actual = cost(r.metrics.costMicros);
    var pacing = daily > 0 ? Math.round((actual / daily) * 10000) / 100 : 0;

    ctx.rows.budget_daily.push([
      ctx.label, r.segments.date, r.campaign.name,
      daily, actual, pacing, r.campaignBudget.deliveryMethod, ctx.currency,
      pct(r.metrics.searchBudgetLostImpressionShare)
    ]);
    n++;
  }
  return n;
}


function extractKeywordsDaily(ctx) {
  // Solo keywords con impresiones ese dia. Sin ese filtro serian 224 filas
  // por dia por cuenta, casi todas en cero.
  var q =
    'SELECT segments.date, campaign.name, ad_group.name, ' +
    'ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ' +
    'ad_group_criterion.status, ad_group_criterion.system_serving_status, ' +
    'ad_group_criterion.quality_info.quality_score, ' +
    'ad_group_criterion.quality_info.creative_quality_score, ' +
    'ad_group_criterion.quality_info.post_click_quality_score, ' +
    'ad_group_criterion.quality_info.search_predicted_ctr, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, ' +
    'metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion, ' +
    'metrics.conversions_from_interactions_rate, metrics.search_impression_share, ' +
    'metrics.search_top_impression_share, metrics.search_rank_lost_impression_share ' +
    'FROM keyword_view ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  var res = AdsApp.search(q);
  var n = 0;
  while (res.hasNext()) {
    var r = res.next(), m = r.metrics, c = r.adGroupCriterion;
    var qi = c.qualityInfo || {};
    ctx.rows.keywords_daily.push([
      ctx.label, r.segments.date, r.campaign.name, r.adGroup.name,
      c.keyword.text, c.keyword.matchType, c.status, c.systemServingStatus || '',
      ctx.currency, qi.qualityScore || null,
      qi.creativeQualityScore || '', qi.postClickQualityScore || '',
      qi.searchPredictedCtr || '',
      num(m.impressions), num(m.clicks), pct(m.ctr), cost(m.averageCpc),
      cost(m.costMicros), num2(m.conversions), cost(m.costPerConversion),
      pct(m.conversionsFromInteractionsRate), pct(m.searchImpressionShare),
      pct(m.searchTopImpressionShare), pct(m.searchRankLostImpressionShare)
    ]);
    n++;
  }
  return n;
}


function extractSearchTermsDaily(ctx) {
  var q =
    'SELECT segments.date, campaign.name, ad_group.name, ' +
    'search_term_view.search_term, segments.search_term_match_type, ' +
    'segments.keyword.info.text, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, ' +
    'metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion ' +
    'FROM search_term_view ' + dateFilter(ctx) + ' AND metrics.impressions > 0';

  var res = AdsApp.search(q);
  var n = 0;
  while (res.hasNext()) {
    var r = res.next(), m = r.metrics;
    var kw = (r.segments && r.segments.keyword && r.segments.keyword.info)
             ? r.segments.keyword.info.text : '';
    ctx.rows.search_terms_daily.push([
      ctx.label, r.segments.date, r.campaign.name, r.adGroup.name,
      r.searchTermView.searchTerm, r.segments.searchTermMatchType, kw, ctx.currency,
      num(m.impressions), num(m.clicks), pct(m.ctr), cost(m.averageCpc),
      cost(m.costMicros), num2(m.conversions), cost(m.costPerConversion)
    ]);
    n++;
  }
  return n;
}


/**
 * Foto diaria de la configuración de conversiones y campañas.
 *
 * change_event de Google NO registra cambios en acciones de conversión: su
 * lista de recursos cubre anuncios, grupos, keywords, campañas, presupuestos,
 * criterios y assets, y ahí termina. Pasar una conversión de primaria a
 * secundaria no aparece nunca en ese log.
 *
 * La solución es no depender del log: se guarda la configuración completa
 * cada día y Postgres detecta la diferencia con el snapshot anterior. Lo que
 * cambió, cambió, lo haya registrado Google o no.
 */
function extractConfigSnapshot(ctx) {
  var hoy = Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd');
  var n = 0;

  // --- Acciones de conversión: TODO lo que define cómo se cuenta
  var qc =
    'SELECT conversion_action.name, conversion_action.status, conversion_action.type, ' +
    'conversion_action.category, conversion_action.primary_for_goal, ' +
    'conversion_action.include_in_conversions_metric, conversion_action.counting_type, ' +
    'conversion_action.value_settings.default_value, ' +
    'conversion_action.value_settings.default_currency_code, ' +
    'conversion_action.value_settings.always_use_default_value, ' +
    'conversion_action.click_through_lookback_window_days, ' +
    'conversion_action.view_through_lookback_window_days, ' +
    'conversion_action.attribution_model_settings.attribution_model ' +
    'FROM conversion_action WHERE conversion_action.status != "REMOVED"';

  var rc = AdsApp.search(qc);
  while (rc.hasNext()) {
    var ca = rc.next().conversionAction;
    var vs = ca.valueSettings || {};
    var am = ca.attributionModelSettings || {};
    var config = {
      status: ca.status || null,
      type: ca.type || null,
      category: ca.category || null,
      primary_for_goal: ca.primaryForGoal === true,
      include_in_conversions: ca.includeInConversionsMetric === true,
      counting_type: ca.countingType || null,
      default_value: vs.defaultValue !== undefined ? Number(vs.defaultValue) : null,
      default_currency: vs.defaultCurrencyCode || null,
      always_use_default_value: vs.alwaysUseDefaultValue === true,
      click_lookback_days: ca.clickThroughLookbackWindowDays || null,
      view_lookback_days: ca.viewThroughLookbackWindowDays || null,
      attribution_model: am.attributionModel || null
    };
    ctx.rows.config_snapshot.push([
      ctx.label, hoy, 'conversion_action', ca.name,
      JSON.stringify(config), hashOf(config)
    ]);
    n++;
  }

  // --- Campañas: lo que change_event a veces registra sin detalle
  var qp =
    'SELECT campaign.name, campaign.status, campaign.bidding_strategy_type, ' +
    'campaign.target_cpa.target_cpa_micros, campaign.maximize_conversions.target_cpa_micros, ' +
    'campaign.target_roas.target_roas, campaign.maximize_conversion_value.target_roas, ' +
    'campaign_budget.amount_micros, campaign.advertising_channel_type, ' +
    'campaign.geo_target_type_setting.positive_geo_target_type, ' +
    'campaign.network_settings.target_search_network, ' +
    'campaign.network_settings.target_content_network, ' +
    'campaign.network_settings.target_partner_search_network, ' +
    'campaign.labels ' +
    'FROM campaign WHERE campaign.status != "REMOVED"';

  // Fechas: en Scripts NO se piden por GAQL (campaign.start_date no existe como campo
  // de consulta). Se leen del objeto campaña con getStartDate() / getEndDate(), que
  // devuelven {year, month, day}. Un mapa por nombre, una sola pasada.
  var fechasPorCampana = {};
  try {
    var itc = AdsApp.campaigns().withCondition('Status != REMOVED').get();
    while (itc.hasNext()) {
      var cc = itc.next();
      fechasPorCampana[cc.getName()] = { inicio: fechaISO(cc.getStartDate()), fin: fechaISO(cc.getEndDate()) };
    }
    // Performance Max y Demand Gen no salen en AdsApp.campaigns()
    if (typeof AdsApp.performanceMaxCampaigns === 'function') {
      var itp = AdsApp.performanceMaxCampaigns().withCondition('Status != REMOVED').get();
      while (itp.hasNext()) {
        var pc = itp.next();
        fechasPorCampana[pc.getName()] = { inicio: fechaISO(pc.getStartDate()), fin: fechaISO(pc.getEndDate()) };
      }
    }
  } catch (e) { Logger.log('fechas de campaña: ' + e.message); }

  var rp = AdsApp.search(qp);
  while (rp.hasNext()) {
    var r = rp.next(), c = r.campaign;
    var ns = c.networkSettings || {};
    var gt = c.geoTargetTypeSetting || {};
    var tcpa = (c.targetCpa && c.targetCpa.targetCpaMicros) ||
               (c.maximizeConversions && c.maximizeConversions.targetCpaMicros) || null;
    var troas = (c.targetRoas && c.targetRoas.targetRoas) ||
                (c.maximizeConversionValue && c.maximizeConversionValue.targetRoas) || null;
    var cfg = {
      status: c.status || null,
      bidding_strategy: c.biddingStrategyType || null,
      target_cpa: tcpa ? cost(tcpa) : null,
      target_roas: troas ? num2(troas) : null,
      daily_budget: cost(r.campaignBudget.amountMicros),
      channel: c.advertisingChannelType || null,
      geo_target_type: gt.positiveGeoTargetType || null,
      search_network: ns.targetSearchNetwork === true,
      content_network: ns.targetContentNetwork === true,
      partner_network: ns.targetPartnerSearchNetwork === true,
      // Fechas: Google deja el estado en ENABLED aunque la campaña ya haya terminado.
      // estado_real distingue terminada de rota; sin esto, una campaña finalizada
      // con presupuesto y gasto cero parece un error y genera alertas falsas.
      start_date: (fechasPorCampana[c.name] || {}).inicio || null,
      end_date: (fechasPorCampana[c.name] || {}).fin || null,
      estado_real: (function () {
        var f = fechasPorCampana[c.name] || {};
        var hoyISO = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
        if (c.status === 'ENABLED' && f.fin && f.fin < hoyISO) return 'FINALIZADA';
        if (c.status === 'ENABLED' && f.inicio && f.inicio > hoyISO) return 'PROGRAMADA';
        return c.status || null;
      })(),
      etiquetas: (c.labels && c.labels.length) ? c.labels.map(function (rn) { return String(rn).split('/').pop(); }) : null
    };
    ctx.rows.config_snapshot.push([
      ctx.label, hoy, 'campaign', c.name,
      JSON.stringify(cfg), hashOf(cfg)
    ]);
    n++;
  }

  // --- Grupos de anuncios (8 sep 2026, ticket 30)
  // Faltaba este nivel, y es justo el que hace falta para verificar un cambio de
  // targetCpaMicros a nivel grupo contra una foto anterior. Sin esto, los ocho cambios
  // del 7 de septiembre en KAREDO se ven en el historial de Google y no se pueden
  // contrastar contra ningun estado, que es lo que bloquea la lectura de H7 el 21.
  //
  // TRAMPA IMPORTANTE: la clave unica de config_snapshot es
  // (account, snapshot_date, entity_type, entity_name). El mismo nombre de grupo existe
  // en 21 campanas de FRESH_MONKEE, asi que si entity_name fuera solo el nombre del grupo
  // los 21 colapsarian en una sola fila y la foto quedaria plausible y falsa.
  // Por eso entity_name es 'campana :: grupo'.
  var qg =
    'SELECT ad_group.name, ad_group.status, ad_group.type, campaign.name, ' +
    'ad_group.cpc_bid_micros, ad_group.target_cpa_micros, ad_group.target_roas, ' +
    'ad_group.effective_target_cpa_micros, ad_group.effective_target_roas ' +
    'FROM ad_group WHERE ad_group.status != "REMOVED" AND campaign.status != "REMOVED"';

  try {
    var rg = AdsApp.search(qg);
    while (rg.hasNext()) {
      var rr = rg.next();
      var ag = rr.adGroup, cp = rr.campaign;
      var cfgG = {
        status: ag.status || null,
        tipo: ag.type || null,
        campana: cp.name || null,
        cpc_bid: ag.cpcBidMicros ? cost(ag.cpcBidMicros) : null,
        target_cpa: ag.targetCpaMicros ? cost(ag.targetCpaMicros) : null,
        target_roas: ag.targetRoas ? num2(ag.targetRoas) : null,
        // el efectivo incluye lo heredado de la campana: sin el no se distingue
        // "el grupo tiene tCPA propio" de "el grupo hereda el de la campana"
        target_cpa_efectivo: ag.effectiveTargetCpaMicros ? cost(ag.effectiveTargetCpaMicros) : null,
        target_roas_efectivo: ag.effectiveTargetRoas ? num2(ag.effectiveTargetRoas) : null
      };
      ctx.rows.config_snapshot.push([
        ctx.label, hoy, 'ad_group', cp.name + ' :: ' + ag.name,
        JSON.stringify(cfgG), hashOf(cfgG)
      ]);
      n++;
    }
  } catch (e) { Logger.log('config_snapshot ad_group: ' + e.message); }

  return n;
}

/** Hash determinista de un objeto, con claves ordenadas. */
// {year, month, day} -> 'YYYY-MM-DD'. Google usa 2037-12-30 como "sin fecha de fin".
function fechaISO(d) {
  if (!d || !d.year) { return null; }
  var s = d.year + '-' + ('0' + d.month).slice(-2) + '-' + ('0' + d.day).slice(-2);
  return s === '2037-12-30' ? null : s;
}

function hashOf(obj) {
  var keys = Object.keys(obj).sort();
  var canon = keys.map(function (k) { return k + '=' + String(obj[k]); }).join('|');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, canon, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}


// ================================================================
// ESCRITURA EN SUPABASE
// ================================================================

/**
 * Elimina duplicados por clave dentro del mismo lote, sumando las métricas.
 *
 * Postgres rechaza el comando entero si un INSERT ... ON CONFLICT intenta
 * tocar la misma fila dos veces:
 *   "ON CONFLICT DO UPDATE command cannot affect row a second time"
 *
 * Y la API de Google devuelve filas que colapsan en la misma clave con más
 * frecuencia de la esperada: un mismo término de búsqueda activado por dos
 * keywords, una acción de conversión segmentada por categoría, etc.
 *
 * Las columnas numéricas se suman porque representan el mismo día y la misma
 * entidad; las de texto conservan el primer valor. Las derivadas (ctr, cpa,
 * conv_rate, y las cuotas de impresiones) se recalculan o se dejan como
 * están, porque promediarlas daría un número incorrecto.
 */
var SUMABLES = { impressions: 1, clicks: 1, cost: 1, conversions: 1, actual_cost: 1 };
var RECALCULAR = { ctr: 1, cost_per_conv: 1, conv_rate: 1, avg_cpc: 1, pacing_pct: 1 };

function dedupe(rows, cols, conflictKey) {
  if (!rows || rows.length === 0) { return []; }
  if (!conflictKey) { return rows; }

  var keyCols = conflictKey.split(',');
  var idx = {};
  for (var c = 0; c < cols.length; c++) { idx[cols[c]] = c; }

  var mapa = {};
  var orden = [];

  for (var i = 0; i < rows.length; i++) {
    var fila = rows[i];
    var partes = [];
    for (var k = 0; k < keyCols.length; k++) {
      partes.push(String(fila[idx[keyCols[k]]] === undefined ? '' : fila[idx[keyCols[k]]]));
    }
    var clave = partes.join('\u0001');

    if (!mapa[clave]) {
      mapa[clave] = fila.slice();
      orden.push(clave);
    } else {
      var acum = mapa[clave];
      for (var col in SUMABLES) {
        if (idx[col] !== undefined) {
          acum[idx[col]] = (Number(acum[idx[col]]) || 0) + (Number(fila[idx[col]]) || 0);
        }
      }
    }
  }

  // Recalcular las derivadas sobre los totales acumulados
  var out = [];
  for (var j = 0; j < orden.length; j++) {
    var f = mapa[orden[j]];
    if (idx.ctr !== undefined && idx.clicks !== undefined && idx.impressions !== undefined) {
      var im = Number(f[idx.impressions]) || 0;
      f[idx.ctr] = im > 0 ? Math.round((Number(f[idx.clicks]) / im) * 10000) / 100 : 0;
    }
    if (idx.avg_cpc !== undefined && idx.cost !== undefined && idx.clicks !== undefined) {
      var cl = Number(f[idx.clicks]) || 0;
      f[idx.avg_cpc] = cl > 0 ? Math.round((Number(f[idx.cost]) / cl) * 100) / 100 : 0;
    }
    if (idx.cost_per_conv !== undefined && idx.cost !== undefined && idx.conversions !== undefined) {
      var cv = Number(f[idx.conversions]) || 0;
      f[idx.cost_per_conv] = cv > 0 ? Math.round((Number(f[idx.cost]) / cv) * 100) / 100 : 0;
    }
    out.push(f);
  }

  return out;
}


/**
 * Envía todas las tablas con upsert.
 *
 * La clave está en el header Prefer: resolution=merge-duplicates junto al
 * parámetro on_conflict. Sin eso, reextraer la ventana duplicaría cada día
 * en cada corrida. Con eso, los días ya presentes se actualizan con los
 * valores nuevos, que es exactamente lo que hace falta cuando Google
 * corrige conversiones días después.
 */
function flushAll(ctx) {
  if (!CONFIG.SUPABASE.enabled) { return 0; }

  var total = 0;
  var requests = [];

  for (var table in ctx.rows) {
    if (!ctx.rows.hasOwnProperty(table)) { continue; }
    var cols = CONFIG.TABLES[table];
    var rows = dedupe(ctx.rows[table], cols, CONFIG.CONFLICT_KEYS[table]);
    if (rows.length === 0) { continue; }
    var base = CONFIG.SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/' + table +
               '?on_conflict=' + CONFIG.CONFLICT_KEYS[table];

    for (var i = 0; i < rows.length; i += CONFIG.SUPABASE.batchSize) {
      var lote = rows.slice(i, i + CONFIG.SUPABASE.batchSize).map(function (fila) {
        var obj = {};
        for (var c = 0; c < cols.length; c++) {
          var v = fila[c];
          // La columna config es jsonb: se manda como objeto, no como string
          if (cols[c] === 'config' && typeof v === 'string') {
            try { v = JSON.parse(v); } catch (e) {}
          }
          obj[cols[c]] = (v === '' || v === undefined) ? null : v;
        }
        return obj;
      });

      requests.push({
        url: base,
        method: 'post',
        headers: {
          'apikey': CONFIG.SUPABASE.anonKey,
          'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        payload: JSON.stringify(lote),
        muteHttpExceptions: true
      });
      total += lote.length;
    }
  }

  if (requests.length === 0) { return 0; }

  var responses = UrlFetchApp.fetchAll(requests);
  for (var j = 0; j < responses.length; j++) {
    var code = responses[j].getResponseCode();
    if (code >= 300) {
      throw new Error('Supabase HTTP ' + code + ': ' +
                      responses[j].getContentText().substring(0, 300));
    }
  }

  return total;
}


// ================================================================
// UTILIDADES
// ================================================================

/** Ventana móvil: desde hace N días hasta ayer. Hoy nunca está cerrado. */
function lookbackRange(tz, days) {
  var hoy = new Date();
  var fin = new Date(hoy.getTime() - 86400000);              // ayer
  var ini = new Date(fin.getTime() - (days - 1) * 86400000);
  return {
    start: Utilities.formatDate(ini, tz, 'yyyy-MM-dd'),
    end: Utilities.formatDate(fin, tz, 'yyyy-MM-dd')
  };
}

function dateFilter(ctx) {
  return 'WHERE segments.date BETWEEN "' + ctx.range.start + '" AND "' + ctx.range.end + '"';
}

function num(v)  { return v ? Math.round(Number(v)) : 0; }
function num2(v) { return v ? Math.round(Number(v) * 100) / 100 : 0; }
function cost(v) { return v ? Math.round(Number(v) / 10000) / 100 : 0; }
function pct(v)  { return v ? Math.round(Number(v) * 10000) / 100 : 0; }


/* ================================================================
 * INSTALACIÓN
 * ================================================================
 * 1. Crear un script NUEVO en el MCC. No reemplaza al semanal:
 *    los dos conviven.
 * 2. Pegar este código.
 * 3. Vista previa y revisar el registro de ejecución.
 * 4. Programar TODOS LOS DÍAS a las 06:00.
 *
 * La primera corrida trae 14 días de historia. Las siguientes reextraen
 * esa misma ventana y corrigen lo que Google haya ajustado.
 *
 * VERIFICACIÓN tras la primera corrida:
 *
 *   select account, date, gasto, conversiones, cpa, madurez
 *   from v_serie_diaria
 *   order by account, date desc;
 *
 * Deberías ver unos 14 días por cuenta, con los más recientes marcados
 * como provisional y los de más de una semana como consolidado.
 *
 * Y para ver el cruce con los cambios aplicados:
 *
 *   select * from v_dia_con_cambios
 *   where cambios_ese_dia > 0
 *   order by date desc;
 *
 * Terminos que aparecieron por primera vez y ya estan gastando:
 *
 *   select * from v_terminos_nuevos
 *   where conversiones_acumuladas = 0 and gasto_acumulado > 0;
 *
 * Cambios de configuracion detectados por diferencia entre snapshots,
 * incluidos los que change_event no registra (acciones de conversion):
 *
 *   select * from v_cambios_detectados order by detectado_hasta desc;
 *   select * from v_cambios_fuera_del_log;
 *
 * El primer dia no detecta nada: necesita dos snapshots para comparar.
 * ================================================================ */
