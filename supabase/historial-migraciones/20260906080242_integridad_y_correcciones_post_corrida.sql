-- 1. Chequeo permanente: conversion_actions_daily debe sumar lo mismo que campaign_daily
create or replace view v_integridad_conversiones as
select x.account, x.date, x.campaign, x.conv_por_accion, c.conversions as conv_campaign,
       round(x.conv_por_accion - coalesce(c.conversions, 0), 2) as diferencia,
       case when abs(x.conv_por_accion - coalesce(c.conversions, 0)) > 0.01 then 'DESCUADRE' else 'ok' end as estado
from (select account, date, campaign, sum(conversions) as conv_por_accion from conversion_actions_daily group by 1,2,3) x
left join campaign_daily c on c.account = x.account and c.date = x.date and c.campaign = x.campaign
where abs(x.conv_por_accion - coalesce(c.conversions, 0)) > 0.01
order by x.account, x.date desc;
comment on view v_integridad_conversiones is 'Dias donde conversion_actions_daily no suma lo mismo que campaign_daily. Debe estar vacia. Si tiene filas, hay duplicacion (dos versiones del script escribiendo claves distintas) o desfase de extraccion. Detectado por la tarea de BHI el 6 sep 2026.';

-- 2. v_data_health: incorporar el chequeo de integridad
-- (se agrega como columna a v_integridad_datos si existe; si no, queda como vista aparte)

-- 3. v_cambios_detectados: explicitar cuando no puede comparar
create or replace view v_snapshots_disponibles as
select account, count(distinct snapshot_date) as fotos, min(snapshot_date) as primera, max(snapshot_date) as ultima,
       case when count(distinct snapshot_date) < 2 then 'SIN DIFF POSIBLE: v_cambios_detectados necesita 2 fotos. Primera el ' || min(snapshot_date)::text || '; la segunda llega mañana.'
            else 'ok: ' || count(distinct snapshot_date) || ' fotos, diff posible' end as estado
from config_snapshot group by account;
comment on view v_snapshots_disponibles is 'Cuantas fotos de configuracion hay por cuenta. v_cambios_detectados vacia con menos de 2 fotos es VACIO ESTRUCTURAL, no legitimo. Consultar antes de concluir que no hubo cambios. Detectado por la tarea de BHI el 6 sep: tres briefs lo llamaron legitimo sin verificar.';

-- 4. 360: la pregunta de Asana como operator_log para que no se pierda
insert into operator_log (account, fecha, que_cambio, donde, por_que) values
('360', current_date, 'PENDIENTE DE ANDRES: la tarea del 6 sep encontro que los tres montos de Cerrado ganado (40.976.250 CLP) se cargaron a mano en una sesion de 19 minutos el 25 de agosto, y que dos tarjetas llegaron a ganadas en 4 dias o menos, incompatible con el ciclo de 90+ dias. Aiwibi (10.700.000) se gano el 6 de agosto segun el historial de la tarjeta, no en la semana analizada.', 'otro',
 'Los briefs anteriores leyeron modified_at de Asana como fecha de cierre. Es incorrecto: modified_at cambia con cualquier edicion. La fecha de cierre real esta en el historial (stories) de la tarjeta: el evento de cambio de seccion a Cerrado ganado. PREGUNTA: en que fecha se gano cada uno de los tres. De eso depende si el retorno de la semana es real.');

-- 5. BHI: recuento ya en ONE_PER_CLICK
insert into operator_log (account, fecha, que_cambio, donde, por_que) values
('BHI', current_date, 'PENDIENTE DE ANDRES: la foto del 6 sep muestra Envio de formulario con recuento ONE_PER_CLICK (Una). El operator_log del 5 sep lo daba como pendiente de corregir desde Todas.', 'conversiones',
 'Con una sola foto no se distingue si Andres lo cambio entre el 5 y el 6, o si nunca estuvo en Todas y el registro del 5 fue incorrecto. PREGUNTA: lo cambiaste? Si si, cuando. Si no, el registro del 5 sep se corrige.');

select 'ok';;
