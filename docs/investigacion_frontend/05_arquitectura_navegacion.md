# 05 · Arquitectura de información y navegación para herramientas de un solo usuario experto (2024–2026)

**Fecha de investigación:** 12 de septiembre de 2026
**Eje:** cómo ordenar header, panel de menú, secciones y settings de una app interna que usa UNA sola persona experta, varias veces por día, para decidir sobre 4 cuentas de Google Ads.
**Método:** investigación web (búsquedas + lectura directa de fuentes). Cada afirmación lleva su fuente numerada `[n]` contra la lista final. Donde una cifra circula en resúmenes de terceros y no pude verificarla en la fuente primaria, lo digo.

---

## 1. IA para power users: profundidad, amplitud y el eje tarea/objeto

**La IA no es la navegación.** NN/g distingue: la IA es la estructura y el naming subyacente; la navegación son los elementos de UI que la exponen. La recomendación operativa es definir la estructura antes de elegir patrones visuales — elegir un patrón por estética fuerza compromisos en la estructura [2]. Para esta app: primero decidir qué *es* cada cosa (¿"Semana" es una vista de la cuenta o un reporte?) y recién después dónde va el botón.

**Plano le gana a profundo, con un tope.** Las jerarquías profundas (4+ niveles) pierden al usuario: se distrae, se frustra o abandona; las planas exponen más opciones de entrada al costo de menús más largos. NN/g recomienda pocas capas (1–3) y validar con tree testing en vez de reglas fijas [1]. Sobre cantidad de ítems no hay número mágico: el criterio es que las categorías representen el alcance real del contenido sin nombres crípticos [11]. Para una herramienta diaria de un experto, dos niveles visibles (sidebar → tabs internas) es el techo cómodo; todo lo más profundo se alcanza por atajo o palette, no por clic encadenado.

**Orden por frecuencia, no alfabético.** NN/g es explícito: el orden alfabético "debe (mayormente) morir"; ordenar por frecuencia de uso o importancia es más eficiente, y lo alfabético solo sirve para listas largas de nombres propios que el usuario ya conoce [12][11]. En el checklist de menús: etiquetas familiares ("los menús no son el lugar para ponerse creativo con palabras inventadas"), indicar siempre la ubicación actual, activación por clic y nada de cascadas multinivel [8].

**Task-based vs object-based.** La investigación de intranets de NN/g encontró que las estructuras por tarea envejecen mejor que las que copian el organigrama, y que facilitan el aprendizaje [13]. El complemento moderno es Object-Oriented UX (Prater, A List Apart): diseñar primero los objetos del dominio (acá: cuenta, campaña, accionable, ticket, reporte, regla) y sus relaciones, y dejar que "el contenido sea la navegación" — desde un accionable se llega a su campaña y a su evidencia por links contextuales, no por menú [14]. Lo que NN/g sí desaconseja es la navegación por audiencia (segmentar el menú por "tipo de usuario") — irrelevante acá, con un solo usuario, pero confirma que el eje correcto es tarea u objeto, nunca persona [15].

**El usuario experto único cambia las prioridades.** NN/g tipifica tres usuarios de apps complejas: Legacy, Legend y Learner. El "Legend" domina el sistema, usa atajos y macros extensivamente, y necesita innovación continua y features avanzadas sin que se le rompa el flujo [7]. Con un único operador experto, la app puede sesgar todo hacia el Legend: densidad, atajos, defaults agresivos — sin pagar el costo de learnability que pagan las apps multiusuario. La heurística #7 de NN/g (flexibilidad y eficiencia: aceleradores invisibles para el novato, veloces para el experto) deja de ser un balance y pasa a ser el default [6].

---

## 2. El patrón "inbox como home"

**Superhuman: el inbox es una cola de decisiones, no una lista de lectura.** El método inbox-zero que promueven (heredado de Merlin Mann) apunta a reducir el tiempo que la cabeza pasa "adentro del inbox", no a tener cero ítems por deporte. Cada ítem recibe exactamente una de cinco acciones: archivar, delegar, responder ya (si toma <2 min), diferir (defer/remind) o hacer. Procesar en tandas 2–3 veces por día, y **nunca usar el inbox como task manager** [16]. El diseño que lo sostiene: optimistic UI (E archiva al instante, sync en background, Z deshace), J/K para moverse, H para recordatorio [17].

