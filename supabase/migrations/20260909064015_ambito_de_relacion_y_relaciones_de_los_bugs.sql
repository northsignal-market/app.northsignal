-- AMBITO. Habia metido una relacion global (una condicion del ESQUEMA, no de cada cuenta)
-- restringiendola con un dominio_valido que la limitaba a una cuenta arbitraria. Funcionaba
-- y producia tres no_aplicaba falsos, que es exactamente el ruido que la separacion entre
-- "violo" y "no aplicaba" existe para evitar. Se arregla declarando el ambito.

alter table public.relaciones_verdad
  add column if not exists ambito text not null default 'cuenta'
    check (ambito in ('cuenta','global'));

comment on column public.relaciones_verdad.ambito is
  'cuenta: se corre una vez por cuenta activa y $CUENTA$ se reemplaza. global: se corre una sola vez, es una condicion del esquema o del sistema. Sin esta distincion, una relacion global hay que disfrazarla de por-cuenta con un dominio_valido arbitrario, y eso genera no_aplicaba falsos.';

update relaciones_verdad set ambito = 'global', dominio_valido = null
 where nombre = 'columnas_de_fecha_son_de_tipo_fecha';

create or replace function public.correr_relaciones(p_cuenta text default null)
returns table (cumplen int, violan int, no_aplican int, errores int)
language plpgsql security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare r record; cta text; izq numeric; der numeric; aplica boolean; dif numeric;
        n_ok int := 0; n_viola int := 0; n_na int := 0; n_err int := 0;
        objetivos text[];
begin
  for r in select * from relaciones_verdad where activa order by id loop

    -- Una relacion global se corre una sola vez, sin cuenta. Una de cuenta, una vez por cuenta.
    if r.ambito = 'global' then
      if p_cuenta is not null then continue; end if;   -- no tiene sentido filtrarla por cuenta
      objetivos := array[null::text];
    else
      select array_agg(account) into objetivos
        from cuentas where activa and (p_cuenta is null or account = p_cuenta);
    end if;

    foreach cta in array objetivos loop
      begin
        aplica := true;
        if r.dominio_valido is not null then
          execute 'select (' || replace(r.dominio_valido, '$CUENTA$', quote_literal(coalesce(cta,''))) || ')::boolean' into aplica;
        end if;

        if not coalesce(aplica, false) then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, cta, 'no_aplicaba', 'El dominio de validez no se cumple aca. No es una violacion.');
          n_na := n_na + 1; continue;
        end if;

        execute 'select (' || replace(r.sql_izquierda, '$CUENTA$', quote_literal(coalesce(cta,''))) || ')::numeric' into izq;
        execute 'select (' || replace(r.sql_derecha,   '$CUENTA$', quote_literal(coalesce(cta,''))) || ')::numeric' into der;

        if izq is null and der is null then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, cta, 'no_aplicaba', 'Los dos lados dieron NULL: no hay datos para evaluar.');
          n_na := n_na + 1; continue;
        end if;

        dif := abs(coalesce(izq,0) - coalesce(der,0)) / nullif(greatest(abs(coalesce(izq,0)), abs(coalesce(der,0))), 0);

        if coalesce(dif, 0) <= r.tolerancia_rel then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel)
          values (r.id, cta, 'cumple', izq, der, dif);
          n_ok := n_ok + 1;
        else
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel, detalle)
          values (r.id, cta, 'viola', izq, der, dif,
                  r.que_afirma || ' Izquierda ' || izq || ', derecha ' || der || ', diferencia ' || round(dif*100,2) || '%.');
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

-- RELACIONES PARA CUATRO DE LOS SEIS BUGS SIN CONTROL.
insert into relaciones_verdad (familia, nombre, ambito, que_afirma, sql_izquierda, sql_derecha, dominio_valido, tolerancia_rel, por_que_existe) values

