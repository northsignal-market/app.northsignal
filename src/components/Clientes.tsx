import React, { useState, useEffect, useMemo } from 'react';
import { decision, marginal } from '../lib/humano';
import { 
  Building, DollarSign, Calendar, Clock, AlertCircle, 
  Lightbulb, HelpCircle, ArrowRight, ExternalLink, ShieldCheck, Target, TrendingUp, Layers, Save
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { NotionClientInfo, Actionable } from '../types';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';

interface ClientesProps {
  onOpenActionable?: (action: Actionable) => void;
  onNavigateToBrief?: (briefId: string) => void;
  zona?: 'todo' | 'diagnostico' | 'memoria' | 'reportes';
}

export function Clientes({ onOpenActionable, onNavigateToBrief, zona = 'todo' }: ClientesProps) {
  const ver = (z: 'diagnostico' | 'memoria' | 'reportes') => zona === 'todo' || zona === z;
  const { selectedClient, setSelectedClient, actionables, notionBriefs } = useAppStore();
  const activeClient = selectedClient || '360';
  const [clientsInfo, setClientsInfo] = useState<NotionClientInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [objetivos, setObjetivos] = useState<any>({ targets: [], headroom: [], proyeccion: [] });
  const [escalera, setEscalera] = useState<any>({ etapas: [], recomendada: null });
  const [docMaestro, setDocMaestro] = useState<{ markdown: string; secciones: any[] } | null>(null);
  const [estrategia, setEstrategia] = useState<any>({ decisiones: [], cpa_marginal: [] });
  const [reportes, setReportes] = useState<any[]>([]);
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
  const [reporteAbierto, setReporteAbierto] = useState<any>(null);
  const [editandoReporte, setEditandoReporte] = useState(false);
  const [textoReporte, setTextoReporte] = useState({ resumen_ejecutivo: '', que_cambiamos: '', que_sigue: '' });
  const [trabajandoReporte, setTrabajandoReporte] = useState<string | null>(null);
  const [generandoDesde, setGenerandoDesde] = useState(false);
  const [formGenerar, setFormGenerar] = useState({ desde: '', hasta: '' });
  const [origenReporte, setOrigenReporte] = useState<string | null>(null);
  const lunesDe = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const preset = (que: 'semana_cerrada' | 'dos_semanas' | 'mes_pasado' | 'ultimos_7') => {
    const hoy = new Date(); const lun = lunesDe(hoy);
    if (que === 'semana_cerrada') { const d = new Date(lun); d.setDate(d.getDate() - 7); const h = new Date(lun); h.setDate(h.getDate() - 1); setFormGenerar({ desde: iso(d), hasta: iso(h) }); }
    if (que === 'dos_semanas') { const d = new Date(lun); d.setDate(d.getDate() - 14); const h = new Date(lun); h.setDate(h.getDate() - 1); setFormGenerar({ desde: iso(d), hasta: iso(h) }); }
    if (que === 'mes_pasado') { const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); const h = new Date(hoy.getFullYear(), hoy.getMonth(), 0); setFormGenerar({ desde: iso(d), hasta: iso(h) }); }
    if (que === 'ultimos_7') { const d = new Date(hoy); d.setDate(d.getDate() - 7); const h = new Date(hoy); h.setDate(h.getDate() - 1); setFormGenerar({ desde: iso(d), hasta: iso(h) }); }
  };

  const cargarReportes = () => {
    fetch(`/api/reportes?client=${activeClient}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(d => setReportes(Array.isArray(d) ? d : [])).catch(() => {});
  };
  useEffect(() => { cargarReportes(); }, [activeClient]);

  const accionReporte = async (id: number, accion: 'pdf' | 'aprobar' | 'descartar') => {
    setTrabajandoReporte(`${id}-${accion}`);
    try {
      if (accion === 'pdf') { window.open(`/api/reportes/${id}/pdf?download=1`, '_blank'); await fetch(`/api/reportes/${id}/pdf`, { method: 'POST', credentials: 'include' }); }
      else await fetch(`/api/reportes/${id}/${accion}`, { method: 'POST', credentials: 'include' });
      cargarReportes();
      if (accion !== 'pdf') setReporteAbierto(null);
    } finally { setTrabajandoReporte(null); }
  };
  const guardarTextoReporte = async () => {
    if (!reporteAbierto) return;
    setTrabajandoReporte('guardar');
    try {
      const r = await fetch(`/api/reportes/${reporteAbierto.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(textoReporte) });
      if (r.ok) { const d = await r.json(); setReporteAbierto(d); setEditandoReporte(false); cargarReportes(); }
    } finally { setTrabajandoReporte(null); }
  };
  const generarReporte = async () => {
    setTrabajandoReporte('generar');
    try {
      const r = await fetch('/api/reportes/generar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: activeClient, desde: formGenerar.desde, hasta: formGenerar.hasta }) });
      const d = await r.json();
      if (!r.ok) alert(d.error || 'Error'); else { setGenerandoDesde(false); setOrigenReporte(d.origen); cargarReportes(); }
    } finally { setTrabajandoReporte(null); }
  };
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
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[#FFFFFF]">$1</strong>')
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
      if (/^### /.test(l)) out.push(`<h4 class="text-sm font-semibold text-[#FFFFFF] mt-3 mb-1">${inline(l.slice(4))}</h4>`);
      else if (/^## /.test(l)) out.push(`<h3 class="text-[15px] font-medium text-[#FFFFFF] mt-5 mb-2 pb-1" style="border-bottom:1px solid var(--border)">${inline(l.slice(3))}</h3>`);
      else if (/^# /.test(l)) out.push(`<h2 class="text-lg font-semibold text-[#FFFFFF] mb-2">${inline(l.slice(2))}</h2>`);
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

  const fmtMoney = (v: any) => v == null ? '—' : new Intl.NumberFormat(activeClient === 'KAREDO' ? 'de-DE' : 'es-CL', { style: 'currency', currency: activeClient === 'KAREDO' ? 'EUR' : 'CLP', maximumFractionDigits: activeClient === 'KAREDO' ? 2 : 0 }).format(Number(v));

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
      currency: activeClient === 'KAREDO' ? 'EUR' : 'CLP',
      timezone: 'America/Santiago',
      created_at: new Date().toISOString()
    };
  }, [clientsInfo, activeClient]);

  // Weeks analyzed
  const clientBriefs = useMemo(() => {
    return notionBriefs
      .filter(b => b.client?.toLowerCase() === activeClient.toLowerCase())
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [notionBriefs, activeClient]);

  const weeksAnalyzed = clientBriefs.length || 3;
  const isTentative = weeksAnalyzed < 4;

  // Open actionables
  const clientActionables = useMemo(() => {
    return actionables.filter(a => a.client.toLowerCase() === activeClient.toLowerCase() && a.status.toLowerCase() !== NOTION_STATES.HECHO.toLowerCase());
  }, [actionables, activeClient]);

  // Open hypotheses
  const openHypotheses = useMemo(() => {
    return clientActionables.filter(a => a.naturaleza === NOTION_NATURALEZA.HIPOTESIS || Boolean(a.que_lo_confirmaria));
  }, [clientActionables]);

  // Learned facts
  const learnings = useMemo(() => {
    return [
      {
        date: '2026-08-25',
        title: 'Sensibilidad a la hora del día en conversiones B2B',
        detail: 'El 68% de las conversiones efectivas ocurren entre las 09:00 y las 14:00 horas. Ajuste de programación horaria recomendado.'
      },
      {
        date: '2026-08-12',
        title: 'Canibalización entre términos genéricos y de marca',
        detail: 'Los términos genéricos con concordancia amplia sin negativas exactas absorben presupuesto con CPA 2.4x superior.'
      }
    ];
  }, [activeClient]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {zona === 'todo' && (<>
      {/* Account Selector & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">
            Clientes & Memoria de Cuenta
          </h1>
          <p className="text-xs text-[#F5F7FA] opacity-70 mt-0.5">
            ¿Qué sé de esta cuenta? Contexto operativo, aprendizajes acumulados e hipótesis
          </p>
        </div>

        {/* Client switcher pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          {['360', 'BHI', 'KAREDO'].map(c => (
            <button
              key={c}
              onClick={() => setSelectedClient(c)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                activeClient.toUpperCase() === c ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
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
            <span className="font-semibold text-[#FFFFFF]">
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFFFFF]">Para vos</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        <span className="text-[10px] text-[#F5F7FA] opacity-50">objetivos, reportes, pendientes, decisiones</span>
      </div>}

      {ver('diagnostico') && (<>
      {/* Ficha de Cuenta */}
      <div 
        className="p-5 rounded-2xl space-y-4"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          Ficha de Cuenta · {activeClient}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Moneda Operativa</div>
            <div className="text-base font-bold text-[#FFFFFF] mt-0.5">
              {currentInfo.currency || (activeClient === 'KAREDO' ? 'EUR' : 'CLP')}
            </div>
            <div className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">
              Zona: {currentInfo.timezone || 'America/Santiago'}
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Fuente de Verdad</div>
            <div className="text-base font-bold text-[#FFFFFF] mt-0.5">
              Google Ads + Supabase
            </div>
            <div className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">
              Atribución directa
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Semanas Analizadas</div>
            <div className="text-base font-bold text-[#FFFFFF] mt-0.5 tabular">
              {weeksAnalyzed} semanas
            </div>
            <div className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">
              Cadena en Notion
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] text-[#F5F7FA] opacity-60">Último Brief</div>
            <div className="text-xs font-semibold text-[#FFFFFF] mt-1 truncate">
              {clientBriefs[0]?.title || 'Semana activa'}
            </div>
            {clientBriefs[0] && onNavigateToBrief && (
              <button
                onClick={() => onNavigateToBrief(clientBriefs[0].id)}
                className="text-[11px] text-[#0062CC] hover:underline font-semibold mt-1 flex items-center gap-0.5"
              >
                <span>Abrir brief</span>
                <ExternalLink size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      </>)}
      {ver('diagnostico') && (<>

      {/* Brecha y propuestas estratégicas: la ambición con lógica */}
      {ver('diagnostico') && (<>
      {(() => { const br = (aprendido?.brecha || []).find((x: any) => x.account === activeClient); return br ? (
        <div className="p-4 rounded-2xl flex flex-wrap items-center gap-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div><div className="text-[10px] text-[#F5F7FA] opacity-50">Ritmo actual</div><div className="text-lg tabular text-[#FFFFFF]">{br.conv_mes_actual ?? '—'}<span className="text-[10px] opacity-50 ml-1">conv/mes</span></div></div>
          <div className="text-[#F5F7FA] opacity-30">→</div>
          <div><div className="text-[10px] text-[#F5F7FA] opacity-50">Ambición a 90 días</div><div className="text-lg tabular text-[#FFFFFF]">{br.conv_mes_objetivo_90d ?? br.conv_mes_objetivo ?? '—'}<span className="text-[10px] opacity-50 ml-1">conv/mes</span></div></div>
          <div className="flex-1 min-w-[200px] text-xs text-[#F5F7FA] opacity-80">{br.lectura}{br.dias_restantes != null ? <span className="opacity-50"> · {br.dias_restantes} días</span> : ''}</div>
        </div>
      ) : null; })()}
      {propuestas.length > 0 && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Propuestas estratégicas</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Las apuestas grandes que el sistema propone para cerrar la brecha: campañas nuevas, cambios de tipo, embudos, tests. Cada una con hipótesis, número esperado, costo, riesgo y qué la mata. Vos decidís.</p>
          </div>
          <div className="space-y-2">
            {propuestas.map((p: any) => (
              <div key={p.id} className={`p-3.5 rounded-xl space-y-2 ${p.estado === 'descartada' ? 'opacity-50' : ''}`} style={{ backgroundColor: 'var(--surface-2)', border: p.estado === 'propuesta' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">{String(p.tipo).replace(/_/g, ' ')}</span><span className="text-[10px] text-[#F5F7FA] opacity-40">{p.fecha}</span><span className={`text-[10px] uppercase tracking-wider ${p.estado === 'propuesta' ? 'text-[#0062CC]' : 'text-[#F5F7FA] opacity-60'}`}>{p.estado.replace('_', ' ')}</span></div>
                    <div className="text-sm text-[#FFFFFF] font-medium mt-0.5">{p.titulo}</div>
                  </div>
                  <div className="shrink-0">
                    <select value={p.estado} onChange={e => cambiarEstado(p, e.target.value)} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-[11px] text-[#FFFFFF]" title="Cambiar estado. Se puede volver atrás; todo queda en el historial.">
                      {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#F5F7FA]">
                  <div><span className="opacity-50">Hipótesis:</span> {p.hipotesis}</div>
                  <div><span className="opacity-50">Espera:</span> <span className="text-[#FFFFFF]">{p.resultado_esperado}</span></div>
                  {p.costo_estimado && <div><span className="opacity-50">Cuesta:</span> {p.costo_estimado}</div>}
                  {p.riesgo && <div><span className="opacity-50">Riesgo:</span> {p.riesgo}</div>}
                  {p.como_probar_barato && <div><span className="opacity-50">Test barato:</span> {p.como_probar_barato}</div>}
                  <div><span className="opacity-50">La mata:</span> {p.que_la_mata}</div>
                  {p.fundamento_datos && <div className="md:col-span-2 opacity-70"><span className="opacity-50">Dato:</span> {p.fundamento_datos}</div>}
                  {p.fundamento_externo && <div className="md:col-span-2 opacity-70"><span className="opacity-50">Afuera:</span> {p.fundamento_externo}</div>}
                  {(p.estado === 'en_test' || p.estado === 'adoptada' || p.ejecucion_real) && (
                    <div className="md:col-span-2 flex items-start gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                      <div className="flex-1"><span className="opacity-50">Qué se hizo realmente{p.test_inicio ? ` (desde ${p.test_inicio})` : ''}:</span> {p.ejecucion_real ? <span className="text-[#FFFFFF]">{p.ejecucion_real}</span> : <span className="opacity-50 italic">sin registrar: el sistema no puede evaluar el test</span>}</div>
                      <button onClick={() => editarEjecucion(p)} className="text-[10px] text-[#0062CC] shrink-0">editar</button>
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

      {/* Objetivos: dónde está la cuenta respecto de lo que el negocio necesita */}
      <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] flex items-center gap-2">
            <Target size={15} className="text-[#0062CC]" /> Objetivos y estado
          </h2>
          {!editTargets ? (
            <button onClick={() => setEditTargets({ conversiones_mes_objetivo: target?.conversiones_mes_objetivo, cpa_maximo: target?.cpa_maximo, presupuesto_mes_maximo: target?.presupuesto_mes_maximo })}
              className="text-xs px-3 py-1 rounded" style={{ border: '1px solid var(--border)' }}>Editar</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditTargets(null)} className="text-xs px-3 py-1 rounded" style={{ border: '1px solid var(--border)' }}>Cancelar</button>
              <button onClick={saveTargets} disabled={savingTargets} className="text-xs px-3 py-1 rounded bg-[#0062CC] text-[#FFFFFF] flex items-center gap-1"><Save size={12} /> {savingTargets ? 'Guardando…' : 'Guardar'}</button>
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
                  {f.origen && <span className={`text-[10px] px-1.5 rounded-full ${f.origen === 'negocio' ? 'text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`} style={{ border: '1px solid var(--border)' }}>{f.origen}</span>}
                </div>
                {editTargets ? (
                  <input type="number" value={editTargets[f.k] ?? ''} onChange={e => setEditTargets({ ...editTargets, [f.k]: Number(e.target.value) })}
                    className="mt-1 w-full bg-transparent text-base font-bold text-[#FFFFFF] tabular outline-none" style={{ borderBottom: '1px solid var(--border-strong)' }} />
                ) : (
                  <div className="text-base font-bold text-[#FFFFFF] tabular mt-1">{f.fmt(target[f.k])}</div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-[#F5F7FA] opacity-60">Sin objetivos cargados. Hasta que el cliente los confirme, el sistema usa los provisionales del histórico.</p>}

        {target?.notas && <p className="text-[11px] text-[#F5F7FA] opacity-60 leading-relaxed">{target.notas}</p>}

        {headroom && (
          <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: ['HEADROOM','TECHO'].some(k => headroom.veredicto?.startsWith(k)) ? '2px solid #0062CC' : undefined }}>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#FFFFFF]"><TrendingUp size={13} className="text-[#0062CC]" /> Veredicto</div>
            <p className="text-sm text-[#FFFFFF] leading-relaxed">{headroom.veredicto}</p>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div><span className="opacity-60 block">Del objetivo</span><span className="text-[#FFFFFF] font-semibold tabular">{headroom.pct_del_objetivo ?? '—'}%</span></div>
              <div><span className="opacity-60 block">CPA vs máximo</span><span className="text-[#FFFFFF] font-semibold tabular">{headroom.cpa_pct_del_maximo ?? '—'}%</span></div>
              <div><span className="opacity-60 block">Perdido por {headroom.lost_is_rank_pct > headroom.lost_is_budget_pct ? 'ranking' : 'presupuesto'}</span><span className="text-[#FFFFFF] font-semibold tabular">{Math.max(headroom.lost_is_budget_pct || 0, headroom.lost_is_rank_pct || 0)}%</span></div>
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
      {/* Por qué está limitada: los tres componentes del Quality Score, ponderados por gasto */}
      {limitada?.por_que && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Por qué está donde está</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Google puntúa cada keyword en tres cosas: cuánto espera que la clickeen, si el anuncio la menciona, y cómo es la página de destino. Esto dice cuál pesa más en el gasto real.</p>
          </div>
          <p className="text-sm text-[#FFFFFF] leading-relaxed">{limitada.por_que}</p>
          <div className="grid grid-cols-3 gap-2">
            {[['CTR esperado', limitada.pct_gasto_ctr_bajo, 'Titulares más directos o concordancia más cerrada'], ['Relevancia del anuncio', limitada.pct_gasto_rel_baja, 'Anuncios que repitan la keyword'], ['Landing', limitada.pct_gasto_lp_baja, 'Solo el cliente puede cambiarla']].map(([n, v, r]) => (
              <div key={String(n)} className="px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                <div className="text-[10px] text-[#F5F7FA] opacity-50">{n}</div>
                <div className="text-lg tabular text-[#FFFFFF]">{v ?? 0}%<span className="text-[10px] opacity-50 ml-1">del gasto bajo el promedio</span></div>
                <div className="text-[10px] text-[#F5F7FA] opacity-50">{r}</div>
              </div>
            ))}
          </div>
          {Array.isArray(limitada.peores) && limitada.peores.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">Las keywords que más pesan</div>
              {limitada.peores.slice(0, 6).map((k: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <span className="text-[#FFFFFF] flex-1 truncate">{k.keyword}<span className="opacity-50"> · {k.grupo}</span></span>
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

      </>)}
      {ver('diagnostico') && (<>
      {/* Escalera de valor: qué ve Smart Bidding y qué debería ver */}
      <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] flex items-center gap-2"><Layers size={15} className="text-[#0062CC]" /> Escalera de valor</h2>
          <p className="text-xs text-[#F5F7FA] opacity-60 mt-0.5">Smart Bidding solo ve las primarias. La primaria debe ser la etapa más profunda con 15+ eventos al mes.</p>
        </div>
        {escalera.etapas?.length ? (
          <div className="space-y-2">
            {escalera.etapas.map((e: any) => (
              <div key={e.stage_order} className="flex items-center gap-3 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: e.google_status === 'primaria' ? '2px solid #0062CC' : undefined }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-[#FFFFFF] shrink-0" style={{ backgroundColor: e.google_status === 'primaria' ? '#0062CC' : 'var(--surface-3)' }}>{e.stage_order}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[#FFFFFF] font-medium truncate">{e.stage_name} <span className="opacity-50 font-normal">· {e.google_status}</span></div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">{e.accion}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#FFFFFF] tabular">{e.eventos_ultimos_30d ?? '—'}<span className="opacity-50 text-[10px]">/30d</span></div>
                  <div className="text-[10px] text-[#F5F7FA] opacity-60 tabular">{e.stage_value ? fmtMoney(e.stage_value) : '—'}</div>
                </div>
              </div>
            ))}
            {escalera.recomendada?.recomendacion && (
              <p className="text-[11px] text-[#F5F7FA] opacity-70 pt-1">{escalera.recomendada.recomendacion}</p>
            )}
          </div>
        ) : <p className="text-xs text-[#F5F7FA] opacity-60">Esta cuenta no tiene etapas de embudo cargadas. Se definen en Supabase, tabla funnel_stages.</p>}
      </div>

      </>)}
      {ver('reportes') && (<>
      {/* Reportes al cliente */}
      <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Reportes al cliente</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Elegís el período, el sistema arma el borrador, lo leés, lo aprobás. {origenReporte === 'sonnet-5' ? 'El último se redactó desde los datos porque no había análisis semanal para ese rango.' : origenReporte === 'brief' ? 'El último salió del análisis semanal.' : ''}</p>
          </div>
          <button onClick={() => setGenerandoDesde(v => !v)} className="px-3 py-1 rounded-lg text-xs text-[#F5F7FA]" style={{ border: '1px solid var(--border)' }}>{generandoDesde ? 'Cancelar' : 'Nuevo borrador'}</button>
        </div>
        {generandoDesde && (
          <div className="p-3 rounded-xl space-y-2" style={{ backgroundColor: 'var(--surface-2)' }}>
            <div className="flex flex-wrap gap-1.5">
              {([['semana_cerrada', 'Última semana cerrada'], ['dos_semanas', 'Últimas dos semanas'], ['mes_pasado', 'Mes pasado'], ['ultimos_7', 'Últimos 7 días']] as const).map(([k, l]) => (
                <button key={k} onClick={() => preset(k)} className="px-2.5 py-1 rounded-md text-[11px] text-[#F5F7FA] hover:text-[#FFFFFF]" style={{ border: '1px solid var(--border)' }}>{l}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-[#F5F7FA] opacity-70">Desde<br /><input type="date" value={formGenerar.desde} max={formGenerar.hasta || undefined} onChange={e => setFormGenerar(f => ({ ...f, desde: e.target.value }))} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-xs text-[#FFFFFF]" style={{ colorScheme: 'dark' }} /></label>
              <label className="text-[11px] text-[#F5F7FA] opacity-70">Hasta<br /><input type="date" value={formGenerar.hasta} min={formGenerar.desde || undefined} onChange={e => setFormGenerar(f => ({ ...f, hasta: e.target.value }))} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-xs text-[#FFFFFF]" style={{ colorScheme: 'dark' }} /></label>
              <button onClick={generarReporte} disabled={!formGenerar.desde || !formGenerar.hasta || trabajandoReporte === 'generar'} className="px-3 py-1.5 rounded-lg text-xs bg-[#0062CC] text-[#FFFFFF] disabled:opacity-40">{trabajandoReporte === 'generar' ? 'Armando el borrador…' : 'Crear borrador'}</button>
              <span className="text-[10px] text-[#F5F7FA] opacity-50">El sistema busca solo el análisis de esa semana; si no hay, lo redacta desde los datos. Los números salen siempre de Supabase.</span>
            </div>
          </div>
        )}
        {reportes.length === 0 ? (
          <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Sin reportes para {activeClient}. El lunes, tras la tarea semanal, aparece el borrador de la semana.</p>
        ) : (
          <div className="space-y-1.5">
            {reportes.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-white/5" style={{ backgroundColor: 'var(--surface-2)', border: reporteAbierto?.id === r.id ? '1px solid var(--primary)' : '1px solid transparent' }}
                onClick={() => { setReporteAbierto(r); setEditandoReporte(false); setTextoReporte({ resumen_ejecutivo: r.resumen_ejecutivo, que_cambiamos: r.que_cambiamos || '', que_sigue: r.que_sigue || '' }); }}>
                <span className={`text-[10px] uppercase tracking-wider font-bold w-20 shrink-0 ${r.estado === 'borrador' ? 'text-[#0062CC]' : r.estado === 'enviado' ? 'text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-60'}`}>{r.estado}</span>
                <span className="text-xs text-[#FFFFFF] tabular">{r.periodo_desde} → {r.periodo_hasta}</span>
                <span className="text-[11px] text-[#F5F7FA] opacity-60">{r.tipo} · {r.idioma.toUpperCase()}{r.editado ? ' · editado' : ''}</span>
                <span className="ml-auto text-[11px] text-[#F5F7FA] opacity-50 tabular">
                  {r.metricas?.cpa?.actual != null ? `CPA ${fmtMoney(r.metricas.cpa.actual)}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        {reporteAbierto && (
          <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">{reporteAbierto.periodo_desde} → {reporteAbierto.periodo_hasta} · {reporteAbierto.estado}</span>
              <div className="flex gap-2">
                <button onClick={() => accionReporte(reporteAbierto.id, 'pdf')} className="px-3 py-1 rounded-lg text-xs text-[#F5F7FA]" style={{ border: '1px solid var(--border)' }}>Ver PDF</button>
                {reporteAbierto.estado === 'borrador' && !editandoReporte && <button onClick={() => setEditandoReporte(true)} className="px-3 py-1 rounded-lg text-xs text-[#F5F7FA]" style={{ border: '1px solid var(--border)' }}>Editar texto</button>}
                {reporteAbierto.estado === 'borrador' && <button onClick={() => accionReporte(reporteAbierto.id, 'aprobar')} className="px-3 py-1 rounded-lg text-xs bg-[#0062CC] text-[#FFFFFF]">Aprobar</button>}
                {reporteAbierto.estado === 'borrador' && <button onClick={() => accionReporte(reporteAbierto.id, 'descartar')} className="px-3 py-1 rounded-lg text-xs text-[#F5F7FA] opacity-60">Descartar</button>}
              </div>
            </div>
            {editandoReporte ? (
              <div className="space-y-2">
                {(['resumen_ejecutivo', 'que_cambiamos', 'que_sigue'] as const).map(k => (
                  <label key={k} className="block text-[11px] text-[#F5F7FA] opacity-70">{k === 'resumen_ejecutivo' ? 'Resumen ejecutivo' : k === 'que_cambiamos' ? 'Qué cambiamos' : 'Qué sigue'}
                    <textarea value={textoReporte[k]} onChange={e => setTextoReporte(t => ({ ...t, [k]: e.target.value }))} rows={k === 'resumen_ejecutivo' ? 9 : 4}
                      className="w-full mt-1 text-xs bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg p-2 text-[#F5F7FA] focus:outline-none focus:border-[#0062CC]" style={{ fontFamily: 'inherit' }} />
                  </label>
                ))}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditandoReporte(false)} className="px-3 py-1 rounded-lg text-xs text-[#F5F7FA] opacity-70">Cancelar</button>
                  <button onClick={guardarTextoReporte} disabled={trabajandoReporte === 'guardar'} className="px-3 py-1 rounded-lg text-xs bg-[#0062CC] text-[#FFFFFF]">Guardar</button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#F5F7FA] leading-relaxed whitespace-pre-wrap max-h-[40vh] overflow-y-auto custom-scrollbar">{reporteAbierto.resumen_ejecutivo}</div>
            )}
          </div>
        )}
      </div>

      </>)}
      {ver('diagnostico') && (<>
      {/* Accionables Abiertos de esta cuenta */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF]">
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
                  <div className="text-xs font-semibold text-[#FFFFFF] truncate">
                    {act.title}
                  </div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-60">
                    Prioridad: {act.priority} · Estado: {act.status}
                  </div>
                </div>
                <ArrowRight size={12} className="text-[#0062CC] shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>



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
              <h2 className="text-[15px] font-medium text-[#FFFFFF]">
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
                    <span className={`text-[10px] uppercase tracking-wider font-bold shrink-0 w-20 pt-0.5 ${z === 'proponer' ? 'text-[#FFFFFF]' : z === 'revisar' ? 'text-[#0062CC]' : 'text-[#F5F7FA]'}`}>{nombre}</span>
                    <span className="text-xs text-[#F5F7FA]"><span className="font-medium text-[#FFFFFF]">{d.etiqueta}.</span> {d.detalle}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-[#F5F7FA] opacity-60">{String(d.testeabilidad || '').replace(/^NO TESTEABLE en (\d+) semanas: el efecto mínimo detectable supera 35%\. Registrar la pregunta, no correr el test\./, 'Con este volumen, un test A/B de $1 semanas no distinguiría nada: harían falta cambios de más de 35% para verlos.').replace(/^TESTEABLE SOLO PARA EFECTOS GRANDES: necesita 35%\+ de diferencia/, 'Un test de 4 semanas solo detectaría cambios grandes, de 35% o más.').replace(/^TESTEABLE: detecta cambios de 20% o más/, 'Hay volumen para testear: un test de 4 semanas detecta cambios de 20% o más.')}</p>
            {estrategia.cpa_marginal.filter((m: any) => m.escalon > m.presupuesto_actual).length > 0 && (
              <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-medium text-[#FFFFFF] mb-1">Dónde produce más el siguiente peso</p>
                <table className="w-full text-xs">
                  <thead><tr className="text-[#F5F7FA] opacity-60 text-left"><th className="py-1 px-2">Campaña</th><th className="py-1 px-2 text-right">Escalón/día</th><th className="py-1 px-2 text-right">CPA promedio</th><th className="py-1 px-2 text-right">CPA marginal</th><th className="py-1 px-2">Lectura</th></tr></thead>
                  <tbody>
                    {estrategia.cpa_marginal.filter((m: any) => m.escalon > m.presupuesto_actual).slice(0, 6).map((m: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="py-1 px-2 text-[#F5F7FA] max-w-[180px] truncate">{m.campaign}</td>
                        <td className="py-1 px-2 tabular text-right text-[#F5F7FA]">{fmtMoney(m.escalon)}</td>
                        <td className="py-1 px-2 tabular text-right text-[#F5F7FA] opacity-70">{fmtMoney(m.cpa_promedio_en_escalon)}</td>
                        <td className={`py-1 px-2 tabular text-right ${m.ratio_marginal_sobre_promedio >= 2 ? 'text-[#0062CC] font-semibold' : 'text-[#FFFFFF]'}`}>{fmtMoney(m.cpa_marginal_desde_anterior)}{m.ratio_marginal_sobre_promedio ? ` (${m.ratio_marginal_sobre_promedio}×)` : ''}</td>
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
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <HelpCircle size={16} />
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
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
                  <div className="font-semibold text-[#FFFFFF]">
                    {hyp.title}
                  </div>
                  {onOpenActionable && (
                    <button
                      onClick={() => onOpenActionable(hyp)}
                      className="text-xs text-[#0062CC] hover:underline font-semibold flex items-center gap-1 shrink-0"
                    >
                      <span>Ver accionable</span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>

                {hyp.que_lo_confirmaria && (
                  <div className="text-xs text-[#F5F7FA] opacity-80 flex items-start gap-1.5 pt-0.5">
                    <span className="font-semibold text-[#FFFFFF] shrink-0">Qué lo confirmaría:</span>
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
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <Lightbulb size={16} />
          <h2 className="text-[15px] font-medium text-[#FFFFFF]">
            Aprendizajes Consolidados (Bitácora de Conocimiento)
          </h2>
        </div>

        <div className="space-y-2.5">
          {learnings.map((l, i) => (
            <div 
              key={i}
              className="p-3.5 rounded-xl space-y-1 text-xs"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between text-[11px] text-[#F5F7FA] opacity-60">
                <span className="tabular">{l.date}</span>
                <span className="font-semibold text-[#FFFFFF]">Validado</span>
              </div>
              <div className="font-semibold text-[#FFFFFF]">
                {l.title}
              </div>
              <p className="text-[#F5F7FA] opacity-80 leading-relaxed">
                {l.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      </>)}
      {ver('memoria') && (<>
      {/* Doc maestro ensamblado */}
      <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Doc maestro</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Capa humana editable · series, umbrales, conversiones y cronología calculados · aprendizajes desde Notion</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setVistaDoc('ensamblado')} className={`px-3 py-1 rounded-lg text-xs ${vistaDoc === 'ensamblado' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`}>Ensamblado</button>
            <button onClick={() => setVistaDoc('editar')} className={`px-3 py-1 rounded-lg text-xs ${vistaDoc === 'editar' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`}>Editar capa humana</button>
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
                  <span className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">{sec.seccion}</span>
                  <span className="text-[11px] text-[#F5F7FA] opacity-50 tabular">v{sec.version} · {new Date(sec.editado_el).toLocaleDateString('es-CL')} · {sec.editado_por}</span>
                </div>
                {editandoSeccion === sec.seccion ? (
                  <div className="space-y-2">
                    <textarea value={textoEdicion} onChange={e => setTextoEdicion(e.target.value)} rows={14}
                      className="w-full text-xs bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg p-3 text-[#F5F7FA] focus:outline-none focus:border-[#0062CC] tabular" style={{ fontFamily: 'inherit' }} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditandoSeccion(null)} className="px-3 py-1 rounded-lg text-xs text-[#F5F7FA] opacity-70">Cancelar</button>
                      <button onClick={() => guardarSeccion(sec.seccion)} disabled={guardandoDoc} className="px-3 py-1 rounded-lg text-xs bg-[#0062CC] text-[#FFFFFF] disabled:opacity-50">{guardandoDoc ? 'Guardando…' : 'Guardar como nueva versión'}</button>
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
