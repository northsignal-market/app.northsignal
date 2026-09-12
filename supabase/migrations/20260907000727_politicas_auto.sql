-- Politicas de ejecucion automatica: que tipos se ejecutan sin pedir confirmacion, con que condiciones.
create table if not exists politicas_auto (
  tipo text primary key check (tipo in ('negativa_grupo','negativa_campana','pausar_keyword','pausar_anuncio')),
  activa boolean not null default false,
  modo text not null default 'simular' check (modo in ('simular','ejecutar')),
  confianza_min numeric not null default 0.8,      -- del hallazgo que lo origino (pulso) o 1 si es del semanal
  gasto_max numeric,                                 -- solo si la entidad gasto menos que esto en 14 dias (null = sin tope)
  solo_origen text[] default '{Semanal}',            -- que origenes habilita: Semanal, Pulso diario, Anomalias
  cuentas text[] default '{KAREDO,BHI,360}',
  nota text,
  actualizada timestamptz default now()
);
alter table politicas_auto enable row level security; revoke all on politicas_auto from anon, authenticated;
comment on table politicas_auto is 'Reglas para que el sistema ejecute sin preguntar. Solo negativas y pausas. Cada tipo tiene un interruptor, un modo (simular primero), confianza minima, tope de gasto de la entidad, origenes habilitados y cuentas. El interruptor general esta en ajustes_sistema.auto_ejecucion.';
insert into politicas_auto (tipo, activa, modo, confianza_min, gasto_max, solo_origen, nota) values
  ('negativa_grupo', false, 'simular', 0.8, null, '{Semanal}', 'Negativa a nivel de grupo. Reversible: se quita. Empezar en simular.'),
  ('negativa_campana', false, 'simular', 0.9, null, '{Semanal}', 'Negativa a nivel de campaña. Mas alcance: exigir mas confianza.'),
  ('pausar_keyword', false, 'simular', 0.85, 50, '{Semanal}', 'Pausar keyword. Tope de gasto: si gasto mas de esto en 14 dias, pedir confirmacion aunque la politica este activa.'),
  ('pausar_anuncio', false, 'simular', 0.9, null, '{Semanal}', 'Pausar anuncio. Solo si hay otro activo en el grupo.')
on conflict (tipo) do nothing;

create table if not exists ajustes_sistema (clave text primary key, valor jsonb not null, actualizado timestamptz default now());
alter table ajustes_sistema enable row level security; revoke all on ajustes_sistema from anon, authenticated;
insert into ajustes_sistema (clave, valor) values ('auto_ejecucion', '{"activa": false, "nota": "Interruptor general. Si esta en false, ninguna politica ejecuta aunque este activa."}') on conflict (clave) do nothing;

-- Evalua si un accionable cumple una politica activa. Devuelve el modo si aplica, null si no.
create or replace function politica_aplica(p_account text, p_tipo text, p_origen text, p_confianza numeric, p_entidad text) returns text
language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare pol politicas_auto; general boolean; gasto14 numeric;
begin
  select (valor->>'activa')::boolean into general from ajustes_sistema where clave = 'auto_ejecucion';
  if not coalesce(general, false) then return null; end if;
  select * into pol from politicas_auto where tipo = p_tipo and activa;
  if pol is null then return null; end if;
  if not (p_account = any(pol.cuentas)) then return null; end if;
  if not (coalesce(p_origen, 'Semanal') = any(pol.solo_origen)) then return null; end if;
  if coalesce(p_confianza, 1) < pol.confianza_min then return null; end if;
  if pol.gasto_max is not null and p_tipo = 'pausar_keyword' then
    select sum(cost) into gasto14 from keywords_daily where account = p_account and date >= current_date - 14 and normalizar_entidad(keyword) = normalizar_entidad(split_part(p_entidad, '|', 3));
    if coalesce(gasto14, 0) > pol.gasto_max then return null; end if;
  end if;
  return pol.modo;
end $$;
revoke execute on function politica_aplica from anon, authenticated, public;

-- Registro de lo que se auto-aprobo, para auditoria
alter table acciones_aprobadas add column if not exists por_politica boolean default false;
select 'ok';;
