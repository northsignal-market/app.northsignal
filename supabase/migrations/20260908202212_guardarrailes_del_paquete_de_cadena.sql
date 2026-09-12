-- Hallazgo de la simulacion, 8 sep 2026.
-- Los tres guardarrailes construidos hoy contra las tres fallas que se publicaron
-- (ventana truncada, delta sobre base mixta, change_events congelada) se agregaron SOLO
-- a get_weekly_package. get_weekly_package_cadena no tenia ninguno.
-- Es la cuenta con 46 franquiciados y la ventana diaria MAS CORTA de las cuatro
-- (15 dias contra 17): la trampa de "30 dias" muerde mas fuerte justo donde el
-- guardarrail no llego. Misma forma que la leccion del dia: un arreglo aplicado a una
-- cuenta es una hipotesis sobre el sistema, no un dato sobre esa cuenta.
--
-- Nota para el que venga: change_events.change_datetime es TEXT, no timestamp.
-- Cualquier comparacion de fechas contra esa columna necesita ::date o ::timestamp.

alter function public.get_weekly_package_cadena(text)
  rename to get_weekly_package_cadena_base;

comment on function public.get_weekly_package_cadena_base(text) is
  'Nucleo del paquete de cadena. NO llamar directo desde un prompt: usar get_weekly_package_cadena, que le agrega los guardarrailes de ventana, coherencia y cambios.';

create or replace function public.get_weekly_package_cadena(p_account text)
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select public.get_weekly_package_cadena_base(p_account)
    || jsonb_build_object(

      'ventana_real', (
        select jsonb_build_object(
          'dias_capa_diaria', v.dias_en_30d,
          'semanas', v.semanas,
          'cuidado', v.lectura)
        from v_ventana_real v where v.account = p_account),

      'cambios_semana_meta', (
        select jsonb_build_object(
          'en_toda_la_tabla', count(*),
          'dato_mas_nuevo', max(ce.change_datetime::date),
          'cuidado', case
            when count(*) = 0
              then 'change_events NO tiene ninguna fila de esta cuenta. No se puede afirmar que algo no cambio.'
            when max(ce.change_datetime::date) < current_date - 7
              then 'change_events esta CONGELADA: su dato mas nuevo es del ' || max(ce.change_datetime::date) ||
                   '. No se puede afirmar que algo no cambio. Usar v_cambios_detectados, que compara fotos de configuracion.'
            else 'Al dia.' end)
        from change_events ce where ce.account = p_account),

      -- En una cadena el delta de CPA de cuenta no significa nada (regla 1: objetivos
      -- mezclados). Lo que si se contrasta es el gasto, que es una cifra sin ambiguedad
      -- y sirve igual para detectar que el brief se calculo sobre otra base.
      'coherencia_del_gasto', (
        select jsonb_build_object(
          'gasto_semana_segun_la_serie', round(sum(c.cost) filter (where c.week_start = s.ultima)::numeric, 2),
          'gasto_semana_previa_segun_la_serie', round(sum(c.cost) filter (where c.week_start = s.previa)::numeric, 2),
          'delta_gasto_pct', case
            when sum(c.cost) filter (where c.week_start = s.previa) > 0
            then round((((sum(c.cost) filter (where c.week_start = s.ultima)
                        - sum(c.cost) filter (where c.week_start = s.previa))
                       / sum(c.cost) filter (where c.week_start = s.previa)) * 100)::numeric, 1)
            end,
          'como_leerlo', 'Si una cifra del brief no coincide con esta, el brief se calculo sobre otra base. ' ||
                         'La serie semanal es la fuente buena: sale de una sola tabla. ' ||
                         'NO existe un delta de CPA de cuenta aca y no hay que inventarlo: los objetivos ' ||
                         'estan mezclados y el promedio no significa nada (regla 1).')
        from campaign c
        cross join (
          select max(week_start) as ultima,
                 (select max(week_start) from campaign
                   where account = p_account
                     and week_start < (select max(week_start) from campaign where account = p_account)) as previa
            from campaign where account = p_account) s
        where c.account = p_account and c.week_start in (s.ultima, s.previa))
    );
$$;

comment on function public.get_weekly_package_cadena(text) is
  'Paquete semanal de una cuenta perfil cadena, con los mismos guardarrailes que el de cuenta unica: ventana_real (la capa diaria tiene 15 dias en FRESH_MONKEE, no 30), cambios_semana_meta (avisa si change_events esta congelada) y coherencia_del_gasto (contraste contra la serie semanal). Envuelve a get_weekly_package_cadena_base, que no hay que llamar directo.';;
