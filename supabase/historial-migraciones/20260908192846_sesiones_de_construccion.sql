-- ============================================================
-- BITACORA DE SESIONES
-- ============================================================
-- cambios_de_sistema tiene los cambios uno por uno con su razon. Lo que falta es
-- el ARCO: por que se hizo cada tanda, en que orden, y que se aprendio del
-- conjunto. Un chat nuevo que lee 35 entradas sueltas ve la lista y no la trama.
-- ============================================================
create table if not exists sesiones (
  id bigserial primary key,
  fecha date not null default current_date,
  titulo text not null,
  desde_version text,
  hasta_version text,
  con_que_empezo text,
  que_se_construyo text,
  que_se_aprendio text,
  que_quedo_pendiente text,
  creada timestamptz default now()
);
alter table sesiones enable row level security; revoke all on sesiones from anon, authenticated;
comment on table sesiones is 'El arco de cada sesion de construccion. cambios_de_sistema tiene los cambios uno por uno; esto tiene por que se hicieron juntos y que se aprendio del conjunto. Un chat nuevo lee esto para entender la trama, no solo la lista.';

create or replace view v_ultima_sesion with (security_invoker = true) as
select * from sesiones order by fecha desc, id desc limit 1;

insert into sesiones (fecha, titulo, desde_version, hasta_version, con_que_empezo, que_se_construyo, que_se_aprendio, que_quedo_pendiente) values
('2026-09-08',
 'De sistema construido a sistema verificado: 26 versiones y la primera corrida real de los agentes',
 'fix-v70', 'fix-v96',
 'El sistema estaba completo y sin probar. Los cuatro agentes nunca habian corrido con los prompts finales, y nadie habia verificado que las piezas funcionaran JUNTAS. La pregunta inicial fue como darle contexto a un chat nuevo sin tener que reexplicar todo.',

 'Contexto para chats nuevos: get_contexto_sistema() y un archivo corto de reglas invariables, separados por volatilidad. Seguridad: limite de tasa en Postgres, cinco comparaciones de secretos pasadas a tiempo constante, PDF publico protegido, manejador global de errores, limite de error de React por pantalla. Entornos: local ya no puede ejecutar en cuentas reales. Multiplataforma: columna plataforma, 12 capacidades de Meta y los tres comportamientos que hacen que Meta deshabilite una cuenta. Cuarentena de conocimiento: un hecho corregido deja de volver por la memoria semantica. Canal con los agentes: notas_para_agentes, el asistente deja nota y el agente la lee al empezar. El asistente paso de solo lectura a operativo: explica el razonamiento, ejecuta por el mismo camino que el boton, y consulta las 142 vistas. Interfaz: adaptada a telefono, radios concentricos, favicon, foco atrapado, contraste alto. Verificacion permanente: completitud por cuenta (11 requisitos), estado_de_los_flujos, v_umbrales_alcanzables, v_notas_fantasma, v_ventana_real, v_primarias_solapadas.',

 'Compilar sin errores no es funcionar, y los avisos del build hay que LEERLOS: el ciclo entre bloques que dejo la app en pantalla de carga estaba avisado en cada compilacion. Un respaldo cableado que se ve completo es peor que un vacio: Fresh Monkee desaparecio del selector durante dias porque la lista de tres se veia entera. Un umbral mal calibrado no se distingue de uno que funciona: tres de cuatro cuentas tenian alertas apagadas o imposibles. Documentar algo no lo crea: cuatro vistas estaban en el diccionario y nunca se escribieron. N eventos del mismo hecho no son N problemas: 57 cosas en la bandeja eran 14. Y la mas importante: un agente corriendo de VERDAD encuentra en una hora lo que la revision por partes no ve en dias, porque usa las piezas juntas y en el orden real. Las tres fallas mas caras del dia eran de logica interna de vistas que devolvian filas plausibles: no estaban rotas, estaban mintiendo, y ninguna auditoria de "esta rota" las detecta.',

 'Ocho tickets abiertos, todos de la capa de extraccion y por eso no arreglables en SQL: change_events se reescribe entera en cada corrida en vez de acumular (32, 42), config_snapshot no cubre nivel de grupo (30), keywords_daily sobreestima 54% y es la fuente de get_entidades (29), y faltan datos en 12 y 16. Ademas: subir las migraciones al repo desde Sistema > Salud, que sigue siendo el paso que hace recuperable un desastre. Y la decision sobre Meta: no conectar con escritura hasta tener el freno de rafagas probado.');

select id, titulo, desde_version, hasta_version from v_ultima_sesion;;
