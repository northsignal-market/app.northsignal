-- Todo el acceso legitimo (app en Vercel, scripts de Google, Make, Cowork)
-- usa service_role. anon y authenticated no deben poder ejecutar nada que
-- escriba o borre, ni leer vistas que bypassean RLS.

-- 1. Funciones que escriben o borran: solo service_role
revoke execute on function mantenimiento_semanal() from anon, authenticated, public;
revoke execute on function actualizar_win_rates() from anon, authenticated, public;
revoke execute on function actualizar_eventos_escalera() from anon, authenticated, public;
revoke execute on function handle_pending_mutations_realtime() from anon, authenticated, public;
revoke execute on function handle_true_roas_realtime() from anon, authenticated, public;
revoke execute on function limpiar_pulso_intradia() from anon, authenticated, public;

-- 2. Vistas: anon no lee nada. Con RLS sin policies en las tablas, las vistas
--    SECURITY DEFINER son la unica puerta para anon; se cierra.
do $$
declare v record;
begin
  for v in select table_name from information_schema.views where table_schema = 'public' loop
    execute format('revoke all on public.%I from anon', v.table_name);
  end loop;
end $$;

-- 3. Funciones de lectura que el script de Google llama con anonKey en el header
--    apikey pero serviceKey en Authorization: siguen funcionando porque la
--    autorizacion real es el Bearer. No hace falta grant a anon.

-- 4. Default para lo que se cree de ahora en adelante
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- 5. match_actionables: fijar search_path
do $$
begin
  execute 'alter function match_actionables set search_path = public, pg_temp';
exception when others then null;
end $$;

select 'acceso endurecido' as ok;;
