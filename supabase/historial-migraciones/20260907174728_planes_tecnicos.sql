-- Planes tecnicos: decisiones de arquitectura que sobreviven a la sesion que las penso.
-- Los agentes los leen; sin esto, un plan vive en un archivo suelto y se pierde.
create table if not exists planes_tecnicos (
  id bigserial primary key,
  clave text unique not null,
  titulo text not null,
  account text,
  estado text not null default 'propuesto' check (estado in ('propuesto','en_curso','hecho','descartado')),
  contenido text not null,
  decision_pendiente text,
  fecha date default current_date,
  actualizado timestamptz default now()
);
alter table planes_tecnicos enable row level security; revoke all on planes_tecnicos from anon, authenticated;
comment on table planes_tecnicos is 'Planes de arquitectura vigentes. Un plan que vive solo en un archivo se pierde; aca lo lee el sistema y cualquier sesion futura. estado dice si se ejecuto.';
select 'ok';;
