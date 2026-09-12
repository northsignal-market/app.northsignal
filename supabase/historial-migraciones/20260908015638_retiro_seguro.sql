-- ============================================================
-- RETIRO SEGURO · medir antes de sacar, y poder volver
-- ============================================================
-- El error que casi cometo: mire lecturas de cinco dias y concluí que algo
-- estaba muerto. Con consumidores que corren una vez por semana, cinco dias
-- es menos de una corrida por cuenta. La foto no alcanza.
--
-- Este registro convierte "sacar algo" en un proceso de cuatro estados con
-- evidencia en cada paso, en vez de una decision de una tarde.
-- ============================================================
create table if not exists candidatos_a_retiro (
  id bigserial primary key,
  objeto text not null,
  tipo text not null check (tipo in ('tabla','vista','funcion','extraccion','seccion_de_prompt')),
  estado text not null default 'observando'
    check (estado in ('observando','en_sombra','retirado','indultado')),
  por_que_se_propone text not null,
  que_se_pierde text,                    -- la parte honesta: que deja de poder hacerse
  quien_lo_usa text,                     -- vistas, funciones o prompts que lo tocan
  lecturas_al_marcar bigint,
  observar_hasta date not null,
  evidencia jsonb default '{}',
  decidido_el date,
  motivo_decision text,
  como_volver text not null,             -- obligatorio: sin vuelta atras no se saca nada
  marcado_el timestamptz default now()
);
alter table candidatos_a_retiro enable row level security;
revoke all on candidatos_a_retiro from anon, authenticated;
comment on table candidatos_a_retiro is 'Nada se saca de una. Se marca, se observa el tiempo de al menos tres corridas del consumidor mas lento, se pone en sombra, y recien despues se retira. Con la forma de volver escrita desde el dia uno.';

-- Foto de lecturas al momento de marcar, para comparar despues
create or replace function marcar_para_retiro(
  p_objeto text, p_tipo text, p_por_que text, p_que_se_pierde text,
  p_como_volver text, p_semanas_de_observacion int default 4) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_lecturas bigint; v_usa text; v_id bigint;
begin
  select coalesce(seq_scan, 0) + coalesce(idx_scan, 0) into v_lecturas
  from pg_stat_user_tables where relname = p_objeto;

  select nullif(concat_ws(' · ',
    nullif((select string_agg(viewname, ', ') from pg_views where schemaname='public' and definition ~* ('\m' || p_objeto || '\M')), ''),
    nullif((select string_agg(proname, ', ') from pg_proc where pronamespace='public'::regnamespace and pg_get_functiondef(oid) ~* ('\m' || p_objeto || '\M')), '')), '')
  into v_usa;

  insert into candidatos_a_retiro (objeto, tipo, por_que_se_propone, que_se_pierde, quien_lo_usa,
    lecturas_al_marcar, observar_hasta, como_volver)
  values (p_objeto, p_tipo, p_por_que, p_que_se_pierde, coalesce(v_usa, '(nadie que se detecte)'),
    v_lecturas, current_date + (p_semanas_de_observacion * 7), p_como_volver)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function marcar_para_retiro from anon, authenticated;

-- Cuanto se leyo DESDE que se marco. Esta es la evidencia real.
create or replace view v_candidatos_con_evidencia with (security_invoker = true) as
select c.id, c.objeto, c.tipo, c.estado, c.observar_hasta,
  c.lecturas_al_marcar,
  coalesce(s.seq_scan, 0) + coalesce(s.idx_scan, 0) - coalesce(c.lecturas_al_marcar, 0) lecturas_desde_que_se_marco,
  current_date >= c.observar_hasta observacion_completa,
  c.quien_lo_usa, c.que_se_pierde, c.como_volver,
  case
    when c.estado <> 'observando' then 'Ya decidido: ' || c.estado
    when current_date < c.observar_hasta then
      'Faltan ' || (c.observar_hasta - current_date) || ' dias de observacion. No sacar todavia.'
    when coalesce(s.seq_scan,0) + coalesce(s.idx_scan,0) - coalesce(c.lecturas_al_marcar,0) > 50 then
      'SE SIGUE USANDO: ' || (coalesce(s.seq_scan,0) + coalesce(s.idx_scan,0) - coalesce(c.lecturas_al_marcar,0)) ||
      ' lecturas desde que se marco. Indultar.'
    when c.quien_lo_usa <> '(nadie que se detecte)' then
      'Sin lecturas nuevas, pero lo tocan: ' || c.quien_lo_usa || '. Revisar esos objetos antes de sacar.'
    else 'Listo para pasar a sombra: sin lecturas nuevas y sin dependencias detectadas.'
  end veredicto
from candidatos_a_retiro c
left join pg_stat_user_tables s on s.relname = c.objeto;

select 1;;
