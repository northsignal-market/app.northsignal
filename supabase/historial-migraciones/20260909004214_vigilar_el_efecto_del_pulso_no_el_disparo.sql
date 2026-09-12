-- El pulso diario no escribe desde el 6 de septiembre en las cuatro cuentas y nadie se
-- entero durante dos dias. La causa no es que faltara vigilancia, es QUE MEDIA la que habia:
--   do $latido$ begin perform disparar_pulso_respaldo(); perform latir('pulso_respaldo', true); ...
-- Ese latido se enciende porque el disparo no lanzo excepcion. El trabajo real ocurre del
-- otro lado, en la app, y ahi es donde viene fallando. Latio OK el 8 a las 10:45 sin
-- escribir una fila.
-- Un latido que mide el disparo y no el efecto es peor que no tener latido: da por sana
-- una tarea muerta. Lo encontraron los agentes semanales de KAREDO y BHI por separado,
-- tickets 50, 51 y 52.
--
-- Arreglo: vigilar el EFECTO. Una tarea nueva, pulso_diario, cuyo latido depende de que
-- haya filas en pulso_diario, no de que alguien haya disparado algo.

create or replace function public.verificar_pulso_del_dia()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare esperadas int; escritas int; dia date;
begin
  -- El pulso analiza el dia anterior, asi que se le da margen: cuenta como al dia si hay
  -- filas de ayer o de hoy.
  select count(*) into esperadas from cuentas where activa;
  select count(distinct account), max(fecha) into escritas, dia
    from pulso_diario where fecha >= current_date - 1;

  if escritas >= esperadas then
    perform latir('pulso_diario', true);
    return 'ok: ' || escritas || ' de ' || esperadas || ' cuentas con pulso al ' || dia;
  else
    perform latir('pulso_diario', false,
      'Solo ' || escritas || ' de ' || esperadas || ' cuentas tienen pulso de ayer u hoy. ' ||
      'El dato mas nuevo de pulso_diario es del ' || coalesce((select max(fecha)::text from pulso_diario), 'nunca') ||
      '. Ojo: pulso_respaldo puede figurar OK igual, porque ese latido mide el disparo y no el efecto.');
    return 'falla: ' || escritas || ' de ' || esperadas;
  end if;
end $function$;

comment on function public.verificar_pulso_del_dia() is
  'Vigila el EFECTO del pulso diario, no su disparo. pulso_respaldo late OK cuando la llamada sale sin excepcion, aunque la app falle despues y no escriba nada: asi el pulso estuvo muerto dos dias en las cuatro cuentas sin que ninguna alarma sonara.';

-- Alta de la tarea con el ultimo dato REAL, no con now(). Sembrar con now() es lo que hace
-- que una tarea muerta se vea sana: aca se quiere que diga la verdad desde el primer minuto.
insert into public.latidos (tarea, ultimo_ok, tolerancia, en_vigilancia, corridas_ok, corridas_falla)
values ('pulso_diario',
        (select max(fecha)::timestamptz from pulso_diario),
        '26:00:00', true, 0, 0)
on conflict (tarea) do update set tolerancia = excluded.tolerancia, en_vigilancia = true;

select cron.unschedule(jobid) from cron.job where jobname = 'pulso_verificar';
select cron.schedule(
  'pulso_verificar',
  '0 12 * * *',
  $cron$do $latido$
begin
  perform verificar_pulso_del_dia();
exception when others then
  perform latir('pulso_diario', false, 'la verificacion misma fallo: ' || sqlerrm);
end $latido$;$cron$
);

select verificar_pulso_del_dia() as estado_ahora;;
