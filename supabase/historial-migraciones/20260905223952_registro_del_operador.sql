-- ================================================================
-- REGISTRO DEL OPERADOR
-- ================================================================
-- El 5 de septiembre de 2026 la tarea semanal de BHI concluyo que existia
-- un feed de conversiones desconocido y que la extraccion estaba rota,
-- y lo escribio como hecho en dos accionables. La realidad: Andres habia
-- cambiado dos conversiones a secundarias a mano el sabado, y el parametro
-- Recuento estaba en "Todas". change_events no lo registro porque es de
-- alcance campana y esos cambios son de nivel cuenta.
--
-- El agente tenia un sensor que ningun query le da: el operador humano.
-- No lo uso porque no tenia canal. Esta tabla es el canal.
-- ================================================================
create table if not exists operator_log (
  id bigserial primary key,
  account text not null,
  fecha date not null default current_date,
  hora time default localtime,
  que_cambio text not null,
  donde text,                          -- 'conversiones', 'campana', 'presupuesto', 'negativas', 'landing', 'otro'
  valor_anterior text,
  valor_nuevo text,
  por_que text,
  accionable_notion_id text,           -- si responde a un accionable
  created_at timestamptz default now()
);
create index if not exists idx_operator_log_acct on operator_log (account, fecha desc);
alter table operator_log enable row level security;

comment on table operator_log is 'Cambios que Andres hace a mano en las cuentas y que change_events NO captura, porque ese log es de alcance campana y no ve configuracion de nivel cuenta: acciones de conversion, objetivos, recuento, ventanas de atribucion, importaciones. Es el sensor humano del sistema. TODA tarea de analisis lo lee ANTES de concluir que algo esta roto o que existe una fuente desconocida. "No hay registro de cambio" nunca significa "no hubo cambio": significa "no lo puedo confirmar por change_events".';

comment on column operator_log.donde is 'Ambito del cambio. Los de nivel cuenta (conversiones, objetivos, recuento, atribucion) son justamente los que change_events no ve.';


-- Vista unificada: todo lo que se movio, de cualquier fuente
create or replace view v_todos_los_cambios as
select account, fecha, hora,
       'operador' as fuente,
       coalesce(donde, 'sin ambito') as ambito,
       que_cambio as detalle,
       valor_anterior, valor_nuevo, por_que,
       false as automatico
from operator_log
union all
select account,
       substring(change_datetime from 1 for 10)::date,
       substring(change_datetime from 12 for 8)::time,
       'change_events',
       resource_type,
       coalesce(changed_field, '(campo no registrado)'),
       old_value, new_value, null,
       (client_type like '%RECOMMENDATION%' or client_type like '%GOOGLE_FIRST_PARTY%')
from change_events
where change_datetime is not null;

comment on view v_todos_los_cambios is 'Cambios de ambas fuentes en una sola lista: los que Google registro en change_events y los que Andres anoto en operator_log. Ordenar por fecha y hora. Si un cambio aparece solo en operator_log, es porque change_events no lo ve: eso es normal para configuracion de nivel cuenta.';


-- Cambios del operador sin registro en Google: son los que mas importan
-- porque son los que un analisis basado solo en change_events se pierde
create or replace view v_cambios_invisibles_para_google as
select o.*
from operator_log o
where not exists (
  select 1 from change_events c
  where c.account = o.account
    and substring(c.change_datetime from 1 for 10)::date = o.fecha
);

comment on view v_cambios_invisibles_para_google is 'Cambios que Andres registro y que change_events no tiene ese dia. Son exactamente los que producen discrepancias entre "lo que dice el registro" y "lo que muestra la pantalla". Antes de concluir que hay un bug o una fuente fantasma, mirar aca.';;
