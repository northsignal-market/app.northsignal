import React, { useState, useEffect, useMemo } from 'react';
import { 
  Check, Cpu, MessageSquare, Send, Clock, 
  ExternalLink, AlertCircle, ShieldAlert,
  ArrowRight, Plus, History, Sparkles, HelpCircle
} from 'lucide-react';
import { receta } from '../lib/recetas';
import type { Actionable } from '../types';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';
import { useAppStore } from '../store/useAppStore';

function CommentsThread({ actionableId }: { actionableId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`/api/notion/actionables/${actionableId}/comments`, { credentials: 'include', headers })
      .then(async res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { comments: [] };
        return res.json();
      })
      .then(data => setComments(data.comments || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [actionableId]);

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || sending) return;
    setSending(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`/api/notion/actionables/${actionableId}/comments`, { 
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ text: newText })
      });
      if (!res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.success) {
        setNewText('');
        setComments([...comments, {
          id: data.comment?.id || Date.now().toString(),
          text: newText,
          created_at: new Date().toISOString(),
          author: 'Andrés (Operador)'
        }]);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <h3 className="text-xs font-semibold tracking-wider text-[#F5F7FA] opacity-70 uppercase mb-3 flex items-center gap-2">
        <MessageSquare size={14} /> Hilo de Discusión y Comentarios
      </h3>
      <div className="space-y-2 mb-3">
        {loading ? (
          <div className="text-xs text-[#F5F7FA] opacity-50 py-2">Cargando comentarios...</div>
        ) : comments.length === 0 ? (
          <div className="text-xs text-[#F5F7FA] opacity-40 italic py-1">Sin comentarios registrados en Notion.</div>
        ) : (
          comments.map(c => (
            <div 
              key={c.id} 
              className="p-3 rounded-lg text-xs"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between text-[11px] text-[#F5F7FA] opacity-60 mb-1">
                <span className="font-semibold text-[#FFFFFF]">{c.author}</span>
                <span className="tabular">{new Date(c.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <p className="text-[#F5F7FA] whitespace-pre-wrap">{c.text}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={sendComment} className="flex gap-2">
        <input 
          type="text" 
          placeholder="Agregar comentario a Notion..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          className="flex-1 bg-transparent px-3 py-1.5 rounded-md text-xs text-[#FFFFFF] placeholder-[#F5F7FA]/30 focus:outline-none focus:border-[#0062CC]"
          style={{ border: '1px solid var(--border-strong)' }}
        />
        <button 
          type="submit" 
          disabled={sending || !newText.trim()}
          className="px-3 py-1.5 rounded-md bg-[#0062CC] hover:opacity-90 disabled:opacity-40 text-[#FFFFFF] text-xs font-semibold flex items-center gap-1 transition-opacity shrink-0"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}

export function ActionableDrawerContent({
  action,
  onActionChange,
  onNavigateToActionable,
  onNavigateToBrief,
  onNavigateToKeyword
}: {
  action: Actionable;
  onActionChange?: (updated: Actionable) => void;
  onNavigateToActionable?: (actionId: string) => void;
  onNavigateToBrief?: (briefId: string) => void;
  onNavigateToKeyword?: (keyword: string) => void;
}) {
  const { updateActionableStatus, notionBriefs, actionables } = useAppStore();

  const [analyzing, setAnalyzing] = useState(false);
  const [geminiResult, setGeminiResult] = useState<{
    consenso: string;
    segunda_opinion: string;
    punto_disputa?: string;
  } | null>(null);

  // Tracking fields
  const [ejecutadoEl, setEjecutadoEl] = useState(action.ejecutado_el || '');
  const [resultadoObservado, setResultadoObservado] = useState(action.resultado_observado || '');
  const [naturaleza, setNaturaleza] = useState(action.naturaleza || NOTION_NATURALEZA.DATO);
  const [queLoConfirmaria, setQueLoConfirmaria] = useState(action.que_lo_confirmaria || '');
  const [causaRaiz, setCausaRaiz] = useState(action.causa_raiz || '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Operator log form
  const [showLogForm, setShowLogForm] = useState(false);
  const [logQueCambio, setLogQueCambio] = useState('');
  const [logDonde, setLogDonde] = useState(action.where || '');
  const [ejecutando, setEjecutando] = useState(false);
  const [ejecutado, setEjecutado] = useState<string | null>(null);
  // Que tipo de accion automatica es, si alguna. Solo negativas y pausas.
  const tipoAuto = (() => {
    const t = action.title.toLowerCase();
    if (/negativ/.test(t)) return /campa/.test(t) ? 'negativa_campana' : 'negativa_grupo';
    if (/pausar/.test(t) && /keyword|palabra/.test(t)) return 'pausar_keyword';
    if (/pausar/.test(t) && /anuncio/.test(t)) return 'pausar_anuncio';
    return null;
  })();
  const entidadPartes = String(action.entidad || action.where || '').split('|').map(x => x.trim());
  const aprobarYEjecutar = async (modo: 'simular' | 'ejecutar') => {
    if (!tipoAuto) return;
    const kw = (action.title.match(/["“'‘]([^"”'’]+)["”'’]/) || [])[1] || entidadPartes[2] || '';
    if (!kw && tipoAuto !== 'pausar_anuncio') { alert('No pude identificar la keyword o término en el título. Ejecutalo a mano con "Cómo hacerlo".'); return; }
    setEjecutando(true);
    try {
      const r = await fetch(`/api/accionables/${action.id}/aprobar-ejecutar`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: action.client, tipo: tipoAuto, campana: entidadPartes[0] || '', grupo: entidadPartes[1] || '', keyword: kw, match_type: /exact|exacta/.test(action.title.toLowerCase()) ? 'EXACT' : 'PHRASE', modo }) });
      const j = await r.json();
      if (!r.ok) alert(j.error || 'Error'); else setEjecutado(modo);
    } finally { setEjecutando(false); }
  };
  const [logValorAnterior, setLogValorAnterior] = useState('');
  const [logValorNuevo, setLogValorNuevo] = useState('');
  const [logPorQue, setLogPorQue] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Recent changes
  const [recentChanges, setRecentChanges] = useState<any[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);

  useEffect(() => {
    setEjecutadoEl(action.ejecutado_el || '');
    setResultadoObservado(action.resultado_observado || '');
    setNaturaleza(action.naturaleza || NOTION_NATURALEZA.DATO);
    setQueLoConfirmaria(action.que_lo_confirmaria || '');
    setCausaRaiz(action.causa_raiz || '');
    setGeminiResult(null);
    setShowLogForm(false);
  }, [action]);

  const fetchChanges = async () => {
    if (!action.client) return;
    setLoadingChanges(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/notion/actionables/${action.id}/recent_changes?client=${encodeURIComponent(action.client)}`, { credentials: 'include', headers });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      setRecentChanges(data.changes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChanges(false);
    }
  };

  useEffect(() => {
    fetchChanges();
  }, [action.id, action.client]);

  const isDone = action.status.toLowerCase() === NOTION_STATES.HECHO.toLowerCase();
  const isEnDisputa = action.revision_ia === 'En disputa';

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/notion/actionables/${action.id}/analyze`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.success) {
        setGeminiResult(data.data);
        if (onActionChange) {
          onActionChange({
            ...action,
            revision_ia: data.data.consenso as any,
            segunda_opinion: data.data.segunda_opinion,
            punto_disputa: data.data.punto_disputa
          });
        }
      }
    } catch(err) {
      console.error('Failed to analyze actionable:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveTracking = async () => {
    setSavingDetails(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`/api/notion/actionables/${action.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ejecutado_el: ejecutadoEl || null,
          resultado_observado: resultadoObservado || null,
          naturaleza,
          que_lo_confirmaria: queLoConfirmaria || null,
          causa_raiz: causaRaiz || null
        })
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.success) {
        setSavedSuccess(true);
        if (onActionChange) {
          onActionChange({
            ...action,
            ejecutado_el: ejecutadoEl || undefined,
            resultado_observado: resultadoObservado || undefined,
            naturaleza: naturaleza as any,
            que_lo_confirmaria: queLoConfirmaria || undefined,
            causa_raiz: causaRaiz || undefined
          });
        }
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleConfirmHypothesis = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`/api/notion/actionables/${action.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          confirmar_hipotesis: true,
          status: NOTION_STATES.PROPUESTO
        })
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.success) {
        updateActionableStatus(action.id, NOTION_STATES.PROPUESTO);
        if (onActionChange) {
          onActionChange({
            ...action,
            status: NOTION_STATES.PROPUESTO
          });
        }
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleSubmitOperatorLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logQueCambio.trim()) return;
    setSavingLog(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch('/api/operator_log', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          account: action.client,
          que_cambio: logQueCambio,
          donde: logDonde,
          valor_anterior: logValorAnterior || null,
          valor_nuevo: logValorNuevo || null,
          por_que: logPorQue || `Registrado desde accionable: ${action.title}`,
          accionable_notion_id: action.id
        })
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const d = await res.json();
      if (d.success) {
        setLogSuccess(true);
        setLogQueCambio('');
        setLogValorAnterior('');
        setLogValorNuevo('');
        setLogPorQue('');
        fetchChanges();
        setTimeout(() => {
          setLogSuccess(false);
          setShowLogForm(false);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingLog(false);
    }
  };

  // Find related actionables
  const relatedActions = useMemo(() => {
    if (!action.client) return [];
    return actionables.filter(a => a.id !== action.id && a.client.toLowerCase() === action.client.toLowerCase()).slice(0, 3);
  }, [actionables, action]);

  // Extract possible keyword from title
  const possibleKeyword = useMemo(() => {
    const m = action.title.match(/keyword[:\s]+["']?([a-zA-Z0-9\s_-]+)["']?/i) || action.title.match(/palabra[:\s]+["']?([a-zA-Z0-9\s_-]+)["']?/i);
    return m ? m[1].trim() : null;
  }, [action.title]);

  return (
    <div className="space-y-4 text-xs">
      {/* Top Metadata Badges */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#0062CC]/15 text-[#FFFFFF] border border-[#0062CC]/30">
            {action.client}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            Prioridad: <strong className="text-[#FFFFFF]">{action.priority}</strong>
          </span>
          {action.origen && action.origen !== 'Semanal' && (
            <span className="px-2 py-0.5 rounded text-[11px] text-[#F5F7FA] opacity-80" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }} title="Lo propuso un proceso automático; la tarea del lunes lo confirma o descarta">
              Propuesto por {action.origen === 'Pulso diario' ? 'el análisis diario' : action.origen === 'Anomalias' ? 'el detector de anomalías' : action.origen}
              {action.vence ? ` · vence ${action.vence.slice(5)}` : ''}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-[11px] ${
            isEnDisputa ? 'border-l-2 border-[#0062CC] font-semibold text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'
          }`} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {action.revision_ia || 'Sin revisar'}
          </span>
        </div>

        {/* Quick Done Toggle */}
        <button
          onClick={() => {
            const next = isDone ? NOTION_STATES.PROPUESTO : NOTION_STATES.HECHO;
            updateActionableStatus(action.id, next);
            if (onActionChange) onActionChange({ ...action, status: next });
          }}
          className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            isDone ? 'bg-white/15 text-[#FFFFFF]' : 'bg-[#0062CC] text-[#FFFFFF]'
          }`}
        >
          <Check size={13} />
          <span>{isDone ? 'Marcar Propuesto' : 'Marcar Hecho'}</span>
        </button>
      </div>

      {/* Main Action Title & Reason */}
      <div 
        className="p-3.5 rounded-xl space-y-2"
        style={{ 
          backgroundColor: 'var(--surface-1)', 
          border: isEnDisputa ? '1px solid var(--border-strong)' : '1px solid var(--border)',
          borderLeft: isEnDisputa ? '2px solid var(--primary)' : undefined
        }}
      >
        <div className="flex items-start gap-2">
          {isEnDisputa && <AlertCircle size={16} className="text-[#0062CC] shrink-0 mt-0.5" />}
          <h2 className="text-sm font-bold text-[#FFFFFF] leading-snug">
            {action.title}
          </h2>
        </div>

        {action.why && (
          <div className="text-xs text-[#F5F7FA] opacity-80 leading-relaxed pl-1">
            {action.why.replace(/^\[[^\]]*\]\s*/, '')}
          </div>
        )}

        {action.where && !/v_[a-z_]+|pulso_diario|\bcron\b/i.test(action.where) && (
          <div className="text-[11px] text-[#F5F7FA] opacity-60 flex items-center gap-1.5 pt-1">
            <span className="font-semibold uppercase tracking-wider">Dónde:</span>
            <span>{action.where}</span>
          </div>
        )}
        {action.where && /pulso_diario/i.test(action.where) && (
          <div className="text-[11px] text-[#F5F7FA] opacity-60 pt-1">Lo detectó el análisis diario{(action.where.match(/\d{4}-\d{2}-\d{2}/) || [])[0] ? ` del ${(action.where.match(/\d{4}-\d{2}-\d{2}/) || [])[0]}` : ''}.</div>
        )}
      </div>



      {/* Aprobar y ejecutar: solo negativas y pausas, que son reversibles */}
      {tipoAuto && action.status !== 'Hecho' && action.status !== 'Descartado' && (
        <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          {ejecutado ? (
            <p className="text-xs text-[#F5F7FA]">{ejecutado === 'ejecutar' ? 'Aprobado. El script lo aplica en Google Ads dentro de la próxima hora y te lo marca Hecho.' : 'Simulación pedida. El script va a escribir qué haría, sin tocar la cuenta. Lo ves en Sistema › Ejecuciones.'}</p>
          ) : (
            <>
              <p className="text-xs text-[#F5F7FA] opacity-80">Esto es una {tipoAuto.startsWith('negativa') ? 'negativa' : 'pausa'}: se puede deshacer, así que el sistema puede aplicarla por vos. Un script la ejecuta dentro de la próxima hora. Presupuesto, puja y conversiones siguen siendo a mano.</p>
              <div className="flex gap-2">
                <button onClick={() => aprobarYEjecutar('ejecutar')} disabled={ejecutando} className="px-3 py-1.5 rounded-lg text-xs bg-[#0062CC] text-[#FFFFFF] disabled:opacity-40">{ejecutando ? 'Enviando…' : 'Aprobar y que se haga'}</button>
                <button onClick={() => aprobarYEjecutar('simular')} disabled={ejecutando} className="px-3 py-1.5 rounded-lg text-xs text-[#F5F7FA]" style={{ border: '1px solid var(--border)' }}>Solo simular</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cómo hacerlo: los pasos en Google Ads */}
      {(() => {
        const propio = (action.como_hacerlo || '').trim();
        const pasosPropios = propio ? propio.split(/\n+/).map(l => l.replace(/^\s*(\d+[.)]|[-•])\s*/, '').trim()).filter(Boolean) : [];
        const rec = pasosPropios.length ? null : receta(action.title, action.client);
        const pasos = pasosPropios.length ? pasosPropios : rec?.pasos || [];
        if (!pasos.length) return null;
        return (
          <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', borderLeft: '2px solid var(--primary)' }}>
            <span className="font-semibold text-[#FFFFFF] text-xs block">Cómo hacerlo{rec ? ` · ${rec.titulo}` : ''}</span>
            <ol className="space-y-1.5 pl-1">
              {pasos.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-[#F5F7FA] leading-relaxed">
                  <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold tabular" style={{ backgroundColor: 'var(--surface-2)', color: '#FFFFFF' }}>{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
            {rec?.nota && <p className="text-[11px] text-[#F5F7FA] opacity-60 pt-1 leading-relaxed">{rec.nota}</p>}
            {!propio && rec && <p className="text-[10px] text-[#F5F7FA] opacity-40">Pasos genéricos para este tipo de acción. Los accionables nuevos traen los suyos.</p>}
          </div>
        );
      })()}

      {/* Criterio / Disputa / Hipótesis alert */}
      {action.punto_disputa && (
        <div 
          className="p-3 rounded-xl space-y-1.5"
          style={{ backgroundColor: 'var(--surface-2)', borderLeft: '2px solid var(--primary)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FFFFFF]">
            <ShieldAlert size={14} className="text-[#0062CC]" />
            <span>La segunda opinión no coincide</span>
          </div>
          <p className="text-xs text-[#F5F7FA] opacity-85 leading-relaxed">
            {action.punto_disputa}
          </p>
        </div>
      )}

      {/* Blocked hypothesis confirm button */}
      {action.status === NOTION_STATES.BLOQUEADO && (
        <div 
          className="p-3 rounded-xl flex items-center justify-between gap-3"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FFFFFF]">
              <Clock size={13} className="text-[#F5F7FA] opacity-70" />
              <span>Esperando tu confirmación</span>
            </div>
            <p className="text-[11px] text-[#F5F7FA] opacity-70">
              {action.que_lo_confirmaria || 'Es una deducción, no un dato visto. Confirmá si tiene sentido antes de ejecutarla.'}
            </p>
          </div>
          <button
            onClick={handleConfirmHypothesis}
            className="px-3 py-1 bg-[#0062CC] hover:opacity-90 text-[#FFFFFF] rounded-md text-xs font-semibold shrink-0"
          >
            Confirmar
          </button>
        </div>
      )}

      {/* Operational Tracking & Nature Form */}
      <div 
        className="p-3.5 rounded-xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#FFFFFF] text-xs uppercase tracking-wider">
            Registrá lo que hiciste
          </span>
          {savedSuccess && (
            <span className="text-[11px] font-medium text-[#FFFFFF] flex items-center gap-1">
              <Check size={12} /> Guardado
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
              Naturaleza
            </label>
            <select
              value={naturaleza}
              onChange={(e) => setNaturaleza(e.target.value as any)}
              className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#FFFFFF] outline-none"
              style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
            >
              <option value={NOTION_NATURALEZA.DATO} className="bg-[#1A1F36]">Dato</option>
              <option value={NOTION_NATURALEZA.INFERENCIA} className="bg-[#1A1F36]">Inferencia</option>
              <option value={NOTION_NATURALEZA.HIPOTESIS} className="bg-[#1A1F36]">Hipótesis</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
              Fecha Ejecución
            </label>
            <input
              type="date"
              value={ejecutadoEl}
              onChange={(e) => setEjecutadoEl(e.target.value)}
              className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#FFFFFF] outline-none tabular"
              style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
            Qué lo confirmaría / resolvería
          </label>
          <input
            type="text"
            value={queLoConfirmaria}
            onChange={(e) => setQueLoConfirmaria(e.target.value)}
            placeholder="Ej: Si el CPA de betreuung se mantiene bajo 45€..."
            className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#F5F7FA]/30 outline-none"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
            Causa Raíz
          </label>
          <input
            type="text"
            value={causaRaiz}
            onChange={(e) => setCausaRaiz(e.target.value)}
            placeholder="Ej: Cambio en presupuesto de campaña Search..."
            className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#F5F7FA]/30 outline-none"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
            Resultado Observado
          </label>
          <textarea
            value={resultadoObservado}
            onChange={(e) => setResultadoObservado(e.target.value)}
            placeholder="Impacto en conversiones, CPA o tráfico tras la ejecución..."
            rows={2}
            className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#F5F7FA]/30 outline-none"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveTracking}
            disabled={savingDetails}
            className="px-3.5 py-1.5 rounded-md bg-[#0062CC] hover:opacity-90 disabled:opacity-50 text-[#FFFFFF] text-xs font-semibold transition-opacity"
          >
            {savingDetails ? 'Guardando...' : 'Guardar Trazabilidad'}
          </button>
        </div>
      </div>

      {/* Gemini 2nd Opinion Trigger */}
      <div 
        className="p-3.5 rounded-xl flex items-center justify-between gap-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FFFFFF]">
            <Cpu size={14} className="text-[#0062CC]" />
            <span>Auditoría de 2da Opinión Gemini</span>
          </div>
          <p className="text-[11px] text-[#F5F7FA] opacity-65">
            Analiza el accionable contra el modelo base y detecta controversias
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-3 py-1.5 rounded-md bg-[#0062CC] hover:opacity-90 disabled:opacity-50 text-[#FFFFFF] text-xs font-semibold shrink-0 flex items-center gap-1"
        >
          <Sparkles size={12} />
          <span>{analyzing ? 'Auditando...' : 'Pedir 2da Opinión'}</span>
        </button>
      </div>

      {geminiResult && (
        <div 
          className="p-3 rounded-xl space-y-2"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#FFFFFF]">Resultado: {geminiResult.consenso}</span>
          </div>
          <p className="text-xs text-[#F5F7FA] opacity-85 whitespace-pre-wrap leading-relaxed">
            {geminiResult.segunda_opinion}
          </p>
        </div>
      )}

      {/* Manual Change Logger (operator_log) */}
      <div 
        className="p-3.5 rounded-xl space-y-2"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FFFFFF]">
            <History size={14} />
            <span>Registro Manual de Cambios</span>
          </div>
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="text-xs text-[#0062CC] hover:underline font-semibold"
          >
            {showLogForm ? 'Cancelar' : '+ Registrar Cambio'}
          </button>
        </div>

        {showLogForm && (
          <form onSubmit={handleSubmitOperatorLog} className="pt-2 space-y-2.5">
            {logSuccess && (
              <div className="text-[11px] text-[#FFFFFF] flex items-center gap-1">
                <Check size={12} /> Cambio guardado en operator_log
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                Qué cambió
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Aumento de presupuesto diario de 30 a 50 EUR"
                value={logQueCambio}
                onChange={e => setLogQueCambio(e.target.value)}
                className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none"
                style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                  Valor anterior
                </label>
                <input
                  type="text"
                  placeholder="Ej: 30 EUR"
                  value={logValorAnterior}
                  onChange={e => setLogValorAnterior(e.target.value)}
                  className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none tabular"
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                  Valor nuevo
                </label>
                <input
                  type="text"
                  placeholder="Ej: 50 EUR"
                  value={logValorNuevo}
                  onChange={e => setLogValorNuevo(e.target.value)}
                  className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none tabular"
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                Por qué
              </label>
              <input
                type="text"
                placeholder="Motivo del cambio..."
                value={logPorQue}
                onChange={e => setLogPorQue(e.target.value)}
                className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none"
                style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingLog || !logQueCambio.trim()}
                className="px-3 py-1 bg-[#0062CC] text-[#FFFFFF] rounded text-xs font-semibold disabled:opacity-50"
              >
                {savingLog ? 'Guardando...' : 'Guardar en Bitácora'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Navigation Outlets */}
      <div 
        className="p-3.5 rounded-xl space-y-2"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <span className="font-semibold text-[#FFFFFF] text-xs uppercase tracking-wider block">
          Ver más
        </span>
        <div className="flex flex-wrap gap-2 pt-1">
          {action.brief_id && onNavigateToBrief && (
            <button
              onClick={() => onNavigateToBrief(action.brief_id!)}
              className="px-2.5 py-1 rounded text-xs font-medium text-[#FFFFFF] hover:bg-white/10 flex items-center gap-1"
              style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
            >
              <ExternalLink size={12} />
              <span>Ver el brief donde apareció</span>
            </button>
          )}

          {possibleKeyword && onNavigateToKeyword && (
            <button
              onClick={() => onNavigateToKeyword(possibleKeyword)}
              className="px-2.5 py-1 rounded text-xs font-medium text-[#FFFFFF] hover:bg-white/10 flex items-center gap-1"
              style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
            >
              <ArrowRight size={12} />
              <span>Ver la keyword en Datos</span>
            </button>
          )}
        </div>

        {/* Related actionables */}
        {relatedActions.length > 0 && onNavigateToActionable && (
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[11px] text-[#F5F7FA] opacity-60 block mb-1.5">
              Otros accionables de {action.client} relacionados:
            </span>
            <div className="space-y-1">
              {relatedActions.map(ra => (
                <button
                  key={ra.id}
                  onClick={() => onNavigateToActionable(ra.id)}
                  className="w-full text-left p-2 rounded text-xs text-[#F5F7FA] hover:text-[#FFFFFF] transition-colors flex items-center justify-between"
                  style={{ backgroundColor: 'var(--surface-2)' }}
                >
                  <span className="truncate pr-2">{ra.title}</span>
                  <ArrowRight size={12} className="shrink-0 text-[#0062CC]" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discussion comments thread */}
      <CommentsThread actionableId={action.id} />
    </div>
  );
}
