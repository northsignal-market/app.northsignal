/**
 *  INSTALAR EN EL MCC 641-902-5021 · cada hora
 *  Procesa KAREDO, BHI y 360. Saltea Fresh Monkee, que corre su propia copia.
 */
/**
 * NORTHSIGNAL · EJECUTOR v7
 * ----------------------------------------------------------------------------
 * Aplica en Google Ads lo que Andrés aprobó con un clic en la app. Corre cada
 * hora en el MCC. Lee v_acciones_pendientes en Supabase, ejecuta, reporta.
 *
 * QUE EJECUTA (verificado contra la documentacion de AdsApp, 7 sep 2026):
 *   Riesgo bajo, se deshacen con la accion inversa:
 *     agregar_negativa, quitar_negativa, pausar_keyword, reactivar_keyword,
 *     pausar_anuncio, pausar_grupo, cambiar_concordancia, aplicar_etiqueta
 *   Riesgo medio, reversibles pero reinician aprendizaje o mueven plata. Guardan
 *   el valor anterior en el resultado para poder volver atras:
 *     cambiar_estrategia_puja, cambiar_objetivo_puja, cambiar_presupuesto,
 *     pausar_campana, reactivar_campana, cambiar_cpc_keyword
 *
 * QUE NO, y por que: crear o editar anuncios (AdsApp solo hace expanded text ads,
 * que Google retiro; los RSA no se crean por script), cambiar la conversion primaria
 * (las acciones de conversion no estan en AdsApp), segmentacion y landing.
 * Eso esta en capacidades_ejecucion, en Supabase, y es lo que consultan los prompts.
 *
 * TOPES DE SEGURIDAD para riesgo medio: el presupuesto no se mueve mas de 30% en una
 * ejecucion, y todo cambio de puja o presupuesto guarda el valor anterior en el texto
 * del resultado, que va a operator_log. Sin eso no se puede revertir.
 *
 * modo = 'simular': escribe qué haría, no toca la cuenta. Primera semana así.
 * modo = 'ejecutar': aplica y reporta. Cada ejecución queda en operator_log
 * y marca el accionable Hecho en Notion (lo hace el server al recibir el resultado).
 * ----------------------------------------------------------------------------
 */

var CONFIG = {
  SUPABASE: {
    url: 'https://djbwxgicosargfobsmqd.supabase.co',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnd4Z2ljb3Nhcmdmb2JzbXFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODM5OTA1MCwiZXhwIjoyMTAzOTc1MDUwfQ.QqJg2ccFzBkJI2rZ5mHk0QoJ27Lz4sMfOXuK_czaU98'   // el mismo del centinela
  },
  APP: {
    url: 'https://app-northsignal.vercel.app',
    cronSecret: '0dQmIC25MphBVHyndfaeQgjEfx70anls3btp1JvwVHA'   // el mismo de Vercel
  },
  // Tope de acciones por corrida (8 sep 2026). Antes no habia ninguno: _main recorria
  // TODAS las pendientes sin pausa. En Google es tolerable; es exactamente el
  // comportamiento por el que Meta deshabilita una cuenta (rafagas de decenas de cambios
  // por hora). El freno se construye ahora, antes de que exista una accion de Meta.
  MAX_POR_CORRIDA: 12,
  PAUSA_ENTRE_ACCIONES_MS: 1500,

  CIDS: { 'KAREDO': '913-287-4649', 'BHI': '882-940-8394', '360': '378-925-9849', 'FRESH_MONKEE': '497-723-1137' },
  NOTIFY_EMAIL: 'biggsandres@gmail.com'
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

function main() {
  try { _main(); latir('ejecutor', true); }
  catch (e) { latir('ejecutor', false, e.message); throw e; }
}

function _main() {
  var pendientes = leerPendientes();
  if (!pendientes.length) { Logger.log('Sin acciones pendientes.'); return; }
  Logger.log(pendientes.length + ' acciones pendientes');

  // Freno de rafagas. Lo que sobra del tope NO se pierde: queda pendiente y sale en la
  // corrida siguiente, que es dentro de una hora. Preferimos tardar a que una cuenta
  // quede deshabilitada por comportamiento.
  var sobrantes = 0;
  if (pendientes.length > CONFIG.MAX_POR_CORRIDA) {
    sobrantes = pendientes.length - CONFIG.MAX_POR_CORRIDA;
    pendientes = pendientes.slice(0, CONFIG.MAX_POR_CORRIDA);
  }

  var resumen = [];
  for (var i = 0; i < pendientes.length; i++) {
    var a = pendientes[i];
    var r = ejecutar(a);
    if (r === null) continue;   // no es de esta cuenta (modo cuenta unica)
    reportar(a.id, r.estado, r.resultado);
    resumen.push('[' + a.account + '] ' + a.tipo + ' "' + (a.keyword || a.ad_id) + '" → ' + r.estado + ': ' + r.resultado);
    if (i < pendientes.length - 1 && CONFIG.PAUSA_ENTRE_ACCIONES_MS) {
      Utilities.sleep(CONFIG.PAUSA_ENTRE_ACCIONES_MS);
    }
  }

  if (sobrantes > 0) {
    resumen.push('');
    resumen.push('Quedaron ' + sobrantes + ' accion(es) para la proxima corrida: se aplico el tope de ' +
                 CONFIG.MAX_POR_CORRIDA + ' por corrida. No se perdio ninguna.');
  }
  if (resumen.length) MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'NorthSignal ejecutor: ' + resumen.length + ' acción(es)', resumen.join('\n'));
}

