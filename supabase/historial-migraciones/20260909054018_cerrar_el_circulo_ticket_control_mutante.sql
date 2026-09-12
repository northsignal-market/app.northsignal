-- CERRAR EL CIRCULO. Hasta hoy el sistema detectaba bien y cerraba mal: el ticket 37
-- estuvo marcado resuelto sin estarlo, y el 29 lo vigila una relacion solo porque la ate
-- a mano. La deteccion sin remediacion verificada es solo ruido.
--
-- La forma viene de la practica de regresion: despues de cada incidente, tres preguntas,
-- y el control se actualiza ANTES de que el ticket cierre. Eso es lo que hace que la suite
-- deje de ser un artefacto estatico y pase a aprender de cada escape.
--
-- Aca la regla es: un ticket de bug o de dato incorrecto NO se cierra hasta que exista una
-- relacion que atrape su regreso, y esa relacion no cuenta hasta que mato a su mutante.
-- Un control que nunca se probo contra una falla inyectada no es un control, es una
-- esperanza.

alter table public.relaciones_verdad
  add column if not exists mutante_sql       text,
  add column if not exists mutante_probado_el date,
  add column if not exists mutante_resultado  text
    check (mutante_resultado in ('mato_al_mutante','sobrevivio','sin_probar'));

comment on column public.relaciones_verdad.mutante_sql is
  'UPDATE que corrompe el dato a proposito para probar que la relacion dispara. Se corre dentro de una transaccion con rollback: nunca toca produccion.';
comment on column public.relaciones_verdad.mutante_resultado is
  'mato_al_mutante = la relacion disparo con el dato corrompido, o sea sirve. sobrevivio = no disparo, o sea el control esta roto aunque se vea sano.';

create table if not exists public.controles_de_ticket (
  ticket_id      bigint not null references tickets(id) on delete cascade,
  relacion_id    bigint not null references relaciones_verdad(id) on delete restrict,
  como_lo_atrapa text not null,
  atado_el       timestamptz not null default now(),
  primary key (ticket_id, relacion_id)
);

comment on table public.controles_de_ticket is
  'Que relacion vigila que un ticket no vuelva. Sin esta fila, un ticket de bug no puede pasar a resuelto: es la diferencia entre arreglar y arreglar-y-que-quede-vigilado.';

alter table public.tickets
  add column if not exists auditoria_de_escape text,
  add column if not exists veces_reabierto int not null default 0;

comment on column public.tickets.auditoria_de_escape is
  'Las tres preguntas despues del incidente: 1) habia un control que cubriera esto, 2) si lo habia, por que paso en verde, 3) que cambia para que no vuelva a escapar. Se responde antes de cerrar, no despues.';

-- LA REGLA, como trigger. No es una convencion que haya que recordar.
create or replace function public.exigir_control_al_cerrar()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare n_controles int; n_probados int;
begin
  if new.estado = 'resuelto' and coalesce(old.estado,'') <> 'resuelto'
     and new.tipo in ('bug','dato_incorrecto') then

    select count(*), count(*) filter (where r.mutante_resultado = 'mato_al_mutante')
      into n_controles, n_probados
      from controles_de_ticket ct
      join relaciones_verdad r on r.id = ct.relacion_id and r.activa
     where ct.ticket_id = new.id;

    if n_controles = 0 then
      raise exception 'El ticket % no se puede cerrar: ningun control vigila que vuelva. Ata una relacion de relaciones_verdad en controles_de_ticket, o si de verdad no aplica, cerralo como "no_aplica" en vez de "resuelto".', new.id;
    end if;

    if n_probados = 0 then
      raise exception 'El ticket % tiene % control(es) atado(s) pero ninguno probo que puede fallar. Corre su mutante y dejalo en mutante_resultado. Un control sin mutante probado no es un control, es una esperanza.', new.id, n_controles;
    end if;

    if new.auditoria_de_escape is null then
      raise exception 'El ticket % necesita auditoria_de_escape antes de cerrar: si habia un control que cubriera esto, por que paso en verde, y que cambia para que no escape otra vez.', new.id;
    end if;
  end if;

  -- Reapertura: se cuenta, porque la tasa de reapertura es la metrica que delata un
  -- proceso que cierra tickets sin verificar. El 37 se cerro sin estarlo.
  if coalesce(old.estado,'') = 'resuelto' and new.estado = 'abierto' then
    new.veces_reabierto := coalesce(old.veces_reabierto, 0) + 1;
  end if;

  return new;
end $$;

drop trigger if exists trg_exigir_control_al_cerrar on public.tickets;
create trigger trg_exigir_control_al_cerrar
  before update on public.tickets
  for each row execute function public.exigir_control_al_cerrar();

comment on function public.exigir_control_al_cerrar() is
  'Un ticket de bug no cierra hasta que exista una relacion que atrape su regreso, esa relacion haya matado a su mutante, y esten respondidas las tres preguntas del escape. Es la regla que convierte los detectores sueltos en un ciclo.';

create or replace view public.v_tickets_sin_control as
select t.id, t.cuenta, t.tipo, left(t.titulo, 90) as titulo, t.estado, t.veces_reabierto,
       count(ct.relacion_id) as controles,
       count(*) filter (where r.mutante_resultado = 'mato_al_mutante') as controles_probados,
       case when count(ct.relacion_id) = 0 then 'Sin control: si vuelve, nadie se entera.'
            when count(*) filter (where r.mutante_resultado = 'mato_al_mutante') = 0
              then 'Tiene control pero sin mutante probado: no se sabe si puede fallar.'
            else 'Cubierto.' end as lectura
  from tickets t
  left join controles_de_ticket ct on ct.ticket_id = t.id
  left join relaciones_verdad r on r.id = ct.relacion_id
 where t.estado = 'abierto' and t.tipo in ('bug','dato_incorrecto')
 group by t.id, t.cuenta, t.tipo, t.titulo, t.estado, t.veces_reabierto
 order by count(ct.relacion_id), t.id;

comment on view public.v_tickets_sin_control is
  'Tickets abiertos de bug que hoy no podrian cerrarse porque nada vigila que vuelvan. Es la cola de trabajo real: cada uno necesita una relacion antes que un arreglo.';;
