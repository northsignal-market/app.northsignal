-- ================================================================
-- REGISTRO DE CAPACIDADES DE EJECUCION
-- Que puede hacer un script de Google Ads y que no. Verificado contra la
-- documentacion oficial de AdsApp el 7 de septiembre de 2026.
-- Sin esto, cada agente decide por su cuenta si algo es ejecutable, y en la
-- practica no lo ofrece: 12 de 15 accionables abiertos no tenian Accion JSON,
-- y varios de ellos SI eran ejecutables.
-- ================================================================
create table if not exists capacidades_ejecucion (
  verbo text primary key,
  ejecutable boolean not null,
  metodo text,                      -- el metodo de AdsApp que lo hace
  reversible text,                  -- como se deshace
  riesgo text not null check (riesgo in ('bajo','medio','alto')),
  requiere text,                    -- campos obligatorios del Accion JSON
  por_que_no text,                  -- si no es ejecutable, la razon
  verificado_el date default current_date
);
alter table capacidades_ejecucion enable row level security; revoke all on capacidades_ejecucion from anon, authenticated;
comment on table capacidades_ejecucion is 'Que verbos puede ejecutar un script de Google Ads. Verificado contra developers.google.com/google-ads/scripts. Los agentes lo consultan antes de escribir un accionable: si el verbo es ejecutable, el accionable DEBE llevar Accion JSON.';

insert into capacidades_ejecucion (verbo, ejecutable, metodo, reversible, riesgo, requiere, por_que_no) values
-- EJECUTABLES, riesgo bajo: se deshacen con una accion inversa igual de simple
('agregar_negativa', true, 'campaign.createNegativeKeyword(texto) o adGroup.createNegativeKeyword(texto)', 'Se quita con negativeKeyword.remove()', 'bajo', 'objeto.campana, objeto.keyword (o objeto.keywords), parametros.nivel, objeto.match_type', null),
('quitar_negativa', true, 'negativeKeyword.remove()', 'Se vuelve a crear con createNegativeKeyword()', 'bajo', 'objeto.campana, objeto.keyword, parametros.nivel', null),
('pausar_keyword', true, 'keyword.pause()', 'Se habilita con keyword.enable()', 'bajo', 'objeto.campana, objeto.keyword (o objeto.keywords)', null),
('reactivar_keyword', true, 'keyword.enable()', 'Se pausa con keyword.pause()', 'bajo', 'objeto.campana, objeto.keyword', null),
('pausar_anuncio', true, 'ad.pause()', 'Se habilita con ad.enable()', 'bajo', 'objeto.campana, objeto.grupo, objeto.ad_id', null),
('pausar_grupo', true, 'adGroup.pause()', 'Se habilita con adGroup.enable()', 'bajo', 'objeto.campana, objeto.grupo', null),
('cambiar_concordancia', true, 'adGroup.newKeywordBuilder() para la nueva, keyword.pause() para la vieja', 'Se reactiva la vieja y se pausa la nueva', 'bajo', 'objeto.campana, objeto.grupo, objeto.keyword, parametros.match_type_destino', null),
-- EJECUTABLES, riesgo medio: reversibles pero reinician aprendizaje o mueven plata
('cambiar_estrategia_puja', true, 'campaign.bidding().setStrategy(estrategia, argsBuilder)', 'Se vuelve a poner la anterior, pero el aprendizaje se reinicia igual', 'medio', 'objeto.campana, parametros.estrategia_destino', null),
('cambiar_objetivo_puja', true, 'campaign.bidding().setTargetCpa(v) / setTargetRoas(v) / clearTargetCpa()', 'Se vuelve al valor anterior', 'medio', 'objeto.campana, parametros.valor_nuevo (null para quitar el objetivo)', null),
('cambiar_presupuesto', true, 'campaign.getBudget().setAmount(monto)', 'Se vuelve al monto anterior', 'medio', 'objeto.campana, parametros.valor_actual, parametros.valor_nuevo', null),
('pausar_campana', true, 'campaign.pause()', 'Se habilita con campaign.enable()', 'medio', 'objeto.campana', null),
('reactivar_campana', true, 'campaign.enable()', 'Se pausa con campaign.pause()', 'medio', 'objeto.campana', null),
('cambiar_cpc_keyword', true, 'keyword.bidding().setCpc(monto)', 'Se vuelve al CPC anterior', 'medio', 'objeto.campana, objeto.keyword, parametros.valor_nuevo', null),
('aplicar_etiqueta', true, 'entidad.applyLabel(nombre) / removeLabel(nombre)', 'Se quita la etiqueta', 'bajo', 'objeto.campana, parametros.etiqueta', null),
-- NO EJECUTABLES: la razon es de la plataforma, no nuestra
('crear_anuncio', false, null, null, 'alto', null, 'AdsApp solo crea expanded text ads, que Google retiro. Los RSA no se pueden crear por script: hay que hacerlos en la interfaz o con la API de Google Ads.'),
('editar_anuncio', false, null, null, 'alto', null, 'Un anuncio no se edita en Google Ads: se crea uno nuevo y se pausa el viejo. Y los RSA no se crean por script.'),
('cambiar_conversion_primaria', false, null, null, 'alto', null, 'Las acciones de conversion no estan en AdsApp. Se cambian en Objetivos > Conversiones, a mano o con la API.'),
('cambiar_segmentacion', false, null, null, 'alto', null, 'AdsApp lee la segmentacion de campana pero no permite cambiar radios ni ubicaciones existentes de forma confiable. A mano.'),
('cambiar_landing', false, null, null, 'alto', null, 'La URL final de un anuncio no se edita: hay que recrear el anuncio. A mano.'),
('preguntar_andres', false, null, null, 'bajo', null, 'Es una pregunta, no un cambio.'),
('preguntar_cliente', false, null, null, 'bajo', null, 'Es una pregunta, no un cambio.'),
('tarea_externa', false, null, null, 'bajo', null, 'Trabajo fuera de Google Ads: un Sheet, el CRM, la landing, GTM.'),
('investigar', false, null, null, 'bajo', null, 'Es trabajo de diagnostico, no un cambio.')
on conflict (verbo) do update set ejecutable = excluded.ejecutable, metodo = excluded.metodo,
  reversible = excluded.reversible, riesgo = excluded.riesgo, requiere = excluded.requiere,
  por_que_no = excluded.por_que_no, verificado_el = current_date;

select ejecutable, riesgo, count(*) n, string_agg(verbo, ', ' order by verbo) verbos from capacidades_ejecucion group by 1,2 order by 1 desc, 2;;
