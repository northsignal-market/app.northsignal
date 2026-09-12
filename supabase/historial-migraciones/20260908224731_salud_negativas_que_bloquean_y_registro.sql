-- Que la auditoria de negativas se lea sin ir a buscarla.
create or replace view public.v_salud_sistema as
 with x as (
  select 'integridad'::text as area, prueba, cuenta, estado, detalle
    from auditar_integridad() auditar_integridad(prueba, cuenta, estado, detalle)
  union all
  select 'integridad', 'primarias_solapadas', v.account, 'FALLA',
         'Doble conteo posible en ' || v.campanas_afectadas || ' campana(s), factor hasta ' ||
         v.factor_de_inflado || 'x. NO es el CPA de la cuenta entera: ' || left(v.lectura, 260)
    from v_primarias_solapadas v where v.factor_de_inflado > 1.2
  union all
  select 'integridad', 'ventana_truncada', v_ventana_real.account, 'ATENCION', v_ventana_real.lectura
    from v_ventana_real where v_ventana_real.dias_en_30d < 25
  union all
  -- NUEVO 8 sep 2026: negativas de campana que alcanzan terminos que convirtieron.
  select 'cuentas', 'negativa_bloquea_conversion', n.account, 'ATENCION',
         'Negativa de campana "' || n.negative_keyword || '" (' || n.match_type || ') alcanza ' ||
         n.conversiones_de_lo_bloqueado_90d || ' conversion(es) en ' || n.en_grupos ||
         '. Cruce por ILIKE, verificar en pantalla.'
    from v_negativas_que_bloquean n where n.conversiones_de_lo_bloqueado_90d >= 1
  union all
  select 'flujos', 'estado', f.cuentas,
         case when f.estado = any (array['CORTADO','NUNCA RECIBIO NADA']) then 'FALLA' else 'OK' end,
         f.flujo || ': ' || f.estado || '. ' || f.lectura
    from estado_de_los_flujos() f(flujo, cuentas, quien_escribe, estado, ultimo_dato, lectura)
  union all
  select 'scripts', 'umbral_inalcanzable', u.account, 'FALLA', u.umbral || ': ' || u.lectura
    from v_umbrales_alcanzables() u(account, umbral, valor, referencia, veredicto, lectura)
   where u.veredicto = any (array['IMPOSIBLE','APAGADO'])
  union all
  select 'scripts', 'umbral_no_auditable', i.account,
         case when i.veredicto in ('APAGADO','DIVERGE') then 'FALLA' else 'ATENCION' end,
         i.script || ' / ' || i.umbral || ' [' || i.veredicto || ']: ' || left(i.lectura, 200)
    from v_umbrales_inconsistentes i
  union all
  select 'cuenta', 'completitud', c.account, 'ATENCION', c.requisito || ': ' || c.detalle
    from v_cuentas_incompletas c
  union all
  select 'notion', 'vs_supabase', n.account, 'FALLA', n.lectura from v_notion_vs_supabase n
  union all
  select 'seguridad', 'intentos_sospechosos', s.clave, 'ATENCION', s.lectura from v_intentos_sospechosos s
  union all
  select 'tareas', 'en_silencio', t.tarea, 'FALLA', t.lectura from v_tareas_en_silencio t
  union all
  select 'objetos', 'vistas_y_funciones', '-',
         case when (a.vistas_falla + a.funciones_falla) > 0 then 'FALLA'
              when a.corrida_el < (now() - '36:00:00'::interval) then 'ATENCION' else 'OK' end,
         a.vistas_ok || ' vistas y ' || a.funciones_ok || ' llamadas responden'
    from auditoria_objetos_ultima a
  union all
  select 'objetos', 'documentadas_inexistentes', f.objeto, 'FALLA', f.lectura from v_notas_fantasma f
  union all
  select 'objetos', 'sin_documentar', '-', case when count(*) > 10 then 'ATENCION' else 'OK' end,
         count(*) || ' sin nota de ' || (select count(*) from diccionario_datos() d(capa, objeto, usar_para, cuidado))
    from v_objetos_sin_documentar
  union all
  select 'capacidades', 'registro_coherente', c.verbo, 'FALLA', c.problema
    from v_capacidades_coherentes_chk() c(verbo, problema)
  union all
  select 'notion', 'espejo_huerfano', e.account, 'FALLA', e.lectura from v_espejo_huerfano e
  union all
  select 'mapeo', 'campanas_sin_dim', d.account, 'FALLA', 'Campana fuera de campaign_dim: ' || d.campaign
    from v_campanas_sin_dim d
  union all
  select 'reportes', 'no_entregables', r.account, 'FALLA', r.lectura from v_reportes_no_entregables r
  union all
  select 'tareas', 'tickets_abiertos', coalesce(tickets.cuenta, '-'),
         case when count(*) > 12 then 'ATENCION' else 'OK' end, count(*) || ' ticket(s) abiertos'
    from tickets where tickets.estado = 'abierto' group by tickets.cuenta
 )
 select area, prueba, cuenta, estado, detalle from x
  order by (case estado when 'FALLA' then 1 when 'ATENCION' then 2 else 3 end), area, prueba;

