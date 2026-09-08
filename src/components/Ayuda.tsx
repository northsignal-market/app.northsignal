/**
 * Ayuda flotante: un botón abajo a la derecha con dos cosas.
 *  - Preguntar: el asistente, que sabe la app y consulta los datos.
 *  - Reportar: un ticket para Claude, con la página y la cuenta ya cargadas.
 * Mismo estilo que el resto: superficies de la paleta, sin tarjetas nuevas.
 */
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Bug, X, Send, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

type Msg = { role: 'user' | 'assistant'; content: string };
const NOMBRES: Record<string, string> = { bandeja: 'Bandeja', cuenta: 'Cuenta', datos: 'Datos', herramientas: 'Herramientas', sistema: 'Sistema' };

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
      {/* Botones flotantes */}
      {!abierto && (
        <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2">
          <button onClick={() => setAbierto('chat')} title="Preguntar sobre la app o las cuentas" className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform" style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF' }}><MessageCircle size={18} /></button>
          <button onClick={() => { setAbierto('ticket'); setTicketOk(null); }} title="Algo no cuadra: reportarlo" className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: '#F5F7FA' }}><Bug size={16} /></button>
        </div>
      )}

      {/* Panel */}
      {abierto && (
        <div className="fixed bottom-5 right-5 z-[90] w-[380px] max-w-[calc(100vw-40px)] rounded-2xl flex flex-col shadow-2xl" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-strong)', maxHeight: '70vh' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex gap-1">
              <button onClick={() => setAbierto('chat')} className={`px-2.5 py-1 rounded-md text-xs ${abierto === 'chat' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`}>Preguntar</button>
              <button onClick={() => { setAbierto('ticket'); setTicketOk(null); }} className={`px-2.5 py-1 rounded-md text-xs ${abierto === 'ticket' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`}>Reportar</button>
            </div>
            <button onClick={() => setAbierto(null)} className="text-[#F5F7FA] opacity-60 hover:opacity-100"><X size={16} /></button>
          </div>

          {abierto === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 min-h-[200px]">
                {mensajes.length === 0 && (
                  <div className="text-xs text-[#F5F7FA] opacity-60 leading-relaxed space-y-2">
                    <p>Preguntame dónde está algo, qué significa un término, o cómo va una cuenta. Consulto los datos reales; no invento números.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['¿Cómo va ' + (selectedClient || 'Karedo') + '?', '¿Qué es cuota perdida por ranking?', '¿Dónde apruebo el reporte al cliente?', '¿Qué hago con lo que espera confirmación?', '¿Qué dice el plan de esta semana?'].map(q => (
                        <button key={q} onClick={() => setTexto(q)} className="px-2 py-1 rounded-md text-[11px] text-[#F5F7FA]" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {mensajes.map((m, i) => (
                  <div key={i} className={`text-xs leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2 ${m.role === 'user' ? 'ml-8 text-[#FFFFFF]' : 'mr-4 text-[#F5F7FA]'}`} style={{ backgroundColor: m.role === 'user' ? 'var(--primary-faint)' : 'var(--surface-2)' }}>{m.content}</div>
                ))}
                {pensando && <div className="mr-4 rounded-lg px-3 py-2 text-xs text-[#F5F7FA] opacity-60 flex items-center gap-2" style={{ backgroundColor: 'var(--surface-2)' }}><Loader2 size={12} className="animate-spin" /> Consultando…</div>}
                <div ref={fin} />
              </div>
              <div className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
                <input aria-label="Texto" value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && preguntar()} placeholder="Escribí tu pregunta…" className="flex-1 bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-3 py-1.5 text-xs text-[#FFFFFF] focus:outline-none focus:border-[#0062CC]" />
                <button aria-label="Enviar la pregunta" title="Enviar la pregunta" onClick={preguntar} disabled={!texto.trim() || pensando} className="px-3 rounded-lg bg-[#0062CC] text-[#FFFFFF] disabled:opacity-40"><Send size={14} /></button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              {ticketOk ? (
                <div className="text-xs text-[#F5F7FA] leading-relaxed py-4 text-center">
                  <div className="text-[#FFFFFF] font-medium mb-1">Ticket #{ticketOk} guardado.</div>
                  Claude lo lee al empezar la próxima sesión de trabajo y te responde ahí, o lo resuelve en el siguiente fix.
                  <button onClick={() => setTicketOk(null)} className="block mx-auto mt-3 text-[11px] text-[#0062CC]">Crear otro</button>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-[#F5F7FA] opacity-60">Estás en <span className="text-[#FFFFFF]">{NOMBRES[pagina] || pagina}</span>{selectedClient ? <> con <span className="text-[#FFFFFF]">{selectedClient}</span></> : ''}. Eso viaja con el ticket.</p>
                  <div className="flex gap-1">
                    {(['bug', 'dato_incorrecto', 'mejora', 'pregunta'] as const).map(t => (
                      <button key={t} onClick={() => setTicket(k => ({ ...k, tipo: t }))} className={`px-2 py-1 rounded-md text-[11px] ${ticket.tipo === t ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`} style={ticket.tipo !== t ? { border: '1px solid var(--border)' } : {}}>{t === 'bug' ? 'Algo falla' : t === 'dato_incorrecto' ? 'Un dato está mal' : t === 'mejora' ? 'Idea' : 'Pregunta'}</button>
                    ))}
                  </div>
                  <input aria-label="Ticket" value={ticket.titulo} onChange={e => setTicket(k => ({ ...k, titulo: e.target.value }))} placeholder="Qué pasa, en una línea" className="w-full bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-3 py-1.5 text-xs text-[#FFFFFF] focus:outline-none focus:border-[#0062CC]" />
                  <textarea aria-label="Ticket" value={ticket.descripcion} onChange={e => setTicket(k => ({ ...k, descripcion: e.target.value }))} rows={4} placeholder="Detalle si querés: qué esperabas ver, qué viste, qué número no cuadra." className="w-full bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-3 py-1.5 text-xs text-[#FFFFFF] focus:outline-none focus:border-[#0062CC]" />
                  <button onClick={enviarTicket} disabled={!ticket.titulo.trim() || enviando} className="w-full py-2 rounded-lg bg-[#0062CC] text-[#FFFFFF] text-xs font-medium disabled:opacity-40">{enviando ? 'Guardando…' : 'Enviar a Claude'}</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
