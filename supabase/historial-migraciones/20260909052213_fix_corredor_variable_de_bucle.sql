-- Correccion: la variable del FOREACH sobre un array de texto tiene que ser text,
-- no record. Con record, Postgres rechaza asignar un valor no compuesto.
create or replace function public.correr_relaciones(p_cuenta text default null)
returns table (cumplen int, violan int, no_aplican int, errores int)
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare r record; cta text; izq numeric; der numeric; aplica boolean; dif numeric;
        n_ok int := 0; n_viola int := 0; n_na int := 0; n_err int := 0;
        cuentas_a_correr text[];
begin
  select array_agg(account) into cuentas_a_correr
    from cuentas where activa and (p_cuenta is null or account = p_cuenta);

  for r in select * from relaciones_verdad where activa order by id loop
    foreach cta in array cuentas_a_correr loop
      begin
        aplica := true;
        if r.dominio_valido is not null then
          execute 'select (' || replace(r.dominio_valido, '$CUENTA$', quote_literal(cta)) || ')::boolean' into aplica;
        end if;

        if not coalesce(aplica, false) then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, cta, 'no_aplicaba', 'El dominio de validez no se cumple para esta cuenta. No es una violacion.');
          n_na := n_na + 1;
          continue;
        end if;

        execute 'select (' || replace(r.sql_izquierda, '$CUENTA$', quote_literal(cta)) || ')::numeric' into izq;
        execute 'select (' || replace(r.sql_derecha,   '$CUENTA$', quote_literal(cta)) || ')::numeric' into der;

        if izq is null and der is null then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, cta, 'no_aplicaba', 'Los dos lados dieron NULL: no hay datos para evaluar la relacion.');
          n_na := n_na + 1;
          continue;
        end if;

        dif := abs(coalesce(izq,0) - coalesce(der,0)) / nullif(greatest(abs(coalesce(izq,0)), abs(coalesce(der,0))), 0);

        if coalesce(dif, 0) <= r.tolerancia_rel then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel)
          values (r.id, cta, 'cumple', izq, der, dif);
          n_ok := n_ok + 1;
        else
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel, detalle)
          values (r.id, cta, 'viola', izq, der, dif,
                  r.que_afirma || ' Izquierda ' || izq || ', derecha ' || der ||
                  ', diferencia relativa ' || round(dif * 100, 2) || '%.');
          n_viola := n_viola + 1;
        end if;

      exception when others then
        insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
        values (r.id, cta, 'error', sqlerrm);
        n_err := n_err + 1;
      end;
    end loop;
  end loop;
  return query select n_ok, n_viola, n_na, n_err;
end $function$;

comment on function public.correr_relaciones(text) is
  'Corre todas las relaciones activas sobre todas las cuentas activas. $CUENTA$ se reemplaza por el nombre de la cuenta, escapado con quote_literal. Cuatro veredictos, y no_aplicaba NO es una falla: es la relacion diciendo que su dominio de validez no se cumple aca.';;
