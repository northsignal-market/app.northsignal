-- Alinear la vista con lo verificado el 8 sep 2026 contra la documentacion de Google y
-- los estudios de Adalysis. El veredicto "sumar un segundo anuncio" decia solo que Google
-- rota; ahora lleva la cifra, que es lo que permite priorizarlo contra otra cosa.
create or replace view public.v_donde_escribir_anuncio as
select v.*
  from (select * from v_donde_escribir_anuncio) v
 where false;  -- placeholder, se reemplaza abajo

-- (el placeholder anterior no persiste: se define la vista de verdad a continuacion)
drop view if exists public.v_donde_escribir_anuncio;

create view public.v_donde_escribir_anuncio as
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
select kw.account, d.location, d.objetivo, kw.campaign, kw.ad_group,
       round(kw.gasto::numeric) as gasto_semana,
       round(coalesce(kw.gasto_rel_baja, 0)::numeric) as plata_en_riesgo,
       round(coalesce(kw.gasto_rel_baja, 0) / nullif(kw.gasto, 0) * 100) as pct_gasto_con_relevancia_baja,
       round(coalesce(kw.gasto_landing_baja, 0) / nullif(kw.gasto, 0) * 100) as pct_gasto_con_landing_baja,
       kw.qs_ponderado, kw.keywords,
       coalesce(anu.anuncios, 0) as anuncios_en_el_grupo,
       anu.fuerza as fuerza_del_anuncio,
       coalesce(txt.titulos, 0) as titulos_actuales,
       coalesce(term.n_terminos, 0) as terminos_que_convierten_30d,
       kw.keywords_del_grupo, term.terminos_que_convierten,
       case
         when coalesce(kw.gasto_landing_baja,0) > coalesce(kw.gasto_rel_baja,0) * 1.5
           then 'NO ES EL ANUNCIO: el problema dominante es la landing (' ||
                round(coalesce(kw.gasto_landing_baja,0)/nullif(kw.gasto,0)*100) ||
                '% del gasto). Escribir un RSA nuevo no va a mover el Quality Score.'
         when coalesce(anu.anuncios, 0) = 0
           then 'CREAR EL PRIMER ANUNCIO: el grupo gasta y no tiene ningun RSA activo.'
         when coalesce(kw.gasto_rel_baja,0) / nullif(kw.gasto,0) >= 0.5 and coalesce(anu.anuncios,0) = 1
           then 'REESCRIBIR: mas de la mitad del gasto va a keywords que el unico anuncio no menciona. Reescribirlo con el tema del grupo, y despues sumar un segundo.'
         when coalesce(kw.gasto_rel_baja,0) / nullif(kw.gasto,0) >= 0.5
           then 'REESCRIBIR: mas de la mitad del gasto va a keywords que los anuncios no mencionan.'
         when coalesce(anu.anuncios, 0) = 1
           then 'SUMAR UN SEGUNDO ANUNCIO: hay uno solo. Google mide 6,6% mas conversiones a CPA similar al pasar de uno a dos RSA, y 3,7% mas al pasar de dos a tres. Es la accion de menor esfuerzo de la lista.'
         when anu.fuerza ilike '%POOR%'
           then 'MEJORAR EL EXISTENTE: la Eficacia del anuncio es POOR. Ojo: Ad Strength es un diagnostico de la interfaz y NO entra en la subasta, asi que vale como pista de variedad, no como objetivo en si.'
         else 'SIN ACCION CLARA POR ANUNCIO: la relevancia no es el cuello de este grupo.'
       end as que_hacer,
       case
         when coalesce(kw.gasto_landing_baja,0) > coalesce(kw.gasto_rel_baja,0) * 1.5 then 0
         else round(coalesce(kw.gasto_rel_baja, 0)::numeric)
       end as prioridad,
       c.locale as idioma_anuncio, c.moneda,
       (c.perfil_analisis = 'cadena') as es_cadena,
       c.nombre_cliente
  from kw
  join cuentas c on c.account = kw.account
  left join campaign_dim d on d.account = kw.account and d.campaign = kw.campaign
  left join anu  on anu.account  = kw.account and anu.campaign  = kw.campaign and anu.ad_group  = kw.ad_group
  left join txt  on txt.account  = kw.account and txt.campaign  = kw.campaign and txt.ad_group  = kw.ad_group
  left join term on term.account = kw.account and term.campaign = kw.campaign and term.ad_group = kw.ad_group;

