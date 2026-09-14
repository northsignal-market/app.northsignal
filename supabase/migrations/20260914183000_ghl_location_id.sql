-- ---------------------------------------------------------------------------
-- El Location ID de GoHighLevel, al lado de los otros identificadores externos.
--
-- Va en `cuentas` y no en una variable de entorno por la misma razón que `cid`
-- (Google Ads) y `notion_ficha_id`: es configuración POR CUENTA, no del proceso.
-- Una variable de entorno suelta obliga a tocar Vercel el día que otra cuenta
-- use GHL, y hace imposible preguntarle a la base de qué location es un evento.
--
-- No es secreto: identifica una sub-cuenta, no autoriza nada. El que SÍ es
-- secreto es el token de la Private Integration, y ese vive solo en
-- `process.env.GHL_API_TOKEN` — nunca en la base, nunca en el repo.
-- ---------------------------------------------------------------------------

alter table public.cuentas add column if not exists ghl_location_id text;

comment on column public.cuentas.ghl_location_id is
  'Sub-cuenta (location) de GoHighLevel. Identificador, no credencial: no autoriza nada por si solo. El token de la Private Integration va en process.env.GHL_API_TOKEN y NO en esta tabla.';

update public.cuentas
   set ghl_location_id = 'BVyeiU9rQhBjutWNAz6h'
 where account = 'BHI'
   and ghl_location_id is distinct from 'BVyeiU9rQhBjutWNAz6h';

-- Que quede a la vista si alguien lo carga en la cuenta equivocada: hoy la unica
-- cuenta con pipeline en GoHighLevel es BHI (regla 2 de sus reglas_dominio).
do $$
declare n int;
begin
  select count(*) into n from public.cuentas where ghl_location_id is not null and account <> 'BHI';
  if n > 0 then
    raise notice 'Hay % cuenta(s) ademas de BHI con ghl_location_id. Si es a proposito, ignorar; si no, revisar.', n;
  end if;
end $$;
