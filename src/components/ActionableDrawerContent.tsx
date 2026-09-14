import React, { useState, useEffect, useRef, useMemo } from 'react';
import { avisar, useCuentas } from '../lib/useCuentas';
import { useJSON, fmtMoneda, fmtFechaCorta, Fallo } from './ui';
import { 
  Check, Cpu, MessageSquare, Send, Clock, 
  ExternalLink, AlertCircle, ShieldAlert,
  ArrowRight, Plus, History, Sparkles, HelpCircle
} from 'lucide-react';
import { receta } from '../lib/recetas';
import { detectarTipoAuto, extraerKeyword, concordanciaDestino } from '../lib/tipoAuto';
import { tipoAutoDesde } from '../lib/accion';
import type { Actionable } from '../types';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';
import { useAppStore } from '../store/useAppStore';
import { actorDe, haceCuanto, parsearComentario } from '../lib/actores';
import { Avatar } from './Campana';

function CommentsThread({ actionableId }: { actionableId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      // Primero el espejo (rapido); si esta vacio, Notion directo
      let lista: any[] = [];
      const r = await fetch(`/api/accionables/${actionableId}/comentarios`, { credentials: 'include' });
      if (r.ok) lista = (await r.json()).map((c: any) => ({ id: c.comment_id, text: c.texto, created_at: c.creado, autor: c.autor, prefijo: c.prefijo }));
      if (!lista.length) {
        const r2 = await fetch(`/api/notion/actionables/${actionableId}/comments`, { credentials: 'include' });
        if (r2.ok && r2.headers.get('content-type')?.includes('application/json')) lista = ((await r2.json()).comments || []).map((c: any) => ({ id: c.id, text: c.text, created_at: c.created_at }));
      }
      setComments(lista.sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, [actionableId]);
  useEffect(() => { if (comments.length) fin.current?.scrollIntoView({ block: 'nearest' }); }, [comments.length]);

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/notion/actionables/${actionableId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ text: newText }) });
      if (res.ok) { setComments([...comments, { id: Date.now().toString(), text: `[ANDRES ${new Date().toISOString().slice(0, 10)}] ${newText}`, created_at: new Date().toISOString(), autor: 'andres' }]); setNewText(''); }
    } catch (err) { console.error(err); } finally { setSending(false); }
  };

  const parsed = comments.map(c => { const p = parsearComentario(String(c.text || '')); const actor = c.autor === 'andres' ? 'andres' : p.actor; return { ...c, actor, cuerpo: p.cuerpo || c.text }; });
  const agentes: string[] = Array.from(new Set<string>(parsed.filter(c => c.actor !== 'andres').map(c => String(c.actor))));

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-wider text-[#F5F7FA] opacity-70 uppercase flex items-center gap-2"><MessageSquare size={14} /> Conversación{parsed.length ? ` · ${parsed.length}` : ''}</h3>
        {agentes.length > 0 && <div className="flex items-center gap-1 text-[10px] text-[#F5F7FA] opacity-50"><span>participan</span><div className="flex -space-x-1">{agentes.map(a => <Avatar key={a} actor={a} chico />)}</div></div>}
      </div>
      <div className="space-y-2.5 mb-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
        {loading ? (
          <div className="text-xs text-[#F5F7FA] opacity-50 py-2">Cargando…</div>
        ) : parsed.length === 0 ? (
          <div className="text-xs text-[#F5F7FA] opacity-60 italic py-1">Nadie comentó todavía. Lo que escribas acá lo leen los agentes en su próxima corrida.</div>
        ) : parsed.map((c, i) => {
          const propio = c.actor === 'andres'; const act = actorDe(c.actor);
          const mismoAutor = i > 0 && parsed[i - 1].actor === c.actor && (new Date(c.created_at).getTime() - new Date(parsed[i - 1].created_at).getTime()) < 3600e3;
          return (
            <div key={c.id} className={`flex gap-2 ${propio ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 shrink-0">{!mismoAutor && <Avatar actor={c.actor} />}</div>
              <div className={`max-w-[88%] min-w-0 ${propio ? 'items-end' : ''}`}>
                {!mismoAutor && <div className={`text-[10px] mb-0.5 ${propio ? 'text-right' : ''}`}><span className="font-semibold text-[#EDEFF3]">{act.nombre}</span> <span className="text-[#F5F7FA] opacity-60">{haceCuanto(c.created_at)}{c.created_at ? ' · ' + new Date(c.created_at).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span></div>}
                <div className="px-3 py-2 rounded-xl text-xs text-[#F5F7FA] whitespace-pre-wrap leading-relaxed" style={{ backgroundColor: propio ? 'var(--primary-faint)' : 'var(--surface-2)', border: propio ? '1px solid rgba(0,98,204,0.35)' : '1px solid var(--border)', borderTopLeftRadius: propio || mismoAutor ? undefined : 4, borderTopRightRadius: propio && !mismoAutor ? 4 : undefined }}>
                  {c.cuerpo}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={fin} />
      </div>
      <form onSubmit={sendComment} className="flex gap-2 items-end">
        <textarea rows={2} placeholder="Respondé acá. Los agentes lo leen en su próxima corrida." value={newText} onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment(e as any); }}
          className="flex-1 bg-transparent px-3 py-2 rounded-lg text-xs text-[#EDEFF3] placeholder-[#F5F7FA]/30 focus:outline-none focus:border-[#0062CC] resize-none" style={{ border: '1px solid var(--border-strong)' }} />
        <button type="submit" disabled={sending || !newText.trim()} className="px-3 py-2 rounded-lg bg-[#0062CC] hover:opacity-90 disabled:opacity-40 text-[#EDEFF3] text-xs font-semibold flex items-center gap-1 transition-opacity shrink-0" title="Enviar (Cmd+Enter)"><Send size={12} /></button>
      </form>
    </div>
  );
}

export function ActionableDrawerContent({
  action,
  onActionChange,
  onNavigateToActionable,
  onNavigateToBrief,
  onNavigateToKeyword,
  onSiguiente,
  quedan
}: {
  action: Actionable;
  onActionChange?: (updated: Actionable) => void;
  onNavigateToActionable?: (actionId: string) => void;
  onNavigateToBrief?: (briefId: string) => void;
  onNavigateToKeyword?: (keyword: string) => void;
  /** Queue-advance: tras decidir, avanzar al próximo pendiente sin cerrar. */
  onSiguiente?: () => void;
  quedan?: number;
}) {
  const { updateActionableStatus, notionBriefs, actionables } = useAppStore();
  // Cambiar estado con lo que cada estado necesita: Descartado pide motivo, Hecho pone fecha
  const cambiarEstado = async (nuevo: string) => {
    if (nuevo === action.status) return;
    let extra: any = {};
    if (nuevo === 'Descartado') { const m = prompt('¿Por qué lo descartás? (queda en Decisión final; el sistema aprende de esto)', ''); if (m === null) return; extra.resolutionNote = m; }
    if (nuevo === 'Hecho') { const f = prompt('¿Cuándo lo ejecutaste? (aaaa-mm-dd)', new Date().toISOString().slice(0, 10)); if (f === null) return; extra.ejecutado_el = f; }
    if (nuevo === 'Propuesto' && action.status === 'Bloqueado') extra.confirmar_hipotesis = true;
    await fetch(`/api/notion/actionables/${action.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nuevo, ...extra }) });
    updateActionableStatus(action.id, nuevo);
    if (onActionChange) onActionChange({ ...action, status: nuevo });
  };
  const cambiarPrioridad = async (p: string) => {
    await fetch(`/api/notion/actionables/${action.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prioridad: p }) });
    if (onActionChange) onActionChange({ ...action, priority: p });
  };
  // Al abrir, marcar como leidas las novedades de este accionable
  useEffect(() => { fetch('/api/novedades/leer', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref_tipo: 'accionable', ref_id: action.id }) }).catch(() => {}); }, [action.id]);

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
  // El contexto fresco de la base: versiones, relaciones abiertas, bloqueos y la
  // acción estructurada VIGENTE. Es lo único que autoriza a escribir en Google Ads,
  // y por eso va sin caché (staleMs: 0): servirlo de una caché de 60 s sería
  // habilitar el botón con un dato de hace un minuto.
  const { data: contexto, error: errorContexto, cargando: cargandoContexto, refetch: recargarContexto } =
    useJSON<any>(`/api/accionables/${action.id}/contexto`, null, { staleMs: 0 });
  // Sin contexto confirmado no se ejecuta. Si la consulta falla, `accionActual`
  // cae a la acción de la lista, que puede estar vieja: aprobar desde ahí puede
  // aplicar en la cuenta un cambio que ya no corresponde, y una escritura en
  // Google Ads no se deshace sola. Cargando tampoco alcanza: todavía no se sabe.
  const contextoConfirmado = !cargandoContexto && !errorContexto;
  const resolverRelacion = async (id: number) => { await fetch(`/api/relaciones/${id}/resolver`, { method: 'POST', credentials: 'include' }); recargarContexto(); };
  const NOMBRE_CAMPO: Record<string, string> = { titulo: 'Título', por_que: 'Por qué', accion: 'Acción estructurada', entidad: 'Entidad', prioridad: 'Prioridad', estado: 'Estado', creado: 'Creado' };
  const [ejecutado, setEjecutado] = useState<string | null>(null);
  // Que tipo de accion automatica es, si alguna. Solo negativas y pausas.
  // Con accion estructurada, el tipo sale de ahi. Sin ella, se adivina del titulo (accionables viejos).
  // La accion estructurada fresca (de la base, al abrir) manda; la de la lista puede estar vieja; el titulo es el ultimo recurso
  const accionActual = contexto?.actual?.accion_valida ? contexto.actual.accion : action.accion;
  // Sin accion estructurada valida no hay boton: el servidor tampoco lo aceptaria. Mientras carga el contexto, tampoco.
  const tipoAuto = accionActual ? tipoAutoDesde(accionActual) : null;
  const esPregunta = accionActual?.verbo?.startsWith('preguntar');
  const entidadPartes = String(action.entidad || action.where || '').split('|').map(x => x.trim());
  // Verbos que operan sobre la campaña o el grupo entero: no llevan keyword y el
  // server resuelve el nombre exacto contra la base. Exigirles keyword acá era el
  // bug que dejaba el botón visible pero muerto para presupuesto, puja y pausas de campaña.
  const VERBOS_SIN_KEYWORD = ['pausar_anuncio', 'pausar_campana', 'reactivar_campana', 'cambiar_presupuesto', 'cambiar_objetivo_puja', 'cambiar_estrategia_puja', 'aplicar_etiqueta', 'pausar_grupo'];
  const aprobarYEjecutar = async (modo: 'simular' | 'ejecutar') => {
    if (!tipoAuto) return;
    // La guarda también acá y no solo en el render: el botón se oculta, pero un
    // clic disparado antes de que llegue la falla no tiene por qué colarse.
    if (!contextoConfirmado) { avisar('No se pudo confirmar el contexto de este accionable. Sin eso no se ejecuta: la acción de la lista puede estar vieja.', 'error'); return; }
    const lote: string[] | null = accionActual?.objeto?.keywords?.length ? accionActual.objeto.keywords : null;
    const kw = lote ? lote[0] : extraerKeyword(action.title, action.entidad || action.where);
    if (!kw && !VERBOS_SIN_KEYWORD.includes(tipoAuto)) { avisar('No pude identificar la keyword o término. Ejecutalo a mano con "Cómo hacerlo".', 'error'); return; }
    // Ejecutar de verdad frena UNA vez y muestra exactamente qué va a cambiar:
    // entidad, cuenta, y el antes→después si la acción lo trae. Simular no frena.
    if (modo === 'ejecutar') {
      const o = accionActual?.objeto || {};
      const p = accionActual?.parametros || {};
      const cambio = (p.valor_actual != null || o.valor_actual != null)
        ? `\n${p.valor_actual ?? o.valor_actual} → ${p.valor_nuevo ?? o.valor_nuevo ?? '(según acción)'}` : '';
      const detalle = [o.campana, o.grupo, lote ? `${lote.length} keywords` : (o.keyword || kw)].filter(Boolean).join(' › ');
      if (!confirm(`Aplicar en Google Ads (${action.client}):\n${(tipoAuto || '').replace(/_/g, ' ')} · ${detalle}${cambio}\n\nEl ejecutor lo hace dentro de la próxima hora. ¿Confirmás?`)) return;
    }
    setEjecutando(true);
    try {
      const r = await fetch(`/api/accionables/${action.id}/aprobar-ejecutar`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usar_accion: true, keywords: lote || undefined, account: action.client, tipo: tipoAuto, campana: entidadPartes[0] || '', grupo: entidadPartes[1] || '', keyword: kw, match_type: tipoAuto === 'cambiar_concordancia' ? 'ANY' : (/exact|exacta/.test(action.title.toLowerCase()) ? 'EXACT' : 'PHRASE'), match_type_destino: tipoAuto === 'cambiar_concordancia' ? concordanciaDestino(action.title) : undefined, modo }) });
      const j = await r.json();
      if (!r.ok) { avisar(j.error || 'Ocurrió un error', 'error'); if (j.conflicto) recargarContexto(); } else { setEjecutado(modo); if (j.avisos?.length) avisar(String(j.avisos.join(' · ')).slice(0, 300), 'info', 'Encolado con avisos'); }
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
    // Al avanzar al siguiente (queue-advance), el estado "encolado" es del anterior.
    setEjecutado(null);
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

  // La evidencia del término, acá adentro (informe 15): la mini-serie diaria
  // del texto exacto dentro de su alcance. El texto sale de la Accion
  // estructurada — el título es solo el fallback viejo. En lotes no hay una
  // evidencia única: para eso está Datos.
  const { moneda: monedaDe } = useCuentas();
  const monedaEv = monedaDe(action.client);
  const evTexto = (accionActual?.objeto?.keywords?.length || 0) > 1 ? null
    : (accionActual?.objeto?.keyword || possibleKeyword);
  // Radio de evidencia = radio de la acción: una negativa a nivel campaña se
  // mira en la campaña entera, no solo en el grupo donde apareció.
  const evCampana = accionActual?.objeto?.campana || '';
  const evGrupo = accionActual?.parametros?.nivel === 'campana' ? '' : (accionActual?.objeto?.grupo || '');
  const { data: evidencia, error: errorEvidencia, cargando: cargandoEvidencia, refetch: recargarEvidencia } = useJSON<any>(
    evTexto ? `/api/evidencia-termino?client=${encodeURIComponent(action.client)}&texto=${encodeURIComponent(evTexto)}${evCampana ? `&campana=${encodeURIComponent(evCampana)}` : ''}${evGrupo ? `&grupo=${encodeURIComponent(evGrupo)}` : ''}` : null,
    null
  );

  return (
    <div className="space-y-4 text-xs">
      {/* Top Metadata Badges */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#0062CC]/15 text-[#EDEFF3] border border-[#0062CC]/30">
            {action.client}
          </span>
          <select aria-label="Action" value={action.status} onChange={e => cambiarEstado(e.target.value)} title="Estado. Descartar pide el motivo; Hecho pone la fecha de hoy."
            className="px-2 py-0.5 rounded text-[11px] text-[#EDEFF3] bg-[#1A1F36] border border-[#0062CC]/30 cursor-pointer">
            {['Propuesto', 'Bloqueado', 'En curso', 'Hecho', 'Descartado'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Action" value={action.priority || 'Media'} onChange={e => cambiarPrioridad(e.target.value)} title="Prioridad"
            className="px-2 py-0.5 rounded text-[11px] text-[#F5F7FA] bg-[#1A1F36] border border-[#0062CC]/30 cursor-pointer">
            {['Urgente', 'Alta', 'Media', 'Baja'].map(p => <option key={p} value={p}>Prioridad: {p}</option>)}
          </select>
          {action.origen && action.origen !== 'Semanal' && (
            <span className="px-2 py-0.5 rounded text-[11px] text-[#F5F7FA] opacity-80" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }} title="Lo propuso un proceso automático; la tarea del lunes lo confirma o descarta">
              Propuesto por {action.origen === 'Pulso diario' ? 'el análisis diario' : action.origen === 'Anomalias' ? 'el detector de anomalías' : action.origen}
              {action.vence ? ` · vence ${action.vence.slice(5)}` : ''}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-[11px] ${
            isEnDisputa ? 'border-l-2 border-[#0062CC] font-semibold text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-70'
          }`} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {action.revision_ia || 'Sin revisar'}
          </span>
        </div>

        {/* Atajo: Hecho / volver a Propuesto */}
        <button
          onClick={() => cambiarEstado(isDone ? NOTION_STATES.PROPUESTO : NOTION_STATES.HECHO)}
          className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            isDone ? 'bg-white/15 text-[#EDEFF3]' : 'bg-[#0062CC] text-[#EDEFF3]'
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
          {isEnDisputa && <AlertCircle size={16} className="text-[#4D9DFF] shrink-0 mt-0.5" />}
          <h2 className="text-sm font-bold text-[#EDEFF3] leading-snug">
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




      {/* Si el contexto no llegó, todo lo que sigue es la foto vieja de la lista:
          sin versiones, sin relaciones abiertas y sin bloqueos. Decirlo una vez
          arriba vale más que dejar cada panel callado por su cuenta. */}
      {errorContexto && (
        <Fallo que="las versiones, relaciones y bloqueos de este accionable" motivo={errorContexto} onReintentar={() => recargarContexto()} />
      )}

      {/* Qué cambió desde que se propuso, y con qué se relaciona */}
      {contexto && (contexto.versiones?.length > 1 || contexto.relaciones?.length > 0) && (
        <div className="p-3.5 rounded-xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: contexto.bloqueo ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
          {contexto.bloqueo && (
            <div className="text-xs text-[#EDEFF3]"><span className="font-semibold">No se ejecuta todavía.</span> <span className="opacity-80">{contexto.bloqueo}</span></div>
          )}
          {contexto.relaciones?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">Relacionado con</span>
              {contexto.relaciones.map((r: any) => {
                const otro = r.a === action.id ? r.titulo_b : r.titulo_a;
                const verbo = r.tipo === 'conflicta_con' ? 'conflicta con' : r.tipo === 'depende_de' ? (r.a === action.id ? 'depende de' : 'lo necesita antes') : r.tipo === 'bloquea_keyword' ? 'bloquearía' : r.tipo === 'comparte_causa' ? 'misma causa que' : 'reemplaza';
                return (
                  <div key={r.id} className="px-2.5 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)', borderLeft: r.severidad === 'bloquea' ? '2px solid var(--primary)' : '2px solid transparent' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-[#F5F7FA]"><span className="opacity-60">{verbo}</span> <span className="text-[#EDEFF3]">{otro}</span></div>
                      {r.severidad === 'bloquea' && <button onClick={() => resolverRelacion(r.id)} className="text-[10px] text-[#F5F7FA] opacity-60 hover:opacity-100 shrink-0" title="Marcar como resuelto o deliberado">es deliberado</button>}
                    </div>
                    <div className="text-[11px] text-[#F5F7FA] opacity-60 mt-0.5">{r.motivo}</div>
                  </div>
                );
              })}
            </div>
          )}
          {contexto.versiones?.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">Qué cambió desde que se propuso · versión {contexto.actual?.version || contexto.versiones[0].version}</span>
              {contexto.versiones.filter((v: any) => v.version > 1).slice(0, 4).map((v: any) => (
                <div key={v.id} className="px-2.5 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div className="text-[10px] text-[#F5F7FA] opacity-50 tabular">v{v.version} · {String(v.fecha).slice(0, 16).replace('T', ' ')}{v.motivo ? ` · ${v.motivo}` : ''}</div>
                  {Object.entries(v.diff || {}).map(([campo, cambio]: any) => (
                    <div key={campo} className="text-[11px] mt-1">
                      <span className="text-[#EDEFF3]">{NOMBRE_CAMPO[campo] || campo}:</span>
                      {campo === 'accion' ? <span className="text-[#F5F7FA] opacity-70"> {cambio.antes?.verbo || '—'} → {cambio.despues?.verbo || '—'}{cambio.despues?.objeto?.keyword ? ` · ${cambio.despues.objeto.keyword}` : ''}</span>
                        : <span className="text-[#F5F7FA] opacity-70"> <s className="opacity-50">{String(cambio.antes ?? '—').slice(0, 120)}</s> → {String(cambio.despues ?? '—').slice(0, 160)}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Si es una pregunta, decirlo claro: no hay nada que tocar en Google Ads */}
      {esPregunta && (
        <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <span className="font-semibold text-[#EDEFF3] text-xs block mb-1">{accionActual.verbo === 'preguntar_cliente' ? `Pregunta para ${accionActual.parametros?.a_quien || 'el cliente'}` : 'Decisión tuya'}</span>
          <p className="text-xs text-[#F5F7FA] leading-relaxed">{accionActual.parametros?.pregunta}</p>
          {accionActual.parametros?.dato_que_falta && <p className="text-[11px] text-[#F5F7FA] opacity-60 mt-1">Lo que falta para decidir: {accionActual.parametros.dato_que_falta}</p>}
          <p className="text-[10px] text-[#F5F7FA] opacity-60 mt-2">No hay nada que tocar en Google Ads. Cuando tengas la respuesta, anotala en Decisión final y marcalo Hecho.</p>
        </div>
      )}
      {(contexto?.actual?.accion_error || (!contexto && action.accion_error)) && action.status !== 'Hecho' && action.status !== 'Descartado' && (() => {
        const err = String(contexto?.actual?.accion_error || action.accion_error);
        if (err.startsWith('INVARIANTE')) return (
          <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--primary)' }}>
            <span className="font-semibold text-[#EDEFF3] text-xs block mb-1">Viola una regla que no se negocia</span>
            {err.replace(/^INVARIANTE: /, '').split(' | ').map((m, i) => <p key={i} className="text-xs text-[#F5F7FA] leading-relaxed mb-1">{m}</p>)}
            <p className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">El sistema no lo ejecuta y no debería ejecutarse a mano. Descartalo o pedile a la tarea del lunes que lo reformule.</p>
          </div>
        );
        // "No ejecutable" no es "inválida": el JSON puede estar impecable, solo que no es un clic.
        // Para las preguntas ni hace falta cartel: el panel de pregunta ya lo dice mejor.
        if (err.startsWith('No ejecutable por script') || err.startsWith('Sin Accion JSON')) {
          if (esPregunta) return null;
          return (
            <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              <span className="font-semibold text-[#EDEFF3] text-xs block mb-1">Esto se hace a mano</span>
              <p className="text-xs text-[#F5F7FA] leading-relaxed">{err.replace(/^No ejecutable por script: /, '').replace(/ Se hace a mano con los pasos de "Como hacerlo"\.?$/, '')}</p>
              <p className="text-[10px] text-[#F5F7FA] opacity-50 mt-1">Los pasos están en "Cómo hacerlo". Cuando lo termines, anotá el resultado y marcalo Hecho.</p>
            </div>
          );
        }
        return <p className="text-[10px] text-[#F5F7FA] opacity-60 px-1">Este accionable no trae acción estructurada válida ({err}); el sistema no puede ejecutarlo solo. El del lunes va a venir con el estándar.</p>;
      })()}

      {/* Aprobar y ejecutar. "En curso" tampoco muestra botón: ya está encolado y
          apretarlo de nuevo duplicaría la acción (el server además lo rechaza). */}
      {tipoAuto && action.status !== 'Hecho' && action.status !== 'Descartado' && action.status !== 'En curso' && !contexto?.bloqueo && (
        <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          {ejecutado ? (
            <div className="space-y-2">
              <p className="text-xs text-[#F5F7FA]">{ejecutado === 'ejecutar' ? 'Aprobado. El script lo aplica en Google Ads dentro de la próxima hora y te lo marca Hecho.' : 'Simulación pedida. El script va a escribir qué haría, sin tocar la cuenta. Lo ves en Sistema › Ejecuciones.'}</p>
              {/* Queue-advance: la decisión tomada abre la siguiente, sin volver a la
                  lista (patrón Superhuman/Gmail). El botón, no automático: ves el
                  resultado y avanzás cuando querés. */}
              {onSiguiente && (quedan ?? 0) > 0 && (
                <button onClick={onSiguiente} autoFocus
                  className="w-full py-2 rounded-lg text-xs font-medium text-[#FAFAFA] hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                  style={{ border: '1px solid var(--border-strong)' }}>
                  Siguiente pendiente ({quedan}) →
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Ticket 49: los avisos de pre-vuelo que NO bloquean se muestran acá, antes de aprobar */}
              {contexto?.avisos?.length > 0 && (
                <div className="px-2.5 py-2 rounded-lg space-y-1" style={{ backgroundColor: 'var(--surface-2)', borderLeft: '2px solid #E8A13C' }}>
                  <span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">Avisos · no bloquean, pero miralos antes de aprobar</span>
                  {contexto.avisos.map((a: string, i: number) => (
                    <p key={i} className="text-[11px] text-[#F5F7FA] opacity-80 leading-relaxed">{a}</p>
                  ))}
                </div>
              )}
              {/* La descripción del cambio sale de `accionActual`, que sin
                  contexto confirmado es la de la lista: el antes→después que
                  imprimiría puede no ser el vigente. Mejor no decir nada. */}
              {contextoConfirmado && <p className="text-xs text-[#F5F7FA] opacity-80">{(() => {
                const p = accionActual?.parametros || {};
                const camp = accionActual?.objeto?.campana || '';
                if (tipoAuto === 'cambiar_concordancia') return 'Esto es un cambio de concordancia: el sistema crea la keyword con la nueva y pausa la anterior, así se puede deshacer. Smart Bidding reaprende unos días.';
                if (tipoAuto === 'cambiar_presupuesto') return `Cambia el presupuesto de ${camp} de ${p.valor_actual} a ${p.valor_nuevo}. El valor anterior queda guardado en la cola para poder revertir.`;
                if (tipoAuto === 'cambiar_objetivo_puja') return p.valor_nuevo == null ? `Quita el objetivo de puja de ${camp} (hoy ${p.valor_actual}). El valor anterior queda guardado para revertir.` : `Cambia el objetivo de puja de ${camp} de ${p.valor_actual} a ${p.valor_nuevo}. El valor anterior queda guardado para revertir. Smart Bidding reaprende unos días.`;
                if (tipoAuto === 'cambiar_estrategia_puja') return `Cambia la estrategia de puja de ${camp} a ${p.estrategia_destino}. La estrategia actual queda registrada para revertir. Smart Bidding reaprende unos días.`;
                if (tipoAuto === 'cambiar_cpc_keyword') return `Cambia el CPC máximo de ${p.valor_actual} a ${p.valor_nuevo}. El valor anterior queda guardado para revertir.`;
                if (tipoAuto === 'pausar_campana') return `Pausa la campaña ${camp} entera. Se revierte reactivándola, sin pérdida de historial.`;
                if (tipoAuto === 'reactivar_campana') return `Reactiva la campaña ${camp}. Se revierte pausándola de nuevo.`;
                if (tipoAuto === 'pausar_grupo') return `Pausa el grupo entero. Se revierte reactivándolo, sin pérdida de historial.`;
                if (tipoAuto === 'aplicar_etiqueta') return `Etiqueta ${camp} como "${p.etiqueta}". No cambia la entrega: es organización.`;
                if (accionActual?.objeto?.keywords?.length > 1) return `Son ${accionActual.objeto.keywords.length} ${tipoAuto.startsWith('negativa') ? 'negativas' : 'pausas'} en lote: se pueden deshacer una por una, y el script reporta cada una.`;
                return `Esto es una ${tipoAuto.startsWith('negativa') ? 'negativa' : 'pausa'}: se puede deshacer, así que el sistema puede aplicarla por vos.`;
              })()} Un script lo ejecuta dentro de la próxima hora.</p>}
              {/* Los botones existen solo con el contexto confirmado. Mientras
                  carga, y sobre todo si la consulta falló, lo que se ve acá es
                  por qué NO se puede aprobar — no un botón que promete que sí. */}
              {cargandoContexto ? (
                <p className="text-[11px] text-[#F5F7FA] opacity-50">Confirmando contra la base qué dice hoy este accionable…</p>
              ) : errorContexto ? (
                <Fallo que="el contexto actualizado de este accionable" motivo={errorContexto} onReintentar={() => recargarContexto()} />
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => aprobarYEjecutar('ejecutar')} disabled={ejecutando} className="px-3 py-1.5 rounded-lg text-xs bg-[#0062CC] text-[#EDEFF3] disabled:opacity-40">{ejecutando ? 'Enviando…' : 'Aprobar y que se haga'}</button>
                  <button onClick={() => aprobarYEjecutar('simular')} disabled={ejecutando} className="px-3 py-1.5 rounded-lg text-xs text-[#F5F7FA]" style={{ border: '1px solid var(--border)' }}>Solo simular</button>
                </div>
              )}
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
            <span className="font-semibold text-[#EDEFF3] text-xs block">Cómo hacerlo{rec ? ` · ${rec.titulo}` : ''}</span>
            <ol className="space-y-1.5 pl-1">
              {pasos.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-[#F5F7FA] leading-relaxed">
                  <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold tabular" style={{ backgroundColor: 'var(--surface-2)', color: '#FFFFFF' }}>{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
            {rec?.nota && <p className="text-[11px] text-[#F5F7FA] opacity-60 pt-1 leading-relaxed">{rec.nota}</p>}
            {!propio && rec && <p className="text-[10px] text-[#F5F7FA] opacity-60">Pasos genéricos para este tipo de acción. Los accionables nuevos traen los suyos.</p>}
          </div>
        );
      })()}

      {/* Criterio / Disputa / Hipótesis alert */}
      {action.punto_disputa && (
        <div 
          className="p-3 rounded-xl space-y-1.5"
          style={{ backgroundColor: 'var(--surface-2)', borderLeft: '2px solid var(--primary)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EDEFF3]">
            <ShieldAlert size={14} className="text-[#4D9DFF]" />
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
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EDEFF3]">
              <Clock size={13} className="text-[#F5F7FA] opacity-70" />
              <span>Esperando tu confirmación</span>
            </div>
            <p className="text-[11px] text-[#F5F7FA] opacity-70">
              {action.que_lo_confirmaria || 'Es una deducción, no un dato visto. Confirmá si tiene sentido antes de ejecutarla.'}
            </p>
          </div>
          <button
            onClick={handleConfirmHypothesis}
            className="px-3 py-1 bg-[#0062CC] hover:opacity-90 text-[#EDEFF3] rounded-md text-xs font-semibold shrink-0"
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
          <span className="font-semibold text-[#EDEFF3] text-xs uppercase tracking-wider">
            Registrá lo que hiciste
          </span>
          {savedSuccess && (
            <span className="text-[11px] font-medium text-[#EDEFF3] flex items-center gap-1">
              <Check size={12} /> Guardado
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
              Naturaleza
            </label>
            <select aria-label="Naturaleza"
              value={naturaleza}
              onChange={(e) => setNaturaleza(e.target.value as any)}
              className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#EDEFF3] outline-none"
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
            <input aria-label="Ejecutado El"
              type="date"
              value={ejecutadoEl}
              onChange={(e) => setEjecutadoEl(e.target.value)}
              className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#EDEFF3] outline-none tabular"
              style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
            Qué lo confirmaría / resolvería
          </label>
          <input aria-label="Que Lo Confirmaria"
            type="text"
            value={queLoConfirmaria}
            onChange={(e) => setQueLoConfirmaria(e.target.value)}
            placeholder="Ej: Si el CPA de betreuung se mantiene bajo 45€..."
            className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#EDEFF3] placeholder-[#F5F7FA]/30 outline-none"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
            Causa Raíz
          </label>
          <input aria-label="Causa Raiz"
            type="text"
            value={causaRaiz}
            onChange={(e) => setCausaRaiz(e.target.value)}
            placeholder="Ej: Cambio en presupuesto de campaña Search..."
            className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#EDEFF3] placeholder-[#F5F7FA]/30 outline-none"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
            Resultado Observado
          </label>
          <textarea aria-label="Resultado Observado"
            value={resultadoObservado}
            onChange={(e) => setResultadoObservado(e.target.value)}
            placeholder="Impacto en conversiones, CPA o tráfico tras la ejecución..."
            rows={2}
            className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-xs text-[#EDEFF3] placeholder-[#F5F7FA]/30 outline-none"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveTracking}
            disabled={savingDetails}
            className="px-3.5 py-1.5 rounded-md bg-[#0062CC] hover:opacity-90 disabled:opacity-50 text-[#EDEFF3] text-xs font-semibold transition-opacity"
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
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EDEFF3]">
            <Cpu size={14} className="text-[#4D9DFF]" />
            <span>Auditoría de 2da Opinión Gemini</span>
          </div>
          <p className="text-[11px] text-[#F5F7FA] opacity-65">
            Analiza el accionable contra el modelo base y detecta controversias
          </p>
        </div>
        <button aria-label="Analizar con IA" title="Analizar con IA"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-3 py-1.5 rounded-md bg-[#0062CC] hover:opacity-90 disabled:opacity-50 text-[#EDEFF3] text-xs font-semibold shrink-0 flex items-center gap-1"
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
            <span className="font-semibold text-[#EDEFF3]">Resultado: {geminiResult.consenso}</span>
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
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EDEFF3]">
            <History size={14} />
            <span>Registro Manual de Cambios</span>
          </div>
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="text-xs text-[#4D9DFF] hover:underline font-semibold"
          >
            {showLogForm ? 'Cancelar' : '+ Registrar Cambio'}
          </button>
        </div>

        {showLogForm && (
          <form onSubmit={handleSubmitOperatorLog} className="pt-2 space-y-2.5">
            {logSuccess && (
              <div className="text-[11px] text-[#EDEFF3] flex items-center gap-1">
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
                className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#EDEFF3] outline-none"
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
                  className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#EDEFF3] outline-none tabular"
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
                  className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#EDEFF3] outline-none tabular"
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
                className="w-full bg-transparent rounded px-2.5 py-1 text-xs text-[#EDEFF3] outline-none"
                style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingLog || !logQueCambio.trim()}
                className="px-3 py-1 bg-[#0062CC] text-[#EDEFF3] rounded text-xs font-semibold disabled:opacity-50"
              >
                {savingLog ? 'Guardando...' : 'Guardar en Bitácora'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* La evidencia embebida: qué hizo este texto, sin salir del drawer.
          Datos queda para exploración; la métrica de éxito del informe 15 es
          "mañanas con cero clics de sidebar". */}
      {evTexto && (
        <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold text-[#EDEFF3] text-xs uppercase tracking-wider">La evidencia, acá</span>
            {evidencia?.capa && (
              <span className="text-[10px] text-[#F5F7FA] opacity-50">
                “{evTexto}” {evidencia.capa === 'keyword' ? 'como keyword' : 'como término de búsqueda'}{evGrupo ? ` · en ${evGrupo}` : evCampana ? ` · en ${evCampana}` : ''}
              </span>
            )}
          </div>
          {/* Tres huecos distintos, no uno: todavía consultando, no se pudo
              consultar, o se consultó y la capa diaria no tiene filas. Antes los
              tres decían "Consultando…" y el segundo se quedaba ahí para siempre. */}
          {cargandoEvidencia ? (
            <p className="text-[11px] text-[#F5F7FA] opacity-60">Consultando la capa diaria…</p>
          ) : errorEvidencia ? (
            <Fallo que="la evidencia de la capa diaria" motivo={errorEvidencia} onReintentar={() => recargarEvidencia()} />
          ) : !evidencia?.capa ? (
            <p className="text-[11px] text-[#F5F7FA] opacity-60 leading-relaxed">
              Sin filas en la capa diaria (~17 días) para “{evTexto}” en este alcance. No es cero: puede haber gastado antes de la ventana — el histórico completo está en Datos.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular text-[#EDEFF3]">
                {/* .50 sobre #EDEFF3 da 4,42:1 en surface-1: se queda corto por poco, que
                    es la peor forma de quedarse corto. .60 lo lleva a 5,70:1 y la etiqueta
                    sigue leyéndose como etiqueta al lado de la cifra. */}
                <span>{fmtMoneda(evidencia.totales.cost, monedaEv)} <span className="opacity-60">gastó</span></span>
                <span>{evidencia.totales.clicks} <span className="opacity-60">clics</span></span>
                <span>{Number(evidencia.totales.conversions).toLocaleString('es-AR', { maximumFractionDigits: 1 })} <span className="opacity-60">conv</span></span>
                {/* CPA solo con conversiones: con cero, el CPA es null, no un número */}
                {Number(evidencia.totales.conversions) > 0 && (
                  <span>{fmtMoneda(evidencia.totales.cost / Number(evidencia.totales.conversions), monedaEv)} <span className="opacity-60">CPA</span></span>
                )}
                <span className="opacity-60">en {evidencia.dias} día{evidencia.dias !== 1 ? 's' : ''} con actividad</span>
              </div>
              {evidencia.serie.length > 0 && (
                <table className="w-full text-[11px] tabular">
                  {/* El .50 de la fila multiplicaba al .30 del punto: 0,15 efectivo
                      = 1,58:1. Además el castigo iba al revés — el día que todavía
                      madura es el que más se mira, y era el que peor se leía. .75 deja
                      la marca de provisional (que además está en el ' ·' de la fecha y
                      en la nota de abajo) sin hundir ninguna celda: el piso de la fila
                      queda en 4,97:1 sobre surface-1. */}
                  <tbody>
                    {evidencia.serie.slice(-8).map((d: any) => (
                      <tr key={d.date} className={d.madurez === 'provisional' ? 'opacity-75' : ''} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="py-1 pr-2 text-[#F5F7FA] opacity-70">{fmtFechaCorta(d.date)}{d.madurez === 'provisional' ? ' ·' : ''}</td>
                        <td className="py-1 px-2 text-right text-[#EDEFF3]">{fmtMoneda(d.cost, monedaEv)}</td>
                        <td className="py-1 px-2 text-right text-[#F5F7FA] opacity-80">{d.clicks} clic{d.clicks !== 1 ? 's' : ''}</td>
                        <td className="py-1 pl-2 text-right">{Number(d.conversions) > 0 ? <span className="text-[#EDEFF3] font-semibold">{Number(d.conversions).toLocaleString('es-AR', { maximumFractionDigits: 1 })} conv</span> : <span className="text-[#F5F7FA] opacity-70">·</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-[10px] text-[#F5F7FA] opacity-60">
                {evidencia.serie.length > 8 ? `Últimos 8 de ${evidencia.serie.length} días con actividad · ` : ''}los días con · siguen madurando · ventana diaria ~17 días.
              </p>
            </>
          )}
        </div>
      )}

      {/* Navigation Outlets */}
      <div
        className="p-3.5 rounded-xl space-y-2"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <span className="font-semibold text-[#EDEFF3] text-xs uppercase tracking-wider block">
          Ver más
        </span>
        <div className="flex flex-wrap gap-2 pt-1">
          {action.brief_id && onNavigateToBrief && (
            <button
              onClick={() => onNavigateToBrief(action.brief_id!)}
              className="px-2.5 py-1 rounded text-xs font-medium text-[#EDEFF3] hover:bg-white/10 flex items-center gap-1"
              style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
            >
              <ExternalLink size={12} />
              <span>Ver el brief donde apareció</span>
            </button>
          )}

          {possibleKeyword && onNavigateToKeyword && (
            <button
              onClick={() => onNavigateToKeyword(possibleKeyword)}
              className="px-2.5 py-1 rounded text-xs font-medium text-[#EDEFF3] hover:bg-white/10 flex items-center gap-1"
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
                  className="w-full text-left p-2 rounded text-xs text-[#F5F7FA] hover:text-[#EDEFF3] transition-colors flex items-center justify-between"
                  style={{ backgroundColor: 'var(--surface-2)' }}
                >
                  <span className="truncate pr-2">{ra.title}</span>
                  <ArrowRight size={12} className="shrink-0 text-[#4D9DFF]" />
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