comment on view public.v_donde_escribir_anuncio is
  'Donde conviene escribir un anuncio y por que, por GRUPO DE ANUNCIOS. plata_en_riesgo es el gasto de la semana en keywords con relevancia del anuncio bajo el promedio. OJO con no confundir: la RELEVANCIA DEL ANUNCIO es componente del Quality Score y entra en la subasta; AD STRENGTH es un diagnostico de la interfaz que Google dice explicitamente que no influye en la elegibilidad de publicacion, y ademas depende de tener al menos 6 sitelinks, que no se cargan desde el generador.';

insert into public.lecciones (account, fecha, contexto, decision, resultado, leccion, tipo, confianza, veces_confirmada, escrita_por) values
(null, current_date,
 'Andres cuestiono si el generador de RSA apunta a Ad Strength Excelente y si centrarse en una keyword alcanza, porque Google ademas pide titulos poco repetitivos.',
 'Verificar contra la documentacion de Google y estudios publicados en vez de responder de memoria.',
 'Tenia razon en las dos cosas y aparecio una tercera. El prompt que yo habia escrito pedia que DIEZ de los quince titulos llevaran la keyword, lo que dispara "tus titulos son demasiado similares" de forma garantizada. La practica documentada es 2 a 4 titulos con la keyword y al menos 3 deliberadamente sin ella.',
 'AD STRENGTH Y RELEVANCIA DEL ANUNCIO NO SON LO MISMO Y TIRAN PARA LADOS DISTINTOS. La relevancia es componente del Quality Score y entra en la subasta; Ad Strength es un diagnostico de la interfaz que Google dice que no influye en la elegibilidad de publicacion. Ad Strength premia VARIEDAD (titulos distintos entre si, largos distintos, angulos distintos) y castiga la repeticion, mientras que la relevancia solo pide que el anuncio sea del tema, no que repita la keyword. Repetirla en diez titulos pierde variedad sin ganar relevancia. Tres datos mas: ningun RSA con menos de 8 titulos alcanza Excellent y los que la tienen suelen llevar 13 o mas, pero la mayoria de los RSA con Ad Strength Poor tienen los 15, asi que la cantidad sola no sirve; Ad Strength depende tambien de tener al menos 6 sitelinks, que el generador no toca, asi que por diseno no puede llevar un anuncio a Excellent solo; y cuando un grupo no llega, el remedio documentado suele ser partir el grupo en dos, no forzar el copy. Sobre si conviene perseguir Excellent las fuentes no coinciden: Google publica 15% mas conversiones al pasar de Poor a Excellent, y hay analistas que sostienen que rellenar titulos para llegar a Excellent perjudica el rendimiento. Lo que si esta solido y medido es pasar de un RSA a dos: 6,6% mas conversiones a CPA similar, y 3,7% mas de dos a tres.',
 'neutro', 0.9, 1, 'claude');

select registrar_cambio(
 'El generador de RSA deja de perseguir Ad Strength y apunta a relevancia con variedad',
 'Andres cuestiono el diseno y tenia razon. Mi prompt pedia la keyword en diez de quince titulos, que es el disparador exacto de "tus titulos son demasiado similares": perdia variedad sin ganar relevancia. Ad Strength y relevancia del anuncio no son lo mismo, tiran para lados distintos, y solo la segunda entra en la subasta. Ahora el prompt pide la keyword en 2 a 4 titulos, al menos 3 deliberadamente sin ella, quince angulos distintos y largos variados, y prefiere 13 titulos buenos a 15 con relleno. La validacion del endpoint cambio de signo: antes avisaba si MENOS del 60% llevaba la keyword, ahora avisa si mas de 5 la repiten, detecta pares de titulos que dicen casi lo mismo por solape de palabras, y chequea variedad de largos. Se agrego la aclaracion de que Ad Strength depende tambien de 6 sitelinks que el generador no toca.',
 array['v_donde_escribir_anuncio','lecciones'],
 'fix-v99',
 'La vista anterior esta en el historial de migraciones. El prompt del generador vive en server.ts y se revierte con el archivo anterior.');;
