alter table acciones_aprobadas drop constraint if exists acciones_aprobadas_tipo_check;
alter table acciones_aprobadas add constraint acciones_aprobadas_tipo_check check (tipo in ('negativa_grupo','negativa_campana','pausar_keyword','pausar_anuncio','cambiar_concordancia'));
alter table acciones_aprobadas add column if not exists match_type_destino text check (match_type_destino in ('EXACT','PHRASE','BROAD'));
alter table politicas_auto drop constraint if exists politicas_auto_tipo_check;
alter table politicas_auto add constraint politicas_auto_tipo_check check (tipo in ('negativa_grupo','negativa_campana','pausar_keyword','pausar_anuncio','cambiar_concordancia'));
insert into politicas_auto (tipo, activa, modo, confianza_min, gasto_max, solo_origen, nota) values
  ('cambiar_concordancia', false, 'simular', 0.85, null, '{Semanal}', 'Cambiar concordancia: crea la keyword con la nueva y pausa la vieja. Reversible. Smart Bidding reaprende unos dias.')
on conflict (tipo) do nothing;
drop view if exists v_acciones_pendientes;
create view v_acciones_pendientes as select id, account, tipo, campana, grupo, keyword, match_type, ad_id, modo, match_type_destino from acciones_aprobadas where estado = 'pendiente' order by aprobada_el;
select 'ok';;
