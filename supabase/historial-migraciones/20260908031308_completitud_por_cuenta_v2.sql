create or replace function completitud_de_cuenta(p_account text) returns table (
  requisito text, cumple boolean, detalle text, por_que_importa text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with c as (select * from cuentas where account = p_account)
  select 'doc maestro', (select count(*) from doc_maestro_humano d where d.account = p_account and d.vigente) >= 5,
    (select count(*)::text || ' secciones vigentes' from doc_maestro_humano d where d.account = p_account and d.vigente),
    'Sin doc maestro el agente no sabe que es el negocio ni que esta prohibido decir.'
  union all
  select 'reglas de dominio', (select reglas_dominio is not null and length(reglas_dominio) > 100 from c),
    (select coalesce(length(reglas_dominio)::text || ' caracteres', 'vacio') from c),
    'Son las restricciones que no se negocian. Sin ellas el agente propone cosas que hay que descartar.'
  union all
  select 'nucleo semantico', (select nucleo is not null from c), (select coalesce(left(nucleo::text, 60), 'vacio') from c),
    'La invariante I0 protege el nucleo. Sin nucleo definido, I0 no protege nada.'
  union all
  select 'terminos protegidos', (select count(*) from terminos_protegidos t where t.account = p_account) > 0,
    (select count(*)::text || ' terminos, ' || coalesce(round(sum(conversiones_90d))::text,'0') || ' conversiones cubiertas' from terminos_protegidos t where t.account = p_account),
    'La invariante I2 impide negativizar lo que convierte. Sin protegidos, una negativa puede matar la conversion.'
  union all
  select 'ficha de Notion', (select notion_ficha_id is not null from c), (select coalesce(notion_ficha_id, 'sin vincular') from c),
    'Sin ficha, el espejo no resuelve la cuenta y los accionables quedan huerfanos.'
  union all
  select 'objetivo de cuenta', (select count(*) from account_targets a where a.account = p_account) > 0,
    (select count(*)::text || ' objetivo(s)' from account_targets a where a.account = p_account),
    'Sin objetivo no hay headroom ni brecha: el agente no sabe si la cuenta va bien o mal.'
  union all
  select 'datos frescos', (select coalesce(max(date) >= current_date - 2, false) from campaign_daily d where d.account = p_account),
    (select 'ultimo dia: ' || coalesce(max(date)::text, 'ninguno') from campaign_daily d where d.account = p_account),
    'Un analisis sobre datos viejos es peor que ninguno.'
  union all
  select 'semanas de historia', (select count(distinct week_start) from campaign w where w.account = p_account) >= 4,
    (select count(distinct week_start)::text || ' semanas' from campaign w where w.account = p_account),
    'Con menos de 4 semanas no hay tendencia: cualquier movimiento parece significativo.'
  union all
  select 'destinatarios de reporte', (select destinatarios_reporte is not null and array_length(destinatarios_reporte, 1) > 0 from c),
    (select coalesce(array_to_string(destinatarios_reporte, ', '), 'SIN CARGAR') from c),
    'Sin destinatarios el reporte se aprueba y no se envia: el briefing lo saltea en silencio.'
  union all
  select 'objetivos de conversion', (select perfil_analisis from c) <> 'cadena'
    or (select count(*) from objetivos_conversion o where o.account = p_account) > 0,
    (select count(*)::text || ' objetivos definidos' from objetivos_conversion o where o.account = p_account),
    'Solo obligatorio en perfil cadena: sin ellos no se puede separar compra online de visitas.'
  union all
  select 'mapeo de campanas', not exists (select 1 from v_campanas_sin_dim s where s.account = p_account),
    (select count(*)::text || ' campanas con gasto fuera de campaign_dim' from v_campanas_sin_dim s where s.account = p_account),
    'Una campana fuera de campaign_dim no se puede atribuir a un local ni a un objetivo.';
$$;
comment on function completitud_de_cuenta is 'Que le falta a una cuenta para operar bien. Nacio de que Fresh Monkee llevaba desde su alta con cero terminos protegidos y 3.124 conversiones sin cubrir: las verificaciones eran del sistema entero y ninguna miraba cuenta por cuenta.';

create or replace view v_cuentas_incompletas with (security_invoker = true) as
select c.account, f.requisito, f.detalle, f.por_que_importa
from cuentas c, lateral completitud_de_cuenta(c.account) f
where c.activa and not f.cumple;

select account, requisito, detalle from v_cuentas_incompletas order by account, requisito;;
