-- Una entidad es especifica si tiene grupo o keyword ademas de la campaña. Solo esas deduplican.
create or replace function entidad_especifica(t text) returns boolean language sql immutable as $$
  select coalesce(t, '') <> '' and (
    -- formato campaña|grupo|keyword con al menos grupo o keyword no vacios
    (position('|' in t) > 0 and (coalesce(nullif(trim(split_part(t, '|', 2)), ''), nullif(trim(split_part(t, '|', 3)), '')) is not null))
    -- o texto libre de mas de una palabra que no sea solo el nombre de una campaña conocida
    or (position('|' in t) = 0 and length(trim(t)) > 12)
  );
$$;

create or replace function reconciliar() returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n_venc int := 0; n_dup int := 0; n_hecho int := 0; n_alert int := 0; r record;
begin
  for r in select notion_id, account, titulo from accionables_espejo where estado in ('Propuesto','Bloqueado') and vence is not null and vence < current_date and reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R1_vencido', 'accionable:' || r.notion_id, 'vencer', 'Vencio sin ejecutarse: ' || r.titulo) on conflict do nothing; n_venc := n_venc + 1;
  end loop;
  -- R2: solo entidades especificas (grupo o keyword), nunca campaña sola
  for r in select a.account, a.notion_id as viejo, b.notion_id as nuevo, a.entidad from accionables_espejo a join accionables_espejo b
    on a.account = b.account and a.notion_id < b.notion_id and normalizar_entidad(a.entidad) = normalizar_entidad(b.entidad) and entidad_especifica(a.entidad)
    where a.estado in ('Propuesto','Bloqueado','En curso') and b.estado in ('Propuesto','Bloqueado','En curso') and a.reemplazado_por is null and b.reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R2_duplicado', 'accionable:' || r.nuevo, 'duplicado', 'Misma entidad que ' || r.viejo || ' (' || r.entidad || '). Pasa a Reemplazado por el mas viejo.') on conflict do nothing; n_dup := n_dup + 1;
  end loop;
  for r in select e.notion_id, e.account, e.titulo, g.event_date from accionables_espejo e
    join google_live_events g on g.account = e.account and g.event_type = 'USER_CHANGE' and g.event_date::date >= coalesce(e.detectado, current_date - 30)
      and entidad_especifica(e.entidad) and normalizar_entidad(g.entity_name) like '%' || split_part(normalizar_entidad(e.entidad), '|', array_length(string_to_array(e.entidad, '|'), 1)) || '%'
    where e.estado in ('Propuesto','Bloqueado') and e.reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R3_posible_hecho', 'accionable:' || r.notion_id, 'ya_hecho', 'Cambio de usuario en esa entidad el ' || r.event_date::date || '. Confirmar si corresponde a "' || r.titulo || '".') on conflict do nothing; n_hecho := n_hecho + 1;
  end loop;
  for r in select a.id, a.account, a.entidad from alertas a where a.tipo = 'plan_condicion' and a.estado in ('abierta','vista')
    and not exists (select 1 from pulso_diario p, jsonb_array_elements(p.evidencia) e where p.account = a.account and p.fecha = (select max(fecha) from pulso_diario where account = a.account) and (e->>'cumple')::boolean and coalesce(e->>'grupo', e->>'nombre') = a.entidad) loop
    update alertas set estado = 'resuelta', resuelta_el = now() where id = r.id;
    insert into reconciliaciones (account, regla, objeto, accion, detalle, aplicada, aplicada_el) values (r.account, 'R4_condicion_cesa', 'alerta:' || r.id, 'cerrar_alerta', 'La condicion dejo de cumplirse en el ultimo pulso.', true, now()); n_alert := n_alert + 1;
  end loop;
  return jsonb_build_object('vencidos', n_venc, 'duplicados', n_dup, 'posibles_hechos', n_hecho, 'alertas_cerradas', n_alert, 'corrida', now());
end $$;

-- Tambien accionable_existente: no matchear por campaña sola
create or replace function accionable_existente(p_account text, p_entidad text, p_causa text default null) returns text language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  select notion_id from accionables_espejo where account = p_account and estado in ('Propuesto','Bloqueado','En curso') and reemplazado_por is null
    and ((entidad_especifica(p_entidad) and normalizar_entidad(entidad) = normalizar_entidad(p_entidad))
         or (p_causa is not null and causa_raiz is not null and length(p_causa) > 20 and extensions.similarity(normalizar_entidad(causa_raiz), normalizar_entidad(p_causa)) > 0.6))
  order by detectado desc limit 1;
$$;

-- Registrar la reversion y corregir el espejo
update reconciliaciones set detalle = detalle || ' [REVERTIDO: falso positivo, entidad de campaña sola. Regla corregida.]' where regla = 'R2_duplicado' and objeto = 'accionable:3d03b1f6-de28-81b6-bbf5-efcdb2b90c24';
update accionables_espejo set reemplazado_por = null where notion_id = '3d03b1f6-de28-81b6-bbf5-efcdb2b90c24';
insert into tickets (tipo, titulo, descripcion, pagina, cuenta, creado_por, estado, respuesta, resuelto_el, resuelto_en_version) values
('bug', 'Reconciliador marcó como duplicados dos accionables distintos con entidad "Search DACH||"', 'La regla R2 comparaba entidades iguales sin exigir grupo o keyword. Dos accionables a nivel de campaña ("Consolidar acciones de conversión" y "Decidir destino de 21 keywords") compartían la clave vacía.', 'Sistema', 'KAREDO', 'claude', 'resuelto', 'Revertido en Notion. Regla corregida: solo deduplica entidades con grupo o keyword (entidad_especifica). Primera corrida del reconciliador, 6 sep 23:14 UTC.', now(), 'sql');
select reconciliar();;
