/**
 * CAMPANA · el centro de notificaciones.
 *
 * Modelo actor-verbo-objeto (Activity Streams), lectura separada del evento.
 * Agrupado por objeto como Notion: cinco comentarios en el mismo accionable son
 * una entrada expandible. Resoluble desde acá como Linear: abrir, marcar visto.
 * Polling cada 45 s; toast breve cuando entra algo nuevo con la app abierta.
 * La insignia se gana: cuenta solo lo sin ver.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { ACTORES, VERBOS_HUMANOS, actorDe, haceCuanto } from '../lib/actores';

export interface Novedad { id: number; tipo: string; account: string | null; ref_tipo: string; ref_id: string; titulo: string; texto: string | null; actor: string | null; verbo: string | null; objeto: string | null; creada: string; leida_el: string | null }

interface Props { onAbrir: (n: Novedad) => void }

export function Campana({ onAbrir }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [pestana, setPestana] = useState<'sinver' | 'todas'>('sinver');
  const [sinVer, setSinVer] = useState<Novedad[]>([]);
  const [todas, setTodas] = useState<Novedad[]>([]);
  const [toast, setToast] = useState<Novedad | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const vistos = useRef<Set<number>>(new Set()); const primera = useRef(true);
  const panel = useRef<HTMLDivElement>(null);
  const panelFlotante = useRef<HTMLDivElement>(null);

  const cargar = async () => {
    try {
      const r = await fetch('/api/novedades', { credentials: 'include' }); if (!r.ok) return;
      const d: Novedad[] = await r.json();
      // Toast solo para lo que entró desde la última consulta (no en la primera carga)
      if (!primera.current) { const nuevo = d.find(n => !vistos.current.has(n.id)); if (nuevo) { setToast(nuevo); setTimeout(() => setToast(null), 6000); } }
      d.forEach(n => vistos.current.add(n.id)); primera.current = false;
      setSinVer(d);
    } catch {}
  };
  const cargarTodas = async () => { try { const r = await fetch('/api/novedades?todas=1', { credentials: 'include' }); if (r.ok) setTodas(await r.json()); } catch {} };
  useEffect(() => { cargar(); const t = setInterval(cargar, 45000); return () => clearInterval(t); }, []);
  useEffect(() => { if (abierta && pestana === 'todas') cargarTodas(); }, [abierta, pestana]);
  useEffect(() => {
    if (!abierta) return;
    const f = (e: MouseEvent) => { const t = e.target as Node; if (panel.current?.contains(t) || panelFlotante.current?.contains(t)) return; setAbierta(false); };
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f);
  }, [abierta]);

  const leer = async (n: Novedad) => { await fetch('/api/novedades/leer', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref_tipo: n.ref_tipo, ref_id: n.ref_id }) }); cargar(); if (pestana === 'todas') cargarTodas(); };
  const leerTodas = async () => { await fetch('/api/novedades/leer', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todas: true }) }); cargar(); if (pestana === 'todas') cargarTodas(); };
  const abrir = (n: Novedad) => { setAbierta(false); onAbrir(n); leer(n); };

  const lista = pestana === 'sinver' ? sinVer : todas;
  // Agrupar por objeto: el mismo accionable con varios eventos es una entrada
  const grupos = useMemo(() => {
    const m = new Map<string, Novedad[]>();
    lista.forEach(n => { const k = `${n.ref_tipo}:${n.ref_id}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(n); });
    return [...m.entries()].map(([k, items]) => ({ k, items, ultimo: items[0] })).sort((a, b) => new Date(b.ultimo.creada).getTime() - new Date(a.ultimo.creada).getTime());
  }, [lista]);

  const seccion = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); return d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : 'Antes'; };

  return (
    <div className="relative" ref={panel}>
      <button onClick={() => setAbierta(v => !v)} className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#F5F7FA] opacity-80 hover:opacity-100 hover:bg-white/5" title="Novedades: lo que tus compañeros de trabajo hicieron">
        <Bell size={16} />
        {sinVer.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0062CC] text-[#FFFFFF] text-[10px] font-bold flex items-center justify-center tabular">{sinVer.length > 99 ? '99+' : sinVer.length}</span>}
      </button>

      {toast && !abierta && createPortal(
        <div onClick={() => abrir(toast)} className="fixed top-14 right-5 z-[300] w-[340px] p-3 rounded-xl cursor-pointer shadow-2xl" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--primary)' }}>
          <div className="flex items-start gap-2.5">
            <Avatar actor={toast.actor} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-[#FFFFFF]"><span className="font-semibold">{actorDe(toast.actor).nombre}</span> {VERBOS_HUMANOS[toast.verbo || ''] || ''} <span className="opacity-80">{(toast.objeto || toast.titulo).slice(0, 60)}</span></div>
              {toast.texto && <div className="text-[11px] text-[#F5F7FA] opacity-60 line-clamp-2 mt-0.5">{toast.texto}</div>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setToast(null); }} className="text-[#F5F7FA] opacity-40 hover:opacity-100"><X size={12} /></button>
          </div>
        </div>, document.body)}

      {abierta && createPortal(
        <div ref={panelFlotante} className="fixed right-4 top-12 z-[300] w-[420px] max-w-[calc(100vw-24px)] rounded-2xl shadow-2xl flex flex-col" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-strong)', maxHeight: '72vh' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex gap-1">
              <button onClick={() => setPestana('sinver')} className={`px-2.5 py-1 rounded-md text-xs ${pestana === 'sinver' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`}>Sin ver{sinVer.length ? ` · ${sinVer.length}` : ''}</button>
              <button onClick={() => setPestana('todas')} className={`px-2.5 py-1 rounded-md text-xs ${pestana === 'todas' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`}>Últimos 7 días</button>
            </div>
            {sinVer.length > 0 && <button onClick={leerTodas} className="text-[11px] text-[#F5F7FA] opacity-60 hover:opacity-100 flex items-center gap-1"><Check size={12} /> Marcar todo visto</button>}
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {grupos.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={18} className="mx-auto text-[#F5F7FA] opacity-30 mb-2" />
                <p className="text-xs text-[#FFFFFF]">{pestana === 'sinver' ? 'Nada nuevo.' : 'Sin actividad en 7 días.'}</p>
                <p className="text-[11px] text-[#F5F7FA] opacity-50 mt-1">Tus compañeros te avisan acá cuando comentan, editan, proponen o ejecutan algo.</p>
              </div>
            ) : (() => {
              let ultimaSeccion = '';
              return grupos.map(g => {
                const s = seccion(g.ultimo.creada); const cab = s !== ultimaSeccion; ultimaSeccion = s;
                const varios = g.items.length > 1; const exp = expandido[g.k];
                const actores: string[] = Array.from(new Set<string>(g.items.map(i => i.actor || 'agente')));
                return (
                  <div key={g.k}>
                    {cab && <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-40">{s}</div>}
                    <div className={`px-4 py-2.5 hover:bg-white/5 ${g.items.some(i => !i.leida_el) ? '' : 'opacity-60'}`} style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="flex items-start gap-2.5 cursor-pointer" onClick={() => varios ? setExpandido(x => ({ ...x, [g.k]: !exp })) : abrir(g.ultimo)}>
                        <div className="flex -space-x-1.5 shrink-0 pt-0.5">{actores.slice(0, 3).map(a => <Avatar key={a} actor={a} chico />)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-[#FFFFFF] leading-snug">
                            {varios ? <><span className="font-semibold">{g.items.length} novedades</span> en </> : <><span className="font-semibold">{actorDe(g.ultimo.actor).nombre}</span> {VERBOS_HUMANOS[g.ultimo.verbo || ''] || ''} </>}
                            <span className="opacity-90">{(g.ultimo.objeto || g.ultimo.titulo).slice(0, 80)}</span>
                          </div>
                          {!varios && g.ultimo.texto && <div className="text-[11px] text-[#F5F7FA] opacity-60 line-clamp-2 mt-0.5">{g.ultimo.texto}</div>}
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#F5F7FA] opacity-40">
                            {g.ultimo.account && <span className="uppercase tracking-wider">{g.ultimo.account}</span>}
                            <span>{haceCuanto(g.ultimo.creada)}</span>
                            {varios && <span className="ml-auto flex items-center gap-0.5">{exp ? <ChevronDown size={11} /> : <ChevronRight size={11} />} {exp ? 'cerrar' : 'ver las ' + g.items.length}</span>}
                          </div>
                        </div>
                        {!varios && <button onClick={(e) => { e.stopPropagation(); leer(g.ultimo); }} className="text-[#F5F7FA] opacity-30 hover:opacity-100 shrink-0 pt-0.5" title="Marcar visto"><Check size={13} /></button>}
                      </div>
                      {varios && exp && (
                        <div className="mt-2 ml-8 space-y-1.5">
                          {g.items.map(i => (
                            <div key={i.id} onClick={() => abrir(i)} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-white/5" style={{ backgroundColor: 'var(--surface-2)' }}>
                              <Avatar actor={i.actor} chico />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] text-[#FFFFFF]"><span className="font-semibold">{actorDe(i.actor).nombre}</span> {VERBOS_HUMANOS[i.verbo || ''] || ''}</div>
                                {i.texto && <div className="text-[11px] text-[#F5F7FA] opacity-60 line-clamp-2">{i.texto}</div>}
                                <div className="text-[10px] text-[#F5F7FA] opacity-40 mt-0.5">{haceCuanto(i.creada)}</div>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => abrir(g.ultimo)} className="text-[11px] text-[#0062CC] px-2.5 py-1">Abrir {g.ultimo.ref_tipo === 'accionable' ? 'el accionable' : g.ultimo.ref_tipo === 'propuesta' ? 'la propuesta' : 'esto'}</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div className="px-4 py-2 text-[10px] text-[#F5F7FA] opacity-40" style={{ borderTop: '1px solid var(--border)' }}>
            Quiénes te avisan: {Object.entries(ACTORES).filter(([k]) => ['semanal', 'pulso', 'mensual', 'reconciliador', 'politica', 'claude'].includes(k)).map(([, a]) => a.inicial + ' ' + a.nombre.toLowerCase()).join(' · ')}
          </div>
        </div>, document.body)}
    </div>
  );
}

export function Avatar({ actor, chico }: { actor?: string | null; chico?: boolean; key?: any }) {
  const a = actorDe(actor);
  const propio = actor === 'andres';
  return (
    <span title={a.nombre + (a.que_hace ? ': ' + a.que_hace : '')} className={`${chico ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-[11px]'} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ backgroundColor: propio ? 'var(--primary)' : 'var(--surface-2)', color: '#FFFFFF', border: propio ? 'none' : '1px solid var(--border-strong)' }}>
      {a.inicial}
    </span>
  );
}
