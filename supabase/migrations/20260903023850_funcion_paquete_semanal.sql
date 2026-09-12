create or replace function get_weekly_package(p_account text)
returns json
language sql
stable
as $$
  select json_build_object(
    'cuenta', p_account,
    'semana', (select max(week_start) from weekly_brief where account = p_account),
    'brief', (
      select coalesce(json_agg(json_build_object(
        'seccion', section, 'item', item, 'detalle', detail,
        'valor', value, 'previo', prev_value, 'delta', delta_pct, 'nota', note
      ) order by id), '[]'::json)
      from weekly_brief
      where account = p_account
        and week_start = (select max(week_start) from weekly_brief where account = p_account)
    ),
    'estado_cuenta', (
      select coalesce(json_agg(json_build_object(
        'seccion', section, 'item', item, 'valor', value, 'detalle', detail
      ) order by id), '[]'::json)
      from account_state where account = p_account
    ),
    'alertas_altas', (
      select coalesce(json_agg(json_build_object(
        'tipo', type, 'entidad', entity, 'detalle', detail,
        'valor', value, 'umbral', threshold
      )), '[]'::json)
      from alerts
      where account = p_account and severity = 'ALTA'
        and week_start = (select max(week_start) from alerts where account = p_account)
    ),
    'alertas_medias_conteo', (
      select count(*) from alerts
      where account = p_account and severity = 'MEDIA'
        and week_start = (select max(week_start) from alerts where account = p_account)
    ),
    'tendencia_8_semanas', (
      select coalesce(json_agg(json_build_object(
        'semana', week_start, 'gasto', gasto, 'conversiones', conversiones,
        'cpa', cpa, 'ctr', ctr_promedio, 'impr_share', impr_share_promedio,
        'perdido_presupuesto', perdido_presupuesto, 'perdido_ranking', perdido_ranking
      ) order by week_start desc), '[]'::json)
      from (
        select * from v_tendencia_semanal
        where account = p_account
        order by week_start desc limit 8
      ) t
    ),
    'keywords_atencion', (
      select coalesce(json_agg(json_build_object(
        'campana', campaign, 'grupo', ad_group, 'keyword', keyword,
        'concordancia', match_type, 'motivo', motivo, 'gasto', cost,
        'quality_score', quality_score
      )), '[]'::json)
      from v_keywords_atencion
      where account = p_account
        and week_start = (select max(week_start) from keywords where account = p_account)
    ),
    'cambios_semana', (
      select coalesce(json_agg(json_build_object(
        'fecha', change_datetime, 'usuario', user_email, 'origen', client_type,
        'recurso', resource_type, 'campo', changed_field,
        'antes', old_value, 'despues', new_value,
        'auto_aplicado', (client_type like '%RECOMMENDATION%')
      ) order by change_datetime desc), '[]'::json)
      from change_events where account = p_account
    )
  );
$$;

comment on function get_weekly_package(text) is
'Devuelve el paquete completo del analisis semanal en UNA sola llamada: brief pre-agregado, estado estructural de la cuenta, alertas altas con el conteo de medias, tendencia de 8 semanas, keywords que requieren atencion con su motivo, y cambios de la semana marcando los auto-aplicados por Google. Reemplaza cuatro o cinco consultas separadas. Uso: select get_weekly_package(''KAREDO'');';;
