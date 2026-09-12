-- ================================================================
-- PULSO DIARIO: interpretacion de ayer, por cuenta, con Gemini
-- ================================================================
-- Responde una pregunta: paso algo ayer que no pueda esperar al lunes?
-- Un parrafo por cuenta con nivel. Solo escala a Notion y mail si es critico.
-- El semanal lo lee como memoria de la semana: 7 filas, tamano constante.
create table if not exists pulso_diario (
  id bigserial primary key,
  account text not null,
  fecha date not null,                -- el dia analizado (ayer)
  nivel text not null check (nivel in ('normal','atencion','critico')),
  resumen text not null,              -- 3 a 5 lineas
  hallazgo_principal text,            -- una linea, o null si normal
  conecta_con text,                   -- referencia a un patron anterior, si lo hay
  tokens_in int, tokens_out int, costo_usd numeric(8,5),
  modelo text default 'gemini-3.8-flash',
  created_at timestamptz default now(),
  unique (account, fecha)
);
create index if not exists idx_pulso_acct_fecha on pulso_diario (account, fecha desc);
alter table pulso_diario enable row level security;
revoke all on pulso_diario from anon, authenticated;
comment on table pulso_diario is 'Interpretacion diaria de Gemini por cuenta: que paso ayer y si puede esperar al lunes. nivel critico escala a Notion y mail; normal y atencion solo se muestran en la app. El semanal lee los 7 del periodo. Costo registrado por fila.';

-- Paquete de entrada para el pulso: todo lo que Gemini necesita en una llamada
create or replace function get_pulso_input(p_account text, p_fecha date default current_date - 1) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'cuenta', p_account, 'fecha_analizada', p_fecha,
    'serie_7d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'gasto', gasto, 'clics', clics, 'conv', conversiones, 'cpa', cpa, 'madurez', madurez) order by date), '[]')
                 from v_serie_diaria where account = p_account and date between p_fecha - 6 and p_fecha),
    'anomalias_2d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'sev', severidad, 'metrica', metrica_anomala, 'explicacion', explicacion)), '[]')
                     from v_anomalia_explicada where account = p_account and date between p_fecha - 1 and p_fecha),
    'conv_por_grupo_3d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'grupo', ad_group, 'conv', conv) order by date, ad_group), '[]')
                          from (select date, ad_group, sum(conversions) conv from v_conversiones_por_grupo where account = p_account and date between p_fecha - 2 and p_fecha group by 1, 2) g),
    'grupos_ayer', (select coalesce(jsonb_agg(jsonb_build_object('grupo', ad_group, 'clics', clicks, 'gasto', round(cost, 2), 'conv', conversions) order by cost desc), '[]')
                    from adgroup_daily where account = p_account and date = p_fecha and cost > 0),
    'cambios_detectados', (select coalesce(jsonb_agg(jsonb_build_object('entidad', entity_name, 'tipo', entity_type, 'campos', campos_cambiados)), '[]')
                           from v_cambios_detectados where account = p_account and detectado_hasta >= p_fecha),
    'operator_log_2d', (select coalesce(jsonb_agg(jsonb_build_object('d', fecha, 'que', left(que_cambio, 200), 'donde', donde) order by fecha desc), '[]')
                        from operator_log where account = p_account and fecha >= p_fecha - 1),
    'cambios_google_ayer', (select coalesce(jsonb_agg(jsonb_build_object('entidad', entity_name, 'tipo', event_type, 'quien', user_email)), '[]')
                            from google_live_events where account = p_account and event_type in ('USER_CHANGE','AUTO_CHANGE') and event_date::date = p_fecha),
    'terminos_nuevos_con_gasto', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'kw', keyword_disparadora, 'grupo', ad_group, 'gasto', gasto_acumulado, 'conv', conversiones_acumuladas) order by gasto_acumulado desc), '[]')
                                  from (select * from v_terminos_nuevos where account = p_account and primera_aparicion = p_fecha and gasto_acumulado > 0 limit 10) t),
    'pulsos_previos_3d', (select coalesce(jsonb_agg(jsonb_build_object('d', fecha, 'nivel', nivel, 'hallazgo', hallazgo_principal) order by fecha desc), '[]')
                          from pulso_diario where account = p_account and fecha between p_fecha - 3 and p_fecha - 1),
    'reflexiones_recientes', (select coalesce(jsonb_agg(que_haria_distinto order by run_date desc), '[]')
                              from (select que_haria_distinto, run_date from reflexiones where account = p_account order by run_date desc limit 5) r),
    'hipotesis_abiertas', (select left(hipotesis_abiertas, 800) from doc_maestro_consolidado where account = p_account),
    'objetivos', (select jsonb_build_object('cpa_max', cpa_maximo, 'conv_mes', conversiones_mes_objetivo, 'provisional', cpa_maximo_origen = 'historico') from account_targets where account = p_account)
  );
$$;
comment on function get_pulso_input is 'Paquete de entrada para el pulso diario de Gemini: todo lo relevante de ayer en un JSON de ~4-5k tokens. Una llamada, tamano constante.';

select pg_size_pretty(octet_length(get_pulso_input('KAREDO')::text)::bigint) as tamano_karedo, pg_size_pretty(octet_length(get_pulso_input('BHI')::text)::bigint) as tamano_bhi;;
