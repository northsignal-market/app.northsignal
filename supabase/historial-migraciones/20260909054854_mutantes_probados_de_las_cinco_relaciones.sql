-- Los tres mutantes que faltaban, probados el 9 sep 2026. Las cinco relaciones matan al suyo.
update relaciones_verdad set
  mutante_sql = 'insert into conversion_actions (...) values (''BHI'', max(week_start), ''FANTASMA'', ''Accion inventada'', 999, 999) -- en transaccion con rollback',
  mutante_probado_el = current_date, mutante_resultado = 'mato_al_mutante'
 where nombre = 'acciones_suman_lo_que_campana';

update relaciones_verdad set
  mutante_sql = 'update campaign_daily set cost = cost * 2 where account = ''KAREDO'' -- en transaccion con rollback',
  mutante_probado_el = current_date, mutante_resultado = 'mato_al_mutante'
 where nombre = 'diaria_igual_a_semanal_en_semana_completa';

update relaciones_verdad set
  mutante_sql = 'create or replace view v_ventana_real con dias_en_30d = 30 cableado -- en transaccion con rollback. El mutante NO puede ser un dato: los dos lados leen campaign_daily y se mueven juntos. Tiene que cambiar la DEFINICION.',
  mutante_probado_el = current_date, mutante_resultado = 'mato_al_mutante'
 where nombre = 'ventana_declarada_es_la_real';

-- Que la prueba de mutantes deje de ser manual. Una tarea que corre cada relacion contra
-- su propio mutante, en transaccion, y marca la que sobrevivio.
create or replace function public.probar_mutantes()
returns table (relacion text, resultado text)
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare r record; viola int; total int;
begin
  for r in select id, nombre, mutante_sql from relaciones_verdad
            where activa and mutante_sql is not null and mutante_sql not like 'no aplica%'
              and mutante_sql ~ '^\s*(update|insert|delete)\s' order by id
  loop
    begin
      execute r.mutante_sql;
      perform correr_relaciones();
      select count(*) filter (where cv.veredicto='viola'), count(*)
        into viola, total
        from corridas_verdad cv
       where cv.relacion_id = r.id and cv.corrida_el > now() - interval '20 seconds';
      relacion := r.nombre;
      resultado := case when viola > 0 then 'mato_al_mutante' else 'sobrevivio' end;
      return next;
      raise exception 'rollback del mutante';
    exception when others then
      if sqlerrm <> 'rollback del mutante' then
        relacion := r.nombre; resultado := 'error: ' || sqlerrm; return next;
      end if;
    end;
  end loop;
end $function$;

comment on function public.probar_mutantes() is
  'Corre cada relacion contra su propio mutante dentro de una transaccion y revierte. Solo toma mutantes que son UPDATE, INSERT o DELETE: los que exigen cambiar una definicion (DDL) se prueban a mano, porque un rollback de DDL fallido dejaria la base en un estado raro. Una relacion que no mata a su mutante no es un control, es una esperanza.';

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Al preparar el mutante de ventana_declarada_es_la_real note que los dos lados de la relacion eran casi la misma expresion: la vista usa date > current_date - 30 sin techo y la relacion usaba >= con techo en hoy.',
 'Alinear el lado derecho al predicado EXACTO de la vista antes de probar el mutante.',
 'Hoy los dos daban lo mismo por casualidad, porque no hay filas de hoy en campaign_daily. El dia que entrara una, la relacion habria disparado en falso y nadie habria sabido por que.',
 'Dos expresiones CASI iguales no son una relacion, son una bomba de tiempo. Una relacion que compara A contra una copia levemente distinta de A no verifica nada: verifica que la copia no cambio. Al escribir una relacion hay que decidir si el lado derecho es una fuente independiente (entonces vale) o una reescritura del izquierdo (entonces solo detecta cambios de definicion, y hay que decirlo). Y en ese segundo caso el mutante tiene que ser DDL, nunca un dato.',
 'acierto', 0.9, 1, 'claude');

select registrar_cambio(
 'Las cinco relaciones tienen mutante probado y la prueba deja de ser manual',
 'Los tres mutantes que faltaban dieron mato_al_mutante: conservacion con una accion de conversion fantasma, equivalencia duplicando el gasto diario, y ventana cableando dias_en_30d en 30. Este ultimo confirmo la leccion del dia anterior: cuando los dos lados leen la misma tabla, el mutante no puede ser un dato porque los mueve juntos; tiene que cambiar la definicion. Ademas se corrigio la propia relacion de ventana: comparaba la vista contra una copia CASI identica de su definicion (>= con techo contra > sin techo), que hoy coincidian por casualidad y habrian disparado en falso el dia que entrara una fila de hoy. Se agrego probar_mutantes(), que corre los mutantes de datos solos y deja los de DDL para prueba manual.',
 array['relaciones_verdad','probar_mutantes','v_ventana_real'],
 'fix-v102',
 'probar_mutantes() se dropea sin efecto. Las marcas de mutante_resultado se pueden volver a sin_probar con un update.'
) as registro;;
