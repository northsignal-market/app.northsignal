-- v_umbrales_inconsistentes devolvia 16 hallazgos y no la miraba nadie: no estaba en
-- v_salud_sistema. Un chequeo que existe y no se lee es el mismo problema que un chequeo
-- que no puede fallar, con un paso mas.
create or replace view public.v_salud_sistema as
 with x as (
  select 'integridad'::text as area, prueba, cuenta, estado, detalle
    from auditar_integridad() auditar_integridad(prueba, cuenta, estado, detalle)
  union all
  select 'integridad', 'primarias_solapadas', v.account, 'FALLA',
         'Doble conteo posible en ' || v.campanas_afectadas || ' campana(s) de esta cuenta, factor hasta ' ||
         v.factor_de_inflado || 'x. NO es el CPA de la cuenta entera: ' || left(v.lectura, 260)
    from v_primarias_solapadas v where v.factor_de_inflado > 1.2
  union all
  select 'integridad', 'ventana_truncada', v_ventana_real.account, 'ATENCION', v_ventana_real.lectura
    from v_ventana_real where v_ventana_real.dias_en_30d < 25
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
  -- NUEVO 8 sep 2026: umbrales que un script no declara, tiene en cero, o divergen del
  -- valor canonico. NO DECLARA es ATENCION y no FALLA: no significa que el umbral este
  -- mal, significa que no se puede saber, que es distinto y hay que decirlo distinto.
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

-- Los tickets de extraccion: la mitad de base ya esta hecha, falta desplegar el script.
-- Dejarlos como estaban haria que la proxima corrida los lea como si no se hubiera tocado nada.
update public.tickets set respuesta =
 'PARCIAL 8 sep 2026. Lado Supabase HECHO: se recreo uq_keywords_daily sin keyword_status y se deduplicaron las 26 filas afectadas (KAREDO paso de 2.449,42 a 2.113,50 EUR, -13,7%). Cero duplicados al cerrar. FALTA: desplegar northsignal_diario v5, que saca keyword_status de CONFLICT_KEYS. Hasta que se despliegue, cada corrida vuelve a duplicar al cambiar un estado.'
 where id = 29 and estado = 'abierto';

update public.tickets set respuesta =
 'PARCIAL 8 sep 2026. Lado Supabase HECHO: existe uq_change_events (account, change_datetime, resource_name, changed_field) para poder hacer upsert. Causa raiz confirmada: pushToSupabase del semanal acotaba el DELETE a la semana solo si la tabla tenia columna week_start, y change_events no la tiene, asi que borraba la cuenta entera. FALTA: desplegar northsignal_semanal v11, que hace upsert, amplia la ventana a 30 dias y corta la corrida si una tabla no declara su politica de escritura.'
 where id in (32, 42) and estado = 'abierto';

update public.tickets set respuesta =
 'PARCIAL 8 sep 2026. FALTA solo desplegar northsignal_diario v5, que agrega el bloque de ad_group a extractConfigSnapshot. Trampa ya resuelta en el codigo: entity_name va como "campana :: grupo", porque la clave unica es (account, snapshot_date, entity_type, entity_name) y el mismo nombre de grupo existe en 21 campanas de FRESH_MONKEE.'
 where id = 30 and estado = 'abierto';;
