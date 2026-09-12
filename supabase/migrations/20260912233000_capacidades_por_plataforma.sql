-- El flujo de aprobar-ejecutar consultaba capacidades_ejecucion por verbo con
-- maybeSingle(), pero la tabla mezcla filas de Google Ads y de Meta sin columna
-- que las distinga: seis verbos estan duplicados (pausar_anuncio, pausar_campana,
-- reactivar_campana, cambiar_presupuesto, crear_anuncio, cambiar_conversion_primaria)
-- y la consulta devolvia error -> "Verbo desconocido" para verbos perfectamente
-- ejecutables. pausar_anuncio estaba roto en la app por esto.
-- Se agrega plataforma, se clasifican las filas de Meta por su forma (conjunto_id,
-- creatividad, campana_id) y un indice unico impide que el duplicado vuelva.

alter table public.capacidades_ejecucion
  add column if not exists plataforma plataforma_pub not null default 'google';

update public.capacidades_ejecucion set plataforma = 'meta'
where verbo in ('crear_conjunto', 'pausar_conjunto', 'subir_creatividad', 'editar_creatividad', 'crear_campana')
   or coalesce(requiere, '') ilike '%conjunto_id%'
   or (verbo = 'pausar_anuncio' and requiere = 'objeto.anuncio_id')
   or (verbo in ('pausar_campana', 'reactivar_campana') and requiere = 'objeto.campana_id')
   or (verbo = 'cambiar_conversion_primaria' and coalesce(por_que_no, '') ilike '%conjunto%');

-- Si despues de clasificar queda un duplicado dentro de una plataforma, la
-- migracion falla ACA con la lista, en vez de dejar que el indice explote sin contexto.
do $guarda$
declare v_dup text;
begin
  select string_agg(verbo || ' (' || plataforma || ' x' || n || ')', ', ')
  into v_dup
  from (select verbo, plataforma, count(*) as n from capacidades_ejecucion group by 1, 2 having count(*) > 1) d;
  if v_dup is not null then
    raise exception 'capacidades_ejecucion sigue con duplicados tras clasificar: %', v_dup;
  end if;
end $guarda$;

create unique index if not exists capacidades_ejecucion_verbo_plataforma_unico
  on public.capacidades_ejecucion (verbo, plataforma);
