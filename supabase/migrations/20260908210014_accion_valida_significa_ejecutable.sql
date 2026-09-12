-- accion_valida solo decia "el JSON parsea". Una pregunta a Andres tiene JSON perfectamente
-- valido. La app usa esa columna para decidir si muestra el boton de ejecutar, asi que
-- ofrecia 17 botones de los cuales 14 devolvian 400 al apretarlos.
-- fix-v83 ya lo habia corregido en la Bandeja y en el correo, pero la COLUMNA siguio
-- mintiendo, asi que cualquier superficie nueva que la lea vuelve a caer. Se arregla donde
-- deja de poder repetirse: en la base, no en cada pantalla.
-- Nota: capacidades_ejecucion.plataforma es el enum plataforma_pub, no text.

create or replace function public.marcar_ejecutabilidad_real()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare v text; plat plataforma_pub; ejec boolean; motivo text; hay boolean;
begin
  if new.accion is null then
    new.accion_valida := false;
    new.accion_error  := coalesce(new.accion_error,
      'Sin Accion JSON. No es un error si el verbo no es ejecutable: una pregunta no lleva JSON.');
    return new;
  end if;

  v := new.accion->>'verbo';
  if v is null or v = '' then
    new.accion_valida := false;
    new.accion_error  := 'El JSON no declara verbo.';
    return new;
  end if;

  begin
    plat := coalesce(new.accion->>'plataforma', 'google')::plataforma_pub;
  exception when others then
    plat := 'google'::plataforma_pub;
  end;

  select true, c.ejecutable, c.por_que_no into hay, ejec, motivo
    from capacidades_ejecucion c
   where c.verbo = v and c.plataforma = plat
   limit 1;

  if not coalesce(hay, false) then
    new.accion_valida := false;
    new.accion_error  := 'Verbo desconocido: "' || v || '". Los validos estan en capacidades_ejecucion.';
  elsif not coalesce(ejec, false) then
    -- El JSON puede estar impecable. Igual no es un clic.
    new.accion_valida := false;
    new.accion_error  := 'No ejecutable por script: ' || coalesce(motivo, 'sin motivo registrado') ||
                         ' Se hace a mano con los pasos de "Como hacerlo".';
  end if;
  return new;
end $$;

drop trigger if exists trg_ejecutabilidad_real on public.accionables_espejo;
create trigger trg_ejecutabilidad_real
  before insert or update on public.accionables_espejo
  for each row execute function public.marcar_ejecutabilidad_real();

comment on function public.marcar_ejecutabilidad_real() is
  'accion_valida significa "se puede ejecutar de un clic", no "el JSON parsea". Un accionable con JSON impecable y verbo preguntar_andres NO es valido para ejecutar, y el motivo queda en accion_error. Sin esto la app ofrece botones que el servidor rechaza.';

update public.accionables_espejo set accion_valida = accion_valida;;
