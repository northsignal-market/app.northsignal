-- ============================================================
-- PREPARACION MULTIPLATAFORMA · no migra nada, solo abre la puerta
-- ============================================================
-- El sistema hoy no tiene concepto de plataforma: 113 columnas y 5 tablas son
-- de Google. Meta no tiene keywords, ni terminos de busqueda, ni concordancia,
-- ni quality score. Tiene conjuntos de anuncios, publicos y creatividades.
--
-- Lo que se hace ACA es solo lo que no rompe nada: marcar todo lo existente
-- como 'google' con valor por defecto, para que el dia que entre Meta las
-- consultas de hoy sigan devolviendo lo mismo. La migracion de verdad espera
-- a que Google este cerrado.
-- ============================================================

create type plataforma_pub as enum ('google', 'meta');

alter table cuentas add column if not exists plataformas plataforma_pub[] not null default array['google']::plataforma_pub[];
comment on column cuentas.plataformas is 'Que plataformas opera esta cuenta. Fresh Monkee gasta el doble en Meta que en Google y hoy Meta esta fuera del sistema.';

-- Las tablas donde van a convivir las dos
alter table campaign add column if not exists plataforma plataforma_pub not null default 'google';
alter table campaign_daily add column if not exists plataforma plataforma_pub not null default 'google';
alter table accionables_espejo add column if not exists plataforma plataforma_pub not null default 'google';
alter table acciones_aprobadas add column if not exists plataforma plataforma_pub not null default 'google';
alter table operator_log add column if not exists plataforma plataforma_pub not null default 'google';
alter table capacidades_ejecucion add column if not exists plataforma plataforma_pub not null default 'google';

-- El registro de capacidades pasa a tener clave compuesta: el mismo verbo puede
-- existir en las dos plataformas con metodo y riesgo distintos.
alter table capacidades_ejecucion drop constraint if exists capacidades_ejecucion_pkey;
alter table capacidades_ejecucion add primary key (plataforma, verbo);

-- Que puede hacer un agente en Meta. Verificado contra la documentacion del MCP
-- oficial de Meta (mcp.facebook.com/ads, 29 herramientas, abierto el 29 abr 2026).
insert into capacidades_ejecucion (plataforma, verbo, ejecutable, metodo, reversible, riesgo, requiere, por_que_no) values
('meta', 'pausar_campana', true, 'ads_update_entity con status PAUSED', 'Se reactiva con ads_activate_entity', 'medio', 'objeto.campana_id', null),
('meta', 'reactivar_campana', true, 'ads_activate_entity', 'Se pausa con ads_update_entity', 'medio', 'objeto.campana_id', null),
('meta', 'pausar_conjunto', true, 'ads_update_entity sobre el ad set', 'Se reactiva', 'medio', 'objeto.conjunto_id', null),
('meta', 'pausar_anuncio', true, 'ads_update_entity sobre el ad', 'Se reactiva', 'bajo', 'objeto.anuncio_id', null),
('meta', 'cambiar_presupuesto', true, 'ads_update_entity con daily_budget', 'Se vuelve al monto anterior', 'medio', 'objeto.conjunto_id, parametros.valor_actual, parametros.valor_nuevo', null),
('meta', 'crear_campana', true, 'ads_create_campaign. NACE PAUSADA por diseno del MCP.', 'Se elimina o se deja pausada', 'alto', 'objetivo, presupuesto, categoria_especial', null),
('meta', 'crear_conjunto', true, 'ads_create_ad_set con segmentacion, ubicaciones y calendario', 'Se elimina', 'alto', 'objeto.campana_id, publico, presupuesto', null),
('meta', 'crear_anuncio', true, 'ads_create_ad, enlazando la creatividad', 'Se pausa', 'alto', 'objeto.conjunto_id, creatividad_id, ETIQUETA DE CONTENIDO IA si la creatividad se genero con IA', null),
('meta', 'subir_creatividad', true, 'Subida de imagen o video al ad account', 'Se deja sin usar', 'medio', 'archivo, ETIQUETA DE CONTENIDO IA obligatoria si la genero un modelo', null),
('meta', 'cambiar_publico', false, null, null, 'alto', null, 'Un publico personalizado no se edita: se crea uno nuevo. Y la arquitectura de publicos de una cuenta es una decision estrategica, no una accion suelta.'),
('meta', 'cambiar_conversion_primaria', false, null, null, 'alto', null, 'El evento de optimizacion se define al crear el conjunto. Cambiarlo reinicia el aprendizaje entero: se crea un conjunto nuevo.'),
('meta', 'editar_creatividad', false, null, null, 'alto', null, 'Una creatividad publicada no se edita en Meta. Se crea una nueva y se pausa la vieja.')
on conflict (plataforma, verbo) do nothing;

select plataforma, count(*) verbos, count(*) filter (where ejecutable) ejecutables
from capacidades_ejecucion group by 1 order by 1;;
