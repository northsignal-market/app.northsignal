-- ================================================================
-- ESCALERA DE VALOR POR ETAPA DEL FUNNEL
-- ================================================================
-- El problema estructural de las tres cuentas: Smart Bidding solo ve el
-- formulario. Con 4 a 8 formularios al mes, no puede aprender. Y con ciclos
-- de 45 a 90 dias, el cierre llega tarde y en volumen infimo.
--
-- La solucion documentada: una conversion separada por etapa del funnel,
-- cada una con valor = tasa de cierre desde esa etapa x ticket promedio.
-- Se envia a Google cuando el lead LLEGA a la etapa, dentro de la ventana
-- de 90 dias. El cierre real se envia despues como correccion.
--
-- Asi el algoritmo recibe senal graduada y frecuente en vez de una senal
-- exacta pero tardia y escasa.
--
-- Regla de oro: las acciones nuevas nacen SECUNDARIAS. Pasan a primarias
-- cuando tienen 15 o mas eventos en 30 dias. Antes, alimentan el reporte
-- pero no la puja.
-- ================================================================
create table if not exists funnel_stages (
  id serial primary key,
  account text not null,
  stage_order int not null,
  stage_name text not null,
  source text not null,                -- 'asana_section' | 'ghl_stage' | 'karedo_backend' | 'google_native'
  external_id text,                    -- gid de seccion Asana, id de etapa GHL
  google_conversion_action text,       -- nombre exacto en Google Ads, null si aun no existe
  google_status text default 'no_existe' check (google_status in ('no_existe','secundaria','primaria')),
  -- Calculo del valor
  win_rate_to_close numeric,           -- de los que llegan aca, que fraccion cierra
  avg_ticket numeric,                  -- ticket promedio de los cierres
  stage_value numeric generated always as (round(coalesce(win_rate_to_close,0) * coalesce(avg_ticket,0), 0)) stored,
  currency text,
  -- Volumen
  eventos_ultimos_30d int,
  listo_para_primaria boolean generated always as (coalesce(eventos_ultimos_30d,0) >= 15) stored,
  -- Metadatos
  win_rate_origen text,                -- 'calculado' | 'estimado' | 'benchmark'
  notas text,
  actualizado timestamptz default now(),
  unique (account, stage_order)
);
alter table funnel_stages enable row level security;

comment on table funnel_stages is 'Escalera de valor por etapa. stage_value = win_rate_to_close x avg_ticket: es lo que vale un lead que llega a esa etapa, en esperanza. Se envia a Google como conversion offline con ese valor. listo_para_primaria dice si la etapa tiene volumen suficiente (15+/mes) para alimentar Smart Bidding sin desestabilizarlo. Actualizar win rates cada 6 meses o cuando cambie el ticket.';

-- 360: pipeline de Asana, 4 secciones, ticket real de los 3 cierres conocidos
-- Ticket promedio: (29.500.000 + 10.700.000 + 776.250) / 3 = 13.658.750
-- Win rates ESTIMADOS: sin historico suficiente. Benchmark B2B eventos.
insert into funnel_stages (account, stage_order, stage_name, source, external_id, google_conversion_action, google_status, win_rate_to_close, avg_ticket, currency, eventos_ultimos_30d, win_rate_origen, notas) values
('360', 1, 'Nuevo Lead', 'asana_section', '1213749057109113', 'Contacto', 'primaria', 0.04, 13658750, 'CLP', 8, 'estimado', 'Formulario. Es la unica primaria hoy. 4% = 0,5 cierres / 14 leads al mes segun doc maestro'),
('360', 2, 'En contacto', 'asana_section', '1213749057109114', null, 'no_existe', 0.08, 13658750, 'CLP', null, 'estimado', 'Primer contacto humano. Doble de probabilidad que un lead frio'),
('360', 3, 'Cotizacion enviada', 'asana_section', '1213749057109115', null, 'no_existe', 0.33, 13658750, 'CLP', null, 'estimado', '3 cierres sobre ~9 cotizaciones = 33%. Es la etapa con mejor relacion volumen/senal: hay 6 cotizaciones estancadas ahora mismo'),
('360', 4, 'Cerrado ganado', 'asana_section', '1213749057109116', 'Cierre offline', 'secundaria', 1.00, 13658750, 'CLP', 0, 'calculado', 'Valor real del campo Monto. 3 cierres historicos. Volumen insuficiente para puja: se manda como correccion'),

