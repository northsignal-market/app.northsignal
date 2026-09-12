alter table acciones_aprobadas add column if not exists nivel text;
alter table acciones_aprobadas add column if not exists estrategia_destino text;
alter table acciones_aprobadas add column if not exists valor_actual numeric;
alter table acciones_aprobadas add column if not exists valor_nuevo numeric;
alter table acciones_aprobadas add column if not exists etiqueta text;
comment on column acciones_aprobadas.valor_actual is 'Valor antes del cambio. Obligatorio en cambiar_presupuesto, cambiar_objetivo_puja y cambiar_cpc_keyword: sin el no se puede revertir.';

create or replace view v_acciones_pendientes with (security_invoker = true) as
select id, account, tipo, campana, grupo, keyword, match_type, ad_id, modo, match_type_destino, keywords,
  nivel, estrategia_destino, valor_actual, valor_nuevo, etiqueta
from acciones_aprobadas where estado = 'pendiente' order by aprobada_el;

-- El tipo se valida contra el registro de capacidades, con un trigger en vez de un CHECK
-- (un CHECK no puede consultar otra tabla). Asi, agregar un verbo ejecutable al registro
-- lo habilita en la cola sin tocar el esquema.
create or replace function accion_encolar_valida() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare cap record;
begin
  select * into cap from capacidades_ejecucion where verbo = new.tipo;
  if cap.verbo is null and new.tipo not in ('negativa_campana','negativa_grupo') then
    raise exception 'Verbo desconocido: %. Los verbos validos estan en capacidades_ejecucion', new.tipo;
  end if;
  if cap.verbo is not null and not cap.ejecutable then
    raise exception 'El verbo % no lo puede ejecutar un script: %', new.tipo, cap.por_que_no;
  end if;
  if new.tipo in ('cambiar_presupuesto','cambiar_objetivo_puja','cambiar_cpc_keyword') and new.valor_actual is null then
    raise exception 'La accion % necesita valor_actual: sin el valor anterior el cambio no se puede revertir', new.tipo;
  end if;
  if new.tipo = 'cambiar_estrategia_puja' and coalesce(new.estrategia_destino, '') = '' then
    raise exception 'cambiar_estrategia_puja necesita estrategia_destino';
  end if;
  return new;
end $$;
drop trigger if exists tg_accion_encolar_valida on acciones_aprobadas;
create trigger tg_accion_encolar_valida before insert on acciones_aprobadas for each row execute function accion_encolar_valida();
select count(*) verbos_ejecutables from capacidades_ejecucion where ejecutable;;
