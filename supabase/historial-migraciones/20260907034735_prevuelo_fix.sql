create or replace function prevuelo(p_notion_id text) returns text language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare rel text; inv jsonb; acc record; motivos text[] := '{}'; det text;
begin
  select string_agg(motivo, ' | ') into rel from accionable_relaciones where not resuelta and severidad = 'bloquea' and (a = p_notion_id or b = p_notion_id);
  if rel is not null then motivos := motivos || rel; end if;
  select account, accion into acc from accionables_espejo where notion_id = p_notion_id;
  if acc.accion is not null then
    inv := verificar_invariantes(acc.account, acc.accion);
    for det in select e->>'detalle' from jsonb_array_elements(inv) e where (e->>'bloquea')::boolean loop
      motivos := motivos || det;
    end loop;
  end if;
  return nullif(array_to_string(motivos, ' | '), '');
end $$;
select a.id, a.tipo, a.keyword, coalesce(array_length(a.keywords, 1), 0) n_lote, prevuelo(a.notion_id) bloqueo from acciones_aprobadas a where a.estado = 'pendiente' order by a.id;;
