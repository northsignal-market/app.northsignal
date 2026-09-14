-- ---------------------------------------------------------------------------
-- `stage_name` ES EL NOMBRE DE GHL, NO EL NUESTRO.
--
-- El sondeo del 14/9/2026 mostró que el pipeline real de BHI ("Marketing y
-- Ventas") tiene DIEZ columnas, y que `funnel_stages` declaraba una que no
-- existía: "Envio de formulario". Andrés lo aclaró: esa etapa es la que en GHL se
-- llama **Nuevo Lead**. No era una etapa fantasma, era el nombre equivocado.
--
-- Y ahí está la ambigüedad que hay que fijar. El webhook hace:
--
--     buscarEtapa(etapas, payload.pipeline_stage)   -- compara contra stage_name
--
-- O sea que `stage_name` TIENE que ser el nombre tal como lo manda GoHighLevel.
-- El nombre nuestro —el de la acción de conversión en Google— ya vive en
-- `google_conversion_action`, y sigue siendo "Envío de formulario". Los dos
-- nombres son correctos; lo que estaba mal era cuál iba en cuál columna.
--
-- Con este cambio casan 4 de 10. Las otras seis siguen yendo a SIN_MAPEO a
-- propósito: no tienen valor asignado, y un valor inventado en una etapa es un
-- CPA inventado aguas abajo. Se declaran cuando Andrés diga cuánto vale cada una.
--
--   Nuevo Lead            -> declarada (era "Envio de formulario")
--   Intento de Contacto   -> SIN_MAPEO
--   Contactado            -> SIN_MAPEO
--   Asesoría Agendada     -> declarada
--   Asesoría Realizada    -> declarada
--   En Seguimiento        -> SIN_MAPEO
--   Proceso Iniciado      -> SIN_MAPEO
--   Cliente Activo        -> declarada
--   Cerrado Perdido       -> SIN_MAPEO   <- la que más le importa a Andrés
--   Descartado            -> SIN_MAPEO   <- ídem
-- ---------------------------------------------------------------------------

update public.funnel_stages
   set stage_name = 'Nuevo Lead'
 where account = 'BHI'
   and source = 'ghl_stage'
   and stage_name = 'Envio de formulario';

comment on column public.funnel_stages.stage_name is
  'El nombre de la etapa TAL COMO LO MANDA EL ORIGEN (GoHighLevel, Asana). El webhook compara el payload contra esta columna, asi que un nombre nuestro aca hace que la etapa nunca case y el evento caiga en SIN_MAPEO. El nombre nuestro va en google_conversion_action. Caso real: BHI declaraba "Envio de formulario" y GHL manda "Nuevo Lead".';

-- Que se vea si vuelve a pasar: una etapa declarada que el origen nunca mandó.
do $$
declare n int;
begin
  select count(*) into n from public.funnel_stages
   where account = 'BHI' and source = 'ghl_stage'
     and stage_name not in ('Nuevo Lead','Asesoría Agendada','Asesoria Agendada',
                            'Asesoría Realizada','Asesoria Realizada','Cliente Activo');
  if n > 0 then
    raise notice 'Hay % etapa(s) de BHI que no coinciden con ninguna columna del pipeline de GHL. Van a caer en SIN_MAPEO.', n;
  end if;
end $$;