-- BHI: pipeline de GoHighLevel. Ya tiene las 4 acciones en Google con valores asignados.
-- Ticket: US$5.599 fue el cierre conocido. Un solo dato.
('BHI', 1, 'Envio de formulario', 'ghl_stage', null, 'Envío de formulario', 'primaria', 0.03, 5599, 'USD', 4, 'estimado', 'Unica primaria desde el 5 sep. Sin valor asignado (se retiro el fijo de 10.000 CLP). 3% = 1 cierre en ~30 solicitudes'),
('BHI', 2, 'Asesoria Agendada', 'ghl_stage', null, 'Asesoría Agendada', 'secundaria', 0.10, 5599, 'USD', null, 'estimado', 'Tiene US$100 asignado a mano. El calculo daria 560. Revisar'),
('BHI', 3, 'Asesoria Realizada', 'ghl_stage', null, 'Asesoría Realizada', 'secundaria', 0.25, 5599, 'USD', 14, 'estimado', 'Tiene US$300 asignado. 14 registros historicos: es la etapa con volumen. Candidata a PRIMARIA cuando pase 15/mes'),
('BHI', 4, 'Cliente Activo', 'ghl_stage', null, 'Cliente Activo', 'secundaria', 1.00, 5599, 'USD', 2, 'calculado', 'Valor real. 2 registros. Solo correccion'),

-- KAREDO: SaaS. Solo tiene el clic en Registrieren. Las etapas siguientes viven en el backend de Karedo y NO hay integracion.
('KAREDO', 1, 'Clic Registrieren', 'google_native', null, 'Lead - Karedo App', 'primaria', null, null, 'EUR', 45, 'benchmark', 'Enhanced Conversions con 0-15% match, dispara al clic no al completar. Es lo unico que Google ve'),
('KAREDO', 2, 'Cuenta creada', 'karedo_backend', null, null, 'no_existe', null, null, 'EUR', null, 'benchmark', 'FALTA INTEGRACION. Karedo tiene el dato en su backend. Sin esto, no hay escalera'),
('KAREDO', 3, 'Trial activo', 'karedo_backend', null, null, 'no_existe', null, null, 'EUR', null, 'benchmark', 'FALTA INTEGRACION'),
('KAREDO', 4, 'Suscripcion paga', 'karedo_backend', null, null, 'no_existe', null, null, 'EUR', null, 'benchmark', 'FALTA INTEGRACION. Es el unico valor real. Sin el, el valor de 20 EUR por registro es arbitrario');


-- ================================================================
-- VISTA: ESTADO DE LA ESCALERA POR CUENTA
-- ================================================================
create or replace view v_escalera_valor as
select
  account, stage_order, stage_name, source,
  google_conversion_action, google_status,
  win_rate_to_close, avg_ticket, stage_value, currency,
  eventos_ultimos_30d, listo_para_primaria, win_rate_origen,
  -- Diagnostico por etapa
  case
    when google_status = 'no_existe' and source = 'karedo_backend' then 'BLOQUEADO: falta integracion con backend del cliente'
    when google_status = 'no_existe' then 'CREAR: accion de conversion offline como secundaria'
    when google_status = 'secundaria' and listo_para_primaria then 'PROMOVER: tiene volumen para ser primaria'
    when google_status = 'secundaria' then 'ACUMULAR: secundaria hasta llegar a 15/mes'
    when google_status = 'primaria' and stage_order = 1 then 'SUSTITUIR: es la etapa de entrada, senal barata y ruidosa'
    when google_status = 'primaria' then 'OK: primaria con volumen'
  end as accion,
  notas
from funnel_stages
order by account, stage_order;

comment on view v_escalera_valor is 'Estado de cada etapa del funnel por cuenta: si existe en Google, si es primaria o secundaria, cuanto vale, y que accion corresponde. El objetivo es que la primaria sea la etapa mas profunda que tenga 15+ eventos al mes, no la de entrada.';


-- ================================================================
-- VISTA: RESUMEN, QUE PRIMARIA DEBERIA TENER CADA CUENTA
-- ================================================================
create or replace view v_primaria_recomendada as
select
  account,
  (select stage_name from funnel_stages f where f.account = a.account and f.google_status = 'primaria' order by stage_order limit 1) as primaria_actual,
  (select stage_name from funnel_stages f where f.account = a.account and listo_para_primaria and stage_order > 1 order by stage_order desc limit 1) as primaria_recomendada,
  (select stage_value from funnel_stages f where f.account = a.account and listo_para_primaria and stage_order > 1 order by stage_order desc limit 1) as valor_primaria_recomendada,
  (select count(*) from funnel_stages f where f.account = a.account and google_status = 'no_existe' and source <> 'karedo_backend') as etapas_por_crear,
  (select count(*) from funnel_stages f where f.account = a.account and source = 'karedo_backend') as etapas_bloqueadas_por_integracion,
  case
    when (select count(*) from funnel_stages f where f.account = a.account and listo_para_primaria and stage_order > 1) = 0
      then 'Ninguna etapa intermedia tiene 15+/mes. Primero crear las acciones secundarias y acumular'
    else 'Mover la puja a ' || (select stage_name from funnel_stages f where f.account = a.account and listo_para_primaria and stage_order > 1 order by stage_order desc limit 1)
  end as recomendacion
from (select distinct account from funnel_stages) a;

comment on view v_primaria_recomendada is 'Una fila por cuenta: cual es la primaria hoy, cual deberia ser segun volumen, y que falta para llegar. La regla: la primaria debe ser la etapa mas profunda con 15+ eventos al mes. Mas profunda = mejor senal; 15+ = suficiente para que Smart Bidding aprenda.';;