**Linear separa dos colas que acá conviene no mezclar.** *Triage* es la cola de lo que entra desde afuera (integraciones, otros equipos): cada ítem se acepta (`1`), se marca duplicado (`2`), se declina (`3`) o se pospone (`H`), con `G+T` para llegar [18]. *Inbox* es la cola personal de notificaciones (asignaciones, menciones), con `G+I`, snooze `H`, borrar `Backspace`, pestaña Priority, y sin archivo: el cero se alcanza borrando [19]. La lección estructural: **lo que espera una decisión va a una cola con verbos; lo que solo informa va a otra, y se borra sin culpa.**

**Things 3: captura ≠ compromiso.** El Inbox es solo el punto de captura rápida; Today es el compromiso del día (con sección This Evening); Upcoming, Anytime y Someday gradúan el horizonte [20]. La distinción útil para esta app: la Bandeja no debería mezclar "cosas que llegaron" con "cosas que decidí hacer hoy".

**Height: control granular de qué entra.** Inbox de notificaciones en tiempo real con badge, archivado de conversaciones y suscripción manual por tarea — el usuario decide qué merece notificar [21].

**Qué va al inbox y qué NO (síntesis de las cuatro apps):** entra lo que pide una decisión o cambió de estado y tiene una acción posible; no entran dashboards, métricas de solo lectura ni nada sin verbo. Snooze/defer es la válvula que mantiene el cero honesto: sacar de la vista sin perder el ítem, con fecha o "cuando haya actividad nueva" [16][18][19]. El cero-inbox es estado deseable porque convierte la home en un semáforo: bandeja vacía = no hay nada que decidir hoy — exactamente la semántica de `v_para_actuar`.

---

## 3. Context switching entre espacios de trabajo (las 4 cuentas)

**Posición: arriba a la izquierda es la convención.** Slack pone el switcher de workspace en la esquina superior izquierda [22]; Vercel pone su scope selector (equipo/proyecto) arriba a la izquierda del dashboard [25]; Atlassian dejó el top bar para acciones universales y movió el contexto al sidebar [24]. El patrón de Linear es un breadcrumb donde cada segmento abre un dropdown de hermanos — cambiás de workspace/proyecto/vista desde cualquier punto sin volver a home [23].

**Atajos: número por posición.** Slack: `⌘+Shift+S` abre/cierra el switcher y `⌘+1…9` salta al workspace N [22][26]. Con 4 cuentas fijas, `⌘1–4` es el mapeo natural y aprendible en un día.

**Persistencia de la vista al cambiar de espacio.** El rediseño de navegación de Vercel (opt-in enero 2026, default desde el 26/2/2026) lo hace explícito: sidebar unificado con links consistentes entre nivel equipo y nivel proyecto, y "projects as filters" — cambiás entre la versión de equipo y la de proyecto *de la misma página* en un clic [25][27]. Traducción directa: si estás en Cuenta›Semana de BHI y saltás a 360, tenés que caer en Cuenta›Semana de 360, no en la home de 360.

**Indicadores de pendientes por espacio: con cuidado.** Un experimento en PLOS ONE (2022, N=1.095, first-impression click test) mostró que el badge captura clics sistemáticamente activando sesgos de saliencia y urgencia [28] — es un imán de atención, no un adorno. Y la guía 2025 de Smashing sobre notificaciones documenta que menos notificaciones mejora la satisfacción (caso Facebook) y que la frecuencia es la queja #1 en testing [29]. Conclusión: badge por cuenta sí, pero contando **solo decisiones pendientes** (lo que está en la bandeja de esa cuenta), nunca actividad general.

---

## 4. Headers de aplicación (2024–2026)

