-- ============================================================
-- CUARENTENA · que un registro escrito con datos falsos no se propague
-- ============================================================
-- El problema: un brief escrito sobre un numero equivocado no desaparece cuando
-- el numero se corrige. Queda ahi, y la proxima corrida lo lee como base.
--
-- Por que NO se resuelve avisando en el prompt: decirle a un agente "algunas
-- cosas del pasado pueden estar mal" no lo hace mas cuidadoso, lo hace
-- desconfiar de todo. Un agente que duda de su propia memoria vuelve a
-- investigar lo ya resuelto y pierde la corrida.
--
-- Se resuelve en el dato: el registro contaminado se marca, y las funciones que
-- alimentan a los agentes lo saltean. El agente no se entera de que existio, que
-- es exactamente lo que hay que lograr.
-- ============================================================
create table if not exists cuarentena (
  id bigserial primary key,
  tabla text not null,
  registro_id text not null,
  cuenta text,
  por_que text not null,              -- que dato falso contiene
  reemplazado_por text,               -- donde esta la version correcta, si existe
  puesto_el timestamptz default now(),
  unique (tabla, registro_id)
);
alter table cuarentena enable row level security; revoke all on cuarentena from anon, authenticated;
comment on table cuarentena is 'Registros escritos sobre datos que despues resultaron falsos. Las funciones que alimentan a los agentes los saltean, para que un error corregido no se propague por la memoria. No se borran: quedan para auditoria.';

create or replace function en_cuarentena(p_tabla text, p_id text) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from cuarentena where tabla = p_tabla and registro_id = p_id);
$$;

create or replace function poner_en_cuarentena(p_tabla text, p_id text, p_por_que text,
  p_cuenta text default null, p_reemplazado_por text default null) returns bigint
language sql security definer set search_path = public, pg_temp as $$
  insert into cuarentena (tabla, registro_id, cuenta, por_que, reemplazado_por)
  values (p_tabla, p_id, p_cuenta, p_por_que, p_reemplazado_por)
  on conflict (tabla, registro_id) do update set por_que = excluded.por_que,
    reemplazado_por = excluded.reemplazado_por
  returning id;
$$;
revoke execute on function poner_en_cuarentena from anon, authenticated;

-- Lo que un agente ve: las capas de conocimiento ya filtradas
create or replace view v_lecciones_vigentes with (security_invoker = true) as
select l.* from lecciones l where not en_cuarentena('lecciones', l.id::text);

create or replace view v_memoria_vigente with (security_invoker = true) as
select m.* from memoria m where not en_cuarentena('memoria', m.id::text);

create or replace view v_reflexiones_vigentes with (security_invoker = true) as
select r.* from reflexiones r where not en_cuarentena('reflexiones', r.id::text);

-- Y que se vea cuanto hay en cuarentena, para que no se acumule en silencio
create or replace view v_cuarentena_resumen with (security_invoker = true) as
select tabla, coalesce(cuenta,'(todas)') cuenta, count(*) registros,
  max(puesto_el) ultimo,
  string_agg(distinct left(por_que, 70), ' | ') motivos
from cuarentena group by 1, 2;

select 1;;
