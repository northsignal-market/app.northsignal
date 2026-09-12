-- ============================================================
-- LATIDOS · DETECCION DE LO QUE NO CORRIO
-- ============================================================
-- El modo de falla de pg_cron es el SILENCIO: si Supabase tiene un incidente,
-- toca el techo de conexiones o el proyecto se pausa, las 18 tareas se detienen
-- sin una sola alerta y el historial solo muestra un hueco. Y el sistema que
-- avisaria (la salud, la auditoria, el correo de las 9:15) son tareas tambien.
--
-- El patron correcto se llama interruptor de hombre muerto: algo de AFUERA
-- verifica que el latido llego, y avisa por su AUSENCIA. Nuestro observador
-- externo son los scripts de Google Ads, que corren en infraestructura de
-- Google y ya llaman al sistema todos los dias.
-- ============================================================

create table if not exists latidos (
  tarea text primary key,
  ultimo_ok timestamptz,
  ultimo_intento timestamptz,
  ultimo_error text,
  corridas_ok int default 0,
  corridas_falla int default 0,
  -- Cada cuanto se espera. Con margen: una tarea diaria tolera 25 horas.
  tolerancia interval not null default interval '25 hours'
);
alter table latidos enable row level security; revoke all on latidos from anon, authenticated;
comment on table latidos is 'Ultima corrida exitosa de cada tarea. Un observador externo lee esto y avisa por la AUSENCIA de latido, que es como se detecta que pg_cron dejo de disparar: el historial no registra lo que nunca corrio.';

create or replace function latir(p_tarea text, p_ok boolean default true, p_error text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into latidos (tarea, ultimo_ok, ultimo_intento, ultimo_error, corridas_ok, corridas_falla)
  values (p_tarea, case when p_ok then now() end, now(), case when not p_ok then p_error end,
          case when p_ok then 1 else 0 end, case when p_ok then 0 else 1 end)
  on conflict (tarea) do update set
    ultimo_ok = case when p_ok then now() else latidos.ultimo_ok end,
    ultimo_intento = now(),
    ultimo_error = case when p_ok then null else p_error end,
    corridas_ok = latidos.corridas_ok + case when p_ok then 1 else 0 end,
    corridas_falla = latidos.corridas_falla + case when p_ok then 0 else 1 end;
$$;
revoke execute on function latir from anon, authenticated;

-- Sembrar desde las tareas que ya existen, con la tolerancia derivada del horario
insert into latidos (tarea, tolerancia)
select j.jobname,
  case
    when j.schedule ~ '^\*/\d+' then interval '2 hours'
    when j.schedule ~ '^\d+ \d+ \* \* \*$' then interval '25 hours'
    when j.schedule ~ '\* \* [0-6]$' then interval '8 days'
    else interval '25 hours' end
from cron.job j where j.active
on conflict (tarea) do nothing;

-- Las tareas de Cowork y los scripts, que no son crons de la base
insert into latidos (tarea, tolerancia) values
  ('extraccion_diaria', interval '26 hours'),
  ('extraccion_semanal', interval '8 days'),
  ('centinela', interval '5 hours'),
  ('ejecutor', interval '2 hours'),
  ('tarea_semanal_KAREDO', interval '8 days'),
  ('tarea_semanal_BHI', interval '8 days'),
  ('tarea_semanal_360', interval '8 days'),
  ('tarea_semanal_FRESH_MONKEE', interval '8 days')
on conflict (tarea) do nothing;

-- Lo que NO latio a tiempo. Esta es la vista que lee el observador externo.
create or replace view v_tareas_en_silencio with (security_invoker = true) as
select l.tarea,
  l.ultimo_ok,
  case when l.ultimo_ok is null then 'nunca corrio'
       else round(extract(epoch from (now() - l.ultimo_ok))/3600.0)::text || ' horas sin correr' end estado,
  l.tolerancia,
  round(extract(epoch from l.tolerancia)/3600.0)::text || ' horas de tolerancia' esperado,
  l.ultimo_error,
  case
    when l.ultimo_ok is null then 'Nunca registro una corrida buena. Puede ser que la tarea no exista o que nunca haya latido.'
    else 'La tarea ' || l.tarea || ' no corre desde hace ' || round(extract(epoch from (now() - l.ultimo_ok))/3600.0) ||
         ' horas, y se espera cada ' || round(extract(epoch from l.tolerancia)/3600.0) || '. Si son varias a la vez, mira si Supabase tuvo un incidente: pg_cron se detiene entero sin avisar.' end lectura
from latidos l
where l.ultimo_ok is null or l.ultimo_ok < now() - l.tolerancia;

select count(*) tareas_con_latido from latidos;;
