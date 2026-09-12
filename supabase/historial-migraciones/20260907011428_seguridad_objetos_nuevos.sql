-- Vistas nuevas a security_invoker
alter view v_leading_indicators_diarios set (security_invoker = true);
alter view v_correlacion_leading_lagging set (security_invoker = true);
alter view v_alertas_abiertas set (security_invoker = true);
alter view v_memoria_pendiente set (security_invoker = true);
alter view v_calibracion set (security_invoker = true);
alter view v_calibracion_global set (security_invoker = true);
alter view v_acierto_por_tipo set (security_invoker = true);
alter view v_por_que_limitada set (security_invoker = true);
alter view v_brecha_objetivo set (security_invoker = true);
alter view v_acciones_pendientes set (security_invoker = true);
alter view v_accionables_invalidos set (security_invoker = true);
alter view v_accionable_relaciones set (security_invoker = true);
alter view v_respaldos_pg_net set (security_invoker = true);
-- Funciones inmutables con search_path fijo
alter function plan_valido(jsonb, jsonb) set search_path = public, pg_temp;
alter function entidad_especifica(text) set search_path = public, pg_temp;
alter function negativa_bloquea(text, text, text) set search_path = public, extensions, pg_temp;
-- Funciones que solo debe llamar pg_cron o el server (service_role): fuera de la API anon/authenticated
revoke execute on function evaluar_predicciones() from anon, authenticated, public;
revoke execute on function memoria_ingestar() from anon, authenticated, public;
revoke execute on function terminos_protegidos_actualizar() from anon, authenticated, public;
revoke execute on function detectar_conflictos() from anon, authenticated, public;
revoke execute on function detectar_cambios_no_informados() from anon, authenticated, public;
revoke execute on function disparar_pulso_respaldo() from anon, authenticated, public;
revoke execute on function reconciliar() from anon, authenticated, public;
revoke execute on function alerta_registrar(text, text, text, text, text, text, text, text, date) from anon, authenticated, public;
select 'seguridad cerrada';;
