-- Tres cosas que el generador necesita y la vista no llevaba, una por cada adaptacion
-- que las cuatro cuentas exigen:
--   idioma_anuncio: KAREDO es de-DE y sus anuncios estan en aleman ("30 Tage gratis
--     testen", "§ 1863 BGB konform"). El generador no declaraba idioma en ningun lado:
--     con un prompt en castellano le habria escrito copy en espanol a una cuenta alemana.
--     Es el fallo mas silencioso de los tres, porque el texto sale "bien" y esta mal.
--   es_cadena: solo FRESH_MONKEE es multi-local. En las otras tres, location es null y
--     pedir que el titulo nombre la ciudad no tiene sentido.
--   moneda: para que una oferta con numero no salga en la moneda equivocada.
--
-- Dato que motiva la regla de la ciudad: de 664 titulos de FRESH_MONKEE, solo 44
-- nombran su propia ciudad. Cero nombran otra, asi que no hay contaminacion cruzada:
-- simplemente los anuncios son genericos en 21 mercados distintos.

create or replace view public.v_donde_escribir_anuncio as
with sem_kw as (select max(week_start) w from keywords),
sem_ads as (select max(week_start) w from ads),
sem_rsa as (select max(week_start) w from rsa_assets),
kw as (
  select k.account, k.campaign, k.ad_group,
         sum(k.cost) as gasto,
         sum(k.cost) filter (where k.qs_ad_relevance = 'BELOW_AVERAGE') as gasto_rel_baja,
         sum(k.cost) filter (where k.qs_landing_page = 'BELOW_AVERAGE') as gasto_landing_baja,
         round(sum(k.cost * k.quality_score) / nullif(sum(k.cost), 0), 1) as qs_ponderado,
         count(*) as keywords,
         string_agg(distinct k.keyword, ' | ' order by k.keyword) as keywords_del_grupo
    from keywords k, sem_kw s
   where k.week_start = s.w and k.cost > 0
   group by 1, 2, 3
),
anu as (
  select a.account, a.campaign, a.ad_group,
         count(distinct a.ad_id) as anuncios,
         string_agg(distinct coalesce(a.ad_strength, 'sin dato'), ', ') as fuerza
    from ads a, sem_ads s
   where a.week_start = s.w and coalesce(a.status, 'ENABLED') <> 'REMOVED'
   group by 1, 2, 3
),
txt as (
  select r.account, r.campaign, r.ad_group,
         count(*) filter (where r.field_type = 'HEADLINE') as titulos,
         count(*) filter (where r.field_type = 'DESCRIPTION') as descripciones
    from rsa_assets r, sem_rsa s
   where r.week_start = s.w
   group by 1, 2, 3
),
term as (
  select st.account, st.campaign, st.ad_group,
         string_agg(st.search_term, ' | ' order by st.conversions desc, st.cost desc) as terminos_que_convierten,
         count(*) as n_terminos
    from (select account, campaign, ad_group, search_term, sum(conversions) conversions, sum(cost) cost
            from search_terms where week_start > current_date - 30
           group by 1,2,3,4 having sum(conversions) > 0) st
   group by 1, 2, 3
)
select kw.account,
       d.location,
       d.objetivo,
       kw.campaign,
       kw.ad_group,
       round(kw.gasto::numeric) as gasto_semana,
       round(coalesce(kw.gasto_rel_baja, 0)::numeric) as plata_en_riesgo,
       round(coalesce(kw.gasto_rel_baja, 0) / nullif(kw.gasto, 0) * 100) as pct_gasto_con_relevancia_baja,
       round(coalesce(kw.gasto_landing_baja, 0) / nullif(kw.gasto, 0) * 100) as pct_gasto_con_landing_baja,
       kw.qs_ponderado,
       kw.keywords,
       coalesce(anu.anuncios, 0) as anuncios_en_el_grupo,
       anu.fuerza as fuerza_del_anuncio,
       coalesce(txt.titulos, 0) as titulos_actuales,
       coalesce(term.n_terminos, 0) as terminos_que_convierten_30d,
       kw.keywords_del_grupo,
       term.terminos_que_convierten,
       case
         when coalesce(kw.gasto_landing_baja,0) > coalesce(kw.gasto_rel_baja,0) * 1.5
           then 'NO ES EL ANUNCIO: el problema dominante es la landing (' ||
                round(coalesce(kw.gasto_landing_baja,0)/nullif(kw.gasto,0)*100) ||
                '% del gasto). Escribir un RSA nuevo no va a mover el Quality Score.'
         when coalesce(anu.anuncios, 0) = 0
           then 'CREAR EL PRIMER ANUNCIO: el grupo gasta y no tiene ningun RSA activo.'
         when coalesce(kw.gasto_rel_baja,0) / nullif(kw.gasto,0) >= 0.5 and coalesce(anu.anuncios,0) = 1
           then 'REESCRIBIR: mas de la mitad del gasto va a keywords que el unico anuncio no menciona. Reescribirlo con las keywords del grupo, y despues sumar un segundo.'
         when coalesce(kw.gasto_rel_baja,0) / nullif(kw.gasto,0) >= 0.5
           then 'REESCRIBIR: mas de la mitad del gasto va a keywords que los anuncios no mencionan.'
         when coalesce(anu.anuncios, 0) = 1
           then 'SUMAR UN SEGUNDO ANUNCIO: hay uno solo. Google rota entre dos o tres y aprende cual gana.'
         when anu.fuerza ilike '%POOR%'
           then 'MEJORAR EL EXISTENTE: la Eficacia del anuncio es POOR. Suele faltar titulos o sobran repetidos.'
         else 'SIN ACCION CLARA POR ANUNCIO: la relevancia no es el cuello de este grupo.'
       end as que_hacer,
       case
         when coalesce(kw.gasto_landing_baja,0) > coalesce(kw.gasto_rel_baja,0) * 1.5 then 0
         else round(coalesce(kw.gasto_rel_baja, 0)::numeric)
       end as prioridad,
       -- --- lo nuevo, al final para no mover las columnas que ya se consumen ---
       c.locale as idioma_anuncio,
       c.moneda,
       (c.perfil_analisis = 'cadena') as es_cadena,
       c.nombre_cliente
  from kw
  join cuentas c on c.account = kw.account
  left join campaign_dim d on d.account = kw.account and d.campaign = kw.campaign
  left join anu  on anu.account  = kw.account and anu.campaign  = kw.campaign and anu.ad_group  = kw.ad_group
  left join txt  on txt.account  = kw.account and txt.campaign  = kw.campaign and txt.ad_group  = kw.ad_group
  left join term on term.account = kw.account and term.campaign = kw.campaign and term.ad_group = kw.ad_group;

comment on view public.v_donde_escribir_anuncio is
  'Donde conviene escribir un anuncio y por que, por GRUPO DE ANUNCIOS. Lleva idioma_anuncio (KAREDO es de-DE: el copy va en aleman), es_cadena (solo FRESH_MONKEE: ahi el titulo tiene que nombrar la ciudad) y moneda. plata_en_riesgo es el gasto de la semana en keywords con relevancia bajo el promedio. que_hacer distingue reescribir, sumar un segundo, crear el primero, mejorar el existente, y el caso en que el problema es la landing y ningun anuncio lo arregla.';;
