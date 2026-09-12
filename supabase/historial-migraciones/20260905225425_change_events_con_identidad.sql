-- Al modificar una entidad, change_event solo registra el campo que cambio.
-- "status: ENABLED -> PAUSED" no dice CUAL keyword ni CUAL anuncio: solo
-- trae el identificador del recurso. Sin resolverlo a un nombre, el analisis
-- no puede cruzar el cambio con el accionable que lo pedia.
alter table change_events
  add column if not exists resource_name text,       -- customers/X/adGroupCriteria/Y~Z
  add column if not exists entity_name text,         -- "betreuung" / "Branded" / nombre legible
  add column if not exists campaign_name text,
  add column if not exists ad_group_name text;

create index if not exists idx_change_events_entity on change_events (account, entity_name);

comment on column change_events.entity_name is 'Nombre legible de la entidad modificada, resuelto por el script en el momento de la extraccion. Para keywords es el texto; para anuncios el titular principal; para grupos y campanas su nombre. Es lo que permite cruzar un cambio con el accionable que lo pedia.';


-- Vista lista para el cruce con accionables: cada cambio con todo lo que
-- hace falta para saber si corresponde a una accion propuesta
create or replace view v_cambios_para_cruce as
select
  account,
  substring(change_datetime from 1 for 10)::date as fecha,
  substring(change_datetime from 12 for 8) as hora,
  resource_type,
  operation,
  entity_name,
  campaign_name,
  ad_group_name,
  changed_field,
  old_value,
  new_value,
  user_email,
  (client_type like '%RECOMMENDATION%' or client_type like '%GOOGLE_FIRST_PARTY%') as automatico,
  -- Etiqueta legible del cambio, para que el modelo no tenga que reconstruirla
  case
    when changed_field = 'status' and new_value = 'PAUSED' then 'Pauso ' || lower(resource_type) || ' "' || coalesce(entity_name,'?') || '"'
    when changed_field = 'status' and new_value = 'ENABLED' then 'Activo ' || lower(resource_type) || ' "' || coalesce(entity_name,'?') || '"'
    when operation = 'CREATE' then 'Creo ' || lower(resource_type) || ' "' || coalesce(entity_name, new_value, '?') || '"'
    when operation = 'REMOVE' then 'Elimino ' || lower(resource_type) || ' "' || coalesce(entity_name,'?') || '"'
    when changed_field like '%target_cpa%' or changed_field like '%targetCpa%' then 'Cambio tCPA de "' || coalesce(entity_name,'?') || '": ' || coalesce(old_value,'?') || ' -> ' || coalesce(new_value,'?')
    when changed_field like '%budget%' or changed_field like '%amount%' then 'Cambio presupuesto de "' || coalesce(entity_name,'?') || '": ' || coalesce(old_value,'?') || ' -> ' || coalesce(new_value,'?')
    else 'Modifico ' || coalesce(changed_field,'(campo no registrado)') || ' de "' || coalesce(entity_name,'?') || '"' ||
         case when old_value is not null or new_value is not null then ': ' || coalesce(old_value,'?') || ' -> ' || coalesce(new_value,'?') else '' end
  end as descripcion
from change_events
where change_datetime is not null;

comment on view v_cambios_para_cruce is 'Cada cambio con su entidad nombrada y una descripcion en una linea. Es la vista que la tarea semanal usa para decidir si un accionable se ejecuto: compara descripcion y entity_name con el texto del accionable. Si entity_name es null, el script no pudo resolverlo y el cruce debe hacerse por campana y grupo.';;
