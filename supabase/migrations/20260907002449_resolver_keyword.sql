-- Dada una keyword (texto) y una pista (grupo, campaña, lo que haya), devuelve donde vive con nombres exactos.
-- Si el mismo texto existe en varios grupos, gana el que aparece en la pista; si no, el de mas gasto.
create or replace function resolver_keyword(p_account text, p_keyword text, p_pista text default '') returns jsonb
language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  with k as (
    select campaign, ad_group, match_type, keyword, cost
    from keywords where account = p_account and week_start = (select max(week_start) from keywords where account = p_account)
      and keyword_status = 'ENABLED'
      and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(regexp_replace(p_keyword, '^[\[\"]+|[\]\"]+$', '', 'g'))
  )
  select jsonb_build_object('campana', campaign, 'grupo', ad_group, 'match_type', match_type, 'keyword', keyword)
  from k order by (case when normalizar_entidad(p_pista) like '%' || normalizar_entidad(ad_group) || '%' then 0 else 1 end), cost desc nulls last limit 1;
$$;
revoke execute on function resolver_keyword from anon, authenticated, public;
-- Marcar la fallida y probar
update acciones_aprobadas set estado = 'revertida', resultado = resultado || ' [entidad mal parseada; corregido con resolver_keyword]' where id = 1;
select resolver_keyword('KAREDO', 'berufsbetreuer software vergleich', 'Vergleich') as resuelto;;