**Qué vive en el header de una app de trabajo.** La estructura convencional es de tres zonas: izquierda = contexto/navegación (switcher, breadcrumb), centro = título o búsqueda, derecha = acciones globales y utilidades [30]. Atlassian, tras su rediseño de diciembre 2024, reservó el top bar exclusivamente para acciones universales (buscar, crear) y movió toda la navegación de producto al sidebar — su argumento: el sidebar es el modelo mental dominante (Google Workspace, Slack, Teams) y da la densidad vertical que el top bar no tiene [24]. La utility navigation (ayuda, settings, perfil) va por convención en la esquina superior derecha [3].

**Sticky: sí, si es chico y quieto.** NN/g recomienda sticky headers cuando los elementos del header se usan con frecuencia durante la sesión (acá: switcher de cuenta, ⌘K): mantenerlo chico (máximo ratio contenido/chrome), fondo opaco de alto contraste, y sin animación — o persistencia parcial (aparece al scrollear hacia arriba) [4]. La cifra de ~22% de ahorro de tiempo de navegación se atribuye a los tests de NN/g en resúmenes de terceros; el artículo primario recomienda el patrón sin publicar esa cifra, así que tomala como direccional [4]. Smashing agrega: barra compacta, no más de ~5 ítems, y ojo en móvil donde el teclado virtual ya come hasta 60% de la pantalla [5].

**Breadcrumb en el header: solo si hay jerarquía real.** Las guías de NN/g: el breadcrumb muestra jerarquía (no historial), el ítem final es la página actual sin link, y **los sitios de 1–2 niveles no lo necesitan** [31]. Con sidebar de 5 secciones + tabs internas, un breadcrumb completo es redundante; lo útil es la versión mínima "Cuenta / Sección" como indicador de ubicación — o el patrón Linear donde ese texto además conmuta [23][31].

---

## 5. Sidebars

**Iconos + texto, siempre.** La investigación clásica de NN/g sigue vigente: los iconos solos fallan porque su significado depende de la experiencia previa de cada uno; los labels tienen que estar visibles todo el tiempo, no en hover [9]. El estado colapsado "solo iconos" es aceptable únicamente como estado *opcional* que el usuario elige — Vercel 2026 lo implementa como sidebar redimensionable y ocultable [25].

**Agrupación semántica: títulos o divisores, nunca ambos.** La guía del design system de Atlassian para side navigation: usar títulos para agrupar ítems, divisores con moderación para separar lo central de lo secundario, y jamás combinar título + divisor para el mismo grupo [32].

**Orden por frecuencia de uso.** Lo más usado arriba [12]. Para una app cuyo ciclo es "entro a decidir": Bandeja primero, la cuenta después, y Sistema (mantenimiento) al fondo.

**Badges de conteo: ayudan cuando son decisiones, ansían cuando son actividad.** El badge captura atención de forma automática [28]; si cuenta cosas que no requieren acción, entrena al usuario a ignorarlo (fatiga) [29]. NN/g clasifica el badge como *indicador* — información contextual suplementaria — y funciona mejor cuando su semántica es una sola [10]. Regla práctica: en el sidebar, badge numérico solo en Bandeja; en Sistema, a lo sumo un punto de estado (hay algo violado / no hay nada), no un número.

---

## 6. Settings y configuración

**Página, no modal.** El árbol de decisión de Vitaly Friedman (Smashing, marzo 2026): modal solo para tareas cortas y autocontenidas que piden confirmación; página separada para procesos complejos o multi-paso; y evitar bloquear la UI entera cuando se pueda [33]. Settings de una herramienta de trabajo — con integraciones, credenciales, reglas por cuenta — es página con URL, no modal.

**Agrupar por lo que la gente viene a hacer, con 4–5 grupos de tope.** La guía de Toptal (actualizada 2025): agrupar en categorías con jerarquía visual clara, 4–5 categorías top-level, separar lo frecuente de lo avanzado, lenguaje llano, y ofrecer "restaurar defaults" [34]. El patrón Android/Material coincide: priorizar los settings que de verdad se tocan y mover el resto a subpantallas [35].

