/**
 * Ayuda: preguntar y reportar.
 *  - Preguntar: el asistente, que sabe la app y consulta los datos.
 *  - Reportar: un ticket para Claude, con la página y la cuenta ya cargadas.
 *
 * DÓNDE VIVE EL DISPARADOR. Pasó por dos círculos apilados y después por una
 * pastilla flotante. Las dos versiones tenían el mismo problema de fondo: un
 * botón que flota sobre el contenido tapa la esquina inferior derecha de TODAS
 * las pantallas, y esa esquina es justo donde terminan las tablas largas y las
 * leyendas de los gráficos. Un elemento permanente no puede vivir encima de
 * contenido que cambia de alto.
 *
 * Ahora el disparador está en el header, al lado de ⌘K, que es donde el
 * operador ya busca las acciones globales — y no pisa nada nunca. En el
 * teléfono sigue habiendo un círculo, porque ahí el header no tiene lugar y la
 * barra de navegación de abajo da una referencia clara de dónde ponerlo.
 *
 * El panel se abre desde el evento `ns:ayuda` o con ⌘J.
 */
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

type Msg = { role: 'user' | 'assistant'; content: string };
const NOMBRES: Record<string, string> = { bandeja: 'Bandeja', cuenta: 'Cuenta', datos: 'Datos', herramientas: 'Anuncios', sistema: 'Sistema' };
const LABEL = { color: '#ADADAD', letterSpacing: '0.3px' } as const;
const CAMPO: React.CSSProperties = {
  border: '1px solid var(--border-strong)',
  backgroundColor: 'color-mix(in srgb, var(--navy) 55%, transparent)',
  borderRadius: 10,
};

