/**
 * REPORTES v2 · el editor.
 *
 * Patrón: la IA redacta, el humano revisa antes de que llegue al cliente
 * ("approve with edits"). Lo que hace rápido a ese patrón: el diff es
 * obvio (versiones), los números están bloqueados (vienen de Supabase, no
 * se editan), cada sección se regenera sola, y aprobar es un paso explícito
 * distinto de enviar. Y enviar NO significa mandarlo al cliente: te lo manda a vos,
 * con el PDF y el texto listo para reenviar. Vos decidís cuándo sale.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, Check, Send, Eye, History, Copy, ExternalLink, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

type Bloque = { etiqueta: string; texto?: string; vinetas?: string[] };
interface Props { activeClient: string; fmtMoney: (v: any) => string }

const ESTADOS: Record<string, { label: string; ayuda: string }> = {
  borrador: { label: 'Borrador', ayuda: 'Lo escribió el sistema. Leelo, editá lo que quieras, regenerá secciones.' },
  revisado: { label: 'Revisado', ayuda: 'Lo leíste. Falta aprobar.' },
  aprobado: { label: 'Aprobado', ayuda: 'Listo. El briefing de las 9:15 te lo manda a vos con el texto para reenviar. El link ya funciona.' },
  enviado: { label: 'Enviado', ayuda: 'Ya lo tiene el cliente. No se edita.' },
  descartado: { label: 'Descartado', ayuda: '' },
};

export function ReportesEditor({ activeClient, fmtMoney }: Props) {
  const [reportes, setReportes] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [sucio, setSucio] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [versiones, setVersiones] = useState<any[]>([]);
  const [verVersiones, setVerVersiones] = useState(false);
  const [preview, setPreview] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [form, setForm] = useState({ desde: '', hasta: '' });

  const cargar = async () => { const r = await fetch(`/api/reportes?client=${activeClient}`, { credentials: 'include' }); if (r.ok) { const d = await r.json(); setReportes(d); if (sel) { const s = d.find((x: any) => x.id === sel.id); if (s) abrir(s); } } };
  useEffect(() => { setSel(null); cargar(); }, [activeClient]);
  const abrir = (r: any) => { setSel(r); setBloques(Array.isArray(r.bloques) && r.bloques.length ? r.bloques : []); setSucio(false); setPreview(false); setVerVersiones(false); fetch(`/api/reportes/${r.id}/versiones`, { credentials: 'include' }).then(x => x.ok ? x.json() : []).then(setVersiones).catch(() => {}); };
  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(null), 4000); };

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const lunes = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const preset = (q: string) => { const hoy = new Date(), l = lunes(hoy); const D = (n: number) => { const x = new Date(l); x.setDate(x.getDate() + n); return x; };
    if (q === 'semana') setForm({ desde: iso(D(-7)), hasta: iso(D(-1)) }); if (q === 'dos') setForm({ desde: iso(D(-14)), hasta: iso(D(-1)) });
    if (q === 'mes') setForm({ desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)) }); };
  const crear = async () => { setTrabajando('crear'); try { const r = await fetch('/api/reportes/generar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: activeClient, desde: form.desde, hasta: form.hasta }) }); const d = await r.json(); if (!r.ok) avisar(d.error); else { avisar(d.origen === 'brief' ? 'Borrador armado desde el análisis semanal.' : d.origen === 'sonnet-5' ? 'No había análisis para ese rango: lo redacté desde los datos.' : 'Borrador creado.'); await cargar(); const rr = await fetch(`/api/reportes?client=${activeClient}`, { credentials: 'include' }); const lista = await rr.json(); const nuevo = lista.find((x: any) => x.id === d.reporte.id); if (nuevo) abrir(nuevo); } } finally { setTrabajando(null); } };

  const editable = sel && !['enviado', 'descartado'].includes(sel.estado);
  const setBloque = (i: number, patch: Partial<Bloque>) => { setBloques(bs => bs.map((b, k) => k === i ? { ...b, ...patch } : b)); setSucio(true); };
  const guardar = async (motivo?: string) => { if (!sel) return; setTrabajando('guardar'); try { const r = await fetch(`/api/reportes/${sel.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bloques, motivo }) }); if (r.ok) { setSucio(false); avisar('Guardado como versión nueva.'); await cargar(); } else avisar((await r.json()).error); } finally { setTrabajando(null); } };
  const regenerar = async (etiqueta: string) => { if (!sel) return; const ins = prompt(`Regenerar "${etiqueta}". ¿Alguna instrucción? (opcional: "más corto", "mencioná el cambio de puja", "tono más directo")`, ''); if (ins === null) return; if (sucio && !confirm('Tenés cambios sin guardar en otras secciones; se guardan primero. ¿Seguir?')) return; if (sucio) await guardar('antes de regenerar'); setTrabajando('regen:' + etiqueta); try { const r = await fetch(`/api/reportes/${sel.id}/regenerar`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etiqueta, instruccion: ins || undefined }) }); const d = await r.json(); if (!r.ok) avisar(d.error); else { setBloques(d.bloques); setSucio(false); avisar(`"${etiqueta}" regenerada (v${d.version}). Si no te gusta, restaurá la anterior en Versiones.`); await cargar(); } } finally { setTrabajando(null); } };
  const restaurar = async (v: number) => { if (!sel || !confirm(`¿Volver a la versión ${v}? La actual queda en el historial.`)) return; const r = await fetch(`/api/reportes/${sel.id}/versiones/${v}/restaurar`, { method: 'POST', credentials: 'include' }); if (r.ok) { const d = await r.json(); setBloques(d.bloques); setSucio(false); avisar(`Restaurada la v${v} como v${d.version}.`); await cargar(); } };
  const accion = async (ruta: string, ok: string) => { if (!sel) return; if (sucio) { if (!confirm('Tenés cambios sin guardar. ¿Guardar y seguir?')) return; await guardar(); } setTrabajando(ruta); try { const r = await fetch(`/api/reportes/${sel.id}/${ruta}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const d = await r.json(); if (!r.ok) avisar(d.error); else { avisar(d.nota || ok); if (d.url && d.canal === 'manual') { try { await navigator.clipboard.writeText(d.url); avisar('Link copiado al portapapeles: ' + d.url); } catch {} } await cargar(); } } finally { setTrabajando(null); } };
  const link = sel?.token ? `${window.location.origin}/r/${sel.token}` : null;
  const copiarLink = async () => { if (!link) return; try { await navigator.clipboard.writeText(link); avisar('Link copiado.'); } catch { avisar(link); } };

  const m = sel?.metricas || {};
  const kpi = (k: string, f: (v: any) => string) => m[k] ? <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}><div className="text-[10px] text-[#F5F7FA] opacity-50 uppercase tracking-wider">{k === 'gasto' ? 'Inversión' : k === 'conversiones' ? 'Conversiones' : k.toUpperCase()}</div><div className="text-sm tabular text-[#FFFFFF]">{f(m[k].actual)}</div>{m[k].anterior != null && m[k].anterior ? <div className="text-[10px] tabular text-[#F5F7FA] opacity-50">{((m[k].actual - m[k].anterior) / m[k].anterior * 100 > 0 ? '+' : '')}{((m[k].actual - m[k].anterior) / m[k].anterior * 100).toFixed(0)}% vs anterior</div> : null}</div> : null;

  return (
    <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-4 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-[15px] font-medium text-[#FFFFFF]">Reportes al cliente</h2>
          <p className="text-xs text-[#F5F7FA] opacity-60">El sistema redacta, vos revisás. Los números no se editan: salen de Supabase. Cada sección se regenera sola. Al aprobar, el reporte te llega a vos por correo con el texto listo para reenviar al cliente en su idioma; no sale solo.</p>
        </div>
        {aviso && <span className="text-[11px] text-[#FFFFFF] px-3 py-1.5 rounded-lg shrink-0" style={{ backgroundColor: 'var(--primary-faint)', border: '1px solid rgba(0,98,204,0.4)' }}>{aviso}</span>}
      </div>

      {/* Crear */}
      <div className="p-3 rounded-xl flex flex-wrap items-end gap-2" style={{ backgroundColor: 'var(--surface-2)' }}>
        <div className="flex gap-1.5">{[['semana', 'Última semana'], ['dos', 'Dos semanas'], ['mes', 'Mes pasado']].map(([k, l]) => <button key={k} onClick={() => preset(k)} className="px-2.5 py-1 rounded-md text-[11px] text-[#F5F7FA] hover:text-[#FFFFFF]" style={{ border: '1px solid var(--border)' }}>{l}</button>)}</div>
        <input aria-label="Form" type="date" value={form.desde} onChange={e => setForm(f => ({ ...f, desde: e.target.value }))} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-xs text-[#FFFFFF]" style={{ colorScheme: 'dark' }} />
        <span className="text-[11px] text-[#F5F7FA] opacity-50">a</span>
        <input aria-label="Form" type="date" value={form.hasta} onChange={e => setForm(f => ({ ...f, hasta: e.target.value }))} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-xs text-[#FFFFFF]" style={{ colorScheme: 'dark' }} />
        <button onClick={crear} disabled={!form.desde || !form.hasta || trabajando === 'crear'} className="px-3 py-1.5 rounded-lg text-xs bg-[#0062CC] text-[#FFFFFF] disabled:opacity-40">{trabajando === 'crear' ? 'Armando…' : 'Crear borrador'}</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Lista */}
        <div className="space-y-1">
          {reportes.length === 0 && <p className="text-xs text-[#F5F7FA] opacity-50 italic">Ningún reporte todavía para {activeClient}.</p>}
          {reportes.map(r => (
            <button key={r.id} onClick={() => abrir(r)} className="w-full text-left px-3 py-2 rounded-lg" style={{ backgroundColor: sel?.id === r.id ? 'var(--primary-faint)' : 'var(--surface-2)', border: sel?.id === r.id ? '1px solid rgba(0,98,204,0.4)' : '1px solid transparent' }}>
              <div className="flex items-center justify-between"><span className="text-xs text-[#FFFFFF] tabular">{r.periodo_desde} → {r.periodo_hasta}</span><span className={`text-[10px] uppercase tracking-wider ${r.estado === 'borrador' ? 'text-[#0062CC]' : 'text-[#F5F7FA] opacity-50'}`}>{ESTADOS[r.estado]?.label || r.estado}</span></div>
              <div className="text-[10px] text-[#F5F7FA] opacity-50">{r.tipo} · {r.idioma} · v{r.version || 1}{r.visto_el ? ' · visto por el cliente' : ''}{r.enviado_el ? ` · enviado ${String(r.enviado_el).slice(0, 10)}` : ''}</div>
            </button>
          ))}
        </div>

        {/* Editor */}
        {!sel ? <div className="text-xs text-[#F5F7FA] opacity-50 italic pt-2">Elegí un reporte o creá uno.</div> : (
          <div className="space-y-3 min-w-0">
            {/* Estado y acciones */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] text-[#FFFFFF]" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>{ESTADOS[sel.estado]?.label} · v{sel.version || 1}</span>
              <span className="text-[11px] text-[#F5F7FA] opacity-50">{ESTADOS[sel.estado]?.ayuda}</span>
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <button onClick={() => setPreview(v => !v)} className="px-2.5 py-1 rounded-md text-[11px] text-[#F5F7FA] flex items-center gap-1" style={{ border: '1px solid var(--border)' }}><Eye size={12} /> {preview ? 'Editar' : 'Ver como PDF'}</button>
                <button onClick={() => setVerVersiones(v => !v)} className="px-2.5 py-1 rounded-md text-[11px] text-[#F5F7FA] flex items-center gap-1" style={{ border: '1px solid var(--border)' }}><History size={12} /> Versiones{versiones.length ? ` (${versiones.length})` : ''}</button>
                {editable && sucio && <button onClick={() => guardar()} disabled={trabajando === 'guardar'} className="px-2.5 py-1 rounded-md text-[11px] bg-[#0062CC] text-[#FFFFFF]">{trabajando === 'guardar' ? 'Guardando…' : 'Guardar'}</button>}
                {sel.estado === 'borrador' && <button onClick={() => accion('revisado', 'Marcado como revisado.')} className="px-2.5 py-1 rounded-md text-[11px] text-[#F5F7FA]" style={{ border: '1px solid var(--border)' }}>Lo leí</button>}
                {['borrador', 'revisado'].includes(sel.estado) && <button onClick={() => accion('aprobar', 'Aprobado. El link ya funciona.')} className="px-2.5 py-1 rounded-md text-[11px] bg-[#0062CC] text-[#FFFFFF] flex items-center gap-1"><Check size={12} /> Aprobar</button>}
                {sel.estado === 'aprobado' && <button onClick={() => accion('enviar', 'Enviado.')} disabled={trabajando === 'enviar'} className="px-2.5 py-1 rounded-md text-[11px] bg-[#0062CC] text-[#FFFFFF] flex items-center gap-1"><Send size={12} /> {trabajando === 'enviar' ? 'Enviando…' : 'Enviar'}</button>}
                {['borrador', 'revisado'].includes(sel.estado) && <button onClick={() => { if (confirm('¿Descartar este borrador?')) accion('descartar', 'Descartado.'); }} className="px-2 py-1 rounded-md text-[11px] text-[#F5F7FA] opacity-50 hover:opacity-100" title="Descartar"><Trash2 size={12} /></button>}
              </div>
            </div>

            {/* Link */}
            {link && ['aprobado', 'enviado'].includes(sel.estado) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: 'var(--surface-2)' }}>
                <ExternalLink size={12} className="text-[#0062CC] shrink-0" />
                <a href={link} target="_blank" rel="noreferrer" className="text-[#FFFFFF] truncate hover:underline">{link}</a>
                <button aria-label="Copiar el link del reporte" title="Copiar el link del reporte" onClick={copiarLink} className="ml-auto text-[#F5F7FA] opacity-60 hover:opacity-100 flex items-center gap-1 shrink-0"><Copy size={11} /> copiar</button>
                <span className="text-[#F5F7FA] opacity-40 shrink-0">{sel.vistas ? `${sel.vistas} vista${sel.vistas !== 1 ? 's' : ''}` : 'sin abrir todavía'}</span>
              </div>
            )}

            {/* Versiones */}
            {verVersiones && (
              <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'var(--surface-2)' }}>
                {versiones.length === 0 ? <span className="text-[11px] text-[#F5F7FA] opacity-50">Sin versiones todavía.</span> : versiones.map(v => (
                  <div key={v.id} className="flex items-center gap-3 text-[11px]">
                    <span className="tabular text-[#FFFFFF] w-8">v{v.version}</span>
                    <span className="text-[#F5F7FA] opacity-50 tabular w-28">{String(v.fecha).slice(5, 16).replace('T', ' ')}</span>
                    <span className="text-[#F5F7FA] opacity-70">{v.autor === 'andres' ? 'vos' : v.autor}</span>
                    <span className="text-[#F5F7FA] opacity-50 flex-1 truncate">{v.motivo}</span>
                    {editable && v.version !== (sel.version || 1) && <button onClick={() => restaurar(v.version)} className="text-[#0062CC]">restaurar</button>}
                  </div>
                ))}
              </div>
            )}

            {/* Números bloqueados */}
            <div className="flex flex-wrap gap-2">
              {kpi('gasto', fmtMoney)}{kpi('conversiones', v => Number(v).toLocaleString('es-CL'))}{kpi('cpa', fmtMoney)}{kpi('clics', v => Number(v).toLocaleString('es-CL'))}{kpi('ctr', v => Number(v).toFixed(2) + '%')}
              <div className="self-center text-[10px] text-[#F5F7FA] opacity-40 max-w-[220px]">Estos números salen de Supabase para el período; no se editan. Si no cuadran, el problema está en los datos, no en el reporte.</div>
            </div>

            {/* Vista previa PDF o editor por bloques */}
            {preview ? (
              <iframe title="PDF" src={`/api/reportes/${sel.id}/pdf?download=1&t=${sel.version}`} className="w-full rounded-xl" style={{ height: 620, border: '1px solid var(--border)', backgroundColor: '#fff' }} />
            ) : (
              <div className="space-y-2">
                {bloques.length === 0 && <p className="text-xs text-[#F5F7FA] opacity-50 italic">Este reporte no tiene secciones. Regenerá una o escribila.</p>}
                {bloques.map((b, i) => (
                  <div key={i} className="p-3 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#FFFFFF]">{b.etiqueta}</span>
                      {editable && <button onClick={() => regenerar(b.etiqueta)} disabled={!!trabajando} className="text-[11px] text-[#0062CC] flex items-center gap-1 disabled:opacity-40"><RefreshCw size={11} className={trabajando === 'regen:' + b.etiqueta ? 'animate-spin' : ''} /> {trabajando === 'regen:' + b.etiqueta ? 'redactando…' : 'regenerar'}</button>}
                    </div>
                    {(b.texto !== undefined || !b.vinetas?.length) && (
                      <textarea aria-label="B" value={b.texto || ''} disabled={!editable} onChange={e => setBloque(i, { texto: e.target.value })} rows={Math.max(2, Math.ceil((b.texto || '').length / 110))} placeholder="Párrafo (opcional)" className="w-full bg-transparent px-2 py-1.5 rounded-lg text-xs text-[#F5F7FA] leading-relaxed resize-y focus:outline-none focus:border-[#0062CC] disabled:opacity-70" style={{ border: '1px solid var(--border)' }} />
                    )}
                    {(b.vinetas || []).map((v, k) => (
                      <div key={k} className="flex items-start gap-2">
                        <span className="text-[#F5F7FA] opacity-40 pt-1.5">–</span>
                        <textarea aria-label="V" value={v} disabled={!editable} onChange={e => setBloque(i, { vinetas: b.vinetas!.map((x, j) => j === k ? e.target.value : x) })} rows={Math.max(1, Math.ceil(v.length / 110))} className="flex-1 bg-transparent px-2 py-1 rounded-lg text-xs text-[#F5F7FA] leading-relaxed resize-y focus:outline-none focus:border-[#0062CC] disabled:opacity-70" style={{ border: '1px solid transparent' }} onFocus={e => (e.target.style.borderColor = 'var(--border)')} onBlur={e => (e.target.style.borderColor = 'transparent')} />
                        {editable && <button onClick={() => setBloque(i, { vinetas: b.vinetas!.filter((_, j) => j !== k) })} className="text-[#F5F7FA] opacity-30 hover:opacity-100 pt-1" title="Quitar viñeta">×</button>}
                      </div>
                    ))}
                    {editable && <button onClick={() => setBloque(i, { vinetas: [...(b.vinetas || []), ''] })} className="text-[10px] text-[#F5F7FA] opacity-50 hover:opacity-100">+ viñeta</button>}
                  </div>
                ))}
                {editable && bloques.length > 0 && <p className="text-[10px] text-[#F5F7FA] opacity-40">Guardar crea una versión. Regenerar una sección reescribe solo esa, con los datos y lo que escribiste en las demás; podés darle una instrucción.</p>}
              </div>
            )}

            {/* Nota interna */}
            <details className="text-[11px]">
              <summary className="cursor-pointer text-[#F5F7FA] opacity-50">Nota interna (no va al cliente)</summary>
              <textarea aria-label="Campo" defaultValue={sel.nota_interna || ''} onBlur={async e => {
                  // Sin catch, una nota que no se guarda desaparece al recargar sin
                  // que nadie lo note. Ahora avisa.
                  try {
                    const r = await fetch(`/api/reportes/${sel.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nota_interna: e.target.value }) });
                    if (!r.ok) avisar('La nota no se guardó: el servidor respondió ' + r.status + '.');
                  } catch { avisar('La nota no se guardó: sin conexión.'); }
                }} rows={2} placeholder="Qué querés recordar de este envío" className="w-full mt-1 bg-transparent px-2 py-1.5 rounded-lg text-xs text-[#F5F7FA] focus:outline-none" style={{ border: '1px solid var(--border)' }} />
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