**La separación que importa en una herramienta single-user: "se configura una vez" vs "se opera todos los días".** Esto sale de cruzar [34] con cómo lo resuelven las herramientas estudiadas: lo que se toca una vez (credenciales, integraciones, fichas de cliente, locale por cuenta) vive en Settings; lo que se ajusta durante el trabajo (filtros de la bandeja, columnas visibles, agrupación, umbrales de una vista) vive **inline en la vista donde actúa**, como los filtros y display options del Inbox de Linear [19] o la suscripción por tarea de Height [21]. Si un "setting" se toca todas las semanas, no es un setting: es un control de la vista, y esconderlo en Settings es fricción pura.

---

## 7. Keyboard-first y command palette como navegación primaria

**El patrón ⌘K.** Maggie Appleton traza la historia (Spotlight en Mac OS X Tiger, 2005 → Quicksilver → Linear/Raycast/Todoist/Tana): una barra que busca *comandos y contenido* con fuzzy matching, que libera espacio visual y mantiene las manos en el teclado; su matiz honesto es que la GUI clásica sigue siendo mejor para novatos — el palette brilla cuando el usuario ya conoce el sistema [36]. Que es exactamente este caso.

**Qué exponen los que lo hacen bien.** Linear registra en el palette todas las vistas y acciones, y además da atajos directos `G+letra` por vista (`G+I` inbox, `G+T` triage) y teclas de una letra dentro de las listas (`1/2/3/H`, `J/K`, `U`) [18][19]. Raycast suma dos aceleradores por encima del palette: *alias* (2–3 letras tipeadas en la búsqueda) para lo que usás seguido, y *hotkeys globales* para lo que usás constantemente [37]. La anatomía formal del patrón (trigger, input con foco, resultados agrupados, hints de atajo por ítem, estado vacío) y sus riesgos (estados de error/carga, accesibilidad combobox) están documentados en UX Patterns for Developers [38].

**Cómo se enseñan atajos sin manual.** Tres mecanismos convergentes:
1. **El palette como profesor:** en Superhuman, cada vez que ejecutás un comando vía ⌘K, el atajo aparece al lado — aprendizaje pasivo hasta que la memoria muscular toma el control [17].
2. **El panel `?` buscable:** Linear rediseñó su pantalla de atajos para hacerla buscable, explícitamente "para que más usuarios usen atajos" [39].
3. **Atajos visibles en menús y tooltips:** la guía de NN/g sobre aceleradores — disponibles pero ignorables, mostrados junto a la acción en menús contextuales, enfocados en las acciones que se repiten [6].

Superhuman demuestra el techo del enfoque: onboarding de práctica (no de explicación) que sube 20% el uso de atajos y 67% la adopción de features, sobre una base de optimistic UI con undo (`Z`) y objetivo interno de ~50–60ms de respuesta [17]. Para un solo usuario experto, el equivalente es más simple: que cada acción de la bandeja tenga tecla, que la tecla esté impresa al lado del botón, y que `?` liste todo.

---

## 8. Responsive/móvil: qué recortan las apps serias

**El recorte es de casos de uso, no de tamaño.** Linear Mobile se define como app de acompañamiento "para flujos on-demand lejos del teclado": crear/actualizar issues, inbox con tap para actuar, swipe para borrar, snooze, y notificaciones; la configuración compleja queda en desktop [40]. GitHub Mobile apostó a lo mismo: notificaciones push de PRs (aprobación, comentario, request de review) con horarios configurables — triage en el bolsillo, trabajo profundo en la compu [41]. Vercel, en su rediseño 2026, resolvió móvil con una **bottom bar flotante optimizada para una mano** [25].

**Jerarquía de lo que sobrevive en pantalla chica** (síntesis de los tres casos): 1) la cola de decisiones (inbox: aprobar, declinar, snooze), 2) el estado (¿algo se rompió? ¿corrió lo que tenía que correr?), 3) captura rápida. Lo que muere en móvil: tablas densas, configuración, análisis comparativo.

**Bottom tabs vs sidebar.** Material Design: bottom navigation para 3–5 destinos de igual importancia; con más, drawer — pero M3 explícitamente desaconseja el drawer como navegación primaria en teléfonos [42]. Para subnavegación en móvil, NN/g: menos de 6 subcategorías → accordion; 6–15 → menú de sección [43]. Y los breadcrumbs en móvil se truncan al padre inmediato [31].

