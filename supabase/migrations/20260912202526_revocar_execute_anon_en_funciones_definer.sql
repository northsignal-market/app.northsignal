-- Advisor de seguridad 12/9: 14 funciones SECURITY DEFINER ejecutables por anon/authenticated
-- via PostgREST. Son funciones internas (latidos, registro, cuarentena): cualquiera con la
-- anon key podia escribir latidos o registros falsos. Se revoca a public/anon/authenticated
-- (revocar solo anon no alcanza: hereda de PUBLIC) y se concede explicito a service_role,
-- que es el rol del servidor. Los crons corren como postgres (owner): no los toca.
do $$
declare f text;
begin
  foreach f in array array[
    'atender_nota(bigint, text, text)',
    'declarar_umbral(text, text, text, numeric)',
    'dejar_nota_para_agente(text, text, text, text)',
    'latir(text, boolean, text)',
    'limite_de_tasa(text, text, integer, interval)',
    'limpiar_intentos()',
    'marcar_grupo_leido(text, text, text, date)',
    'marcar_para_retiro(text, text, text, text, text, integer)',
    'poner_en_cuarentena(text, text, text, text, text)',
    'registrar_cambio(text, text, text[], text, text)',
    'registrar_intento(text, text, boolean, text)',
    'resolver_grupo_alertas(text, text, date)',
    'verificar_pulso_del_dia()',
    'volcar_crons()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
