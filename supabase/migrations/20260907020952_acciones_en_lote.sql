alter table acciones_aprobadas add column if not exists keywords text[];
comment on column acciones_aprobadas.keywords is 'Lote: lista de keywords para pausar o agregar como negativas en una sola accion. El ejecutor itera y reporta una por una.';
drop view if exists v_acciones_pendientes;
create view v_acciones_pendientes with (security_invoker = true) as
  select id, account, tipo, campana, grupo, keyword, match_type, ad_id, modo, match_type_destino, keywords from acciones_aprobadas where estado = 'pendiente' order by aprobada_el;
select 'ok';;