**Tap targets.** NN/g: mínimo 1cm × 1cm **físico** (no px) con separación suficiente; el target puede ser mayor que el ícono visible via padding [44].

---

## Síntesis aplicada a NorthSignal

La estructura actual (Bandeja + Cuenta con 6 segmentos + Datos + Herramientas + Sistema, selector global, ⌘K) ya es la topología correcta según esta investigación: inbox-como-home, secciones por objeto/tarea, 2 niveles. Lo que la literatura sugiere ajustar es la **semántica y la mecánica**, no el mapa: bandeja con verbos y cero alcanzable [16][18], switcher con ⌘1–4 y persistencia de vista al cambiar [22][25], badges solo de decisiones [28][29], tabs internas en Cuenta en vez de más sidebar [1][43], settings partidos en "una vez" vs "operación diaria" [33][34], y el teclado como capa que cose todo [6][17][36][39]. El botón flotante de ayuda/tickets puede migrar a la utility nav del header (esquina superior derecha, su lugar convencional [3]) o a un comando de ⌘K, liberando la esquina inferior para acciones de la vista.

---

## Fuentes

Verificadas por lectura directa (fetch) salvo indicación. Formato: título — URL — aporte.

1. **Flat vs. Deep Website Hierarchies (NN/g, Kathryn Whitenton, 2013)** — https://www.nngroup.com/articles/flat-vs-deep-hierarchy/ — Jerarquías 4+ niveles pierden al usuario; preferir 1–3 capas y validar con tree testing.
2. **The Difference Between IA and Navigation (NN/g, Jen Cardello, 2014)** — https://www.nngroup.com/articles/ia-vs-navigation/ — Definir estructura antes que patrones de UI.
3. **Utility Navigation: What It Is and How to Design It (NN/g, Susan Farrell, 2015)** — https://www.nngroup.com/articles/utility-navigation/ — Ayuda/settings/cuenta van en la esquina superior derecha por convención.
4. **Sticky Headers: 5 Ways to Make Them Better (NN/g, Page Laubheimer, 2021)** — https://www.nngroup.com/articles/sticky-headers/ — Sticky chico, opaco, sin animación; evaluar necesidad por frecuencia de uso.
5. **Designing Sticky Menus: UX Guidelines (Smashing, Vitaly Friedman, mayo 2023)** — https://www.smashingmagazine.com/2023/05/sticky-menus-ux-guidelines/ — ≤5 ítems, compacto; teclado virtual come 60% en móvil; persistencia parcial.
6. **Accelerators Maximize Efficiency in User Interfaces (NN/g, Rachel Krause & Aurora Harley, oct 2024)** — https://www.nngroup.com/articles/ui-accelerators/ — Atajos "disponibles pero ignorables", mostrados junto a acciones, para lo repetido.
7. **Supporting "Power Users" Isn't Enough: 3 Complex-App User Types (NN/g, Kate Kaplan, jun 2025)** — https://www.nngroup.com/articles/complex-apps-users/ — El "Legend" usa atajos/macros y pide densidad e innovación continua.
8. **Menu-Design Checklist: 17 UX Guidelines (NN/g, Page Laubheimer, jun 2024)** — https://www.nngroup.com/articles/menu-design/ — Labels familiares, indicar ubicación actual, clic no hover, sin cascadas.
9. **Icon Usability (NN/g, Aurora Harley, 2014)** — https://www.nngroup.com/articles/icon-usability/ — Iconos solos fallan; labels visibles siempre.
10. **Indicators, Validations, and Notifications (NN/g, Kim Flaherty, ene 2024)** — https://www.nngroup.com/articles/indicators-validations-notifications/ — El badge es un indicador contextual; una sola semántica por indicador.
11. **Top 3 IA Questions about Navigation Menus (NN/g, Kathryn Whitenton, 2015)** — https://www.nngroup.com/articles/ia-questions-navigation-menus/ — Sin número mágico de ítems; orden por frecuencia salvo listas largas de nombres conocidos.
12. **Alphabetical Sorting Must (Mostly) Die (NN/g, Jakob Nielsen)** — https://www.nngroup.com/articles/alphabetical-sorting-must-mostly-die/ — Frecuencia/importancia le gana a A–Z. *(Verificada por búsqueda.)*
13. **Intranet Information Architecture Methods (NN/g)** — https://www.nngroup.com/articles/intranet-ia-methods/ — Estructuras task-based envejecen mejor que las organizacionales. *(Verificada por búsqueda.)*
14. **Object-Oriented UX (A List Apart, Sophia V. Prater, oct 2015)** — https://alistapart.com/article/object-oriented-ux/ — Diseñar por objetos y relaciones; "el contenido es la navegación".
15. **Audience-Based Navigation: 5 Reasons to Avoid It (NN/g)** — https://www.nngroup.com/articles/audience-based-navigation/ — Navegar por tipo de usuario fragmenta la IA. *(Verificada por búsqueda.)*
16. **Inbox Zero Method: The Complete Guide (Superhuman Blog)** — https://blog.superhuman.com/inbox-zero-method/ — 5 acciones por ítem, batching, el inbox no es task manager.
17. **Superhuman: Speed as the Product (Blake Crosley)** — https://blakecrosley.com/guides/design/superhuman — Optimistic UI, ⌘K que enseña el atajo en cada uso, onboarding de práctica, +20% atajos/+67% adopción.
18. **Triage (Linear Docs)** — https://linear.app/docs/triage — Cola de entrada con accept/duplicate/decline/snooze (`1/2/3/H`), `G+T`, responsabilidad de triage.
19. **Inbox (Linear Docs)** — https://linear.app/docs/inbox — Notificaciones personales: `G+I`, snooze `H`, `J/K`, pestaña Priority, cero por borrado.
20. **Things 3: Beauty and Delight in a Task Manager (MacStories, Ryan Christoffel, 2017)** — https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/ — Inbox de captura separado de Today/Upcoming/Anytime/Someday.
21. **When and where do I get notifications about tasks? (Height Help Center)** — https://help.height.app/en/articles/3991724-when-and-where-do-i-get-notifications-about-tasks — Inbox con badge en tiempo real, archivado, suscripción granular. *(Verificada por búsqueda.)*
22. **Switch between workspaces (Slack Help)** — https://slack.com/help/articles/1500002200741-Switch-between-workspaces — Switcher arriba-izquierda; `⌘+Shift+S`; reordenable.
23. **Modrim — Real UI patterns with the code** — https://www.modrim.com/ — Catálogo de patrones reales: breadcrumb-switcher de Linear, pill de workspaces de Slack, tabs con overflow de Vercel. *(Verificada por búsqueda.)*
24. **Designing Atlassian's new navigation (Atlassian Blog, dic 2024)** — https://www.atlassian.com/blog/design/designing-atlassians-new-navigation — Navegación de producto al sidebar; top bar solo acciones universales; 3 componentes reutilizables.
25. **New dashboard navigation available (Vercel Changelog, 22 ene 2026)** — https://vercel.com/changelog/new-dashboard-navigation-available — Sidebar redimensionable/ocultable, links consistentes entre scopes, "projects as filters" (misma página al cambiar de scope), bottom bar flotante en móvil.
26. **Slack keyboard shortcuts (Slack Help)** — https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts — `⌘+número` por workspace, `⌘K` quick switcher, `⌘/` lista de atajos.
27. **New dashboard redesign is now the default (Vercel Changelog, feb 2026)** — https://vercel.com/changelog/dashboard-navigation-redesign-rollout — Rollout como default el 26/2/2026. *(Verificada por búsqueda.)*
28. **Driven by notifications — exploring the effects of badge notifications on user experience (PLOS ONE, 2022)** — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0270888 — N=1.095: el badge captura clics sistemáticamente (sesgos de saliencia y urgencia).
29. **Design Guidelines For Better Notifications UX (Smashing, jul 2025)** — https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/ — Frecuencia = queja #1; menos notificaciones, más satisfacción; niveles de severidad; modos calm/regular/power.
30. **App bar UI design: Vs nav bar, header, and toolbar (Setproduct, Roman Kamushken, 2021)** — https://www.setproduct.com/blog/appbar-ui-design — Estructura del header en 3 zonas; colapso responsivo a "More".
31. **Breadcrumbs: 11 Design Guidelines (NN/g, Page Laubheimer, 2018, rev. 2026)** — https://www.nngroup.com/articles/breadcrumbs/ — Jerarquía no historial; innecesarios en sitios de 1–2 niveles; truncar en móvil.
32. **Side navigation (Atlassian Design System)** — https://atlassian.design/components/side-navigation — Títulos para agrupar, divisores con moderación, nunca ambos. *(Verificada por búsqueda.)*
33. **Modal vs. Separate Page: UX Decision Tree (Smashing, Vitaly Friedman, mar 2026)** — https://www.smashingmagazine.com/2026/03/modal-separate-page-ux-decision-tree/ — Modal para tareas cortas autocontenidas; página para lo complejo; evitar bloquear la UI.
34. **How to Improve App Settings UX (Toptal, Mayank Sharma, act. 2025)** — https://www.toptal.com/designers/ux/settings-ux — 4–5 categorías top-level, frecuente separado de avanzado, restaurar defaults.
35. **Settings (Android Developers / Material patterns)** — https://developer.android.com/design/ui/mobile/guides/patterns/settings — Priorizar los settings que se usan; agrupar y subordinar el resto. *(Verificada por búsqueda.)*
36. **Command K Bars (Maggie Appleton)** — https://maggieappleton.com/command-bar — Historia del patrón desde Spotlight (2005); fuzzy search de comandos+contenido; mejor para usuarios que ya conocen el sistema.
37. **Command Aliases & Hotkeys (Raycast Manual)** — https://manual.raycast.com/command-aliases-and-hotkeys — Alias de 2–3 letras para lo frecuente, hotkey global para lo constante. *(Verificada por búsqueda.)*
38. **Command Palette Pattern (UX Patterns for Developers)** — https://uxpatterns.dev/patterns/advanced/command-palette — Anatomía (trigger, input, grupos, hints, empty state), accesibilidad combobox, estados de error.
39. **Keyboard shortcuts help (Linear Changelog, 25 mar 2021)** — https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help — Panel `?` buscable, rediseñado explícitamente para que más usuarios adopten atajos.
40. **Linear Mobile (linear.app/mobile)** — https://linear.app/mobile — App de acompañamiento para flujos lejos del teclado: crear, inbox, notificaciones; swipe y snooze. *(Verificada por búsqueda.)*
41. **Push notifications for PR review activities on GitHub Mobile (GitHub Changelog, nov 2021)** — https://github.blog/changelog/2021-11-22-push-notifications-for-pull-request-review-activities-on-github-mobile/ — Móvil = triage de notificaciones con horarios; trabajo profundo en desktop. *(Verificada por búsqueda.)*
42. **Navigation drawer — Guidelines (Material Design 3)** — https://m3.material.io/components/navigation-drawer/guidelines — Bottom nav 3–5 destinos en phones; drawer no primario en móvil, sí en pantallas grandes. *(Verificada por búsqueda; complementa https://m2.material.io/components/bottom-navigation.)*
43. **Mobile Subnavigation (NN/g, Raluca Budiu, 2017)** — https://www.nngroup.com/articles/mobile-subnavigation/ — <6 subcategorías → accordion; 6–15 → menú de sección; >15 → landing de categoría.
44. **Touch Targets on Touchscreens (NN/g, Aurora Harley, 2019)** — https://www.nngroup.com/articles/touch-target-size/ — Mínimo 1cm × 1cm físico + separación; el área táctil puede exceder el ícono visible.
45. **The Linear Method (Linear)** — https://linear.app/method — Principios de producto: simplicidad opinionada, momentum, alcance chico. *(Contexto general.)*
46. **What is Information Architecture? (Jorge Arango)** — https://jarango.com/what-is-information-architecture/ — IA como práctica de organizar/etiquetar para encontrar y entender. *(Verificada por búsqueda; contexto conceptual junto a Abby Covert, https://www.howtomakesenseofanymess.com/.)*
