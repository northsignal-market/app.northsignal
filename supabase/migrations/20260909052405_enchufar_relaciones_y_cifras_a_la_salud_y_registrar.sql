-- Que lo construido hoy se lea sin ir a buscarlo, y que corra solo.
create or replace view public.v_salud_calidad as
select 'metricas'::text as area, 'metrica_reescrita' as prueba, m.objeto as cuenta, 'ATENCION' as estado,
       m.metrica || ': ' || m.por_que || ' Usar ' || m.usar_en_su_lugar as detalle
  from v_metricas_reescritas m
union all
select 'verdad', 'relacion_violada', v.cuenta, 'FALLA',
       v.familia || ' / ' || v.nombre || ': ' || v.detalle
  from v_relaciones_violadas v
union all
select 'verdad', 'cifra_no_verificada', c.cuenta, 'ATENCION',
       c.etiqueta || ': publicada el ' || c.publicada_el::date || ' y todavia sin verificar. ' ||
       'Correr verificar_cifras(''' || c.brief_id || ''').'
  from cifras_publicadas c where c.veredicto is null and c.publicada_el < now() - interval '2 hours'
union all
select 'verdad', 'cifra_sospechosa', s.cuenta, 'FALLA',
       s.etiqueta || ' [' || s.veredicto || ']: ' || left(s.detalle, 200)
  from v_cifras_sospechosas s;

comment on view public.v_salud_calidad is
  'La capa de calidad semantica en una sola vista: metricas reescritas a mano, relaciones de verdad violadas, cifras publicadas sin verificar y cifras que no se reproducen desde su fuente. Es lo que distingue "el dato existe" de "el dato significa lo que dice".';

select cron.unschedule(jobid) from cron.job where jobname = 'relaciones_verdad';
select cron.schedule('relaciones_verdad', '10 11 * * *',
  $cron$do $latido$
begin
  perform correr_relaciones();
  perform latir('relaciones_verdad', true);
exception when others then
  perform latir('relaciones_verdad', false, sqlerrm);
end $latido$;$cron$);

insert into public.latidos (tarea, ultimo_ok, tolerancia, en_vigilancia, corridas_ok, corridas_falla)
values ('relaciones_verdad', now(), '26:00:00', true, 1, 0)
on conflict (tarea) do update set en_vigilancia = true, tolerancia = excluded.tolerancia;

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Se construyo la capa de calidad semantica: metricas canonicas con linter, groundedness numerica con verificador determinista, linaje, y relaciones de verdad. Las cinco relaciones dieron 20 de 20 cumpliendo.',
 'No creerle a un resultado perfecto: probarlo con mutacion antes de darlo por bueno.',
 'Se duplico el gasto de keywords_daily de KAREDO dentro de una transaccion. La relacion de monotonia disparo (1 viola, 4 cumplen) y el rollback dejo la tabla en 2.113,50 exactos. El chequeo mata al mutante.',
 'Un tablero en verde no prueba nada hasta que se prueba que puede ponerse en rojo. La mutacion en transaccion con rollback es la forma barata de verificarlo en Postgres: se corrompe un dato a proposito, se corre el chequeo, se revierte. Un control que nunca disparo desde que existe es sospechoso, y uno que no mata a un mutante evidente esta roto aunque se vea sano. Aplica a cada control que se agregue de aca en mas: se entrega con su mutante probado.',
 'acierto', 0.95, 1, 'claude');

select registrar_cambio(
 'Capa de calidad semantica: metricas canonicas, groundedness numerica, linaje y relaciones de verdad',
 'El problema de este sistema nunca fue integridad sino significado: todos los errores caros fueron logica equivocada produciendo numeros verosimiles, y una firma criptografica los habria firmado con la misma prolijidad. Se construyo lo que si ataca eso. (1) Capa de metricas: ventana_metrica devuelve la ventana REAL con un flag honesta, mas metrica_conversiones, metrica_gasto y metrica_cpa que devuelve NULL con cero conversiones a proposito. Validado: reproducen exacto lo que publica v_headroom en las cuatro cuentas. El linter v_metricas_reescritas encontro 9 objetos calculando metricas inline, tres mas de los estimados. (2) Groundedness numerica: cifras_publicadas guarda el SQL que produjo cada cifra y verificar_cifras la recalcula sin ver el brief, porque un verificador que ve el relato valida coherencia y no verdad, y no puede ser otro modelo por preference leakage. Probado contra seis casos incluidos dos intentos de inyeccion, ambos frenados por la guarda de forma. (3) Linaje sobre pg_depend, 192 aristas a nivel objeto (no 1.295: ese numero contaba una fila por referencia de columna), mas que_publique_con() para saber que briefs contamino una vista equivocada. (4) Relaciones de verdad con las familias del catalogo publicado para sistemas basados en consultas: conservacion, monotonia, equivalencia e invariantes de dominio, que NO son metamorficas y por eso van en familia aparte. 20 de 20 cumplen, y la mutacion confirma que pueden fallar.',
 array['metricas','patrones_drift','v_metricas_reescritas','ventana_metrica','metrica_conversiones','metrica_gasto','metrica_cpa','cifras_publicadas','verificar_cifras','v_linaje','que_publique_con','relaciones_verdad','correr_relaciones','v_salud_calidad'],
 'fix-v100',
 'Todo lo nuevo es aditivo: ninguna vista ni funcion existente fue modificada, asi que revertir es dropear los objetos nuevos y el cron relaciones_verdad. Las cuatro metricas canonicas reproducen los valores que ya publicaban las vistas, verificado antes de entregar.'
) as registro;;
