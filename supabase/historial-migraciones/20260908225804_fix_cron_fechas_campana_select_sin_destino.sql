-- La tarea fechas_campana tenia ultimo_intento NULL: ni siquiera registraba el intento.
-- El cuerpo del cron era:
--   do $latido$ begin perform campaign_fechas_sincronizar(); select alertas_fechas_campana();;
--   perform latir('fechas_campana', true); exception when others then latir(false, sqlerrm); end
-- Un SELECT sin destino dentro de un bloque plpgsql no compila. Como el error es de
-- COMPILACION, el bloque nunca arranca y el manejador de excepciones tampoco: por eso no
-- quedaba ni el latido de falla. Un job que falla al compilar es invisible para la
-- vigilancia que se construyo justamente para verlo.
-- Ademas el ;; sobrante delataba una edicion a mano.
select cron.unschedule(jobid) from cron.job where jobname = 'fechas_campana';

select cron.schedule(
  'fechas_campana',
  '28 9 * * *',
  $cron$do $latido$
begin
  perform campaign_fechas_sincronizar();
  perform alertas_fechas_campana();
  perform latir('fechas_campana', true);
exception when others then
  perform latir('fechas_campana', false, sqlerrm);
end $latido$;$cron$
);;