insert into public.tickets (cuenta, tipo, titulo, descripcion, estado, creado_por) values
('360', 'bug',
 'Negativas de campana bloquean el grupo "Industry 2 - BTL y Stands" que deberia servirlas',
 'v_negativas_que_bloquean, 8 sep 2026: hay negativas a nivel CAMPANA en concordancia amplia para "stand", "stands", "feria" y "ferias" en Search | Chile | 360 Producciones 2026. El grupo "Industry 2 - BTL y Stands" existe para servir justo esas busquedas, y en 90 dias esos terminos convirtieron 5 veces con 6.203 CLP de gasto. La negativa de campana los apaga en todos los grupos, incluido el que se llama asi. Si hay que excluirlos en los otros grupos, van a nivel grupo, no de campana. Ojo: el cruce de la vista usa ILIKE y aproxima la concordancia de Google, asi que puede haber falsos positivos con negativas en amplia; verificar en pantalla antes de tocar.',
 'abierto', 'claude-revision'),
('BHI', 'bug',
 'La negativa de campana "viaje" en amplia alcanza 11.879 CLP con conversion en SEGURO SALUD INTERNACIONAL',
 'v_negativas_que_bloquean, 8 sep 2026. Mismo patron que "iclick travel": una negativa de campana con radio mayor que la evidencia que la motivo. Verificar en pantalla, el cruce es por ILIKE.',
 'abierto', 'claude-revision');

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Andres fue a ejecutar el accionable de quitar la negativa "iclick travel" en BHI y la base lo rechazo por una restriccion.',
 'Antes de arreglar la restriccion, mirar el accionable en si y medir si el patron se repite.',
 'Aparecieron dos bugs distintos. Uno: acciones_aprobadas_tipo_check aceptaba 5 tipos mientras capacidades_ejecucion declaraba 14 y el ejecutor implementaba 14, asi que nueve verbos no podian entrar a la cola aunque la app mostrara el boton. Dos, mas caro: el accionable proponia la negativa a nivel campana, y ese termino quema 14.667 CLP en un grupo y convierte 3 veces en otro de la misma campana. Ademas hay negativas ya puestas con el mismo defecto: en 360 el grupo se llama "BTL y Stands" y hay negativas de campana para stand, stands, feria y ferias.',
 'El radio de la accion tiene que ser el radio de la evidencia. Un veredicto calculado sobre un termino DENTRO de un grupo no autoriza una accion a nivel campana: el mismo termino puede comportarse al reves en el grupo de al lado. Vale para negativas y para cualquier accion cuyo alcance sea mayor que la unidad donde se midio. Y el nivel lo decide la evidencia, no quien aprieta el boton: si la vista puede calcular el nivel, el endpoint no deberia aceptar otro.',
 'error', 0.95, 1, 'claude');

select registrar_cambio(
 'El nivel de una negativa lo decide la evidencia, y el tipo de accion se valida contra capacidades',
 'Dos bugs encontrados al ejecutar un accionable real, no auditando. (1) acciones_aprobadas_tipo_check tenia 5 tipos cableados de cuando existian 5; capacidades_ejecucion declara 14 y el ejecutor v7 implementa 14, asi que nueve verbos rebotaban en la base despues de que la app mostrara el boton y el endpoint dijera que si. Se reemplazo por un trigger que valida contra capacidades_ejecucion, con los alias historicos negativa_campana y negativa_grupo: la lista deja de existir por duplicado. (2) El veredicto se calculaba por termino DENTRO de un grupo y la accion se proponia a nivel campana. "iclick travel" quema 14.667 CLP en SEGURO EN EL EXTRANJERO y convierte 3 veces en SEGURO SALUD INTERNACIONAL: una negativa de campana apaga las dos. v_terminos_sin_cobertura ahora devuelve nivel_recomendado y conflicto_entre_grupos, el endpoint rechaza el nivel campana cuando hay conflicto, y v_negativas_que_bloquean audita las que ya estan puestas. Encontro que en 360 hay negativas de campana para stand, stands, feria y ferias mientras el grupo se llama "Industry 2 - BTL y Stands".',
 array['acciones_aprobadas','v_terminos_sin_cobertura','v_negativas_que_bloquean','v_salud_sistema','capacidades_ejecucion'],
 'fix-v98',
 'El trigger de tipo se revierte recreando el CHECK anterior con los 5 valores, aunque eso vuelve a romper nueve verbos. Las vistas tienen su version previa en el historial de migraciones; las columnas nuevas van al final y no mueven las que ya se consumen.'
) as registro;;
