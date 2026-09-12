create table if not exists cambios_de_sistema (
  id bigserial primary key,
  cuando timestamptz default now(),
  quien text not null default 'claude',
  que text not null,
  por_que text,
  objetos text[],
  version text,
  revierte_como text
);
alter table cambios_de_sistema enable row level security;
revoke all on cambios_de_sistema from anon, authenticated;
comment on table cambios_de_sistema is 'Bitacora de cambios al sistema. Cada chat declara que toco antes de terminar. Sirve para que el siguiente no arregle lo mismo de otra forma ni deshaga lo recien hecho.';
create index if not exists ix_cambios_sistema_cuando on cambios_de_sistema (cuando desc);

create or replace function registrar_cambio(p_que text, p_por_que text default null,
  p_objetos text[] default null, p_version text default null, p_revierte_como text default null) returns bigint
language sql security definer set search_path = public, pg_temp as $$
  insert into cambios_de_sistema (que, por_que, objetos, version, revierte_como)
  values (p_que, p_por_que, p_objetos, p_version, p_revierte_como) returning id;
$$;
revoke execute on function registrar_cambio from anon, authenticated;

drop view if exists v_cambios_recientes;
create view v_cambios_recientes with (security_invoker = true) as
select cuando, que, por_que, objetos, version, revierte_como
from cambios_de_sistema where cuando > now() - interval '7 days' order by cuando desc;

drop view if exists v_objetos_tocados_dos_veces;
create view v_objetos_tocados_dos_veces with (security_invoker = true) as
select unnest(a.objetos) objeto, count(*) veces, max(a.cuando) ultimo,
  'Este objeto se toco mas de una vez en 48 horas. Revisa que el segundo cambio no haya deshecho el primero.' lectura
from cambios_de_sistema a where a.cuando > now() - interval '48 hours'
group by 1 having count(*) > 1;

select registrar_cambio(
  'Latidos y deteccion de tareas en silencio',
  'El modo de falla de pg_cron es el silencio: si Supabase tiene un incidente las 18 tareas se detienen sin alerta y el historial solo muestra un hueco. Ahora cada tarea late y v_tareas_en_silencio avisa por ausencia. El observador es el briefing, que corre en Google Ads y sobrevive a una caida de la base.',
  array['latidos','latir','v_tareas_en_silencio','get_salud_sistema'],
  'sql + briefing_v4', 'Desenvolver los comandos de cron.job y borrar la tabla latidos');
select registrar_cambio(
  'Volcado del esquema, semillas y tareas programadas',
  'El esquema entero vivia solo dentro de Supabase: si se corrompia no habia archivo del que saliera de nuevo. Las vistas se ordenan por nivel de dependencia porque 18 dependen de otras vistas con 148 aristas.',
  array['volcar_esquema','volcar_semillas','volcar_crons','nivel_de_vistas'],
  'sql + fix-v70', 'Son funciones de solo lectura, no hay que revertir nada');
select registrar_cambio(
  'Registro de capacidades corregido: faltaba declarar valor_actual',
  'cambiar_cpc_keyword y cambiar_objetivo_puja no declaraban valor_actual en el campo requiere, pero el trigger si lo exige. Un agente habria leido el registro, escrito el JSON que decia, y el sistema se lo habria rechazado sin explicacion. Lo encontro una prueba pgTAP mientras la escribia.',
  array['capacidades_ejecucion','v_capacidades_coherentes_chk'],
  'sql', 'Volver el campo requiere a su texto anterior');
select registrar_cambio(
  'Contexto vivo para chats nuevos',
  'Un documento que describe el estado envejece en dias. Un estudio de ETH Zurich midio que los archivos de contexto autogenerados bajan la tasa de exito en 5 de 8 escenarios porque una referencia vieja engana mas que un vacio. Lo que no cambia va en un archivo corto; el estado se consulta.',
  array['get_contexto_sistema','cambios_de_sistema','v_cambios_recientes'],
  'sql', null);
select count(*) cambios from cambios_de_sistema;;
