-- Google entrega tres identificadores de clic distintos segun el contexto:
-- gclid en el caso general, gbraid para trafico de app y wbraid para web
-- cuando hay restricciones de privacidad, tipicamente iOS. Se suben a la API
-- de conversiones offline en campos separados, asi que hay que saber cual es.
-- Verificado en el pipeline real de 360: de tres cierres, dos llegaron con
-- gbraid y ninguno con gclid.
alter table true_roas_events
  add column if not exists click_id_type text
    check (click_id_type in ('gclid','gbraid','wbraid'));

comment on column true_roas_events.click_id_type is 'Cual de los tres identificadores de Google trae la columna gclid. Determina en que campo se sube la conversion offline: gclid, gbraid o wbraid. Filtrar solo por gclid descarta el trafico de iOS.';

-- Cierres reales sin ningun identificador de clic. No son un error del
-- sistema: son negocio que existe pero no se puede atribuir a la campana.
-- Caso conocido en 360: un cierre de 29.500.000 CLP que entro por WhatsApp,
-- canal donde el identificador no cruza del ecosistema de Google al de Meta.
create table if not exists cierres_sin_atribucion (
  id bigserial primary key,
  client text not null,
  source text not null default 'asana',
  external_id text not null,
  nombre_tarea text,
  monto numeric,
  motivo text,
  event_date timestamptz,
  created_at timestamptz default now()
);
create unique index if not exists uq_cierres_sin_atrib on cierres_sin_atribucion (client, external_id);
alter table cierres_sin_atribucion enable row level security;

comment on table cierres_sin_atribucion is 'Negocios cerrados que no se pueden atribuir por falta de identificador de clic. Se registran igual porque son ingresos reales: sin esto, el retorno del canal queda subestimado y nadie sabe por que. Contrastar el total contra los ingresos reportados por el cliente.';

-- Vista unica del negocio cerrado, atribuible o no
create or replace view v_cierres_totales as
select client, 'atribuido' as tipo, external_id, monto, event_date,
       click_id_type as identificador
from true_roas_events
union all
select client, 'sin atribucion', external_id, monto, event_date, null
from cierres_sin_atribucion;

comment on view v_cierres_totales is 'Todos los cierres, con y sin atribucion. La suma de la columna monto es el negocio real generado; solo la parte atribuida se puede vincular a una campana especifica.';;
