/**
 * NORTHSIGNAL - AUTO-EJECUCIÓN DE ACCIONABLES (Human-in-the-Loop)
 * 
 * Este script revisa una tabla en Supabase donde la app aprobó mutaciones.
 * Ejecuta el cambio en Google Ads, y le devuelve a Supabase un estado "APPLIED" o "FAILED".
 */

function main() {
  var props = PropertiesService.getScriptProperties();
  var SUPABASE_URL = props.getProperty('SUPABASE_URL');
  var SUPABASE_KEY = props.getProperty('SUPABASE_KEY');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    Logger.log("Error: SUPABASE_URL o SUPABASE_KEY no configurados en PropertiesService.");
    return;
  }

  // 1. Buscar mutaciones pendientes y APROBADAS en Supabase (máx 20 para seguridad)
  var pendingMutations = fetchApprovedMutations(SUPABASE_URL, SUPABASE_KEY);
  
  if (pendingMutations.length === 0) {
    Logger.log("No hay accionables aprobados pendientes de ejecución.");
    return;
  }
  
  for (var i = 0; i < pendingMutations.length; i++) {
    var task = pendingMutations[i];
    
    // Validación de seguridad adicional
    if (task.status !== 'APPROVED' || !task.approved_by) {
      Logger.log("Saltando tarea " + task.id + " porque no está aprobada correctamente.");
      continue;
    }

    try {
      // 2. Ejecutar la acción según el tipo
      if (task.action_type === 'PAUSE_KEYWORD') {
        pauseKeyword(task.campaign_name, task.adgroup_name, task.keyword_text);
      } else if (task.action_type === 'ADD_NEGATIVE') {
        addNegativeKeyword(task.campaign_name, task.keyword_text, task.match_type);
      } else {
        throw new Error("Tipo de acción no soportada: " + task.action_type);
      }
      
      // 3. Marcar como aplicado en Supabase
      markTaskAsStatus(SUPABASE_URL, SUPABASE_KEY, task.id, 'APPLIED');
      Logger.log("✅ Tarea completada: " + task.action_type + " -> " + task.keyword_text);
      
    } catch (e) {
      Logger.log("❌ Error en tarea ID " + task.id + ": " + e.message);
      markTaskAsStatus(SUPABASE_URL, SUPABASE_KEY, task.id, 'FAILED', e.message);
    }
  }
}

// -- Funciones Auxiliares de API y Google Ads --

function fetchApprovedMutations(urlPrefix, key) {
  var url = urlPrefix + 'pending_mutations?status=eq.APPROVED&approved_by=not.is.null&limit=20';
  var options = {
    'method': 'get',
    'headers': {
      'apikey': key,
      'Authorization': 'Bearer ' + key
    }
  };
  var response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

function markTaskAsStatus(urlPrefix, key, taskId, status, errorMessage) {
  var url = urlPrefix + 'pending_mutations?id=eq.' + taskId;
  var payload = { 
    status: status
  };
  
  if (status === 'APPLIED') {
    payload.applied_at = new Date().toISOString();
  } else if (status === 'FAILED') {
    payload.error_message = errorMessage || "Error desconocido";
  }

  var options = {
    'method': 'patch',
    'headers': {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    'payload': JSON.stringify(payload)
  };
  UrlFetchApp.fetch(url, options);
}

function pauseKeyword(campaignName, adGroupName, keywordText) {
  var keywordIterator = AdsApp.keywords()
      .withCondition("CampaignName = '" + campaignName + "'")
      .withCondition("AdGroupName = '" + adGroupName + "'")
      .withCondition("Text = '" + keywordText + "'")
      .get();
      
  if (keywordIterator.hasNext()) {
    var keyword = keywordIterator.next();
    keyword.pause();
  } else {
    throw new Error("Keyword no encontrada.");
  }
}

function addNegativeKeyword(campaignName, keywordText, matchType) {
  var campaignIterator = AdsApp.campaigns()
      .withCondition("Name = '" + campaignName + "'")
      .get();
      
  if (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    // Format: [keyword] for exact, "keyword" for phrase, keyword for broad
    var formattedKeyword = keywordText;
    if (matchType === 'EXACT') formattedKeyword = '[' + keywordText + ']';
    if (matchType === 'PHRASE') formattedKeyword = '"' + keywordText + '"';
    
    campaign.createNegativeKeyword(formattedKeyword);
  } else {
    throw new Error("Campaña no encontrada.");
  }
}
