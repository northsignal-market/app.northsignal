-- ================================================================
-- REPORTES v2: bloques editables con numeros bloqueados, versiones, link compartible, entrega
-- ================================================================
alter table reportes_cliente add column if not exists bloques jsonb;              -- [{etiqueta, texto, vinetas:[]}] editables; los numeros NO viven aca
alter table reportes_cliente add column if not exists token text unique;          -- link compartible /r/:token
alter table reportes_cliente add column if not exists visto_el timestamptz;       -- primera apertura del cliente
alter table reportes_cliente add column if not exists vistas int default 0;
alter table reportes_cliente add column if not exists nota_interna text;          -- lo que Andres quiere recordar de este envio
alter table reportes_cliente add column if not exists version int default 1;
alter table reportes_cliente drop constraint if exists reportes_cliente_estado_check;
alter table reportes_cliente add constraint reportes_cliente_estado_check check (estado in ('borrador','revisado','aprobado','enviado','descartado'));

create table if not exists reportes_versiones (
  id bigserial primary key, reporte_id bigint not null references reportes_cliente(id) on delete cascade,
  version int not null, fecha timestamptz default now(), autor text not null,      -- 'sonnet-5' | 'opus-5-semanal' | 'andres' | 'regenerar'
  bloques jsonb not null, motivo text, unique (reporte_id, version)
);
alter table reportes_versiones enable row level security; revoke all on reportes_versiones from anon, authenticated;

-- Token seguro para el link
create or replace function reporte_token() returns text language sql volatile as $$ select encode(extensions.gen_random_bytes(18), 'base64') $$;
create or replace function reporte_token_url() returns text language sql volatile set search_path = public, extensions as $$ select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_') $$;
update reportes_cliente set token = reporte_token_url() where token is null;

-- Plantilla de reporte por cuenta: que secciones, que KPIs, tono
alter table cuentas add column if not exists reporte_plantilla jsonb default '{}';
comment on column cuentas.reporte_plantilla is '{secciones: [contexto, observaciones, cambios, atencion, proximos], kpis: [gasto, conversiones, cpa, ctr], tono: "...", firma: "..."}';
update cuentas set reporte_plantilla = jsonb_build_object(
  'secciones', case when account = 'KAREDO' then '["context","observations","changes","attention","next"]'::jsonb else '["contexto","observaciones","cambios","atencion","proximos"]'::jsonb end,
  'kpis', case when account = 'KAREDO' then '["gasto","conversiones","cpa","ctr","cuota_impresiones"]'::jsonb when account = 'BHI' then '["gasto","conversiones","cpa","clics"]'::jsonb else '["gasto","conversiones","cpa","clics","ctr"]'::jsonb end,
  'firma', 'Andrés Biggs · NorthSignal'
) where reporte_plantilla = '{}' or reporte_plantilla is null;

-- Vista publica minima para el link (sin datos internos)
create or replace view v_reporte_publico with (security_invoker = true) as
select r.token, r.account, c.nombre_cliente, c.encabezado_reporte, r.periodo_desde, r.periodo_hasta, r.tipo, r.idioma, r.estado, r.bloques, r.resumen_ejecutivo, r.metricas, r.serie, r.campanas, r.aprobado_el, r.enviado_el, c.reporte_plantilla, r.version
from reportes_cliente r join cuentas c on c.account = r.account where r.estado in ('aprobado','enviado');
select count(*) reportes, count(token) con_token from reportes_cliente;;
