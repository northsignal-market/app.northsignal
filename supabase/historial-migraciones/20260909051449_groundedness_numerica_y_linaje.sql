-- GROUNDEDNESS NUMERICA. Cada cifra publicada guarda el SQL que la produjo, y un
-- verificador DETERMINISTA la recalcula. No lo hace un agente: cuando el generador y el
-- juez comparten linaje el juez favorece al generador, y la correlacion de errores entre
-- modelos ronda el 60% de acuerdo dado que ambos se equivocan.
-- El verificador recibe el numero y la consulta, NUNCA la narrativa: un verificador que ve
-- el relato valida coherencia interna en vez de anclaje a la evidencia.

create table if not exists public.cifras_publicadas (
  id                bigserial primary key,
  brief_id          text not null,
  cuenta            text not null,
  etiqueta          text not null,
  valor             numeric not null,
  unidad            text,
  sql_origen        text not null,
  objetos_usados    text[],
  publicada_el      timestamptz not null default now(),
  publicada_por     text,
  verificada_el     timestamptz,
  valor_recalculado numeric,
  veredicto         text,
  detalle           text,
  unique (brief_id, etiqueta)
);

comment on table public.cifras_publicadas is
  'Toda cifra que sale a un brief o a un cliente, con el SQL exacto que la produjo. verificar_cifras() la recalcula sin ver el texto del brief. veredicto no_reproducible NO es un error del verificador: es el hallazgo de que la consulta ya no devuelve lo mismo, casi siempre porque cambio una vista abajo.';

create index if not exists ix_cifras_sin_verificar
  on public.cifras_publicadas (publicada_el) where veredicto is null;

create or replace function public.verificar_cifras(p_brief text default null, p_limite int default 200)
returns table (verificadas int, coinciden int, difieren int, no_reproducibles int)
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare r record; v numeric; n int := 0; ok int := 0; dif int := 0; nore int := 0; s text;
begin
  for r in
    select id, sql_origen, valor from cifras_publicadas
     where veredicto is null and (p_brief is null or brief_id = p_brief)
     order by publicada_el limit p_limite
  loop
    s := lower(btrim(r.sql_origen));

    -- Guarda de forma: el SQL lo escribe un agente, asi que solo se acepta UNA consulta
    -- de lectura. Sin esto la tabla seria una via de ejecucion arbitraria contra la base.
    if s !~ '^(select|with)\s' or s like '%;%'
       or s ~ '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do)\m' then
      update cifras_publicadas
         set veredicto = 'no_reproducible', verificada_el = now(),
             detalle = 'El SQL de origen no es una sola consulta de lectura. Solo se acepta un SELECT o WITH, sin punto y coma ni sentencias de escritura.'
       where id = r.id;
      nore := nore + 1; n := n + 1; continue;
    end if;

    begin
      execute 'select (' || r.sql_origen || ')::numeric' into v;
    exception when others then
      update cifras_publicadas
         set veredicto = 'no_reproducible', verificada_el = now(),
             detalle = 'La consulta ya no corre o no devuelve un solo numero: ' || sqlerrm ||
                       '. Suele significar que cambio una vista aguas abajo, que es justo lo que hay que saber.'
       where id = r.id;
      nore := nore + 1; n := n + 1; continue;
    end;

    -- Tolerancia relativa de una milesima: absorbe redondeo, no absorbe un error real.
    if v is not null and abs(v - r.valor) <= greatest(abs(r.valor) * 0.001, 0.01) then
      update cifras_publicadas
         set veredicto = 'coincide', valor_recalculado = v, verificada_el = now(), detalle = null
       where id = r.id;
      ok := ok + 1;
    else
      update cifras_publicadas
         set veredicto = 'difiere', valor_recalculado = v, verificada_el = now(),
             detalle = 'Publicado ' || r.valor || ', recalculado ' || coalesce(v::text, 'NULL') ||
                       '. La cifra del brief no se reproduce desde su propia fuente.'
       where id = r.id;
      dif := dif + 1;
    end if;
    n := n + 1;
  end loop;
  return query select n, ok, dif, nore;
end $function$;

comment on function public.verificar_cifras(text, int) is
  'Recalcula cada cifra publicada desde el SQL que la produjo. Determinista, sin modelo. Valida la forma del SQL antes de ejecutarlo porque el texto lo escribe un agente: solo una sentencia SELECT o WITH, sin punto y coma ni escrituras.';

create or replace view public.v_cifras_sospechosas as
select c.cuenta, c.brief_id, c.etiqueta, c.valor as publicado, c.valor_recalculado as recalculado,
       c.veredicto, c.detalle, c.publicada_el, c.publicada_por
  from cifras_publicadas c
 where c.veredicto in ('difiere', 'no_reproducible')
 order by c.publicada_el desc;

-- LINAJE. Las 1.295 aristas ya estaban en el catalogo y no las miraba nadie.
-- OJO: relname es de tipo name, que arrastra collation "C" incluso al castear a text.
-- Sin el COLLATE "default" explicito, cualquier CTE recursivo sobre esta vista falla.
create or replace view public.v_linaje as
select distinct
       (dependiente.relname::text) collate "default" as objeto,
       case dependiente.relkind when 'v' then 'vista' when 'm' then 'materializada' else 'tabla' end as tipo_objeto,
       (fuente.relname::text) collate "default" as depende_de,
       case fuente.relkind when 'v' then 'vista' when 'm' then 'materializada' else 'tabla' end as tipo_fuente
  from pg_depend d
  join pg_rewrite r         on r.oid = d.objid
  join pg_class dependiente on dependiente.oid = r.ev_class
  join pg_class fuente      on fuente.oid = d.refobjid
  join pg_namespace nd      on nd.oid = dependiente.relnamespace
  join pg_namespace nf      on nf.oid = fuente.relnamespace
 where d.classid = 'pg_rewrite'::regclass
   and nd.nspname = 'public' and nf.nspname = 'public'
   and dependiente.oid <> fuente.oid;

comment on view public.v_linaje is
  'Grafo de dependencias a nivel objeto, leido de pg_depend y pg_rewrite. Ya existia en el catalogo. Los nombres van con COLLATE "default" a proposito: relname es name y arrastra collation C, que rompe cualquier recorrido recursivo. Para saber COMO se transforma cada columna hace falta parsear el SQL con sqlglot o LineageX; esto no lo hace.';

create or replace function public.que_publique_con(p_objeto text)
returns table (cuenta text, brief_id text, etiqueta text, valor numeric, veredicto text, publicada_el timestamptz)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  with recursive aguas_abajo as (
    select p_objeto as objeto
    union
    select l.objeto from v_linaje l join aguas_abajo a on l.depende_de = a.objeto
  )
  select c.cuenta, c.brief_id, c.etiqueta, c.valor, c.veredicto, c.publicada_el
    from cifras_publicadas c
   where exists (
     select 1 from aguas_abajo a
      where c.sql_origen ilike '%' || a.objeto || '%'
         or a.objeto = any (c.objetos_usados))
   order by c.publicada_el desc;
$$;

comment on function public.que_publique_con(text) is
  'Dado un objeto que resulto estar mal, devuelve las cifras ya publicadas que salieron de el o de cualquier vista que lo use, recorriendo el grafo hacia abajo. Es la pregunta que el 8 de septiembre no se pudo responder cuando aparecieron numeros equivocados ya copiados a briefs y a Notion.';;
