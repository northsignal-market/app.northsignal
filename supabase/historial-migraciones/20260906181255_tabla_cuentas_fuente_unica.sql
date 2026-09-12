-- ================================================================
-- CUENTAS: la única fuente de verdad sobre qué clientes existen
-- ================================================================
-- Reemplaza las listas hardcodeadas en scripts, servidor y prompts.
-- Onboarding = una fila acá + capa humana del doc maestro + correr el diario.
-- ================================================================
create table if not exists cuentas (
  account text primary key,                    -- KAREDO, BHI, 360, FRESH_MONKEE
  nombre_cliente text not null,                -- Karedo GmbH
  cid text,                                    -- 913-287-4649 (null hasta vincular)
  activa boolean not null default true,
  moneda text not null,                        -- EUR, CLP, USD
  zona_horaria text not null,                  -- Europe/Berlin
  locale text not null default 'es-CL',        -- para formatear números en reportes
  -- Reporte al cliente
  idioma_reporte text not null default 'es' check (idioma_reporte in ('es', 'en')),
  frecuencia_reporte text not null default 'semanal' check (frecuencia_reporte in ('semanal', 'mensual', 'ninguna')),
  canal_reporte text default 'email' check (canal_reporte in ('email', 'slack', 'portal', 'manual')),
  destinatarios_reporte text[],                -- emails; null = pendiente
  nombre_contacto text,                        -- para el saludo, null = no personalizar
  encabezado_reporte text,                     -- "Google Ads Report | Karedo | {rango}"
  metricas_destacadas text[] not null default '{cost,conversions,cpa,ctr}',
  -- Centinela y umbrales (antes en el script)
  presupuesto_diario numeric,
  pico_gasto_factor numeric not null default 1.5,
  sin_conv_min_gasto numeric,
  -- Reglas de dominio para los prompts (markdown, compacto)
  reglas_dominio text,
  -- Notion
  notion_ficha_id text,
  -- Cowork
  hora_tarea_semanal time,                     -- 07:45 BA
  -- Auditoría
  creada timestamptz default now(),
  actualizada timestamptz default now()
);
alter table cuentas enable row level security;
revoke all on cuentas from anon, authenticated;
comment on table cuentas is 'Unica fuente de verdad de los clientes. Los scripts de Google Ads la leen al arrancar (GET a /rest/v1/cuentas?activa=eq.true), el servidor la lee en vez de listas hardcodeadas, el prompt generico la lee junto al doc maestro. idioma_reporte: el brief interno es siempre en espanol; solo la seccion de reporte al cliente cambia de idioma.';

insert into cuentas (account, nombre_cliente, cid, activa, moneda, zona_horaria, locale, idioma_reporte, frecuencia_reporte, canal_reporte, destinatarios_reporte, nombre_contacto, encabezado_reporte, metricas_destacadas, presupuesto_diario, pico_gasto_factor, sin_conv_min_gasto, notion_ficha_id, hora_tarea_semanal) values
('KAREDO', 'Karedo GmbH', '913-287-4649', true, 'EUR', 'Europe/Berlin', 'de-DE', 'en', 'semanal', 'slack', null, null, 'Google Ads Report | Karedo | {rango}', '{cost,conversions,cpa,impr_share}', 135, 1.5, 90, '3cf3b1f6-de28-81ea-ac05-c83c1fd3b219', '07:45'),
('BHI', 'Best Health International', '882-940-8394', true, 'CLP', 'America/Santiago', 'es-CL', 'es', 'mensual', 'email', null, null, 'Reporte Google Ads | BHI | {rango}', '{cost,conversions,cpa,ctr}', 20000, 1.5, 40000, '3cf3b1f6-de28-818c-ae11-d2b86330fc7a', '08:15'),
('360', '360 Producciones', '378-925-9849', true, 'CLP', 'America/Santiago', 'es-CL', 'es', 'ninguna', 'manual', null, null, 'Reporte Google Ads | 360 Producciones | {rango}', '{cost,conversions,cpa,ctr}', 20000, 1.7, 50000, '3cf3b1f6-de28-816e-8c4e-f111bb05ccd4', '08:45'),
('FRESH_MONKEE', 'Fresh Monkee', null, false, 'USD', 'America/New_York', 'en-US', 'es', 'semanal', 'email', null, null, 'Reporte Google Ads | Fresh Monkee | {rango}', '{cost,conversions,cpa,ctr}', null, 1.5, null, null, null)
on conflict (account) do update set idioma_reporte = excluded.idioma_reporte, frecuencia_reporte = excluded.frecuencia_reporte, actualizada = now();

-- Las reglas de dominio: extraidas de los prompts, compactas
update cuentas set reglas_dominio = $r$1. Conversiones direccionales: Enhanced Conversions 0-15% de coincidencia, dispara al clic en Registrieren. Nunca afirmar sub ni sobreestimacion.
2. Nunca ROAS ni valor de conversion: 20 EUR es arbitrario.
3. No cambios de puja sin simulations o problema estructural.
4. Nada auto-aplicable. Negativas y pausas se proponen.
5. Limitada por ranking, no por presupuesto: escalar = mejorar QS.
6. Objetivo: no-marca supere a marca en conversiones.
7. Antes de atribuir una caida a Alemania, verificar feriados y vacaciones escolares. Fin de semana gasta la mitad.$r$ where account = 'KAREDO';

update cuentas set reglas_dominio = $r$1. RIESGO REGULATORIO CMF (DFL 251 Art. 46): vocabulario de asesoria, orientacion, coordinacion. Prohibido: vender, contratar, cotizar, poliza, precios, su seguro, opciones de cobertura. Aplica a lo que BHI dice, no a lo que la gente busca. AI Max, assets automaticos, auto-apply = alerta ALTA.
2. Fuente de verdad del negocio: GoHighLevel, no Google. No inventar cierres.
3. Leads buen perfil (ABC1), descalificados por preexistencias o presupuesto: el filtro es el problema, no el trafico.
4. Subir presupuesto = CPA 55% mayor. Saturada.
5. Ciclo largo, 1-2 solicitudes/semana: un movimiento semanal casi nunca es significativo.
6. Una primaria (Envio de formulario) sin valor. Puja pendiente de cambiar a Maximizar conversiones.$r$ where account = 'BHI';

update cuentas set reglas_dominio = $r$1. Montos de negocio de Asana y v_cierres_totales, nunca de Google (conv_value inflado 1,5x).
2. Nunca all_conversions (suma WhatsApp, mail, llamadas).
3. Cualquier client_type con RECOMMENDATION = alerta ALTA (17 jul 2026 paquete automatico paso semanas sin detectarse).
4. "Configuracion erronea" en offline NO es error: ciclo >90 dias, Google rechaza. La subida funciona. En contacto es la etapa que llega a tiempo.
5. Presupuesto 20.000 CLP confirmado.
6. Destinatario no confirmado; audiencia sin formacion en marketing.
7. QS limitado por landing: techo estructural. Volumen bajo: 14 formularios, 0,5 cierres/mes.$r$ where account = '360';

-- Funcion para que el servidor y los prompts lean una cuenta completa
create or replace function get_cuenta(p_account text) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select to_jsonb(c) from cuentas c where c.account = p_account;
$$;

select account, nombre_cliente, idioma_reporte, frecuencia_reporte, canal_reporte, activa, length(reglas_dominio) reglas from cuentas order by account;;
