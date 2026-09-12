alter table cuentas add column if not exists perfil_analisis text default 'negocio_unico'
  check (perfil_analisis in ('negocio_unico','cadena'));
update cuentas set perfil_analisis = 'cadena' where account = 'FRESH_MONKEE';
comment on column cuentas.perfil_analisis is 'negocio_unico: el paquete semanal lista campanas y keywords. cadena: el paquete va por objetivo y por local, con detalle solo de los locales que importan. Sin esto, 81 campanas producen un paquete de 132 KB que ningun modelo lee bien.';

-- Paquete jerarquico: tamano acotado pase lo que pase
create or replace function get_weekly_package_cadena(p_account text) returns jsonb
language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  rank4 as (select * from v_location_ranking_bayes(p_account, 4)),
  destacados as (
    select location from (
      select location, puesto, count(*) over (partition by objetivo) n from rank4 where evidencia <> 'poca: la estimacion es casi el promedio de la cuenta'
    ) x where puesto <= 5 or puesto > n - 5
  )
  select jsonb_build_object(
    'cuenta', p_account, 'perfil', 'cadena', 'semana', (select w from sem), 'armado', now(),
    'como_leer', 'Paquete jerarquico. Primero los objetivos, despues el ranking de locales ajustado por volumen, y solo el detalle de los locales que entran en las listas. Para cualquier otro local usa get_entidades o consulta la vista. Nunca cites el CPA crudo de un local: usa tasa_ajustada y evidencia.',

    'por_objetivo', (select coalesce(jsonb_agg(jsonb_build_object(
        'objetivo', o.objetivo, 'campanas', o.campanas, 'gasto', round(o.gasto, 2), 'conversiones', round(o.conversiones, 1),
        'cpa', round(o.cpa, 2), 'roas', round(o.roas, 2),
        'metrica_valida', (select metrica_principal from objetivos_conversion oc where oc.account = p_account and oc.objetivo = o.objetivo),
        'campanas_activas', (select count(*) from campaign_fechas f, lateral (select (resolver_campana(p_account, f.campaign))->>'objetivo' ob) r where f.account = p_account and r.ob = o.objetivo and f.estado_real = 'ENABLED')
      ) order by o.gasto desc), '[]')
      from v_por_objetivo_semanal o, sem where o.account = p_account and o.week_start = sem.w),

    'tendencia_por_objetivo', (select coalesce(jsonb_agg(t), '[]') from (
        select jsonb_build_object('objetivo', objetivo, 'semanas', jsonb_agg(jsonb_build_object('s', week_start, 'gasto', round(gasto), 'conv', round(conversiones, 1)) order by week_start)) t
        from v_por_objetivo_semanal where account = p_account and week_start >= (select w from sem) - 28 group by objetivo) x),

    'ranking_locales', (select coalesce(jsonb_agg(jsonb_build_object(
        'local', location, 'objetivo', objetivo, 'puesto', puesto, 'clics', clics, 'conv', conv, 'gasto', gasto,
        'tasa_cruda', tasa_cruda, 'tasa_ajustada', tasa_ajustada, 'cpa_ajustado', cpa_ajustado,
        'evidencia', evidencia, 'vs_mediana', vs_mediana, 'lectura', lectura) order by objetivo, puesto), '[]')
      from rank4),

    'detalle_locales_clave', (select coalesce(jsonb_object_agg(loc, det), '{}') from (
        select v.location loc, jsonb_build_object(
          'campanas', (select jsonb_agg(jsonb_build_object('campana', c.campaign, 'gasto', round(c.cost, 2), 'conv', round(c.conversions, 1), 'clics', c.clicks, 'estado', f.estado_real, 'fin', f.end_date))
                       from v_campana_resuelta c left join campaign_fechas f on f.account = p_account and f.campaign = c.campaign, sem
                       where c.account = p_account and c.week_start = sem.w and c.location = v.location and c.cost > 0),
          'keywords_top', (select jsonb_agg(jsonb_build_object('kw', k.keyword, 'mt', k.match_type, 'clics', k.clicks, 'conv', round(k.conversions, 1), 'gasto', round(k.cost, 2), 'qs', k.quality_score) order by k.cost desc)
                           from (select k.* from keywords k, sem where k.account = p_account and k.week_start = sem.w and k.cost > 0
                                 and (resolver_campana(p_account, k.campaign))->>'location' = v.location order by k.cost desc limit 12) k),
          'terminos_top', (select jsonb_agg(jsonb_build_object('t', s.search_term, 'clics', s.clicks, 'conv', round(s.conversions, 1), 'gasto', round(s.cost, 2)) order by s.cost desc)
                           from (select s.* from search_terms s, sem where s.account = p_account and s.week_start = sem.w and s.cost > 0
                                 and (resolver_campana(p_account, s.campaign))->>'location' = v.location order by s.cost desc limit 10) s)
        ) det
        from (select distinct location from destacados) v where v.location is not null) y),

    'transversal', jsonb_build_object(
      'keywords_en_muchos_locales', (select coalesce(jsonb_agg(jsonb_build_object('kw', kw, 'locales', n, 'gasto', gasto, 'conv', conv, 'cpa', cpa)), '[]') from (
          select k.keyword kw, count(distinct (resolver_campana(p_account, k.campaign))->>'location') n,
                 round(sum(k.cost), 2) gasto, round(sum(k.conversions), 1) conv, round(sum(k.cost)/nullif(sum(k.conversions),0), 2) cpa
          from keywords k, sem where k.account = p_account and k.week_start = sem.w and k.cost > 0
          group by 1 having count(distinct (resolver_campana(p_account, k.campaign))->>'location') >= 3 order by sum(k.cost) desc limit 15) z),
      'terminos_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'clics', clics, 'gasto', gasto)), '[]') from (
          select s.search_term, sum(s.clicks) clics, round(sum(s.cost), 2) gasto from search_terms s, sem
          where s.account = p_account and s.week_start = sem.w and s.cost > 0
            and not exists (select 1 from search_terms p where p.account = p_account and p.search_term = s.search_term and p.week_start < sem.w)
          group by 1 order by sum(s.cost) desc limit 15) z)),

    'campanas_terminadas', (select coalesce(jsonb_agg(jsonb_build_object('campana', campaign, 'fin', end_date, 'dias', current_date - end_date)), '[]')
      from campaign_fechas where account = p_account and estado_real = 'FINALIZADA'),
    'carteras_puja', (select coalesce(jsonb_agg(jsonb_build_object('grupo', grupo, 'campanas', campanas, 'conv', conv, 'tasa', tasa, 'cpa', cpa, 'veredicto', veredicto)), '[]') from v_carteras_puja(p_account, 4)),
    'estado_cuenta', get_estado_cuenta(p_account)
  );
$$;
select round(octet_length((get_weekly_package_cadena('FRESH_MONKEE'))::text)/1024.0) kb;;
