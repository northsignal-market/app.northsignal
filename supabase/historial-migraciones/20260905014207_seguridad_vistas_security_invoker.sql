-- Las vistas en Postgres son SECURITY DEFINER por defecto: corren con los
-- permisos de quien las creo y saltean el RLS de las tablas base. Como el rol
-- anon tiene SELECT sobre las vistas, cualquiera con la clave anonima podia
-- leer los datos de los tres clientes.
-- security_invoker = on hace que la vista respete el RLS de las tablas base.
-- El service_role sigue funcionando porque bypasea RLS por definicion.
do $$
declare v record;
begin
  for v in
    select table_name from information_schema.views where table_schema = 'public'
  loop
    execute format('alter view public.%I set (security_invoker = on)', v.table_name);
  end loop;
end $$;

-- search_path fijo en las funciones, para que no dependa del rol que las llama
alter function public.get_view_totals(text, text, date) set search_path = public, pg_temp;
alter function public.get_weekly_package(text) set search_path = public, pg_temp;

-- Los triggers de realtime no deben poder invocarse como RPC desde el exterior
revoke execute on function public.handle_pending_mutations_realtime() from anon, authenticated;
revoke execute on function public.handle_true_roas_realtime() from anon, authenticated;;
