-- 1. Todas las vistas de public a security_invoker: usan los permisos de quien
--    consulta (siempre service_role). Mismo comportamiento, sin el ERROR del advisor.
do $$
declare v record;
begin
  for v in select table_name from information_schema.views where table_schema = 'public' loop
    execute format('alter view public.%I set (security_invoker = on)', v.table_name);
  end loop;
end $$;

-- 2. testeabilidad con search_path fijo
alter function testeabilidad(numeric, int, numeric) set search_path = public, pg_temp;

-- 3. fuzzystrmatch a extensions
create schema if not exists extensions;
alter extension fuzzystrmatch set schema extensions;

-- Verificar que v_fuzzy_negatives sigue funcionando
select count(*) as filas_fuzzy from v_fuzzy_negatives;;
