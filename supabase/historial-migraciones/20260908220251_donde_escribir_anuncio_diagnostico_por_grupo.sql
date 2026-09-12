-- El RSA Factory funcionaba al reves: el humano elegia terminos de la cuenta entera y el
-- modelo escribia. Eso es una herramienta de redaccion, no de optimizacion. Faltaba lo
-- unico que importa: DONDE conviene escribir un anuncio, POR QUE, y QUE accion es.
-- El sistema ya tenia los datos y no los cruzaba: keywords trae la relevancia por grupo,
-- campaign_dim mapea campana a location y objetivo, ads trae ad_strength y cuantos RSA
-- hay por grupo, rsa_assets trae el texto vigente.
--
-- La unidad es el GRUPO DE ANUNCIOS, no la cuenta: un anuncio compite por las keywords de
-- su grupo. En FRESH_MONKEE eso ademas significa por LOCAL, porque cada local tiene su
-- campana _OP con su propio grupo.
--
-- plata_en_riesgo = gasto de la semana en keywords cuya relevancia del anuncio esta por
-- debajo del promedio. Es lo que se esta pagando de mas por un anuncio que no menciona lo
-- que la persona busco. Ordenar por eso responde "que necesita la cuenta" con plata.

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
   where a.week_start = s.w and coalesce(a.status,'ENABLED') <> 'REMOVED'
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
-- Terminos que ya convirtieron en ese grupo. Son la materia prima del anuncio: las
-- palabras que la gente de verdad escribio, no las que suponemos.
term as (
  select st.account, st.campaign, st.ad_group,
         string_agg(st.search_term, ' | ' order by st.conversions desc, st.cost desc) as terminos_que_convierten,
         count(*) as n_terminos
    from (select account, campaign, ad_group, search_term, sum(conversions) conversions, sum(cost) cost
            from search_terms
           where week_start > current_date - 30
           group by 1,2,3,4
          having sum(conversions) > 0) st
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
       -- Que accion corresponde. Un anuncio no arregla una landing: si el problema
       -- dominante es la landing, se dice y no se propone escribir.
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
       -- Prioridad, para ordenar sin pensar
       case
         when coalesce(kw.gasto_landing_baja,0) > coalesce(kw.gasto_rel_baja,0) * 1.5 then 0
         else round(coalesce(kw.gasto_rel_baja, 0)::numeric)
       end as prioridad
  from kw
  left join campaign_dim d on d.account = kw.account and d.campaign = kw.campaign
  left join anu  on anu.account  = kw.account and anu.campaign  = kw.campaign and anu.ad_group  = kw.ad_group
  left join txt  on txt.account  = kw.account and txt.campaign  = kw.campaign and txt.ad_group  = kw.ad_group
  left join term on term.account = kw.account and term.campaign = kw.campaign and term.ad_group = kw.ad_group;

comment on view public.v_donde_escribir_anuncio is
  'Responde donde conviene escribir un anuncio y por que, por GRUPO DE ANUNCIOS y no por cuenta, con la location resuelta desde campaign_dim. plata_en_riesgo es el gasto de la semana en keywords cuya relevancia del anuncio esta bajo el promedio: es lo que se paga de mas por un anuncio que no menciona lo que la persona busco. que_hacer distingue reescribir, sumar un segundo anuncio, crear el primero, y el caso en que el problema es la landing y ningun anuncio lo arregla.';;
