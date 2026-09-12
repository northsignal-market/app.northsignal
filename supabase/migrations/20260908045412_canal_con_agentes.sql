-- ============================================================
-- CANAL ENTRE ANDRES Y LOS AGENTES
-- ============================================================
-- Hoy Andres le pregunta algo al asistente y esa conversacion muere ahi. Si
-- pregunta "por que 360 no escala", el agente semanal del lunes no se entera de
-- que eso le preocupa, y vuelve a analizar lo mismo de siempre.
--
-- Esta tabla es el canal: el asistente deja nota, el agente la lee en su proxima
-- corrida y responde en el brief. No es un chat: es contexto que viaja.
-- ============================================================
create table if not exists notas_para_agentes (
  id bigserial primary key,
  creada timestamptz default now(),
  account text,                    -- null si es del sistema entero
  para text not null default 'semanal'
    check (para in ('semanal','pulso','mensual','cualquiera')),
  de text not null default 'asistente',
  tipo text not null default 'pregunta'
    check (tipo in ('pregunta','instruccion','contexto','correccion')),
  contenido text not null,
  atendida_el timestamptz,
  atendida_por text,
  respuesta text
);
alter table notas_para_agentes enable row level security;
revoke all on notas_para_agentes from anon, authenticated;
comment on table notas_para_agentes is 'Lo que Andres le pregunto o indico al asistente y que un agente tiene que saber en su proxima corrida. Sin esto una conversacion con el asistente muere ahi y el agente del lunes vuelve a analizar lo de siempre.';
create index if not exists ix_notas_agentes_pendientes on notas_para_agentes (account, para) where atendida_el is null;

create or replace function dejar_nota_para_agente(
  p_contenido text, p_account text default null, p_para text default 'semanal',
  p_tipo text default 'pregunta') returns bigint
language sql security definer set search_path = public, pg_temp as $$
  insert into notas_para_agentes (account, para, tipo, contenido)
  values (p_account, p_para, p_tipo, p_contenido) returning id;
$$;
revoke execute on function dejar_nota_para_agente from anon, authenticated;

create or replace function atender_nota(p_id bigint, p_por text, p_respuesta text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update notas_para_agentes set atendida_el = now(), atendida_por = p_por, respuesta = p_respuesta where id = p_id;
$$;
revoke execute on function atender_nota from anon, authenticated;

create or replace view v_notas_pendientes with (security_invoker = true) as
select id, creada, coalesce(account, '(sistema)') cuenta, para, tipo, contenido,
  round(extract(epoch from (now() - creada)) / 86400.0, 1) dias_esperando
from notas_para_agentes where atendida_el is null order by creada;

select 1;;