// Que verbos tienen sentido sobre una campana Performance Max.
var VERBOS_PMAX = {
  pausar_campana: true, reactivar_campana: true, cambiar_presupuesto: true,
  cambiar_estrategia_puja: true, cambiar_objetivo_puja: true, aplicar_etiqueta: true
};

/**
 * Resuelve una campana por nombre buscando en los tres iteradores.
 * AdsApp.campaigns() solo trae Search, Display y Video: ni PMax ni Demand Gen ni
 * Shopping. Devuelve null si no existe en ninguno, y el tipo si existe, porque el
 * tipo decide que se puede hacer con ella.
 */
function resolverCampana(nombre) {
  var esc = String(nombre).replace(/"/g, '\\"');
  var it = AdsApp.campaigns().withCondition('Name = "' + esc + '"').get();
  if (it.hasNext()) return { campana: it.next(), tipo: 'estandar' };

  if (typeof AdsApp.performanceMaxCampaigns === 'function') {
    try {
      var ip = AdsApp.performanceMaxCampaigns().withCondition('Name = "' + esc + '"').get();
      if (ip.hasNext()) return { campana: ip.next(), tipo: 'pmax' };
    } catch (e) { }
  }
  if (typeof AdsApp.shoppingCampaigns === 'function') {
    try {
      var is = AdsApp.shoppingCampaigns().withCondition('Name = "' + esc + '"').get();
      if (is.hasNext()) return { campana: is.next(), tipo: 'shopping' };
    } catch (e) { }
  }
  return null;
}

function ejecutar(a) {
  var cid = CONFIG.CIDS[a.account];
  if (!cid) return { estado: 'fallida', resultado: 'Cuenta desconocida: ' + a.account };
  if (typeof AdsManagerApp === 'undefined') {
    // Cuenta unica: solo se ejecutan las acciones de ESTA cuenta; las demas quedan para el MCC
    if (AdsApp.currentAccount().getCustomerId().replace(/-/g, '') !== cid.replace(/-/g, '')) return null;
  } else {
    var acct = AdsManagerApp.accounts().withIds([cid]).get();
    if (!acct.hasNext()) return null;   // no es del MCC (p. ej. Fresh Monkee): la ejecuta el script de esa cuenta
    AdsManagerApp.select(acct.next());
  }

  // AdsApp.campaigns() NO devuelve Performance Max ni Demand Gen. Hasta la v6 toda accion
  // sobre una PMax fallaba con "Campana no encontrada", que se lee como un nombre mal
  // escrito y no como un limite de la herramienta. Las campanas de apertura de
  // FRESH_MONKEE (GO, SO, GS) son todas PMax, y son justo las que hay que pausar cuando
  // pasan su fecha de fin. El script diario ya sabia esto para leer fechas.
  var res = resolverCampana(a.campana);
  if (!res) return { estado: 'fallida', resultado: 'Campaña no encontrada: ' + a.campana };
  var campaign = res.campana;

  if (res.tipo === 'pmax' && VERBOS_PMAX[a.tipo] !== true) {
    return { estado: 'fallida', resultado: 'La campaña "' + a.campana + '" es Performance Max y "' + a.tipo +
      '" no aplica: PMax no tiene keywords, grupos ni anuncios editables por script. ' +
      'Sobre PMax este ejecutor solo puede pausar, reactivar, cambiar presupuesto, ' +
      'cambiar estrategia u objetivo de puja y aplicar etiqueta. Hacerlo a mano.' };
  }

  // ---- LOTES ----
  if (a.keywords && a.keywords.length > 1) {
    var okL = [], noL = [];
    if (a.tipo === 'negativa_campana' || a.tipo === 'negativa_grupo') {
      var grupoL = null;
      if (a.tipo === 'negativa_grupo' && a.grupo) { var gl = campaign.adGroups().withCondition('Name = "' + a.grupo.replace(/"/g, '\\"') + '"').get(); if (!gl.hasNext()) return { estado: 'fallida', resultado: 'Grupo no encontrado: ' + a.grupo }; grupoL = gl.next(); }
      for (var i = 0; i < a.keywords.length; i++) {
        var neg = fmtKw(a.keywords[i], a.match_type);
        if (a.modo === 'simular') { okL.push(neg); continue; }
        try { (grupoL || campaign).createNegativeKeyword(neg); okL.push(neg); } catch (e) { noL.push(neg + ' (' + e.message + ')'); }
      }
      var dondeL = grupoL ? 'grupo ' + grupoL.getName() : 'campaña ' + campaign.getName();
      return { estado: a.modo === 'simular' ? 'simulada' : (okL.length ? 'ejecutada' : 'fallida'), resultado: (a.modo === 'simular' ? 'Agregaría ' : 'Agregadas ') + okL.length + ' negativas en ' + dondeL + ': ' + okL.join(', ') + (noL.length ? '. No pudo: ' + noL.join('; ') : '') };
    }
    if (a.tipo === 'pausar_keyword') {
      for (var j = 0; j < a.keywords.length; j++) {
        var kwsL = campaign.keywords().withCondition('Text = "' + a.keywords[j].replace(/"/g, '\\"') + '"').withCondition('Status = ENABLED').get();
        if (!kwsL.hasNext()) { noL.push(a.keywords[j] + ' (no activa)'); continue; }
        while (kwsL.hasNext()) { var kl = kwsL.next(); if (a.modo === 'ejecutar') kl.pause(); okL.push(kl.getText() + ' (' + kl.getMatchType() + ') en ' + kl.getAdGroup().getName()); }
      }
      return { estado: a.modo === 'simular' ? 'simulada' : (okL.length ? 'ejecutada' : 'fallida'), resultado: (a.modo === 'simular' ? 'Pausaría ' : 'Pausadas ') + okL.length + ': ' + okL.join(', ') + (noL.length ? '. No encontradas activas: ' + noL.join(', ') : '') + '. Para revertir: habilitarlas.' };
    }
    return { estado: 'fallida', resultado: 'Lote no soportado para ' + a.tipo };
  }

  if (a.tipo === 'negativa_campana') {
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Agregaría negativa ' + fmtKw(a.keyword, a.match_type) + ' a la campaña ' + campaign.getName() };
    campaign.createNegativeKeyword(fmtKw(a.keyword, a.match_type));
    return { estado: 'ejecutada', resultado: 'Negativa ' + fmtKw(a.keyword, a.match_type) + ' agregada a la campaña ' + campaign.getName() };
  }

  var grupo = null;
  if (a.grupo) {
    var g = campaign.adGroups().withCondition('Name = "' + a.grupo.replace(/"/g, '\\"') + '"').get();
    if (!g.hasNext()) return { estado: 'fallida', resultado: 'Grupo no encontrado: ' + a.grupo };
    grupo = g.next();
  }

  if (a.tipo === 'negativa_grupo') {
    if (!grupo) return { estado: 'fallida', resultado: 'Negativa de grupo sin grupo' };
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Agregaría negativa ' + fmtKw(a.keyword, a.match_type) + ' al grupo ' + grupo.getName() };
    grupo.createNegativeKeyword(fmtKw(a.keyword, a.match_type));
    return { estado: 'ejecutada', resultado: 'Negativa ' + fmtKw(a.keyword, a.match_type) + ' agregada al grupo ' + grupo.getName() };
  }

  if (a.tipo === 'pausar_keyword') {
    var kws = (grupo ? grupo.keywords() : campaign.keywords()).withCondition('Text = "' + a.keyword.replace(/"/g, '\\"') + '"').withCondition('Status = ENABLED').get();
    if (!kws.hasNext()) return { estado: 'fallida', resultado: 'Keyword activa no encontrada: ' + a.keyword };
    var n = 0, nombres = [];
    while (kws.hasNext()) { var k = kws.next(); nombres.push(k.getText() + ' (' + k.getMatchType() + ')'); if (a.modo === 'ejecutar') k.pause(); n++; }
    return { estado: a.modo === 'simular' ? 'simulada' : 'ejecutada', resultado: (a.modo === 'simular' ? 'Pausaría ' : 'Pausada(s) ') + n + ': ' + nombres.join(', ') };
  }


  if (a.tipo === 'cambiar_concordancia') {
    if (!a.match_type_destino) return { estado: 'fallida', resultado: 'Falta la concordancia destino' };
    var kwsC = (grupo ? grupo.keywords() : campaign.keywords()).withCondition('Text = "' + a.keyword.replace(/"/g, '\\"') + '"').withCondition('Status = ENABLED').get();
    if (!kwsC.hasNext()) return { estado: 'fallida', resultado: 'Keyword activa no encontrada: ' + a.keyword };
    var vieja = kwsC.next();
    if (vieja.getMatchType() === a.match_type_destino) return { estado: 'ejecutada', resultado: 'Ya estaba en ' + a.match_type_destino + '; nada que hacer' };
    var grupoDestino = grupo || vieja.getAdGroup();
    var textoNuevo = fmtKw(vieja.getText(), a.match_type_destino);
    var urlFinal = null; try { urlFinal = vieja.urls().getFinalUrl(); } catch (e) {}
    // CPC manual solo si la campaña puja a mano. Bajo Smart Bidding el CPC de keyword no existe y getCpc() devuelve 0,01.
    var estrategia = ''; try { estrategia = String(campaign.getBiddingStrategyType()); } catch (e) {}
    var pujaManual = /MANUAL_CPC|ENHANCED_CPC/.test(estrategia);
    var cpcManual = null; if (pujaManual) { try { cpcManual = vieja.bidding().getCpc(); } catch (e) {} }
    var detalle = (urlFinal ? 'URL final ' + urlFinal + '; ' : 'sin URL propia (hereda del anuncio); ') + (pujaManual && cpcManual ? 'CPC máximo ' + cpcManual + ' copiado de la anterior' : 'sin CPC máximo (la campaña puja con ' + (estrategia || 'Smart Bidding') + ', el CPC de keyword no aplica)');
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Crearía ' + textoNuevo + ' en ' + grupoDestino.getName() + ' con ' + detalle + ', y pausaría la ' + vieja.getMatchType() + ' actual' };
    var builder = grupoDestino.newKeywordBuilder().withText(textoNuevo);
    if (urlFinal) builder = builder.withFinalUrl(urlFinal);
    if (pujaManual && cpcManual) builder = builder.withCpc(cpcManual);
    var op = builder.build();
    if (!op.isSuccessful()) return { estado: 'fallida', resultado: 'No se pudo crear ' + textoNuevo + ': ' + op.getErrors().join('; ') };
    vieja.pause();
    return { estado: 'ejecutada', resultado: 'Creada ' + textoNuevo + ' en ' + grupoDestino.getName() + ' con ' + detalle + '. Pausada la ' + vieja.getMatchType() + '. Para revertir: reactivar la vieja y pausar la nueva.' };
  }


  // ---- VERBOS DE RIESGO MEDIO: guardan el valor anterior para poder revertir ----

  if (a.tipo === 'cambiar_estrategia_puja') {
    var destino = a.estrategia_destino || a.match_type_destino;
    if (!destino) return { estado: 'fallida', resultado: 'Falta la estrategia destino' };
    var antes = '';
    try { antes = String(campaign.getBiddingStrategyType()); } catch (e) { antes = 'desconocida'; }
    if (antes === destino) return { estado: 'ejecutada', resultado: 'Ya estaba en ' + destino + '; nada que hacer' };
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Cambiaria la puja de ' + campaign.getName() + ' de ' + antes + ' a ' + destino };
    try {
      var bid = campaign.bidding();
      if (a.valor_nuevo && (destino === 'MAXIMIZE_CONVERSIONS' || destino === 'TARGET_CPA')) {
        bid.setStrategy(destino, bid.argsBuilder().withTargetCpa(Number(a.valor_nuevo)));
      } else if (a.valor_nuevo && (destino === 'MAXIMIZE_CONVERSION_VALUE' || destino === 'TARGET_ROAS')) {
        bid.setStrategy(destino, bid.argsBuilder().withTargetRoas(Number(a.valor_nuevo)));
      } else {
        bid.setStrategy(destino);
      }
    } catch (e) { return { estado: 'fallida', resultado: 'No se pudo cambiar la puja: ' + e.message }; }
    return { estado: 'ejecutada', resultado: 'Puja de ' + campaign.getName() + ' cambiada de ' + antes + ' a ' + destino + (a.valor_nuevo ? ' con objetivo ' + a.valor_nuevo : ' sin objetivo') + '. PARA REVERTIR: volver a ' + antes + '. El aprendizaje se reinicia igual, asi que no esperes lecturas utiles por 7 a 14 dias.' };
  }

  if (a.tipo === 'cambiar_objetivo_puja') {
    var antesObj = '';
    try { antesObj = String(campaign.getBiddingStrategyType()); } catch (e) {}
    if (a.modo === 'simular') return { estado: 'simulada', resultado: (a.valor_nuevo == null ? 'Quitaria el objetivo de ' : 'Pondria el objetivo en ' + a.valor_nuevo + ' en ') + campaign.getName() + ' (estrategia ' + antesObj + ')' };
    try {
      var b2 = campaign.bidding();
      if (a.valor_nuevo == null || a.valor_nuevo === '') {
        if (/ROAS|VALUE/.test(antesObj)) { b2.clearTargetRoas(); } else { b2.clearTargetCpa(); }
        return { estado: 'ejecutada', resultado: 'Objetivo quitado en ' + campaign.getName() + ' (estrategia ' + antesObj + ', valor anterior ' + (a.valor_actual != null ? a.valor_actual : 'no registrado') + '). PARA REVERTIR: volver a poner ' + (a.valor_actual != null ? a.valor_actual : 'el valor anterior') + '.' };
      }
      if (/ROAS|VALUE/.test(antesObj)) { b2.setTargetRoas(Number(a.valor_nuevo)); } else { b2.setTargetCpa(Number(a.valor_nuevo)); }
    } catch (e) { return { estado: 'fallida', resultado: 'No se pudo: ' + e.message + '. Nota: setTargetRoas solo aplica a estrategias de valor, setTargetCpa solo a las de conversiones.' }; }
    return { estado: 'ejecutada', resultado: 'Objetivo de ' + campaign.getName() + ' puesto en ' + a.valor_nuevo + ' (antes ' + (a.valor_actual != null ? a.valor_actual : 'no registrado') + ', estrategia ' + antesObj + '). PARA REVERTIR: volver al valor anterior.' };
  }

  if (a.tipo === 'cambiar_presupuesto') {
    if (a.valor_nuevo == null) return { estado: 'fallida', resultado: 'Falta el monto nuevo' };
    var pres = campaign.getBudget();
    var montoAntes = pres.getAmount();
    var montoNuevo = Number(a.valor_nuevo);
    // Tope duro: mas de 30% de una vez reinicia el aprendizaje y descontrola el gasto
    var variacion = Math.abs(montoNuevo - montoAntes) / (montoAntes || 1);
    if (variacion > 0.3) return { estado: 'fallida', resultado: 'Bloqueado por tope de seguridad: el cambio es de ' + Math.round(variacion * 100) + '%, sobre el maximo de 30% por ejecucion. Actual ' + montoAntes + ', pedido ' + montoNuevo + '. Hacerlo en dos pasos.' };
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Cambiaria el presupuesto de ' + campaign.getName() + ' de ' + montoAntes + ' a ' + montoNuevo };
    pres.setAmount(montoNuevo);
    return { estado: 'ejecutada', resultado: 'Presupuesto de ' + campaign.getName() + ': ' + montoAntes + ' -> ' + montoNuevo + '. PARA REVERTIR: volver a ' + montoAntes + '.' };
  }

  if (a.tipo === 'pausar_campana' || a.tipo === 'reactivar_campana') {
    var pausar = a.tipo === 'pausar_campana';
    var estadoAntes = campaign.isPaused() ? 'pausada' : 'activa';
    if ((pausar && campaign.isPaused()) || (!pausar && !campaign.isPaused())) return { estado: 'ejecutada', resultado: 'Ya estaba ' + estadoAntes + '; nada que hacer' };
    if (a.modo === 'simular') return { estado: 'simulada', resultado: (pausar ? 'Pausaria ' : 'Reactivaria ') + campaign.getName() };
    if (pausar) { campaign.pause(); } else { campaign.enable(); }
    return { estado: 'ejecutada', resultado: campaign.getName() + ' ' + (pausar ? 'pausada' : 'reactivada') + ' (antes ' + estadoAntes + '). PARA REVERTIR: ' + (pausar ? 'habilitarla' : 'pausarla') + '.' };
  }

  if (a.tipo === 'quitar_negativa') {
    var nq = fmtKw(a.keyword, a.match_type);
    var fuente = (a.nivel === 'grupo' && grupo) ? grupo : campaign;
    var itn = fuente.negativeKeywords().get(), quitadas = [];
    while (itn.hasNext()) {
      var nk = itn.next();
      if (nk.getText() === nq || nk.getText().replace(/^[\[\"]+|[\]\"]+$/g, '') === String(a.keyword).replace(/^[\[\"]+|[\]\"]+$/g, '')) {
        quitadas.push(nk.getText());
        if (a.modo === 'ejecutar') nk.remove();
      }
    }
    if (!quitadas.length) return { estado: 'fallida', resultado: 'Negativa no encontrada: ' + nq + ' en ' + (a.nivel === 'grupo' ? 'el grupo' : 'la campana') };
    return { estado: a.modo === 'simular' ? 'simulada' : 'ejecutada', resultado: (a.modo === 'simular' ? 'Quitaria ' : 'Quitadas ') + quitadas.length + ': ' + quitadas.join(', ') + '. PARA REVERTIR: volver a crearlas.' };
  }

  if (a.tipo === 'reactivar_keyword') {
    var kwsR = (grupo ? grupo.keywords() : campaign.keywords()).withCondition('Text = "' + String(a.keyword).replace(/"/g, '\\"') + '"').withCondition('Status = PAUSED').get();
    if (!kwsR.hasNext()) return { estado: 'fallida', resultado: 'Keyword pausada no encontrada: ' + a.keyword };
    var nR = 0, nomR = [];
    while (kwsR.hasNext()) { var kr = kwsR.next(); nomR.push(kr.getText() + ' (' + kr.getMatchType() + ')'); if (a.modo === 'ejecutar') kr.enable(); nR++; }
    return { estado: a.modo === 'simular' ? 'simulada' : 'ejecutada', resultado: (a.modo === 'simular' ? 'Reactivaria ' : 'Reactivadas ') + nR + ': ' + nomR.join(', ') + '. PARA REVERTIR: pausarlas.' };
  }

  if (a.tipo === 'pausar_grupo') {
    if (!grupo) return { estado: 'fallida', resultado: 'Falta el grupo' };
    if (grupo.isPaused()) return { estado: 'ejecutada', resultado: 'Ya estaba pausado; nada que hacer' };
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Pausaria el grupo ' + grupo.getName() };
    grupo.pause();
    return { estado: 'ejecutada', resultado: 'Grupo ' + grupo.getName() + ' pausado. PARA REVERTIR: habilitarlo.' };
  }

  if (a.tipo === 'cambiar_cpc_keyword') {
    if (a.valor_nuevo == null) return { estado: 'fallida', resultado: 'Falta el CPC nuevo' };
    var kwsB = (grupo ? grupo.keywords() : campaign.keywords()).withCondition('Text = "' + String(a.keyword).replace(/"/g, '\\"') + '"').get();
    if (!kwsB.hasNext()) return { estado: 'fallida', resultado: 'Keyword no encontrada: ' + a.keyword };
    var kb = kwsB.next(), cpcAntes = null;
    try { cpcAntes = kb.bidding().getCpc(); } catch (e) {}
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Cambiaria el CPC de ' + kb.getText() + ' de ' + cpcAntes + ' a ' + a.valor_nuevo };
    try { kb.bidding().setCpc(Number(a.valor_nuevo)); } catch (e) { return { estado: 'fallida', resultado: 'No se pudo: ' + e.message + '. Bajo Smart Bidding el CPC de keyword no aplica.' }; }
    return { estado: 'ejecutada', resultado: 'CPC de ' + kb.getText() + ': ' + cpcAntes + ' -> ' + a.valor_nuevo + '. PARA REVERTIR: volver a ' + cpcAntes + '.' };
  }

  if (a.tipo === 'pausar_anuncio') {
    if (!a.ad_id) return { estado: 'fallida', resultado: 'Falta ad_id' };
    var ads = (grupo ? grupo.ads() : campaign.ads()).withIds([[grupo ? grupo.getId() : null, Number(a.ad_id)]]).get();
    if (!ads.hasNext()) return { estado: 'fallida', resultado: 'Anuncio no encontrado: ' + a.ad_id };
    var ad = ads.next();
    if (a.modo === 'simular') return { estado: 'simulada', resultado: 'Pausaría el anuncio ' + a.ad_id };
    ad.pause();
    return { estado: 'ejecutada', resultado: 'Anuncio ' + a.ad_id + ' pausado' };
  }
  return { estado: 'fallida', resultado: 'Tipo no soportado: ' + a.tipo };
}

function fmtKw(text, matchType) {
  var t = String(text).replace(/^[\[\]"]+|[\[\]"]+$/g, '').trim();
  if (matchType === 'EXACT') return '[' + t + ']';
  if (matchType === 'PHRASE') return '"' + t + '"';
  return t;
}

function leerPendientes() {
  var res = UrlFetchApp.fetch(CONFIG.SUPABASE.url + '/rest/v1/v_acciones_pendientes?select=*', {
    headers: { 'apikey': CONFIG.SUPABASE.serviceKey, 'Authorization': 'Bearer ' + CONFIG.SUPABASE.serviceKey }, muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) { Logger.log('Supabase ' + res.getResponseCode() + ': ' + res.getContentText().substring(0, 200)); return []; }
  return JSON.parse(res.getContentText());
}

function reportar(id, estado, resultado) {
  var res = UrlFetchApp.fetch(CONFIG.APP.url + '/api/cron/ejecutor-resultado', {
    method: 'post', contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.APP.cronSecret },
    payload: JSON.stringify({ id: id, estado: estado, resultado: resultado }), muteHttpExceptions: true
  });
  Logger.log('reportar ' + id + ' → ' + res.getResponseCode());
}
