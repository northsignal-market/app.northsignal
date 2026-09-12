-- acciones_aprobadas_tipo_check aceptaba 5 tipos, cableados cuando solo existian esos.
-- Hoy capacidades_ejecucion declara 14 verbos ejecutables para Google y el ejecutor v7
-- implementa los 14. La restriccion era la unica que no se entero.
--
-- Sintoma: la app muestra el boton (capacidades dice ejecutable), el endpoint deja pasar
-- (consulta capacidades), y Postgres rechaza el insert. Nueve verbos que el sistema
-- declara ejecutables no podian ni entrar a la cola: quitar_negativa, pausar_grupo,
-- pausar_campana, reactivar_campana, reactivar_keyword, cambiar_presupuesto,
-- cambiar_cpc_keyword, cambiar_estrategia_puja, cambiar_objetivo_puja.
--
-- Es la misma forma que venimos corrigiendo todo el dia: dos listas de lo mismo, una se
-- actualiza y la otra no. El arreglo no es agregar los nueve nombres a mano, porque
-- entonces habria que acordarse de nuevo la proxima vez. Es que la lista viva en un solo
-- lugar. Un CHECK no puede consultar otra tabla, asi que va un trigger.

alter table public.acciones_aprobadas drop constraint if exists acciones_aprobadas_tipo_check;

create or replace function public.validar_tipo_de_accion()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare v text; plat plataforma_pub; ok boolean;
begin
  -- Nombres historicos de la cola que no son verbos. Se mantienen porque el ejecutor
  -- los usa para saber a que nivel va la negativa; se traducen para validar.
  v := case new.tipo
         when 'negativa_campana' then 'agregar_negativa'
         when 'negativa_grupo'   then 'agregar_negativa'
         else new.tipo end;

  begin plat := coalesce(new.plataforma, 'google')::plataforma_pub;
  exception when others then plat := 'google'::plataforma_pub; end;

  select c.ejecutable into ok
    from capacidades_ejecucion c
   where c.verbo = v and c.plataforma = plat
   limit 1;

  if ok is null then
    raise exception 'Tipo de accion desconocido: "%". Los validos son los verbos de capacidades_ejecucion para la plataforma %, mas los alias historicos negativa_campana y negativa_grupo.', new.tipo, plat;
  end if;
  if not ok then
    raise exception 'El verbo "%" esta registrado como NO ejecutable por script en capacidades_ejecucion. No se encola: se hace a mano con los pasos de "Como hacerlo".', v;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_tipo_de_accion on public.acciones_aprobadas;
create trigger trg_validar_tipo_de_accion
  before insert or update of tipo on public.acciones_aprobadas
  for each row execute function public.validar_tipo_de_accion();

comment on function public.validar_tipo_de_accion() is
  'Valida acciones_aprobadas.tipo contra capacidades_ejecucion en vez de contra una lista cableada. Reemplaza a acciones_aprobadas_tipo_check, que aceptaba 5 tipos mientras capacidades declaraba 14 y el ejecutor implementaba 14: nueve verbos no podian entrar a la cola aunque la app mostrara el boton. Si se agrega un verbo a capacidades_ejecucion, la cola lo acepta sola.';;
