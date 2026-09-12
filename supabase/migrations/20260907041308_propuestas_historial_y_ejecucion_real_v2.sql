alter table propuestas_estrategicas add column if not exists ejecucion_real text;
alter table propuestas_estrategicas add column if not exists test_inicio date;
alter table propuestas_estrategicas add column if not exists historial jsonb default '[]';

create or replace function propuesta_cambiar_estado(p_id bigint, p_estado text, p_nota text default null, p_ejecucion_real text default null, p_por text default 'andres') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare ant text; acc text; tit text;
begin
  select estado, account, titulo into ant, acc, tit from propuestas_estrategicas where id = p_id;
  if ant is null then return jsonb_build_object('error', 'no existe'); end if;
  update propuestas_estrategicas set
    estado = p_estado,
    decision_andres = coalesce(p_nota, decision_andres),
    decidida_el = case when p_estado in ('aprobada','descartada','adoptada') then current_date else decidida_el end,
    ejecucion_real = coalesce(p_ejecucion_real, ejecucion_real),
    test_inicio = case when p_estado = 'en_test' and test_inicio is null then current_date else test_inicio end,
    evaluada_el = case when p_estado = 'adoptada' then current_date else evaluada_el end,
    historial = historial || jsonb_build_object('fecha', now(), 'de', ant, 'a', p_estado, 'nota', p_nota, 'por', p_por)
  where id = p_id;
  if p_estado = 'en_test' and p_ejecucion_real is not null then
    insert into operator_log (account, fecha, hora, que_cambio, donde, por_que) values (acc, current_date, now()::time, left(p_ejecucion_real, 200), 'Propuesta estrategica #' || p_id || ': ' || left(tit, 80), 'Test de la propuesta estrategica. Evaluar contra lo hecho, no contra lo propuesto.');
  end if;
  return jsonb_build_object('ok', true, 'de', ant, 'a', p_estado);
end $$;
revoke execute on function propuesta_cambiar_estado from anon, authenticated, public;

select propuesta_cambiar_estado(1, 'en_test',
  'Adoptar fue un clic por error el 7 de septiembre; el estado real es en test. Lo ejecutado difiere de lo propuesto: no se subio el tCPA a 34, se quito el tCPA (Maximizar conversiones sin objetivo). Evaluar contra eso.',
  'Search | DACH | Karedo 2026: estrategia de puja cambiada de Maximizar conversiones con tCPA 22,18 EUR a Maximizar conversiones SIN tCPA, el 7 de septiembre de 2026. La propuesta decia tCPA 34; se quito el objetivo en vez de subirlo.');
update propuestas_estrategicas set test_inicio = '2026-09-07', evaluada_el = null where id = 1;
select id, estado, test_inicio, left(ejecucion_real, 100) ejecucion_real, jsonb_array_length(historial) eventos from propuestas_estrategicas where id = 1;;
