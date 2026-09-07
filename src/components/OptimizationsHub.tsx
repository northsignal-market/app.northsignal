/**
 * Guía de operación. Reemplaza al Playbook de la fase de construcción, que
 * era código para copiar y ya está todo desplegado. Esto es el manual del
 * operador: qué pasa cada día, qué hacés cada lunes, cómo ejecutás un
 * accionable, cómo aprobás un reporte, qué hacer cuando algo no cuadra.
 */
import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Termino } from './Termino';

const SECCIONES: { id: string; titulo: string; cuerpo: React.ReactNode }[] = [
  { id: 'ciclo', titulo: 'Cómo funciona el ciclo', cuerpo: (
    <div className="space-y-3 text-xs text-[#F5F7FA] leading-relaxed">
      <p><span className="text-[#FFFFFF] font-medium">Todos los días a las 6:00</span> un script en Google Ads extrae el día anterior a Supabase: campañas, grupos, keywords, términos de búsqueda, conversiones por acción. A las <span className="text-[#FFFFFF] font-medium">6:45</span>, Sonnet 5 lee ese día contra el <Termino t="Plan semanal">plan de la semana</Termino> y escribe el <Termino t="Pulso diario">pulso</Termino>: qué indicador se movió, si cumple el umbral, cuántos días seguidos. Lo ves en Hoy y en Semana.</p>
      <p><span className="text-[#FFFFFF] font-medium">Cada 4 horas</span> el centinela mira gasto intradía, cambios automáticos de Google y la conversión primaria. Si algo cruza un umbral, manda un mail y crea una alerta que ves en Hoy.</p>
      <p><span className="text-[#FFFFFF] font-medium">Cada lunes a las 7:00</span> el script semanal trae la semana cerrada con simulaciones de presupuesto y historial de cambios. Entre 7:45 y 8:45, Opus 5 en Cowork analiza cada cuenta: escribe el brief, propone accionables con sus pasos, redacta el reporte al cliente y deja el plan de la semana que empieza. A las 9:15 el sistema arma el borrador del reporte en PDF.</p>
      <p><span className="text-[#FFFFFF] font-medium">Vos entrás a las 9:30.</span> Leés Hoy, ejecutás los accionables Propuestos en Google Ads, confirmás o descartás los Bloqueados, aprobás el reporte al cliente. Media hora por cuenta, menos si la semana fue tranquila.</p>
      <p className="opacity-70">Nada cambia en Google Ads sin que lo decidas vos: o lo hacés a mano, o aprobás con un clic, o dejás una regla en Sistema › Automatización que diga "las pausas de keyword con confianza alta, hacelas sin preguntar". Presupuesto, puja y conversiones siempre a mano.</p>
    </div>
  ) },
  { id: 'lunes', titulo: 'Qué hacés cada lunes', cuerpo: (
    <ol className="space-y-2 text-xs text-[#F5F7FA] leading-relaxed list-decimal pl-4">
      <li><span className="text-[#FFFFFF]">Bandeja.</span> Es una cola: pide acción hoy, listos para ejecutar, esperan confirmación, reportes para aprobar. Trabajala de arriba a abajo hasta que diga "Nada te espera".</li>
      <li><span className="text-[#FFFFFF]">Cuenta › Brief.</span> Leé el titular y el handoff de cada cuenta. El brief completo solo si el titular te sorprende.</li>
      <li><span className="text-[#FFFFFF]">Cada accionable.</span> Abrilo desde la Bandeja. Si es negativa o pausa, "Aprobar y que se haga" y el script lo ejecuta en la hora. Si no, seguí "Cómo hacerlo" con Google Ads en la otra pestaña y marcalo Hecho con la fecha. Los que esperan confirmación son deducciones: si tienen sentido, Confirmar; si no, Descartar con una línea en Decisión final.</li>
      <li><span className="text-[#FFFFFF]">Cuenta › Reportes.</span> Leé el borrador. Si está bien, Aprobar. Si querés cambiar una frase, Editar texto, Guardar, Aprobar. Ver PDF lo genera y lo abre.</li>
      <li><span className="text-[#FFFFFF]">Si cambiaste algo que el sistema no propuso</span>, anotalo en Sistema › Soporte › Bitácora. Es la única forma de que el análisis del lunes siguiente sepa por qué se movió un número.</li>
    </ol>
  ) },
  { id: 'accionable', titulo: 'Ejecutar un accionable', cuerpo: (
    <div className="space-y-2 text-xs text-[#F5F7FA] leading-relaxed">
      <p>Cada accionable tiene cuatro cosas: <span className="text-[#FFFFFF]">qué</span> (el título), <span className="text-[#FFFFFF]">por qué</span> (los números), <span className="text-[#FFFFFF]">cómo hacerlo</span> (los pasos en Google Ads) y <span className="text-[#FFFFFF]">dónde</span> (la campaña, el grupo, la keyword).</p>
      <p>Los pasos están escritos contra la interfaz de Google Ads de 2026: menú izquierdo <span className="text-[#FFFFFF]">Campañas</span>, después la campaña, el grupo, y el submenú <span className="text-[#FFFFFF]">Palabras clave</span> con sus pestañas. Las negativas tienen su propia pestaña ahí. Las conversiones viven en <span className="text-[#FFFFFF]">Objetivos › Conversiones</span>. La estrategia de puja en <span className="text-[#FFFFFF]">Configuración › Puja</span>.</p>
      <p>Cuando termines, <span className="text-[#FFFFFF]">Marcar Hecho</span> y poné la fecha en "Ejecutado el". Catorce días después, Sistema te muestra qué pasó con la métrica: eso es lo que convierte un cambio en aprendizaje.</p>
      <p className="opacity-70">Si el accionable dice "Preguntar a X", no hay nada que tocar en Google Ads. Mandá la pregunta, y cuando responda anotá la respuesta en Decisión final.</p>
    </div>
  ) },
  { id: 'reporte', titulo: 'Aprobar un reporte al cliente', cuerpo: (
    <div className="space-y-2 text-xs text-[#F5F7FA] leading-relaxed">
      <p>El lunes a las 9:15 aparece el borrador en <span className="text-[#FFFFFF]">Cuenta › Reportes</span>, y en la Bandeja como "reporte para aprobar", en el idioma de esa cuenta. Y podés armar uno de cualquier período con un clic: última semana, dos semanas, mes pasado, o las fechas que quieras; el sistema busca solo el análisis de esa semana y, si no hay, lo redacta desde los datos. Tiene las secciones que vos usás: contexto, observaciones, cambios aplicados, puntos de atención, próximos pasos. Los números del período y las tablas de campañas y grupos con gasto los pone el sistema desde Supabase.</p>
      <p><span className="text-[#FFFFFF]">Ver PDF</span> lo genera con el branding de NorthSignal y lo abre. <span className="text-[#FFFFFF]">Editar texto</span> si querés cambiar algo. <span className="text-[#FFFFFF]">Aprobar</span> cuando esté listo. El envío por el canal de cada cuenta (Slack para Karedo, mail para BHI) viene en la siguiente versión; mientras tanto, descargá el PDF y mandalo.</p>
    </div>
  ) },
  { id: 'nocuadra', titulo: 'Cuando algo no cuadra', cuerpo: (
    <div className="space-y-2 text-xs text-[#F5F7FA] leading-relaxed">
      <p><span className="text-[#FFFFFF]">Un número que no coincide con Google Ads.</span> Primero mirá la madurez: los últimos dos días son provisionales y Google sigue asentando conversiones hasta siete días. Si es un día consolidado y no cuadra, Sistema › Salud te dice cuándo fue la última extracción.</p>
      <p><span className="text-[#FFFFFF]">Un accionable que no tiene sentido.</span> Descartalo con una línea en Decisión final diciendo por qué. La tarea del lunes lee eso y aprende.</p>
      <p><span className="text-[#FFFFFF]">Algo de la app que falla o confunde.</span> El botón de abajo a la derecha: Reportar. Decí en qué pantalla, qué esperabas ver y qué viste. Va con la página y la cuenta ya cargadas. Claude lo lee al empezar la siguiente sesión.</p>
      <p><span className="text-[#FFFFFF]">Una pregunta.</span> El mismo botón: Preguntar. Sabe dónde está cada cosa en la app, qué significa cada término, y consulta los datos reales de las cuentas.</p>
    </div>
  ) },
];

export function OptimizationsHub() {
  const [activa, setActiva] = useState('ciclo');
  const sec = SECCIONES.find(s => s.id === activa) || SECCIONES[0];
  return (
    <div className="h-full flex flex-col text-[#F5F7FA]">
      <header className="h-14 flex items-center gap-3 px-8 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <BookOpen size={18} className="text-[#0062CC]" />
        <h1 className="text-base font-medium text-[#FFFFFF]">Guía de operación</h1>
        <span className="text-xs text-[#F5F7FA] opacity-50">cómo funciona el ciclo y qué hacés vos en cada parte</span>
      </header>
      <div className="flex-1 flex min-h-0">
        <nav className="w-56 shrink-0 p-4 space-y-1" style={{ borderRight: '1px solid var(--border)' }}>
          {SECCIONES.map(s => (
            <button key={s.id} onClick={() => setActiva(s.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs ${activa === s.id ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100 hover:bg-white/5'}`}>{s.titulo}</button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 max-w-3xl">
          <h2 className="text-[15px] font-medium text-[#FFFFFF] mb-4">{sec.titulo}</h2>
          {sec.cuerpo}
        </div>
      </div>
    </div>
  );
}
