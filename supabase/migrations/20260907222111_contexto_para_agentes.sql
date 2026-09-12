-- ============================================================
-- CONTEXTO VIVO PARA CUALQUIER CHAT
-- ============================================================
-- El problema: un documento escrito a mano envejece en una semana. Hoy mismo
-- pasaron tres casos: cuentas cableadas en seis lugares, el titulo de accionables
-- que nunca se leia, la fecha de espera que no retenia nada.
--
-- Y un documento autogenerado gigante tampoco sirve: un estudio de ETH Zurich
-- midio que bajan la tasa de exito en 5 de 8 escenarios, porque una referencia
-- estructural vieja ENGANA mas de lo que un vacio confunde.
--
-- La salida: separar por volatilidad. Lo que no cambia (reglas, restricciones de
-- negocio) va escrito a mano y corto. Lo que cambia todos los dias NO va en un
-- archivo: se consulta. Esta funcion es esa consulta.
-- ============================================================
create or replace function get_contexto_sistema(p_cuenta text default null) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
select jsonb_build_object(
  'al', now(),
  'como_usar_esto', 'Estado vivo del sistema, generado al momento. No lo copies a un archivo: se consulta cada vez porque cambia todos los dias. Las reglas que NO cambian estan en el conocimiento del proyecto.',

  'salud', get_salud_sistema(),

  'cuentas', (select coalesce(jsonb_agg(jsonb_build_object(
      'account', c.account, 'cliente', c.nombre_cliente, 'moneda', c.moneda,
      'perfil', c.perfil_analisis, 'cid', c.cid,
      'paquete_a_usar', case when c.perfil_analisis = 'cadena' then 'get_weekly_package_cadena' else 'get_weekly_package' end,
      'reglas_propias', c.reglas_dominio,
      'semanas_de_historia', (select count(distinct week_start) from campaign w where w.account = c.account),
      'ultima_semana', (select max(week_start) from campaign w where w.account = c.account),
      'accionables_abiertos', (select count(*) from accionables_espejo a where a.account = c.account and a.estado in ('Propuesto','Bloqueado','Aprobado','En curso'))
    ) order by c.account), '[]') from cuentas c where c.activa),

  'que_puede_ejecutar_un_script', (select jsonb_build_object(
      'ejecutables', (select jsonb_agg(jsonb_build_object('verbo', verbo, 'riesgo', riesgo, 'requiere', requiere) order by riesgo, verbo) from capacidades_ejecucion where ejecutable),
      'no_ejecutables', (select jsonb_agg(jsonb_build_object('verbo', verbo, 'por_que', por_que_no) order by verbo) from capacidades_ejecucion where not ejecutable),
      'regla', 'Si el verbo es ejecutable, el accionable DEBE llevar Accion JSON. Si no lo lleva, el "por que" tiene que decir por que no.')),

  'guardarrailes', jsonb_build_object(
    'prevuelo', 'prevuelo(notion_id) antes de encolar. Bloquea por conflictos, por parametros.no_ejecutar_antes_de, por un cambio estructural sobre la misma campana en 3 dias, y por invariantes.',
    'invariantes', 'verificar_invariantes(cuenta, accion). I0 protege el nucleo del negocio y es la que mas bloquea.',
    'redundancia', 'corrida_redundante(cuenta) antes de analizar. Copiar marcadores_para_la_proxima en run_quality al terminar, si no la proxima corrida cree que todo es nuevo.',
    'mensual', 'mensual_puede_correr() exige que todas las semanales hayan corrido antes.'),

  'donde_esta_cada_cosa', jsonb_build_object(
    'estado_de_una_cuenta', 'get_estado_cuenta(cuenta)',
    'paquete_semanal', 'get_weekly_package(cuenta) o get_weekly_package_cadena(cuenta) segun el perfil',
    'doc_maestro', 'get_doc_maestro(cuenta) o la tabla doc_maestro_humano',
    'accionables', 'accionables_espejo, sincronizado desde Notion cada 30 minutos',
    'que_paso_con_un_cambio', 'operator_log y v_impacto_accionables',
    'lecciones', 'tabla lecciones, y memoria para busqueda semantica',
    'tareas_caidas', 'v_tareas_en_silencio',
    'respaldo_del_esquema', '/api/respaldo en la app'),

  'aprendido_hasta_ahora', (select coalesce(jsonb_agg(jsonb_build_object(
      'leccion', left(l.leccion, 400), 'cuando', l.fecha, 'confianza', l.confianza) order by l.confianza desc nulls last, l.fecha desc), '[]')
    from lecciones l where l.tipo in ('error','omision') and coalesce(l.confianza, 0) >= 0.8
      and (p_cuenta is null or l.account is null or l.account = p_cuenta) limit 12),

  'tickets_abiertos', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'cuenta', t.cuenta, 'titulo', t.titulo) order by t.id), '[]')
    from tickets t where t.estado = 'abierto' and (p_cuenta is null or t.cuenta = p_cuenta)),

  'detalle_de_cuenta', case when p_cuenta is null then null else jsonb_build_object(
      'estado', get_estado_cuenta(p_cuenta),
      'doc_maestro', (select jsonb_object_agg(seccion, left(contenido, 1500)) from doc_maestro_humano where account = p_cuenta and vigente),
      'accionables', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'estado', estado, 'prioridad', prioridad, 'ejecutable', accion_valida) order by prioridad), '[]')
                      from accionables_espejo where account = p_cuenta and estado in ('Propuesto','Bloqueado','Aprobado','En curso'))) end
);
$$;
comment on function get_contexto_sistema is 'Estado vivo del sistema para cualquier chat que empiece de cero. Se consulta, no se copia a un archivo: un documento de contexto viejo enganna mas que un vacio. Sin argumento da el panorama; con una cuenta agrega su detalle.';
select round(octet_length((get_contexto_sistema())::text)/1024.0) kb_general,
       round(octet_length((get_contexto_sistema('FRESH_MONKEE'))::text)/1024.0) kb_con_cuenta;;
