-- Ticket 49: prevuelo() junta solo las invariantes que bloquean; las de aviso
-- (bloquea=false: I2b_protegido_en_otro_alcance, I4_concordancia, I5_presupuesto,
-- I6_estructural_reciente...) no aparecian en ningun lado del camino del boton.
-- Esta funcion las devuelve para que el server las muestre ANTES de aprobar
-- (en /contexto) y las adjunte al aprobar. No bloquea nada: informa.
create or replace function public.prevuelo_avisos(p_notion_id text)
returns text[]
language plpgsql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare acc record; inv jsonb; det text; avisos text[] := '{}'; rel text;
begin
  select string_agg(motivo, ' | ') into rel from accionable_relaciones
  where not resuelta and severidad <> 'bloquea' and (a = p_notion_id or b = p_notion_id);
  if rel is not null then avisos := avisos || rel; end if;
  select account, accion into acc from accionables_espejo where notion_id = p_notion_id;
  if acc.accion is not null then
    inv := verificar_invariantes(acc.account, acc.accion);
    for det in
      select coalesce(e->>'invariante', 'aviso') || ' · ' || (e->>'detalle')
      from jsonb_array_elements(inv) e
      where not coalesce((e->>'bloquea')::boolean, false)
        and coalesce(e->>'detalle', '') <> ''
    loop
      avisos := avisos || det;
    end loop;
  end if;
  return avisos;
end $function$;

revoke execute on function public.prevuelo_avisos(text) from public, anon, authenticated;
grant execute on function public.prevuelo_avisos(text) to service_role;