export function Ayuda({ pagina }: { pagina: string }) {
  const { selectedClient } = useAppStore();
  const [abierto, setAbierto] = useState<null | 'chat' | 'ticket'>(null);
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [ticket, setTicket] = useState({ tipo: 'bug', titulo: '', descripcion: '' });
  const [enviando, setEnviando] = useState(false);
  const [ticketOk, setTicketOk] = useState<number | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, pensando]);

  // Esc cierra: es el gesto que ya usan el drawer y la paleta. ⌘J abre y
  // cierra, que es lo que espera quien ya usa ⌘K acá al lado.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierto) { setAbierto(null); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAbierto(a => (a ? null : 'chat'));
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto]);

  // El header dispara este evento: un botón allá, el panel acá, sin store.
  useEffect(() => {
    const h = (e: Event) => setAbierto(((e as CustomEvent).detail?.modo as any) || 'chat');
    window.addEventListener('ns:ayuda', h);
    return () => window.removeEventListener('ns:ayuda', h);
  }, []);

  const preguntar = async () => {
    const q = texto.trim(); if (!q || pensando) return;
    const nuevos: Msg[] = [...mensajes, { role: 'user', content: q }];
    setMensajes(nuevos); setTexto(''); setPensando(true);
    try {
      const r = await fetch('/api/asistente', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensajes: nuevos, pagina: NOMBRES[pagina] || pagina, cuenta: selectedClient }) });
      const d = await r.json();
      setMensajes([...nuevos, { role: 'assistant', content: r.ok ? d.texto : `No pude responder: ${d.error || r.status}` }]);
    } catch (e: any) { setMensajes([...nuevos, { role: 'assistant', content: 'Sin conexión con el servidor.' }]); }
    finally { setPensando(false); }
  };

  const enviarTicket = async () => {
    if (!ticket.titulo.trim() || enviando) return;
    setEnviando(true);
    try {
      const contexto = { url: window.location.href, viewport: `${window.innerWidth}x${window.innerHeight}`, ua: navigator.userAgent.slice(0, 80), fecha: new Date().toISOString() };
      const r = await fetch('/api/tickets', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ticket, pagina: NOMBRES[pagina] || pagina, cuenta: selectedClient, contexto }) });
      const d = await r.json();
      if (r.ok) { setTicketOk(d.id); setTicket({ tipo: 'bug', titulo: '', descripcion: '' }); }
    } finally { setEnviando(false); }
  };

  return (
    <>
      {/* En el escritorio el disparador vive en el header. Acá solo queda el
          del teléfono, por encima de la barra de navegación de abajo. */}
      {!abierto && (
        <button onClick={() => setAbierto('chat')} aria-label="Preguntar o reportar algo"
          className="fixed bottom-16 right-4 z-[90] sm:hidden w-11 h-11 rounded-full flex items-center justify-center glass-dense"
          style={{ boxShadow: '0 10px 30px -12px rgba(0,0,0,0.8)' }}>
          <MessageCircle size={17} style={{ color: 'var(--primary-text)' }} />
        </button>
      )}

      {/* El panel arranca bajo el header (top-16) y termina antes del borde del
          shell: así nunca tapa el switcher de cuentas ni queda montado sobre la
          esquina redondeada de la ventana. */}
      {abierto && (
        <div className="fixed right-4 top-[64px] bottom-[72px] sm:bottom-5 z-[90] w-[390px] max-w-[calc(100vw-32px)] rounded-2xl flex flex-col glass"
          style={{ borderRadius: 16, maxHeight: 'min(620px, calc(100% - 84px))', boxShadow: '0 28px 70px -20px rgba(0,0,0,0.85)' }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ border: '1px solid var(--border)' }}>
              {[
                { id: 'chat' as const, label: 'Preguntar' },
                { id: 'ticket' as const, label: 'Reportar' },
              ].map(t => (
                <button key={t.id} onClick={() => { setAbierto(t.id); if (t.id === 'ticket') setTicketOk(null); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${abierto === t.id ? 'bg-white/10 text-[#FAFAFA]' : 'hover:text-[#FAFAFA]'}`}
                  style={abierto === t.id ? undefined : LABEL}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={() => setAbierto(null)} aria-label="Cerrar" title="Cerrar · Esc"
              className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-white/5" style={{ color: '#ADADAD' }}><X size={14} /></button>
          </div>

          {abierto === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 min-h-[190px]">
                {mensajes.length === 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] leading-relaxed" style={LABEL}>
                      Preguntame dónde está algo, qué significa un término, o cómo va una cuenta.
                      Consulto los datos reales; no invento números.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {['¿Cómo va ' + (selectedClient || 'la cuenta') + '?', '¿Qué es cuota perdida por ranking?', '¿Qué dice el plan de esta semana?'].map(q => (
                        <button key={q} onClick={() => setTexto(q)} className="px-2 py-1 rounded-md text-[10px] text-[#F5F7FA] hover:bg-white/5 transition-colors"
                          style={{ border: '1px solid var(--border)' }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {mensajes.map((m, i) => (
                  <div key={i} className={`text-[12px] leading-relaxed whitespace-pre-wrap rounded-xl px-3 py-2 ${m.role === 'user' ? 'ml-8 text-[#EDEFF3]' : 'mr-4 text-[#F5F7FA]'}`}
                    style={{ backgroundColor: m.role === 'user' ? 'var(--primary-faint)' : 'var(--surface-2)' }}>{m.content}</div>
                ))}
                {pensando && (
                  <div className="mr-4 rounded-xl px-3 py-2 text-[11px] flex items-center gap-2" style={{ backgroundColor: 'var(--surface-2)', ...LABEL }}>
                    <Loader2 size={11} className="animate-spin" /> Consultando los datos…
                  </div>
                )}
                <div ref={fin} />
              </div>
              <div className="flex gap-2 p-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                <input aria-label="Tu pregunta" value={texto} onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && preguntar()} placeholder="Escribí tu pregunta…"
                  className="flex-1 px-3 py-1.5 text-[12px] text-[#EDEFF3] placeholder-[#F5F7FA]/30 focus:outline-none" style={CAMPO} />
                <button aria-label="Enviar la pregunta" title="Enviar" onClick={preguntar} disabled={!texto.trim() || pensando}
                  className="px-3 rounded-lg bg-[#0062CC] text-[#EDEFF3] disabled:opacity-40" style={{ borderRadius: 10 }}><Send size={13} /></button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2.5 overflow-y-auto custom-scrollbar">
              {ticketOk ? (
                <div className="text-[12px] leading-relaxed py-5 text-center" style={{ color: '#F5F7FA' }}>
                  <div className="text-[#EDEFF3] font-medium mb-1">Ticket #{ticketOk} guardado.</div>
                  Claude lo lee al empezar la próxima sesión y responde ahí, o lo resuelve en el siguiente fix.
                  <button onClick={() => setTicketOk(null)} className="block mx-auto mt-3 text-[11px]" style={{ color: '#4D9DFF' }}>Reportar otra cosa</button>
                </div>
              ) : (
                <>
                  <p className="text-[11px] leading-relaxed" style={LABEL}>
                    Estás en <span className="text-[#EDEFF3]">{NOMBRES[pagina] || pagina}</span>
                    {selectedClient ? <> con <span className="text-[#EDEFF3]">{selectedClient}</span></> : ''}. Eso viaja con el ticket.
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {(['bug', 'dato_incorrecto', 'mejora', 'pregunta'] as const).map(t => (
                      <button key={t} onClick={() => setTicket(k => ({ ...k, tipo: t }))}
                        className={`px-2 py-1 rounded-md text-[10px] transition-colors ${ticket.tipo === t ? 'bg-white/10 text-[#FAFAFA]' : 'hover:text-[#FAFAFA]'}`}
                        style={ticket.tipo === t ? undefined : { ...LABEL, border: '1px solid var(--border)' }}>
                        {t === 'bug' ? 'Algo falla' : t === 'dato_incorrecto' ? 'Un dato está mal' : t === 'mejora' ? 'Idea' : 'Pregunta'}
                      </button>
                    ))}
                  </div>
                  <input aria-label="Qué pasa" value={ticket.titulo} onChange={e => setTicket(k => ({ ...k, titulo: e.target.value }))}
                    placeholder="Qué pasa, en una línea"
                    className="w-full px-3 py-1.5 text-[12px] text-[#EDEFF3] placeholder-[#F5F7FA]/30 focus:outline-none" style={CAMPO} />
                  <textarea aria-label="Detalle" value={ticket.descripcion} onChange={e => setTicket(k => ({ ...k, descripcion: e.target.value }))} rows={4}
                    placeholder="Qué esperabas ver, qué viste, qué número no cuadra."
                    className="w-full px-3 py-1.5 text-[12px] text-[#EDEFF3] placeholder-[#F5F7FA]/30 focus:outline-none leading-relaxed" style={CAMPO} />
                  <button onClick={enviarTicket} disabled={!ticket.titulo.trim() || enviando}
                    className="w-full py-2 rounded-lg bg-[#0062CC] text-[#EDEFF3] text-[12px] font-medium disabled:opacity-40" style={{ borderRadius: 10 }}>
                    {enviando ? 'Guardando…' : 'Enviar a Claude'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
