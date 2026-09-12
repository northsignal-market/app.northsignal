-- Contexto semantico: el agente lee estas descripciones en vez de inferir del DDL.

comment on table campaign is 'Rendimiento semanal por campana. Una fila por campana y semana. IMPORTANTE: las columnas conv_value y roas NO son confiables en KAREDO (valor fijo arbitrario de 20 EUR por registro) ni en 360 (regla de valor 1,5x). Usar las vistas v_<cliente>_campaign en su lugar.';
comment on column campaign.conversions is 'Conversiones primarias de Google Ads. Solo las acciones marcadas como primarias entrenan Smart Bidding.';
comment on column campaign.all_conversions is 'Suma de TODAS las acciones, primarias y secundarias. Casi nunca es negocio real. No reportar al cliente.';
comment on column campaign.lost_is_budget is 'Porcentaje de cuota de impresiones perdida por presupuesto insuficiente. Si es alto, subir presupuesto genera volumen.';
comment on column campaign.lost_is_rank is 'Porcentaje perdido por ad rank, es decir puja y calidad. Si es alto, subir presupuesto NO resuelve.';

comment on table keywords is 'Inventario COMPLETO de keywords no eliminadas, con o sin impresiones en la semana. Una keyword con impressions = 0 existe y esta activa: es senal, no ausencia de dato.';
comment on column keywords.serving_status is 'Estado de entrega segun Google. RARELY_SERVED significa volumen de busqueda insuficiente: la keyword no va a servir aunque este habilitada.';
comment on column keywords.effective_cpc_bid is 'Puja heredada. Con Smart Bidding NO gobierna la entrega. Lo accionable son las columnas est_* de estimacion de posicion.';
comment on column keywords.est_top_of_page_cpc is 'CPC estimado para aparecer en el tope de pagina. Este si es accionable: dice cuanto haria falta para competir.';

comment on table conversion_actions is 'Conversiones desglosadas por accion. Sin este desglose la API devuelve totales agregados. Es la tabla que permite distinguir negocio real de eventos blandos.';
comment on table change_events is 'Historial de cambios con valor anterior y nuevo. Un client_type que contenga RECOMMENDATION indica cambio auto-aplicado por Google: siempre alerta ALTA.';
comment on table simulations is 'Curvas de simulacion de tCPA, tROAS y presupuesto. Vacia es legitimo: Google solo las genera con volumen suficiente. Es la unica base valida para proponer cambios de target.';
comment on table weekly_brief is 'Capa pre-agregada que genera el script. Punto de partida de la lectura semanal. Incluye totales comparados contra la semana previa, campanas, conversiones por accion, top keywords, terminos sin conversion, cambios, alertas y listas exactas de entidades en las secciones que empiezan con entidades_.';
comment on table account_state is 'Estructura real de la cuenta, regenerada cada semana. UNICA fuente de verdad sobre que existe: campanas, grupos, targets, conteos de keywords, negativas y acciones de conversion. Si algo no aparece aca, no existe.';
comment on table alerts is 'Alertas evaluadas por el script contra los umbrales de cada cliente. Severidad ALTA requiere accion.';
comment on table negatives is 'Inventario de negativas. Snapshot semanal: comparar semanas detecta negativas que desaparecieron.';
comment on table search_terms is 'Terminos de busqueda reales. Insumo para negativas y para keywords nuevas.';
comment on table rsa_assets is 'Assets de RSA. performance_label suele venir NOT_APPLICABLE cuando el volumen por asset es bajo: es limitacion de Google, no falla de extraccion.';
comment on table bid_targets is 'Targets efectivos por campana y grupo. target_source indica si el valor es propio del grupo o heredado de la campana.';;
