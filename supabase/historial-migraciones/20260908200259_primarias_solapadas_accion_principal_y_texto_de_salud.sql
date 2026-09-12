-- Dos correcciones sobre el arreglo anterior.
-- 1. accion_principal traia la accion mas grande de TODA la cuenta. En FRESH_MONKEE eso
--    era "Segment: Order Completed", que justamente NO esta en las campanas afectadas.
--    Ahora sale la mas grande entre las campanas en juego.
-- 2. v_salud_sistema envolvia la fila con el texto "El CPA de esta cuenta esta inflado
--    Nx", que es la afirmacion que la vista dejo de hacer. Ahora usa la lectura propia.

create or replace view public.v_primarias_solapadas as
with reales as (
  select ca.account, ca.campaign, ca.conversion_action,
         round(sum(ca.conversions), 1) as conv_90d
    from conversion_actions ca
   where ca.week_start > current_date - 90 and ca.conversions > 0
   group by 1, 2, 3
),
por_campana as (
  select account, campaign, count(*) as acciones,
         round(sum(conv_90d), 1) as conv_camp,
         max(conv_90d) as conv_mayor_camp
    from reales group by 1, 2
),
afectadas as (select * from por_campana where acciones > 1),
limpias as (
  select account, round(sum(conv_camp), 1) as conv_limpias
    from por_campana where acciones = 1 group by 1
),
totales as (
  select account, round(sum(conv_camp), 1) as conv_total,
         round(sum(conv_mayor_camp), 1) as conv_mayor,
         count(*) as campanas_afectadas
    from afectadas group by 1
),
acc as (
  select a.account,
         count(distinct r.conversion_action) as acciones_con_conversiones,
         string_agg(distinct r.conversion_action, ', ' order by r.conversion_action) as acciones_en_juego
    from afectadas a
    join reales r on r.account = a.account and r.campaign = a.campaign
   group by a.account
),
mayor as (   -- la mas grande ENTRE LAS CAMPANAS AFECTADAS, no de toda la cuenta
  select distinct on (z.account) z.account, z.conversion_action
    from (select r.account, r.conversion_action, sum(r.conv_90d) c
            from reales r
            join afectadas a on a.account = r.account and a.campaign = r.campaign
           group by 1, 2) z
   order by z.account, z.c desc
),
declaradas as (
  select account,
         count(*) filter (where google_status = 'primaria') as primarias_declaradas,
         string_agg(stage_name, ', ') filter (where google_status = 'primaria') as cuales_declaradas,
         count(*) as filas_funnel
    from funnel_stages group by account
),
det as (
  select account, string_agg(x, ' | ' order by x) as detalle
    from (select a.account,
                 a.campaign || ': ' || string_agg(r.conversion_action || ' (' || r.conv_90d || ')', ' + ' order by r.conv_90d desc) as x
            from afectadas a
            join reales r on r.account = a.account and r.campaign = a.campaign
           group by a.account, a.campaign) z
   group by account
)
select acc.account,
       acc.acciones_con_conversiones,
       coalesce(d.primarias_declaradas, 0) as primarias_declaradas,
       d.cuales_declaradas,
       t.conv_total,
       m.conversion_action as accion_principal,
       t.conv_mayor as conv_de_la_principal,
       round(t.conv_total - t.conv_mayor, 1) as conv_que_podrian_ser_la_misma,
       round(t.conv_total / nullif(t.conv_mayor, 0), 2) as factor_de_inflado,
       det.detalle,
       case
         when coalesce(d.filas_funnel, 0) = 0 then
           'SIN DECLARAR: la cuenta no tiene ninguna fila en funnel_stages, asi que no se puede saber cuales acciones son etapas del mismo recorrido. Lo que SI se sabe: en ' ||
           t.campanas_afectadas || ' campana(s) conviven ' || acc.acciones_con_conversiones ||
           ' acciones que cuentan conversiones (' || acc.acciones_en_juego || ') y ahi el total puede estar inflado hasta ' ||
           round(t.conv_total / nullif(t.conv_mayor, 0), 2) || 'x. Las otras ' ||
           coalesce(l.conv_limpias, 0) || ' conversiones estan en campanas con una sola accion y NO estan en riesgo. ' ||
           'No desinflar el CPA de la cuenta entera con este factor: aplica solo a las campanas de detalle.'
         when acc.acciones_con_conversiones > coalesce(d.primarias_declaradas, 0) then
           'REVISAR: en ' || t.campanas_afectadas || ' campana(s) conviven ' || acc.acciones_con_conversiones ||
           ' acciones que cuentan conversiones y funnel_stages declara ' || coalesce(d.primarias_declaradas, 0) ||
           ' primaria(s). Si son etapas del mismo recorrido sobre el mismo clic, el total de esas campanas esta inflado hasta ' ||
           round(t.conv_total / nullif(t.conv_mayor, 0), 2) ||
           'x y el CPA publicado ahi es esa fraccion del real. Otras ' || coalesce(l.conv_limpias, 0) ||
           ' conversiones estan en campanas de una sola accion y no estan afectadas. Verificar en Google Ads cuales estan como primarias.'
         else
           'Multiples acciones declaradas conviviendo en la misma campana: verificar que midan hechos distintos y no etapas del mismo clic.'
       end as lectura,
       t.campanas_afectadas,
       coalesce(l.conv_limpias, 0) as conv_en_campanas_limpias,
       case when coalesce(d.filas_funnel, 0) = 0 then 'SIN DECLARAR'
            when acc.acciones_con_conversiones > coalesce(d.primarias_declaradas, 0) then 'REVISAR'
            else 'DECLARADO' end as veredicto
  from acc
  join totales t on t.account = acc.account
  left join declaradas d on d.account = acc.account
  left join limpias    l on l.account = acc.account
  left join mayor      m on m.account = acc.account
  left join det        on det.account = acc.account;

-- La salud dejaba de lado la lectura de la vista y afirmaba por su cuenta.
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
  order by (case estado when 'FALLA' then 1 when 'ATENCION' then 2 else 3 end), area, prueba;;
