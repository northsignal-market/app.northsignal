-- PRUEBA EN LOS DOS SENTIDOS. La mayoria de las relaciones nuevas estan violando hoy, y a
-- un chequeo que ya esta en rojo no se lo puede probar haciendolo fallar mas. La prueba
-- correcta es la INVERSA: arreglar el dato en una transaccion y confirmar que se pone en
-- verde. Una relacion que devuelve "viola" pase lo que pase esta tan rota como una que
-- siempre dice "cumple", y desde afuera las dos se ven igual de convincentes.
alter table public.relaciones_verdad
  drop constraint if exists relaciones_verdad_mutante_resultado_check;
alter table public.relaciones_verdad
  add constraint relaciones_verdad_mutante_resultado_check
  check (mutante_resultado in ('mato_al_mutante','responde_al_inverso','sobrevivio','trabada','sin_probar'));

comment on column public.relaciones_verdad.mutante_resultado is
  'mato_al_mutante: estaba en verde, se corrompio el dato y disparo. responde_al_inverso: estaba en rojo, se arreglo el dato y se puso en verde. sobrevivio o trabada: el control no responde al dato y no sirve, aunque se vea sano.';

update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'responde_al_inverso',
  mutante_sql = 'INVERSO: insert into funnel_stages (account, stage_order, stage_name, source) values (''FRESH_MONKEE'', 1, ''PRUEBA'', ''prueba'') -- en transaccion. Probado 9 sep: paso a verde.'
 where nombre = 'toda_cuenta_declara_su_embudo';

update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'responde_al_inverso',
  mutante_sql = 'INVERSO: insert into pulso_diario (account, fecha, nivel, resumen) values (''KAREDO'', current_date, ''normal'', ''PRUEBA'') -- en transaccion. Probado 9 sep: paso a verde.'
 where nombre = 'pulso_al_dia_en_la_cuenta';

update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'responde_al_inverso',
  mutante_sql = 'INVERSO: insert into change_events (account, change_datetime, resource_name, changed_field) values (''360'', (current_date-1)::text, ''PRUEBA'', ''prueba'') -- en transaccion. Probado 9 sep: paso a verde.'
 where nombre = 'change_events_tiene_datos_recientes';

update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'responde_al_inverso',
  mutante_sql = 'INVERSO: insert into config_snapshot (...) con entity_type = ''ad_group'' -- en transaccion. Probado 9 sep: paso a verde.'
 where nombre = 'config_snapshot_cubre_los_tres_niveles';

update relaciones_verdad set mutante_probado_el = current_date, mutante_resultado = 'mato_al_mutante',
  mutante_sql = 'update campaign_daily set conversions = conversions + 5 where account = ''KAREDO'' -- en transaccion. Probado 9 sep: disparo.'
 where nombre = 'conversiones_diaria_igual_a_semanal';

-- El trigger que exige control probado tiene que aceptar las dos formas de prueba.
create or replace function public.exigir_control_al_cerrar()
returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $$
declare n_controles int; n_probados int;
begin
  if new.estado = 'resuelto' and coalesce(old.estado,'') <> 'resuelto'
     and new.tipo in ('bug','dato_incorrecto') then
    select count(*), count(*) filter (where r.mutante_resultado in ('mato_al_mutante','responde_al_inverso'))
      into n_controles, n_probados
      from controles_de_ticket ct
      join relaciones_verdad r on r.id = ct.relacion_id and r.activa
     where ct.ticket_id = new.id;

    if n_controles = 0 then
      raise exception 'El ticket % no se puede cerrar: ningun control vigila que vuelva. Ata una relacion en controles_de_ticket, o cerralo como "no_aplica" en vez de "resuelto".', new.id;
    end if;
    if n_probados = 0 then
      raise exception 'El ticket % tiene % control(es) pero ninguno probo que responde al dato. Corre su mutante (o su inverso, si la relacion ya esta en rojo) y dejalo en mutante_resultado.', new.id, n_controles;
    end if;
    if new.auditoria_de_escape is null then
      raise exception 'El ticket % necesita auditoria_de_escape antes de cerrar: si habia un control que cubriera esto, por que paso en verde, y que cambia para que no escape otra vez.', new.id;
    end if;
  end if;

  if coalesce(old.estado,'') = 'resuelto' and new.estado = 'abierto' then
    new.veces_reabierto := coalesce(old.veces_reabierto, 0) + 1;
  end if;
  return new;
end $$;

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Al ir a probar los mutantes de las relaciones nuevas note que la mayoria ya estaban violando, porque vigilan bugs abiertos.',
 'Probar en el sentido inverso: arreglar el dato en una transaccion y confirmar que la relacion pasa a verde.',
 'Las cuatro respondieron: embudo, pulso, change_events y config_snapshot pasaron a verde al corregir el dato. Y la quinta, que estaba en verde, mato a su mutante al romperle las conversiones.',
 'Un chequeo que ya esta en rojo NO se puede probar haciendolo fallar mas: hay que arreglarle el dato y ver si se pone en verde. Una relacion trabada en "viola" pase lo que pase esta tan rota como una trabada en "cumple", y desde afuera las dos se ven igual de convincentes: una parece que detecta y la otra parece que todo esta bien. La prueba de un control es que RESPONDA AL DATO, en la direccion que sea, no que grite.',
 'acierto', 0.95, 1, 'claude');

select registrar_cambio(
 'Los controles se prueban en los dos sentidos, y cuatro bugs mas quedaron vigilados',
 'Se agregaron relaciones para los tickets 16, 27, 44 y 45, y se corrigio el ambito: una relacion global se corria disfrazada de por-cuenta con un dominio_valido arbitrario, generando no_aplicaba falsos. De paso aparecio un bug real: v_relaciones_violadas tomaba la ultima corrida POR relacion Y CUENTA, asi que al cambiar el ambito la violacion vieja con cuenta cargada quedaba inmortal, porque nunca volvia a tener una fila mas nueva con la que competir. Ahora toma la ultima corrida de cada relacion. Y lo mas importante: la mayoria de las relaciones nuevas vigilan bugs ABIERTOS, o sea que ya estan en rojo, y a esas no se las puede probar haciendolas fallar mas. Se probaron en sentido inverso, arreglando el dato en transaccion y confirmando que pasan a verde. Las cuatro respondieron. El trigger de cierre acepta las dos formas de prueba.',
 array['relaciones_verdad','correr_relaciones','v_relaciones_violadas','exigir_control_al_cerrar','controles_de_ticket'],
 'fix-v103',
 'El ambito vuelve a cuenta con un update. La constraint de mutante_resultado se puede volver a la lista anterior. v_relaciones_violadas tiene su definicion previa en el historial.'
) as registro;;
