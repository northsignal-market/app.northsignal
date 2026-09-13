import { useCuentaActiva, useCuentas } from '../lib/useCuentas';
import { fmtMoneda, fmtFechaCorta, fetchJSON, Collapsible } from './ui';
import React, { useState, useEffect, useMemo } from 'react';
import { decision, marginal } from '../lib/humano';
import { Clock, Lightbulb, HelpCircle, ArrowRight, ExternalLink, Target, TrendingUp, Layers, Save } from 'lucide-react';
import { ReportesEditor } from './ReportesEditor';
import { useAppStore } from '../store/useAppStore';
import type { NotionClientInfo, Actionable } from '../types';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';

interface ClientesProps {
  onOpenActionable?: (action: Actionable) => void;
  onNavigateToBrief?: (briefId: string) => void;
  zona?: 'todo' | 'diagnostico' | 'memoria' | 'reportes';
}

export function Clientes({ onOpenActionable, onNavigateToBrief, zona = 'todo' }: ClientesProps) {
  const { moneda: monedaDe, nombreCliente, zona: zonaDe, locale: localeDe } = useCuentas();
  const ver = (z: 'diagnostico' | 'memoria' | 'reportes') => zona === 'todo' || zona === z;
  const { selectedClient, setSelectedClient, actionables, notionBriefs } = useAppStore();
  // La cuenta activa sale de las cuentas reales, no de un default cableado.
  // Antes esto era '360' fijo y no coincidia con el header cuando no habia eleccion.
  const { nombres: cuentasActivas } = useCuentas();
  const activeClient = useCuentaActiva(selectedClient) || selectedClient || '';
  const [clientsInfo, setClientsInfo] = useState<NotionClientInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [objetivos, setObjetivos] = useState<any>({ targets: [], headroom: [], proyeccion: [] });
  const [escalera, setEscalera] = useState<any>({ etapas: [], recomendada: null });
  const [docMaestro, setDocMaestro] = useState<{ markdown: string; secciones: any[] } | null>(null);
  const [estrategia, setEstrategia] = useState<any>({ decisiones: [], cpa_marginal: [] });
  const [limitada, setLimitada] = useState<any>(null);
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [aprendido, setAprendido] = useState<any>(null);
  const cargarPropuestas = () => fetch(`/api/propuestas?client=${activeClient}`, { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setPropuestas(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { cargarPropuestas(); fetch(`/api/aprendido?client=${activeClient}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => setAprendido(d)).catch(() => {}); }, [activeClient]);
  const ESTADOS: { id: string; label: string; pregunta?: string; confirmar?: boolean }[] = [
    { id: 'propuesta', label: 'Propuesta' }, { id: 'aprobada', label: 'Aprobada', pregunta: 'Nota (opcional): por qué la aprobás' },
    { id: 'en_test', label: 'En test', pregunta: '¿Qué hiciste exactamente en Google Ads? Puede diferir de lo propuesto; el sistema evalúa contra esto.' },
    { id: 'pausada', label: 'Pausada', pregunta: '¿Por qué la pausás?' },
    { id: 'adoptada', label: 'Adoptada', pregunta: '¿Qué resultado viste? (queda como resultado real)', confirmar: true },
    { id: 'descartada', label: 'Descartada', pregunta: '¿Por qué la descartás? (el sistema aprende de esto)', confirmar: true },
  ];
  const cambiarEstado = async (p: any, estado: string) => {
    const def = ESTADOS.find(e => e.id === estado)!;
    if (def.confirmar && !confirm(`¿Pasar "${p.titulo.slice(0, 60)}" a ${def.label}? Se puede volver atrás, pero queda en el historial.`)) return;
    let nota: string | null = null, ejecucion: string | null = null;
    if (def.pregunta) {
      const r = prompt(def.pregunta, estado === 'en_test' ? (p.ejecucion_real || '') : '');
      if (r === null) return;
      if (estado === 'en_test') ejecucion = r; else nota = r;
    }
    await fetch(`/api/propuestas/${p.id}/estado`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado, nota, ejecucion_real: ejecucion, resultado_real: estado === 'adoptada' ? nota : undefined }) });
    if (estado === 'adoptada' && nota) await fetch(`/api/propuestas/${p.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resultado_real: nota }) });
    cargarPropuestas();
  };
  const editarEjecucion = async (p: any) => { const r = prompt('Qué se hizo realmente en Google Ads (esto es lo que el sistema evalúa):', p.ejecucion_real || ''); if (r === null) return; await fetch(`/api/propuestas/${p.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ejecucion_real: r }) }); cargarPropuestas(); };
  useEffect(() => { fetch(`/api/limitada?client=${activeClient}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => setLimitada(d)).catch(() => {}); }, [activeClient]);
  // La UI de reportes vive completa en ReportesEditor; acá no queda estado propio.
  useEffect(() => {
    fetch(`/api/estrategia?client=${activeClient}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => d && setEstrategia(d)).catch(() => {});
  }, [activeClient]);
  const [editandoSeccion, setEditandoSeccion] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState('');
  const [guardandoDoc, setGuardandoDoc] = useState(false);
  const [vistaDoc, setVistaDoc] = useState<'ensamblado' | 'editar'>('ensamblado');

  const cargarDoc = () => {
    fetch(`/api/doc-maestro/${activeClient}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => d && setDocMaestro(d)).catch(() => {});
  };
  useEffect(() => { cargarDoc(); }, [activeClient]);

  const guardarSeccion = async (seccion: string) => {
    setGuardandoDoc(true);
    try {
      const r = await fetch(`/api/doc-maestro/${activeClient}/${seccion}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: textoEdicion })
      });
      if (r.ok) { setEditandoSeccion(null); cargarDoc(); }
    } finally { setGuardandoDoc(false); }
  };

  const descargarDoc = () => {
    if (!docMaestro) return;
    const blob = new Blob([docMaestro.markdown], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `DOC_MAESTRO_${activeClient}_${new Date().toISOString().slice(0,10)}.md`; a.click();
  };

  // Render markdown mínimo: encabezados, negrita, código, tablas, listas
  const md = (t: string) => {
    const esc = (x: string) => x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const inline = (x: string) => esc(x)
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[#EDEFF3]">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="px-1 rounded text-[11px]" style="background:var(--surface-2)">$1</code>');
    const lines = t.split('\n'); const out: string[] = []; let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^\|/.test(l)) {
        const rows: string[][] = [];
        while (i < lines.length && /^\|/.test(lines[i])) { if (!/^\|[-| ]+\|$/.test(lines[i])) rows.push(lines[i].split('|').slice(1,-1).map(c => c.trim())); i++; }
        if (rows.length) {
          out.push('<table class="w-full text-xs my-2"><thead><tr>' + rows[0].map(c => `<th class="text-left py-1 px-2 text-[#F5F7FA] opacity-60 font-medium" style="border-bottom:1px solid var(--border)">${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
            rows.slice(1).map(r => '<tr>' + r.map(c => `<td class="py-1 px-2 align-top text-[#F5F7FA]" style="border-bottom:1px solid var(--border)">${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
        }
        continue;
      }
      if (/^### /.test(l)) out.push(`<h4 class="text-sm font-semibold text-[#EDEFF3] mt-3 mb-1">${inline(l.slice(4))}</h4>`);
      else if (/^## /.test(l)) out.push(`<h3 class="text-[15px] font-medium text-[#EDEFF3] mt-5 mb-2 pb-1" style="border-bottom:1px solid var(--border)">${inline(l.slice(3))}</h3>`);
      else if (/^# /.test(l)) out.push(`<h2 class="text-lg font-semibold text-[#EDEFF3] mb-2">${inline(l.slice(2))}</h2>`);
      else if (/^---$/.test(l)) out.push('');
      else if (/^[-*] /.test(l) || /^\d+\. /.test(l)) out.push(`<div class="text-xs text-[#F5F7FA] pl-4 py-0.5">${inline(l.replace(/^[-*] /, '• ').replace(/^(\d+)\. /, '$1. '))}</div>`);
      else if (l.trim()) out.push(`<p class="text-xs text-[#F5F7FA] py-0.5 leading-relaxed">${inline(l)}</p>`);
      i++;
    }
    return out.join('');
  };
  const [editTargets, setEditTargets] = useState<any>(null);
  const [savingTargets, setSavingTargets] = useState(false);


  // Objetivos, headroom y escalera de valor
  useEffect(() => {
    const headers: Record<string, string> = {};
    fetch(`/api/objetivos?client=${activeClient}`, { credentials: 'include', headers })
      .then(r => r.ok ? r.json() : null).then(d => d && setObjetivos(d)).catch(() => {});
    fetch(`/api/escalera?client=${activeClient}`, { credentials: 'include', headers })
      .then(r => r.ok ? r.json() : null).then(d => d && setEscalera(d)).catch(() => {});
  }, [activeClient]);

  const target = objetivos.targets?.[0];
  const headroom = objetivos.headroom?.[0];
  const proy = objetivos.proyeccion?.[0];

  const saveTargets = async () => {
    if (!editTargets) return;
    setSavingTargets(true);
    try {
      const r = await fetch(`/api/objetivos/${activeClient}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTargets)
      });
      if (r.ok) {
        const updated = await r.json();
        setObjetivos((o: any) => ({ ...o, targets: [updated] }));
        setEditTargets(null);
      }
    } finally { setSavingTargets(false); }
  };

  // La moneda sale de la cuenta, no de un condicional: Fresh Monkee se mostraba
  // en pesos chilenos porque el ternario solo distinguia Karedo del resto.
  const fmtMoney = (v: any) => fmtMoneda(v == null ? null : Number(v), monedaDe(activeClient));

  useEffect(() => {
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/notion/clients', { credentials: 'include', headers })
      .then(async res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { clients: [] };
        return res.json();
      })
      .then(data => setClientsInfo(data?.clients || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const currentInfo = useMemo(() => {
    return clientsInfo.find(c => c.name.toLowerCase() === activeClient.toLowerCase()) || {
      id: 'default',
      name: activeClient,
      currency: monedaDe(activeClient),
      timezone: zonaDe(activeClient),
      created_at: new Date().toISOString()
    };
  }, [clientsInfo, activeClient]);

  // Weeks analyzed
  const clientBriefs = useMemo(() => {
    return notionBriefs
      .filter(b => b.client?.toLowerCase() === activeClient.toLowerCase())
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [notionBriefs, activeClient]);

  // Sin || 3: con cero briefs el warning decía "tentativas (3 semanas)" con un
  // número fabricado. Cero es cero, y se dice.
  const weeksAnalyzed = clientBriefs.length;
  const isTentative = weeksAnalyzed < 4;

  // Open actionables
  const clientActionables = useMemo(() => {
    return actionables.filter(a => a.client.toLowerCase() === activeClient.toLowerCase() && a.status.toLowerCase() !== NOTION_STATES.HECHO.toLowerCase());
  }, [actionables, activeClient]);

  // Open hypotheses
  const openHypotheses = useMemo(() => {
    return clientActionables.filter(a => a.naturaleza === NOTION_NATURALEZA.HIPOTESIS || Boolean(a.que_lo_confirmaria));
  }, [clientActionables]);

  // Lecciones REALES de la base (tabla lecciones, via /api/aprendido). Antes acá
  // había dos aprendizajes INVENTADOS hardcodeados que se mostraban con badge
  // "Validado": conocimiento fabricado disfrazado de medido, el peor bug posible
  // en un sistema cuyo contrato es no inventar números.
  const [lecciones, setLecciones] = useState<any[]>([]);
  useEffect(() => {
    let vivo = true;
    fetchJSON<any>('/api/aprendido', null).then(d => {
      if (!vivo || !d?.lecciones) return;
      setLecciones(d.lecciones.filter((l: any) => !l.account || l.account === activeClient));
    });
    return () => { vivo = false; };
  }, [activeClient]);

  return (
    <div className="max-w-[1320px] mx-auto px-5 md:px-8 py-6 space-y-6">

      {zona === 'todo' && (<>
      {/* Account Selector & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-[#EDEFF3]">
            Cuenta · memoria y diagnóstico
          </h1>
          <p className="text-xs text-[#F5F7FA] opacity-70 mt-0.5">
            ¿Qué sé de esta cuenta? Contexto operativo, aprendizajes acumulados e hipótesis
          </p>
        </div>

        {/* Client switcher pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
          {cuentasActivas.map(c => (
            <button
              key={c}
              onClick={() => setSelectedClient(c)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                activeClient.toUpperCase() === c ? 'bg-[#0062CC] text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      </>)}
      {/* Warning if weeks < 4 */}
      {isTentative && (
        <div 
          className="p-3.5 rounded-xl flex items-center gap-3 text-xs"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}
        >
          <Clock size={16} className="text-[#F5F7FA] shrink-0" />
          <div className="space-y-0.5">
            <span className="font-semibold text-[#EDEFF3]">
              Tendencias tentativas
            </span>
            <p className="text-[#F5F7FA] opacity-80">
              Menos de 4 semanas de histórico analizado ({weeksAnalyzed} semanas). La significancia estadística aún se encuentra en proceso de acumulación.
            </p>
          </div>
        </div>
      )}

      {/* ZONA 1: lo que leés vos. Objetivos, reportes para aprobar, accionables, decisiones. */}
      {zona === 'todo' && <div className="flex items-center gap-3 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#EDEFF3]">Para vos</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        <span className="text-[10px] text-[#F5F7FA] opacity-50">objetivos, reportes, pendientes, decisiones</span>
      </div>}

      {/* P4b · El diagnóstico se recorre por PREGUNTA, no por origen del dato
          (informe 14 §4: agrupar por origen es el organigrama disfrazado):
          (1) ¿hay algo para decidir? (2) ¿cómo viene? (3) contexto, plegado. */}
      {ver('diagnostico') && (
        <div className="flex items-center gap-3 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#EDEFF3]">¿Hay algo para decidir?</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <span className="text-[10px] text-[#F5F7FA] opacity-50">propuestas, decisiones estructurales, pendientes</span>
        </div>
      )}
      {ver('diagnostico') && (<>
      {propuestas.length > 0 && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">Propuestas estratégicas</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Las apuestas grandes que el sistema propone para cerrar la brecha: campañas nuevas, cambios de tipo, embudos, tests. Cada una con hipótesis, número esperado, costo, riesgo y qué la mata. Vos decidís.">Las apuestas grandes que el sistema propone para cerrar la brecha: campañas nuevas, cambios de tipo, embudos, tests. Cada una con hipótesis, número esperado, costo, riesgo y qué la mata. Vos decidís.</p>
          </div>
          <div className="space-y-2">
            {propuestas.map((p: any) => (
              <div key={p.id} className={`p-3.5 rounded-xl space-y-2 ${p.estado === 'descartada' ? 'opacity-50' : ''}`} style={{ backgroundColor: 'var(--surface-2)', border: p.estado === 'propuesta' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">{String(p.tipo).replace(/_/g, ' ')}</span><span className="text-[10px] text-[#F5F7FA] opacity-40">{p.fecha}</span><span className={`text-[10px] uppercase tracking-wider ${p.estado === 'propuesta' ? 'text-[#4D9DFF]' : 'text-[#F5F7FA] opacity-60'}`}>{p.estado.replace('_', ' ')}</span></div>
                    <div className="text-sm text-[#EDEFF3] font-medium mt-0.5">{p.titulo}</div>
                  </div>
                  <div className="shrink-0">
                    <select aria-label="P" value={p.estado} onChange={e => cambiarEstado(p, e.target.value)} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-[11px] text-[#EDEFF3]" title="Cambiar estado. Se puede volver atrás; todo queda en el historial.">
                      {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#F5F7FA]">
                  <div><span className="opacity-50">Hipótesis:</span> {p.hipotesis}</div>
                  <div><span className="opacity-50">Espera:</span> <span className="text-[#EDEFF3]">{p.resultado_esperado}</span></div>
                  {p.costo_estimado && <div><span className="opacity-50">Cuesta:</span> {p.costo_estimado}</div>}
                  {p.riesgo && <div><span className="opacity-50">Riesgo:</span> {p.riesgo}</div>}
                  {p.como_probar_barato && <div><span className="opacity-50">Test barato:</span> {p.como_probar_barato}</div>}
                  <div><span className="opacity-50">La mata:</span> {p.que_la_mata}</div>
                  {p.fundamento_datos && <div className="md:col-span-2 opacity-70"><span className="opacity-50">Dato:</span> {p.fundamento_datos}</div>}
                  {p.fundamento_externo && <div className="md:col-span-2 opacity-70"><span className="opacity-50">Afuera:</span> {p.fundamento_externo}</div>}
                  {(p.estado === 'en_test' || p.estado === 'adoptada' || p.ejecucion_real) && (
                    <div className="md:col-span-2 flex items-start gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                      <div className="flex-1"><span className="opacity-50">Qué se hizo realmente{p.test_inicio ? ` (desde ${p.test_inicio})` : ''}:</span> {p.ejecucion_real ? <span className="text-[#EDEFF3]">{p.ejecucion_real}</span> : <span className="opacity-50 italic">sin registrar: el sistema no puede evaluar el test</span>}</div>
                      <button onClick={() => editarEjecucion(p)} className="text-[10px] text-[#4D9DFF] shrink-0">editar</button>
                    </div>
                  )}
                  {p.decision_andres && <div className="md:col-span-2"><span className="opacity-50">Tu nota ({p.decidida_el}):</span> {p.decision_andres}</div>}
                  {p.resultado_real && <div className="md:col-span-2"><span className="opacity-50">Resultado:</span> {p.resultado_real}</div>}
                  {Array.isArray(p.historial) && p.historial.length > 0 && (
                    <div className="md:col-span-2 text-[10px] text-[#F5F7FA] opacity-50">
                      {p.historial.slice(-4).map((h: any, i: number) => <span key={i}>{String(h.fecha).slice(5, 16).replace('T', ' ')} {h.de} → {h.a}{h.nota ? ` (${String(h.nota).slice(0, 60)}${h.nota.length > 60 ? '…' : ''})` : ''}{i < Math.min(p.historial.length, 4) - 1 ? ' · ' : ''}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}
      {ver('diagnostico') && (<>
      {/* Decisiones estructurales */}
      {estrategia.decisiones.length > 0 && (() => {
        const d = estrategia.decisiones[0];
        const zona = (t: string) => t?.startsWith('PROPONER') ? 'proponer' : t?.startsWith('REVISAR') ? 'revisar' : 'no';
        const dec = (t: string) => decision(t);
        const decs = [
          ['Separar marca', d.separar_marca], ['Consolidar', d.consolidar], ['Crear campaña', d.crear_campana],
          ['Pausar', d.pausar], ['Escalar', d.escalar], ['Test de incrementalidad', d.test_incrementalidad_marca]
        ];
        const activas = decs.filter(([, t]) => zona(t) !== 'no');
        return (
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: activas.length ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
            <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px] font-medium text-[#EDEFF3]">
                {activas.length === 0 ? 'Estructura: sin decisiones que proponer' : `${activas.length} decisión${activas.length > 1 ? 'es' : ''} estructural${activas.length > 1 ? 'es' : ''} en evaluación`}
              </h2>
              <p className="text-xs text-[#F5F7FA] opacity-60 tabular">
                {d.conv_28d} conv en {d.dias_28d} días consolidados · {d.n_campanas} campaña{d.n_campanas > 1 ? 's' : ''} · {d.grupo_dominante} {d.pct_grupo_dominante}% · MDE a 4 semanas {d.mde_4_semanas_pct}%
              </p>
            </div>
            <div className="space-y-2">
              {decs.map(([nombre, texto]) => {
                const z = zona(texto); const d = dec(texto);
                return (
                  <div key={nombre} className={`flex items-start gap-3 p-2.5 rounded-lg ${z === 'no' ? 'opacity-50' : ''}`} style={{ backgroundColor: 'var(--surface-2)' }}>
                    <span className={`text-[10px] uppercase tracking-wider font-bold shrink-0 w-20 pt-0.5 ${z === 'proponer' ? 'text-[#EDEFF3]' : z === 'revisar' ? 'text-[#4D9DFF]' : 'text-[#F5F7FA]'}`}>{nombre}</span>
                    <span className="text-xs text-[#F5F7FA]"><span className="font-medium text-[#EDEFF3]">{d.etiqueta}.</span> {d.detalle}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-[#F5F7FA] opacity-60">{String(d.testeabilidad || '').replace(/^NO TESTEABLE en (\d+) semanas: el efecto mínimo detectable supera 35%\. Registrar la pregunta, no correr el test\./, 'Con este volumen, un test A/B de $1 semanas no distinguiría nada: harían falta cambios de más de 35% para verlos.').replace(/^TESTEABLE SOLO PARA EFECTOS GRANDES: necesita 35%\+ de diferencia/, 'Un test de 4 semanas solo detectaría cambios grandes, de 35% o más.').replace(/^TESTEABLE: detecta cambios de 20% o más/, 'Hay volumen para testear: un test de 4 semanas detecta cambios de 20% o más.')}</p>
            {estrategia.cpa_marginal.filter((m: any) => m.escalon > m.presupuesto_actual).length > 0 && (
              <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-medium text-[#EDEFF3] mb-1">Dónde produce más el siguiente peso</p>
                <table className="w-full text-xs">
                  <thead><tr className="text-[#F5F7FA] opacity-60 text-left"><th className="py-1 px-2">Campaña</th><th className="py-1 px-2 text-right">Escalón/día</th><th className="py-1 px-2 text-right">CPA promedio</th><th className="py-1 px-2 text-right">CPA marginal</th><th className="py-1 px-2">Lectura</th></tr></thead>
                  <tbody>
                    {estrategia.cpa_marginal.filter((m: any) => m.escalon > m.presupuesto_actual).slice(0, 6).map((m: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="py-1 px-2 text-[#F5F7FA] max-w-[180px] truncate">{m.campaign}</td>
                        <td className="py-1 px-2 tabular text-right text-[#F5F7FA]">{fmtMoney(m.escalon)}</td>
                        <td className="py-1 px-2 tabular text-right text-[#F5F7FA] opacity-70">{fmtMoney(m.cpa_promedio_en_escalon)}</td>
                        <td className={`py-1 px-2 tabular text-right ${m.ratio_marginal_sobre_promedio >= 2 ? 'text-[#4D9DFF] font-semibold' : 'text-[#EDEFF3]'}`}>{fmtMoney(m.cpa_marginal_desde_anterior)}{m.ratio_marginal_sobre_promedio ? ` (${m.ratio_marginal_sobre_promedio}×)` : ''}</td>
                        <td className="py-1 px-2 text-[#F5F7FA] opacity-70 text-[11px]">{marginal(m.lectura)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}


      </>)}
      {ver('diagnostico') && (<>
      {/* Accionables Abiertos de esta cuenta */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#EDEFF3]">
            Accionables Activos para {activeClient}
          </h2>
          <span className="text-xs text-[#F5F7FA] opacity-60 tabular">
            {clientActionables.length} activos
          </span>
        </div>

        {clientActionables.length === 0 ? (
          <div className="py-4 text-xs text-[#F5F7FA] opacity-50 italic">
            Nada pendiente en esta cuenta. Los accionables nuevos aparecen el lunes después de la tarea semanal.
          </div>
        ) : (
          <div className="space-y-1.5">
            {clientActionables.slice(0, 6).map(act => (
              <div
                key={act.id}
                onClick={() => onOpenActionable && onOpenActionable(act)}
                className="p-2.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 transition-colors"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold text-[#EDEFF3] truncate">
                    {act.title}
                  </div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">
                    Prioridad: {act.priority} · Estado: {act.status}
                  </div>
                </div>
                <ArrowRight size={12} className="text-[#4D9DFF] shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>



      </>)}
      {ver('diagnostico') && (
        <div className="flex items-center gap-3 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#EDEFF3]">¿Cómo viene?</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <span className="text-[10px] text-[#F5F7FA] opacity-50">brecha, objetivos y escalera de valor</span>
        </div>
      )}
      {ver('diagnostico') && (<>
      {/* Brecha y propuestas estratégicas: la ambición con lógica */}
      {(() => { const br = (aprendido?.brecha || []).find((x: any) => x.account === activeClient); return br ? (
        <div className="p-4 rounded-2xl flex flex-wrap items-center gap-4" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
          <div><div className="text-[10px] text-[#F5F7FA] opacity-50">Ritmo actual</div><div className="text-lg tabular text-[#EDEFF3]">{br.conv_mes_actual ?? '—'}<span className="text-[10px] opacity-50 ml-1">conv/mes</span></div></div>
          <div className="text-[#F5F7FA] opacity-30">→</div>
          <div><div className="text-[10px] text-[#F5F7FA] opacity-50">Ambición a 90 días</div><div className="text-lg tabular text-[#EDEFF3]">{br.conv_mes_objetivo_90d ?? br.conv_mes_objetivo ?? '—'}<span className="text-[10px] opacity-50 ml-1">conv/mes</span></div></div>
          <div className="flex-1 min-w-[200px] text-xs text-[#F5F7FA] opacity-80">{br.lectura}{br.dias_restantes != null ? <span className="opacity-50"> · {br.dias_restantes} días</span> : ''}</div>
        </div>
      ) : null; })()}
      </>)}
      {ver('diagnostico') && (<>
      {/* Objetivos: dónde está la cuenta respecto de lo que el negocio necesita */}
      <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#EDEFF3] flex items-center gap-2">
            <Target size={15} className="text-[#4D9DFF]" /> Objetivos y estado
          </h2>
          {!editTargets ? (
            <button onClick={() => setEditTargets({ conversiones_mes_objetivo: target?.conversiones_mes_objetivo, cpa_maximo: target?.cpa_maximo, presupuesto_mes_maximo: target?.presupuesto_mes_maximo })}
              className="text-xs px-3 py-1 rounded" style={{ border: '1px solid var(--border)' }}>Editar</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditTargets(null)} className="text-xs px-3 py-1 rounded" style={{ border: '1px solid var(--border)' }}>Cancelar</button>
              <button aria-label="Guardar" title="Guardar" onClick={saveTargets} disabled={savingTargets} className="text-xs px-3 py-1 rounded bg-[#0062CC] text-[#EDEFF3] flex items-center gap-1"><Save size={12} /> {savingTargets ? 'Guardando…' : 'Guardar'}</button>
            </div>
          )}
        </div>

        {target ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { k: 'conversiones_mes_objetivo', label: 'Conversiones / mes', origen: target.conversiones_mes_origen, fmt: (v: any) => v },
              { k: 'cpa_maximo', label: 'CPA máximo', origen: target.cpa_maximo_origen, fmt: fmtMoney },
              { k: 'presupuesto_mes_maximo', label: 'Presupuesto / mes', origen: null, fmt: fmtMoney },
            ].map(f => (
              <div key={f.k} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="text-[11px] text-[#F5F7FA] opacity-60 flex items-center justify-between">
                  <span>{f.label}</span>
                  {f.origen && <span className={`text-[10px] px-1.5 rounded-full ${f.origen === 'negocio' ? 'text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-70'}`} style={{ border: '1px solid var(--border)' }}>{f.origen}</span>}
                </div>
                {editTargets ? (
                  <input aria-label="Edit Targets" type="number" value={editTargets[f.k] ?? ''} onChange={e => setEditTargets({ ...editTargets, [f.k]: Number(e.target.value) })}
                    className="mt-1 w-full bg-transparent text-base font-bold text-[#EDEFF3] tabular outline-none" style={{ borderBottom: '1px solid var(--border-strong)' }} />
                ) : (
                  <div className="text-base font-bold text-[#EDEFF3] tabular mt-1">{f.fmt(target[f.k])}</div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Sin objetivos cargados. Hasta que el cliente los confirme, el sistema usa los provisionales del histórico.">Sin objetivos cargados. Hasta que el cliente los confirme, el sistema usa los provisionales del histórico.</p>}

        {target?.notas && <p className="text-[11px] text-[#F5F7FA] opacity-60 leading-relaxed">{target.notas}</p>}

        {headroom && (
          <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: ['HEADROOM','TECHO'].some(k => headroom.veredicto?.startsWith(k)) ? '2px solid #0062CC' : undefined }}>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#EDEFF3]"><TrendingUp size={13} className="text-[#4D9DFF]" /> Veredicto</div>
            <p className="text-sm text-[#EDEFF3] leading-relaxed">{headroom.veredicto}</p>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div><span className="opacity-60 block">Del objetivo</span><span className="text-[#EDEFF3] font-semibold tabular">{headroom.pct_del_objetivo ?? '—'}%</span></div>
              <div><span className="opacity-60 block">CPA vs máximo</span><span className="text-[#EDEFF3] font-semibold tabular">{headroom.cpa_pct_del_maximo ?? '—'}%</span></div>
              <div><span className="opacity-60 block">Perdido por {headroom.lost_is_rank_pct > headroom.lost_is_budget_pct ? 'ranking' : 'presupuesto'}</span><span className="text-[#EDEFF3] font-semibold tabular">{Math.max(headroom.lost_is_budget_pct || 0, headroom.lost_is_rank_pct || 0)}%</span></div>
            </div>
            {headroom.objetivos_provisionales && (
              <p className="text-[11px] text-[#F5F7FA] opacity-60 flex items-center gap-1.5"><Clock size={11} /> Objetivos provisionales: pendiente confirmar con el cliente qué CPA tolera el negocio al volumen que quiere.</p>
            )}
            {proy?.plan_sugerido && <p className="text-[11px] text-[#F5F7FA] opacity-70">Plan: {proy.plan_sugerido}</p>}
          </div>
        )}
      </div>
      </>)}
      {ver('diagnostico') && (<>
      {/* Escalera de valor: qué ve Smart Bidding y qué debería ver */}
      <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
        <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#EDEFF3] flex items-center gap-2"><Layers size={15} className="text-[#4D9DFF]" /> Escalera de valor</h2>
          <p className="text-xs text-[#F5F7FA] opacity-60 mt-0.5">Smart Bidding solo ve las primarias. La primaria debe ser la etapa más profunda con 15+ eventos al mes.</p>
        </div>
        {escalera.etapas?.length ? (
          <div className="space-y-2">
            {escalera.etapas.map((e: any) => (
              <div key={e.stage_order} className="flex items-center gap-3 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: e.google_status === 'primaria' ? '2px solid #0062CC' : undefined }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-[#EDEFF3] shrink-0" style={{ backgroundColor: e.google_status === 'primaria' ? '#0062CC' : 'var(--surface-3)' }}>{e.stage_order}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[#EDEFF3] font-medium truncate">{e.stage_name} <span className="opacity-50 font-normal">· {e.google_status}</span></div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">{e.accion}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#EDEFF3] tabular">{e.eventos_ultimos_30d ?? '—'}<span className="opacity-50 text-[10px]">/30d</span></div>
                  <div className="text-[10px] text-[#F5F7FA] opacity-60 tabular">{e.stage_value ? fmtMoney(e.stage_value) : '—'}</div>
                </div>
              </div>
            ))}
            {escalera.recomendada?.recomendacion && (
              <p className="text-[11px] text-[#F5F7FA] opacity-70 pt-1">{escalera.recomendada.recomendacion}</p>
            )}
          </div>
        ) : <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Esta cuenta no tiene etapas de embudo cargadas. Se definen en Supabase, tabla funnel_stages.">Esta cuenta no tiene etapas de embudo cargadas. Se definen en Supabase, tabla funnel_stages.</p>}
      </div>

      </>)}
      {/* Contexto estable: cambia poco, es consulta y no lectura diaria — plegado
          por defecto. Se despliega entero: ficha y calidad (QS) se leen juntas. */}
      {ver('diagnostico') && (
        <Collapsible titulo="Contexto de la cuenta" resumen="ficha · por qué está donde está">
          <div className="space-y-4">
      {/* Ficha de Cuenta */}
      <div 
        className="p-5 rounded-2xl space-y-4"
        style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}
      >
        <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          Ficha de Cuenta · {activeClient}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Moneda Operativa</div>
            <div className="text-base font-bold text-[#EDEFF3] mt-0.5">
              {currentInfo.currency || monedaDe(activeClient)}
            </div>
            <div className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">
              Zona: {currentInfo.timezone || zonaDe(activeClient)}
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Fuente de Verdad</div>
            <div className="text-base font-bold text-[#EDEFF3] mt-0.5">
              Google Ads + Supabase
            </div>
            <div className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">
              Atribución directa
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Semanas Analizadas</div>
            <div className="text-base font-bold text-[#EDEFF3] mt-0.5 tabular">
              {weeksAnalyzed} semanas
            </div>
            <div className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">
              Cadena en Notion
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Último Brief</div>
            <div className="text-xs font-semibold text-[#EDEFF3] mt-1 truncate">
              {clientBriefs[0]?.title || 'Semana activa'}
            </div>
            {clientBriefs[0] && onNavigateToBrief && (
              <button
                onClick={() => onNavigateToBrief(clientBriefs[0].id)}
                className="text-[11px] text-[#4D9DFF] hover:underline font-semibold mt-1 flex items-center gap-0.5"
              >
                <span>Abrir brief</span>
                <ExternalLink size={10} />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Por qué está limitada: los tres componentes del Quality Score, ponderados por gasto */}
      {limitada?.por_que && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">Por qué está donde está</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Google puntúa cada keyword en tres cosas: cuánto espera que la clickeen, si el anuncio la menciona, y cómo es la página de destino. Esto dice cuál pesa más en el gasto real.">Google puntúa cada keyword en tres cosas: cuánto espera que la clickeen, si el anuncio la menciona, y cómo es la página de destino. Esto dice cuál pesa más en el gasto real.</p>
          </div>
          <p className="text-sm text-[#EDEFF3] leading-relaxed">{limitada.por_que}</p>
          <div className="grid grid-cols-3 gap-2">
            {[['CTR esperado', limitada.pct_gasto_ctr_bajo, 'Titulares más directos o concordancia más cerrada'], ['Relevancia del anuncio', limitada.pct_gasto_rel_baja, 'Anuncios que repitan la keyword'], ['Landing', limitada.pct_gasto_lp_baja, 'Solo el cliente puede cambiarla']].map(([n, v, r]) => (
              <div key={String(n)} className="px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                <div className="text-[10px] text-[#F5F7FA] opacity-50">{n}</div>
                <div className="text-lg tabular text-[#EDEFF3]">{v ?? 0}%<span className="text-[10px] opacity-50 ml-1">del gasto bajo el promedio</span></div>
                <div className="text-[10px] text-[#F5F7FA] opacity-50">{r}</div>
              </div>
            ))}
          </div>
          {Array.isArray(limitada.peores) && limitada.peores.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">Las keywords que más pesan</div>
              {limitada.peores.slice(0, 6).map((k: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <span className="text-[#EDEFF3] flex-1 truncate">{k.keyword}<span className="opacity-50"> · {k.grupo}</span></span>
                  <span className="tabular text-[#F5F7FA] opacity-70">{fmtMoney(k.gasto)}</span>
                  <span className="tabular text-[#F5F7FA] opacity-50">QS {k.qs}</span>
                  <span className="text-[10px] text-[#F5F7FA] opacity-50">{[k.ctr && 'CTR', k.rel && 'relevancia', k.lp && 'landing'].filter(Boolean).join(', ')}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-[#F5F7FA] opacity-40">QS ponderado por gasto: {limitada.qs_ponderado}. Datos de la última semana cerrada.</p>
        </div>
      )}
          </div>
        </Collapsible>
      )}
      {ver('reportes') && (<>
      {/* Reportes al cliente v2 */}
      <ReportesEditor activeClient={activeClient} />
      </>)}
      {/* ZONA 2: lo que el sistema recuerda entre semanas. Lo escribe la tarea del lunes; vos lo corregís si está mal. */}
      {zona === 'todo' && <div className="flex items-center gap-3 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5F7FA] opacity-70">Lo que el sistema recuerda</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        <span className="text-[10px] text-[#F5F7FA] opacity-50">lo escribe la tarea del lunes; corregilo si está mal</span>
      </div>}

      {ver('memoria') && (<>
      {/* Hipótesis Abiertas */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <HelpCircle size={16} />
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">
              Hipótesis Abiertas & Qué las Resolvería
            </h2>
          </div>
          <span className="text-xs text-[#F5F7FA] opacity-60 tabular">
            {openHypotheses.length} registradas
          </span>
        </div>

        {openHypotheses.length === 0 ? (
          <div className="py-4 text-xs text-[#F5F7FA] opacity-50 italic">
            No hay hipótesis abiertas pendientes para {activeClient}.
          </div>
        ) : (
          <div className="space-y-2">
            {openHypotheses.map(hyp => (
              <div 
                key={hyp.id}
                className="p-3.5 rounded-xl space-y-1.5 text-xs"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[#EDEFF3]">
                    {hyp.title}
                  </div>
                  {onOpenActionable && (
                    <button
                      onClick={() => onOpenActionable(hyp)}
                      className="text-xs text-[#4D9DFF] hover:underline font-semibold flex items-center gap-1 shrink-0"
                    >
                      <span>Ver accionable</span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>

                {hyp.que_lo_confirmaria && (
                  <div className="text-xs text-[#F5F7FA] opacity-80 flex items-start gap-1.5 pt-0.5">
                    <span className="font-semibold text-[#EDEFF3] shrink-0">Qué lo confirmaría:</span>
                    <span>{hyp.que_lo_confirmaria}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}
      {ver('memoria') && (<>
      {/* Aprendizajes Consolidados (Fechados) */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <Lightbulb size={16} />
          <h2 className="text-[15px] font-medium text-[#EDEFF3]">
            Aprendizajes Consolidados (Bitácora de Conocimiento)
          </h2>
        </div>

        <div className="space-y-2.5">
          {lecciones.length === 0 ? (
            <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Todavía no hay lecciones consolidadas para {activeClient}. Las escribe el sistema cuando una decisión se confirma o se refuta con datos.</p>
          ) : lecciones.slice(0, 6).map((l: any, i: number) => (
            <div
              key={l.id || i}
              className="p-3.5 rounded-xl space-y-1 text-xs"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between text-[11px] text-[#F5F7FA] opacity-60">
                <span className="tabular">{l.fecha}</span>
                <span className="font-semibold text-[#EDEFF3]" title={`Confianza ${l.confianza ?? '—'}${l.veces_confirmada ? ` · confirmada ${l.veces_confirmada} vez${l.veces_confirmada !== 1 ? 'es' : ''}` : ''}`}>
                  {l.tipo === 'acierto' ? 'Acierto' : l.tipo === 'error' ? 'Error aprendido' : l.tipo === 'omision' ? 'Omisión' : 'Lección'}
                </span>
              </div>
              <p className="text-[#F5F7FA] opacity-80 leading-relaxed">
                {l.leccion}
              </p>
            </div>
          ))}
        </div>
      </div>

      </>)}
      {ver('memoria') && (<>
      {/* Doc maestro ensamblado */}
      <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">Doc maestro</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Capa humana editable · series, umbrales, conversiones y cronología calculados · aprendizajes desde Notion">Capa humana editable · series, umbrales, conversiones y cronología calculados · aprendizajes desde Notion</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setVistaDoc('ensamblado')} className={`px-3 py-1 rounded-lg text-xs ${vistaDoc === 'ensamblado' ? 'bg-[#0062CC] text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-70'}`}>Ensamblado</button>
            <button onClick={() => setVistaDoc('editar')} className={`px-3 py-1 rounded-lg text-xs ${vistaDoc === 'editar' ? 'bg-[#0062CC] text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-70'}`}>Editar capa humana</button>
            <button onClick={descargarDoc} disabled={!docMaestro} className="px-3 py-1 rounded-lg text-xs text-[#F5F7FA] opacity-70 hover:opacity-100 disabled:opacity-30" style={{ border: '1px solid var(--border)' }}>Descargar .md</button>
          </div>
        </div>

        {!docMaestro ? (
          <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Cargando…</p>
        ) : vistaDoc === 'ensamblado' ? (
          <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-2" dangerouslySetInnerHTML={{ __html: md(docMaestro.markdown) }} />
        ) : (
          <div className="space-y-3">
            {docMaestro.secciones.map(sec => (
              <div key={sec.seccion} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: editandoSeccion === sec.seccion ? '1px solid var(--primary)' : '1px solid transparent' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#EDEFF3] uppercase tracking-wider">{sec.seccion}</span>
                  <span className="text-[11px] text-[#F5F7FA] opacity-50 tabular">v{sec.version} · {fmtFechaCorta(sec.editado_el)} · {sec.editado_por}</span>
                </div>
                {editandoSeccion === sec.seccion ? (
                  <div className="space-y-2">
                    <textarea aria-label="Texto Edicion" value={textoEdicion} onChange={e => setTextoEdicion(e.target.value)} rows={14}
                      className="w-full text-xs bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg p-3 text-[#F5F7FA] focus:outline-none focus:border-[#0062CC] tabular" style={{ fontFamily: 'inherit' }} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditandoSeccion(null)} className="px-3 py-1 rounded-none text-xs text-[#F5F7FA] opacity-70">Cancelar</button>
                      <button onClick={() => guardarSeccion(sec.seccion)} disabled={guardandoDoc} className="px-3 py-1 rounded-lg text-xs bg-[#0062CC] text-[#EDEFF3] disabled:opacity-50">{guardandoDoc ? 'Guardando…' : 'Guardar como nueva versión'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-[#F5F7FA] opacity-80 line-clamp-3 flex-1">{sec.contenido.replace(/[#*`|]/g, '').slice(0, 240)}…</div>
                    <button onClick={() => { setEditandoSeccion(sec.seccion); setTextoEdicion(sec.contenido); }} className="px-3 py-1 rounded-lg text-xs shrink-0" style={{ border: '1px solid var(--border)', color: '#F5F7FA' }}>Editar</button>
                  </div>
                )}
              </div>
            ))}
            <p className="text-[11px] text-[#F5F7FA] opacity-50">Cada edición crea una versión nueva; nada se borra. Las secciones calculadas y las de Notion no se editan acá: se corrigen en su fuente.</p>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
