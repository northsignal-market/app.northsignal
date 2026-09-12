-- Constancia del caso
update acciones_aprobadas set resultado = resultado || ' [7 sep: el historial de Google muestra ademas "CPC maximo de predeterminado a 0,01 EUR" en la nueva. Bug del ejecutor v2 al copiar la puja bajo Smart Bidding; sin efecto practico porque la campana esta en Maximizar conversiones (tCPA 22,18) y el CPC de keyword no aplica. Corregido en ejecutor v3.]' where id = 2;
insert into operator_log (account, fecha, hora, que_cambio, donde, valor_anterior, valor_nuevo, por_que, accionable_notion_id) values
('KAREDO', '2026-09-07', '00:33', 'CPC maximo de [berufsbetreuer software vergleich] quedo en 0,01 EUR al crearse (no pedido)', 'Search | DACH | Karedo 2026 › 7. Vergleich', 'predeterminado', '0,01 EUR', 'Efecto secundario del ejecutor v2. Sin impacto bajo Maximizar conversiones. Detectado por Andres en el historial de cambios; corregido en ejecutor v3.', '3d33b1f6-de28-81b0-96f2-f3f870e23fc9');
insert into lecciones (account, contexto, decision, resultado, leccion, tipo, confianza, origen_id, escrita_por) values
(null, 'Ejecucion automatica de cambio de concordancia, 7 sep 2026', 'El script copio la puja de la keyword vieja a la nueva', 'Google registro CPC maximo 0,01 EUR en la nueva; el resultado reportado no lo mencionaba', 'Lo que el script reporta tiene que igualar lo que Google registra: cada campo que se escribe se nombra en el resultado, y el reconciliador compara contra el historial de cambios', 'error', 0.9, 'acciones_aprobadas:2', 'claude')
on conflict do nothing;
insert into tickets (tipo, titulo, descripcion, pagina, cuenta, creado_por, estado, respuesta, resuelto_el, resuelto_en_version) values
('bug', 'Ejecutor puso CPC maximo 0,01 EUR al crear keyword exacta sin informarlo', 'Bajo Smart Bidding getCpc() devuelve 0,01 como marcador; el v2 lo copiaba a la nueva keyword con withCpc. Detectado por Andres en el historial de cambios de Google.', 'Sistema', 'KAREDO', 'andres', 'resuelto', 'ejecutor_v3: solo copia CPC si la campana puja a mano (MANUAL_CPC o ENHANCED_CPC); el resultado dice exactamente que se creo y con que. Nueva regla R7 en el reconciliador: compara lo reportado con change_events.', now(), 'ejecutor_v3');

-- R7: cambios que Google registro y el script no informo (cambio en la entidad dentro de la hora de la ejecucion, con un campo que no aparece en resultado)
create or replace function detectar_cambios_no_informados() returns int language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n int := 0; r record;
begin
  for r in
    select a.id, a.account, a.keyword, a.resultado, c.field_changes, c.change_date
    from acciones_aprobadas a
    join change_events c on c.account = a.account and c.change_date between a.ejecutada_el - interval '5 minutes' and a.ejecutada_el + interval '60 minutes'
      and (a.keyword is null or normalizar_entidad(c.entity_name) like '%' || normalizar_entidad(a.keyword) || '%')
    where a.estado = 'ejecutada' and a.ejecutada_el >= now() - interval '7 days'
      and c.field_changes is not null
      and (c.field_changes ilike '%cpc%' and a.resultado not ilike '%cpc%'
        or c.field_changes ilike '%url%' and a.resultado not ilike '%url%'
        or c.field_changes ilike '%bid%' and a.resultado not ilike '%puja%' and a.resultado not ilike '%cpc%')
  loop
    perform alerta_registrar(r.account, 'semana', 'cambio_no_informado', 'El script cambio algo que no reporto en ' || coalesce(r.keyword, 'la entidad'),
      'Google registro: ' || left(r.field_changes, 300) || '. El resultado del script decia: ' || left(r.resultado, 200),
      'Revisar en Google Ads > Historial de cambios y corregir si hace falta. Reportar como ticket si el script tiene que cambiar.', 'reconciliador', r.keyword, r.change_date::date);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function detectar_cambios_no_informados from anon, authenticated, public;
select cron.unschedule(jobid) from cron.job where jobname = 'cambios_no_informados';
select cron.schedule('cambios_no_informados', '20 9 * * *', $$select detectar_cambios_no_informados()$$);
select column_name from information_schema.columns where table_name = 'change_events' order by ordinal_position;;
