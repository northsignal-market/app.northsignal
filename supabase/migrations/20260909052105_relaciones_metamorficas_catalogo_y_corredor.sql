-- RELACIONES METAMORFICAS. Resuelven el problema del oraculo: no se puede saber cual era
-- el CPA correcto, pero si se sabe que la suma de las partes tiene que dar el total.
--
-- Las familias salen del catalogo publicado para sistemas basados en consultas (Segura,
-- Duran y Ruiz-Cortes, MET 2019), derivado de algebra relacional, y de la taxonomia de
-- patrones (conservacion, monotonia, simetria, aditivas, orden parcial).
--
-- DISTINCION QUE IMPORTA y que corrige mi propia lista anterior: de las cinco que propuse,
-- solo tres son metamorficas. "Ventana" y "alcance" son INVARIANTES DE DOMINIO: no
-- comparan dos ejecuciones, comparan una ejecucion contra una regla del negocio. Se
-- registran igual pero con familia distinta, porque se razonan distinto.
--
-- Y el campo que evita que esto muera de ruido: dominio_valido. La literatura es explicita
-- en que una relacion aplicada fuera de su dominio de validez da falso positivo, y hay que
-- distinguir "se violo" de "no aplicaba".

create table if not exists public.relaciones_verdad (
  id             bigserial primary key,
  familia        text not null check (familia in
                   ('conservacion','monotonia','equivalencia','invariante_dominio')),
  nombre         text not null unique,
  que_afirma     text not null,
  sql_izquierda  text not null,
  sql_derecha    text not null,
  dominio_valido text,
  tolerancia_rel numeric not null default 0.001,
  por_que_existe text not null,
  activa         boolean not null default true,
  creada_el      date not null default current_date
);

comment on table public.relaciones_verdad is
  'Relaciones que tienen que cumplirse pase lo que pase. Familias metamorficas (conservacion, monotonia, equivalencia) mas invariantes de dominio, que no son lo mismo: la metamorfica compara dos ejecuciones entre si, la invariante compara una ejecucion contra una regla del negocio. dominio_valido devuelve booleano y decide si la relacion APLICA: sin eso una relacion fuera de dominio da falso positivo y se termina ignorando, que es como mueren todas las alertas.';

create table if not exists public.corridas_verdad (
  id            bigserial primary key,
  relacion_id   bigint not null references relaciones_verdad(id),
  cuenta        text,
  corrida_el    timestamptz not null default now(),
  veredicto     text not null check (veredicto in ('cumple','viola','no_aplicaba','error')),
  valor_izq     numeric,
  valor_der     numeric,
  diferencia_rel numeric,
  detalle       text
);

create index if not exists ix_corridas_verdad on public.corridas_verdad (relacion_id, corrida_el desc);

-- El corredor. Guarda de forma igual que verificar_cifras: el SQL puede venir de un agente.
create or replace function public.correr_relaciones(p_cuenta text default null)
returns table (cumplen int, violan int, no_aplican int, errores int)
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare r record; c record; izq numeric; der numeric; aplica boolean; dif numeric;
        n_ok int := 0; n_viola int := 0; n_na int := 0; n_err int := 0;
        cuentas_a_correr text[];
begin
  select array_agg(account) into cuentas_a_correr
    from cuentas where activa and (p_cuenta is null or account = p_cuenta);

  for r in select * from relaciones_verdad where activa order by id loop
    foreach c in array cuentas_a_correr loop
      begin
        -- ¿Aplica? Si no, se registra como no_aplicaba, que NO es una falla.
        aplica := true;
        if r.dominio_valido is not null then
          execute 'select (' || replace(r.dominio_valido, '$CUENTA$', quote_literal(c)) || ')::boolean' into aplica;
        end if;

        if not coalesce(aplica, false) then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, c, 'no_aplicaba', 'El dominio de validez no se cumple para esta cuenta. No es una violacion.');
          n_na := n_na + 1;
          continue;
        end if;

        execute 'select (' || replace(r.sql_izquierda, '$CUENTA$', quote_literal(c)) || ')::numeric' into izq;
        execute 'select (' || replace(r.sql_derecha,   '$CUENTA$', quote_literal(c)) || ')::numeric' into der;

        if izq is null and der is null then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, c, 'no_aplicaba', 'Los dos lados dieron NULL: no hay datos para evaluar la relacion.');
          n_na := n_na + 1;
          continue;
        end if;

        dif := abs(coalesce(izq,0) - coalesce(der,0)) / nullif(greatest(abs(coalesce(izq,0)), abs(coalesce(der,0))), 0);

        if coalesce(dif, 0) <= r.tolerancia_rel then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel)
          values (r.id, c, 'cumple', izq, der, dif);
          n_ok := n_ok + 1;
        else
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel, detalle)
          values (r.id, c, 'viola', izq, der, dif,
                  r.que_afirma || ' Izquierda ' || izq || ', derecha ' || der ||
                  ', diferencia relativa ' || round(dif * 100, 2) || '%.');
          n_viola := n_viola + 1;
        end if;

      exception when others then
        insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
        values (r.id, c, 'error', sqlerrm);
        n_err := n_err + 1;
      end;
    end loop;
  end loop;
  return query select n_ok, n_viola, n_na, n_err;
end $function$;

comment on function public.correr_relaciones(text) is
  'Corre todas las relaciones activas sobre todas las cuentas activas. $CUENTA$ se reemplaza por el nombre de la cuenta, escapado. Distingue cuatro veredictos y no_aplicaba NO es una falla: es la relacion diciendo que su dominio de validez no se cumple aca.';

create or replace view public.v_relaciones_violadas as
select r.familia, r.nombre, r.que_afirma, c.cuenta, c.valor_izq, c.valor_der,
       round(c.diferencia_rel * 100, 2) as diferencia_pct, c.detalle, c.corrida_el, r.por_que_existe
  from corridas_verdad c
  join relaciones_verdad r on r.id = c.relacion_id
 where c.veredicto = 'viola'
   and c.corrida_el = (select max(c2.corrida_el) from corridas_verdad c2 where c2.relacion_id = c.relacion_id and c2.cuenta = c.cuenta)
 order by r.familia, r.nombre;;