('conservacion', 'conversiones_diaria_igual_a_semanal', 'cuenta',
 'Las conversiones de una semana completa leidas desde la capa diaria tienen que dar igual que desde la semanal.',
 'select sum(d.conversions) from campaign_daily d where d.account = $CUENTA$ and d.date between (select max(c.week_start) from campaign c where c.account = $CUENTA$ and c.week_start >= (select min(date) from campaign_daily where account = $CUENTA$) and c.week_start + 6 <= (select max(date) from campaign_daily where account = $CUENTA$)) and (select max(c.week_start) from campaign c where c.account = $CUENTA$ and c.week_start >= (select min(date) from campaign_daily where account = $CUENTA$) and c.week_start + 6 <= (select max(date) from campaign_daily where account = $CUENTA$)) + 6',
 'select sum(c.conversions) from campaign c where c.account = $CUENTA$ and c.week_start = (select max(c2.week_start) from campaign c2 where c2.account = $CUENTA$ and c2.week_start >= (select min(date) from campaign_daily where account = $CUENTA$) and c2.week_start + 6 <= (select max(date) from campaign_daily where account = $CUENTA$))',
 'select (select max(c.week_start) from campaign c where c.account = $CUENTA$ and c.week_start >= (select min(date) from campaign_daily where account = $CUENTA$) and c.week_start + 6 <= (select max(date) from campaign_daily where account = $CUENTA$)) is not null',
 0.02,
 'Ticket 16: campaign_daily conserva la definicion de conversion vigente al momento de extraerse. Si esa definicion cambia entre la extraccion diaria y la semanal, las dos capas divergen en conversiones aunque coincidan en gasto. La hermana de gasto ya existe; esta mira la columna que de verdad puede moverse.'),

('invariante_dominio', 'toda_cuenta_declara_su_embudo', 'cuenta',
 'Cada cuenta activa tiene que declarar al menos una etapa en funnel_stages.',
 'select (count(*) > 0)::int from funnel_stages where account = $CUENTA$',
 'select 1', null, 0,
 'Ticket 44: FRESH_MONKEE no tiene ni una fila, y por eso v_primarias_solapadas la reporta como SIN DECLARAR y no puede decidir si el 1,59x de las seis campanas locales es doble conteo real o dos hechos distintos.'),

('invariante_dominio', 'sin_doble_conteo_declarado', 'cuenta',
 'Ninguna cuenta puede tener campanas donde conviven acciones que cuentan el mismo clic sin declarar cual es la primaria.',
 'select count(*) from v_primarias_solapadas where account = $CUENTA$ and factor_de_inflado > 1.2',
 'select 0', null, 0,
 'Ticket 45: en FRESH_MONKEE conviven Store visits, Directions y Clicks to call en seis campanas locales, factor hasta 1,59x. En BHI el factor es 2,4x en una campana. Mide POR CAMPANA, no por cuenta: un clic pertenece a una campana y dos acciones que no la comparten no pueden contarlo dos veces.'),

('invariante_dominio', 'escalon_estructural_es_plausible', 'cuenta',
 'Un veredicto de saturacion no puede citar un escalon de presupuesto absurdo frente al presupuesto actual.',
 'select count(*) from v_decision_estructural d join cuentas c on c.account = d.account where d.account = $CUENTA$ and c.presupuesto_diario > 0 and d.testeabilidad is not null and coalesce(d.conv_28d,0) < 10 and d.escalar is not null',
 'select 0', 'select exists (select 1 from v_decision_estructural where account = $CUENTA$)', 0,
 'Ticket 27: v_decision_estructural declara la campana saturada citando un escalon 15 a 20 veces el presupuesto actual, sobre 5 conversiones en 11 dias consolidados de 28. Un veredicto de saturacion sobre 5 conversiones no lo aguanta ningun dato. La vista ya expone dias_28d y el veredicto no lo usa.');

insert into controles_de_ticket (ticket_id, relacion_id, como_lo_atrapa)
select c.tid, r.id, c.como from (values
  (16, 'conversiones_diaria_igual_a_semanal', 'Si la definicion de conversion cambia entre extracciones, las dos capas divergen en conversiones para la misma semana y la relacion dispara.'),
  (44, 'toda_cuenta_declara_su_embudo', 'Si una cuenta queda sin declarar su embudo, la relacion dispara. Hoy viola por FRESH_MONKEE.'),
  (45, 'sin_doble_conteo_declarado', 'Si vuelve a haber una campana donde conviven acciones que pueden contar el mismo clic sin declaracion, dispara.'),
  (27, 'escalon_estructural_es_plausible', 'Si la vista vuelve a emitir un veredicto de escalamiento sobre menos de 10 conversiones, dispara.')
) c(tid, rnombre, como)
join relaciones_verdad r on r.nombre = c.rnombre
on conflict do nothing;;
