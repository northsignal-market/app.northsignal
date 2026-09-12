-- HALLAZGO 1, de los logs de Vercel: /api/respaldo devolvia 500 con
-- "permission denied for schema cron", tres veces hoy. Por eso el bloque de respaldo del
-- esquema no se renderizaba en Sistema: el fetch fallaba y el estado quedaba en null.
-- Yo lo habia llamado desde el MCP, que corre con otro rol, y por eso medi 159 ms y no vi
-- el error: probar una funcion con un rol distinto al que la usa no prueba nada.
-- volcar_crons lee el schema cron, que pg_cron reserva para postgres. Como es
-- SECURITY INVOKER, corre con el rol de quien llama. Pasa a DEFINER, que es dueno postgres.
alter function public.volcar_crons() security definer;
alter function public.volcar_crons() set search_path to 'public', 'cron', 'pg_temp';

comment on function public.volcar_crons() is
  'Vuelca las tareas programadas para el respaldo. SECURITY DEFINER a proposito: lee el schema cron, que pg_cron reserva para postgres, y la app llama con otro rol. Si vuelve a INVOKER, /api/respaldo devuelve 500 y el bloque de Sistema deja de renderizarse sin decir por que.';

-- HALLAZGO 2: 19 errores hoy, entre 17:27 y 20:14, en el deploy actual.
-- La app hace .eq('account', client) sobre v_cambios_recientes, que no tiene esa columna.
-- Los cambios de sistema son globales, no de una cuenta. Se expone la columna para que la
-- consulta deje de romper, y se marca explicito que null significa "toca a todo el sistema".
-- El arreglo del lado de la app (sacar el filtro) va en server.ts, porque si no la seccion
-- queda vacia en vez de rota, que es mejor pero sigue sin mostrar nada.
create or replace view public.v_cambios_recientes as
select c.cuando,
       c.que,
       c.por_que,
       c.objetos,
       c.version,
       c.revierte_como,
       -- null = cambio global del sistema. Existe para que un filtro por cuenta no rompa
       -- la consulta. No inventar una atribucion por cuenta que estos registros no tienen.
       null::text as account
  from (select cuando, que, por_que, objetos, version, revierte_como
          from v_cambios_recientes) c;

comment on view public.v_cambios_recientes is
  'Cambios de sistema de los ultimos dias. account es siempre null: estos cambios son globales y no pertenecen a una cuenta. La columna existe solo para que un filtro por cuenta devuelva vacio en vez de romper la consulta.';;
