-- ============================================================
-- INVARIANTES DE META · lo que deshabilita una cuenta
-- ============================================================
-- Meta no banea por usar un MCP. Banea por COMPORTAMIENTO, y son tres cosas
-- que nuestro sistema hace naturalmente si no se lo frena:
--
--   1. Rafagas de escritura. 30 o mas cambios por hora disparan el limite.
--      Nuestro ejecutor corre cada hora y soporta lotes: podria mandar 50.
--   2. Creatividad de IA sin la etiqueta de contenido IA de Meta. Si generamos
--      con Higgsfield y publicamos sin etiquetar, es motivo de baja.
--   3. Bucles de reintento sobre errores. Un script que reintenta un fallo en
--      loop dispara el mismo limite.
--
-- Las tres se pueden prevenir. Ninguna se puede deshacer despues.
-- ============================================================
create table if not exists limites_plataforma (
  plataforma plataforma_pub not null,
  regla text not null,
  valor int,
  ventana interval,
  que_pasa_si_se_viola text not null,
  fuente text,
  primary key (plataforma, regla)
);
alter table limites_plataforma enable row level security; revoke all on limites_plataforma from anon, authenticated;
comment on table limites_plataforma is 'Limites de comportamiento por plataforma. No son limites tecnicos de la API: son los comportamientos que hacen que la plataforma deshabilite la cuenta. Verificado para Meta en septiembre de 2026.';

insert into limites_plataforma (plataforma, regla, valor, ventana, que_pasa_si_se_viola, fuente) values
('meta', 'escrituras_por_hora', 25, interval '1 hour',
 'A partir de 30 cambios por hora Meta lo lee como rafaga automatizada y puede deshabilitar la cuenta publicitaria. Se deja el tope en 25 para tener margen.',
 'Reportes de operadores en 2025 y principios de 2026, y documentacion de limites de la Marketing API'),
('meta', 'etiqueta_ia_obligatoria', null, null,
 'Publicar una creatividad generada por IA sin la etiqueta de contenido IA de Meta es motivo de baja de la cuenta. Aplica a todo lo que salga de Higgsfield.',
 'Politica de contenido de Meta'),
('meta', 'reintentos_por_error', 2, interval '1 hour',
 'Un bucle de reintentos sobre un error dispara el mismo limite que una rafaga. Maximo dos reintentos y despues se registra la falla y se para.',
 'Reportes de operadores'),
('google', 'escrituras_por_hora', 100, interval '1 hour',
 'Google es mas tolerante, pero un script que muta cientos de entidades por hora entra en los limites de la API de scripts.',
 'Limites de Google Ads Scripts')
on conflict (plataforma, regla) do nothing;

-- El guardarrail: cuenta cuantas escrituras se hicieron en la ventana
create or replace function puede_escribir_en(p_account text, p_plataforma plataforma_pub default 'meta')
returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  with lim as (select valor, ventana, que_pasa_si_se_viola from limites_plataforma
               where plataforma = p_plataforma and regla = 'escrituras_por_hora'),
  hechas as (select count(*) n from acciones_aprobadas a, lim
             where a.account = p_account and a.plataforma = p_plataforma
               and a.estado in ('ejecutada','pendiente') and a.modo = 'ejecutar'
               and a.aprobada_el > now() - lim.ventana)
  select jsonb_build_object(
    'permitido', (select n from hechas) < (select valor from lim),
    'hechas_en_la_ventana', (select n from hechas),
    'maximo', (select valor from lim),
    'motivo', case when (select n from hechas) >= (select valor from lim)
      then 'Tope de escrituras alcanzado: ' || (select n from hechas) || ' en la ultima hora. ' || (select que_pasa_si_se_viola from lim)
      else null end);
$$;
comment on function puede_escribir_en is 'Frena las rafagas de escritura antes de que la plataforma las lea como automatizacion. Se consulta antes de encolar en Meta.';

select plataforma, regla, valor, left(que_pasa_si_se_viola, 60) que_pasa from limites_plataforma order by 1, 2;;
