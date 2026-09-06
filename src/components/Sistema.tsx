import React, { useState, useEffect } from 'react';
import { 
  Activity, Check, AlertCircle, Clock, ShieldCheck, 
  RefreshCw, History, Send, Settings2, Sliders, Database, Save 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function Sistema() {
  const { selectedClient } = useAppStore();
  const [healthData, setHealthData] = useState<any>(null);
  const [aprendizaje, setAprendizaje] = useState<any>({ impacto: [], tasa_acierto: [], reflexiones: [], propuestas: [] });
  const [tamano, setTamano] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/aprendizaje', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setAprendizaje(d)).catch(() => {});
    fetch('/api/salud-sistema', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setTamano(d)).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);

  // Tab: 'salud' | 'integridad' | 'scorecard' | 'cambios' | 'bitacora' | 'ajustes'
  // Cuatro grupos en vez de doce pestañas. Cada grupo apila los bloques que antes eran pestañas.
  const GRUPOS: { id: string; label: string; tabs: string[]; ayuda: string }[] = [
    { id: 'salud', label: 'Salud', tabs: ['salud', 'integridad', 'tamano'], ayuda: 'Si los datos están al día y cuadran' },
    { id: 'aprendizaje', label: 'Aprendizaje', tabs: ['scorecard', 'aprendizaje', 'coherencia'], ayuda: 'Qué tan bien analiza el sistema y cómo se corrige' },
    { id: 'automatizacion', label: 'Automatización', tabs: ['alertas', 'ejecuciones', 'cambios'], ayuda: 'Alertas, ejecuciones aprobadas, cambios de configuración' },
    { id: 'soporte', label: 'Soporte', tabs: ['tickets', 'bitacora', 'ajustes'], ayuda: 'Tickets para Claude, tu bitácora, ajustes' },
  ];
  const [grupo, setGrupo] = useState<string>('salud');
  const enGrupo = (tab: string) => (GRUPOS.find(g => g.id === grupo)?.tabs || []).includes(tab);
  const [activeTab, setActiveTab] = useState<'salud' | 'integridad' | 'scorecard' | 'aprendizaje' | 'tamano' | 'cambios' | 'bitacora' | 'ajustes' | 'alertas' | 'tickets' | 'coherencia' | 'ejecuciones'>('salud');
  const [ejecuciones, setEjecuciones] = useState<any[]>([]);
  const [coherencia, setCoherencia] = useState<any>({ escritores: [], reconciliaciones: [] });
  const [alertas, setAlertas] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/alertas', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setAlertas(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/tickets', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setTickets(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/coherencia', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setCoherencia(d)).catch(() => {});
    fetch('/api/acciones-aprobadas', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setEjecuciones(Array.isArray(d) ? d : [])).catch(() => {});
  }, [grupo]);
  const accionAlerta = async (id: number, accion: string, extra: any = {}) => { await fetch(`/api/alertas/${id}/${accion}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extra) }); setActiveTab(t => t); const r = await fetch('/api/alertas', { credentials: 'include' }); if (r.ok) setAlertas(await r.json()); };

  // Operator log form state
  const [logAccount, setLogAccount] = useState('360');
  const [logQueCambio, setLogQueCambio] = useState('');
  const [logDonde, setLogDonde] = useState('');
  const [logValorAnt, setLogValorAnt] = useState('');
  const [logValorNuevo, setLogValorNuevo] = useState('');
  const [logPorQue, setLogPorQue] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Scorecard editable revisions
  const [revisions, setRevisions] = useState<Record<string, string>>({});
  const [savingRevisionId, setSavingRevisionId] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/health/system', { credentials: 'include', headers });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      setHealthData(data);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleSaveRevision = async (id: string) => {
    setSavingRevisionId(id);
    try {
      await fetch(`/api/health/run_quality/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ revision_humana: revisions[id] })
      });
      fetchHealth();
    } catch(err) {
      console.error(err);
    } finally {
      setSavingRevisionId(null);
    }
  };

  const handleSubmitOperatorLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logQueCambio.trim()) return;
    setSavingLog(true);
    try {
      const res = await fetch('/api/operator_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          account: logAccount,
          que_cambio: logQueCambio,
          donde: logDonde,
          valor_anterior: logValorAnt || null,
          valor_nuevo: logValorNuevo || null,
          por_que: logPorQue || null
        })
      });
      const d = await res.json();
      if (d.success) {
        setLogSuccess(true);
        setLogQueCambio('');
        setLogDonde('');
        setLogValorAnt('');
        setLogValorNuevo('');
        setLogPorQue('');
        setTimeout(() => setLogSuccess(false), 2000);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setSavingLog(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">
            Sistema & Auditoría Técnica
          </h1>
          <p className="text-xs text-[#F5F7FA] opacity-70 mt-0.5">
            ¿Está funcionando? Diagnóstico de salud, integridad, calidad de corridas y bitácora de cambios
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="px-3 py-1.5 rounded text-xs font-semibold text-[#FFFFFF] hover:bg-white/10 flex items-center gap-1.5 transition-colors shrink-0"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-[#0062CC]' : ''} />
          <span>Actualizar Estado</span>
        </button>
      </div>

      {/* Cuatro grupos */}
      <div className="flex gap-1 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {GRUPOS.map(g => {
          const n = g.id === 'automatizacion' ? alertas.length + ejecuciones.filter((e: any) => e.estado === 'pendiente').length : g.id === 'soporte' ? tickets.filter((t: any) => t.estado === 'abierto').length : 0;
          return (
            <button key={g.id} onClick={() => setGrupo(g.id)} title={g.ayuda} className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors ${grupo === g.id ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'}`}>
              {g.label}{n > 0 ? <span className="ml-1.5 text-[10px] opacity-70">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {/* TAB: EJECUCIONES */}
      {enGrupo('ejecuciones') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Lo que aprobaste para que el sistema ejecute</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Negativas y pausas, que se pueden deshacer. Un script de Google Ads las lee cada hora. En simulación escribe qué haría; en real lo aplica y marca Hecho.</p>
          </div>
          {ejecuciones.length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Ninguna todavía. Aparecen cuando aprobás una negativa o una pausa desde el accionable.</p> : (
            <div className="space-y-1">
              {ejecuciones.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0 w-24">{String(e.aprobada_el).slice(5, 16).replace('T', ' ')}</span>
                  <span className={`text-[10px] uppercase tracking-wider shrink-0 w-20 ${e.estado === 'ejecutada' ? 'text-[#FFFFFF]' : e.estado === 'fallida' ? 'text-[#0062CC]' : 'text-[#F5F7FA] opacity-60'}`}>{e.estado}{e.modo === 'simular' ? ' (sim)' : ''}</span>
                  <span className="text-[#F5F7FA] flex-1">{e.account} · {e.tipo.replace('_', ' ')} · <span className="text-[#FFFFFF]">{e.keyword || e.ad_id}</span> en {e.campana}{e.grupo ? ` › ${e.grupo}` : ''}</span>
                  {e.resultado && <span className="text-[10px] text-[#F5F7FA] opacity-50 max-w-[260px] truncate" title={e.resultado}>{e.resultado}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: COHERENCIA */}
      {enGrupo('coherencia') && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px] font-medium text-[#FFFFFF]">Quién es dueño de qué</h2>
              <p className="text-xs text-[#F5F7FA] opacity-60">Cada cosa tiene un solo escritor. Los demás proponen, y lo que proponen nace bloqueado con vencimiento hasta que el dueño lo confirme. Así ninguno pisa lo que escribió otro.</p>
            </div>
            <div className="space-y-1">
              {(coherencia.escritores || []).map((e: any) => (
                <div key={e.entidad} className="grid grid-cols-[160px_110px_1fr] gap-3 items-start px-2.5 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <span className="text-[#FFFFFF] font-medium">{e.entidad.replace(/_/g, ' ')}</span>
                  <span className="text-[#F5F7FA] opacity-80">{e.dueno}{e.proponen?.length ? <span className="opacity-50"> · proponen: {e.proponen.join(', ')}</span> : ''}</span>
                  <span className="text-[11px] text-[#F5F7FA] opacity-60 leading-relaxed">{e.regla}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px] font-medium text-[#FFFFFF]">Lo que el reconciliador corrigió</h2>
              <p className="text-xs text-[#F5F7FA] opacity-60">Cada día a las 6:35 compara lo que cada proceso escribió. Vence lo que nadie tocó en siete días, marca duplicados por entidad, avisa si algo propuesto ya se hizo en Google Ads, y cierra alertas cuya condición cesó. Sin modelo: reglas.</p>
            </div>
            {(coherencia.reconciliaciones || []).length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Nada que corregir todavía. Corre por primera vez mañana.</p> : (
              <div className="space-y-1">
                {coherencia.reconciliaciones.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 px-2.5 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0 w-24">{String(r.corrida).slice(5, 16).replace('T', ' ')}</span>
                    <span className="text-[10px] uppercase tracking-wider shrink-0 w-24 text-[#F5F7FA] opacity-70">{r.accion.replace('_', ' ')}</span>
                    <span className="text-[#F5F7FA] opacity-80 flex-1">{r.account ? <span className="text-[#FFFFFF]">{r.account} · </span> : ''}{r.detalle}</span>
                    <span className={`text-[10px] shrink-0 ${r.aplicada ? 'text-[#F5F7FA] opacity-50' : 'text-[#0062CC]'}`}>{r.aplicada ? 'aplicada' : 'pendiente'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ALERTAS */}
      {enGrupo('alertas') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Alertas</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Una alerta existe solo si hay algo concreto que hacer. Tres niveles: pide acción hoy, para mirar esta semana, y las de fondo que no avisan. Silenciar registra por qué y hasta cuándo.</p>
          </div>
          {alertas.length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Sin alertas abiertas. Se generan cada 4 horas desde el centinela, la integridad de datos y el plan de la semana.</p> : (
            <div className="space-y-1.5">
              {alertas.map((a: any) => (
                <div key={a.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-2)', borderLeft: a.nivel === 'hoy' ? '2px solid var(--primary)' : a.nivel === 'semana' ? '2px solid var(--border-strong)' : '2px solid transparent' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">{a.nivel === 'hoy' ? 'Hoy' : a.nivel === 'semana' ? 'Esta semana' : 'De fondo'}</span>
                        <span className="text-[10px] text-[#F5F7FA] opacity-40">{a.account || 'Sistema'} · {a.origen}</span>
                      </div>
                      <div className="text-xs text-[#FFFFFF] font-medium mt-0.5">{a.titulo}</div>
                      {a.detalle && <div className="text-[11px] text-[#F5F7FA] opacity-70">{a.detalle}</div>}
                      {a.accion && <div className="text-[11px] text-[#F5F7FA] mt-1"><span className="opacity-60">Qué hacer:</span> {a.accion}</div>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => accionAlerta(a.id, 'resolver')} className="px-2 py-0.5 rounded text-[10px] bg-[#0062CC] text-[#FFFFFF]">Resuelta</button>
                      <button onClick={() => { const pq = prompt('¿Por qué la silenciás? (queda registrado)'); if (pq !== null) accionAlerta(a.id, 'silenciar', { dias: 7, por_que: pq }); }} className="px-2 py-0.5 rounded text-[10px] text-[#F5F7FA] opacity-60 hover:opacity-100" style={{ border: '1px solid var(--border)' }}>Silenciar 7d</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: TICKETS */}
      {enGrupo('tickets') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">Tickets para Claude</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">Lo que reportaste desde el botón de abajo a la derecha. Claude los lee al empezar cada sesión de trabajo y responde acá o los resuelve en el siguiente fix.</p>
          </div>
          {tickets.length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Ningún ticket todavía.</p> : (
            <div className="space-y-1.5">
              {tickets.map((t: any) => (
                <div key={t.id} className={`p-3 rounded-lg ${t.estado === 'resuelto' ? 'opacity-60' : ''}`} style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 text-[10px] text-[#F5F7FA] opacity-50">
                    <span className="tabular">#{t.id}</span><span>{String(t.creado).slice(0, 16).replace('T', ' ')}</span><span>{t.pagina}{t.cuenta ? ` · ${t.cuenta}` : ''}</span>
                    <span className={`ml-auto uppercase tracking-wider ${t.estado === 'abierto' ? 'text-[#0062CC]' : ''}`}>{t.estado.replace('_', ' ')}</span>
                  </div>
                  <div className="text-xs text-[#FFFFFF] font-medium mt-0.5">{t.titulo}</div>
                  {t.descripcion && <div className="text-[11px] text-[#F5F7FA] opacity-70 whitespace-pre-wrap">{t.descripcion}</div>}
                  {t.respuesta && <div className="text-[11px] text-[#F5F7FA] mt-1.5 pl-2" style={{ borderLeft: '2px solid var(--primary)' }}><span className="opacity-60">Claude:</span> {t.respuesta}{t.resuelto_en_version ? <span className="opacity-50"> · {t.resuelto_en_version}</span> : ''}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: SALUD DE DATOS */}
      {enGrupo('salud') && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Datos por cuenta
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Cuenta</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Estado</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Último día con datos</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Última extracción</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {(healthData?.dataHealth || []).map((row: any, i: number) => {
                    const isOk = row.estado === 'OK';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-bold text-[#FFFFFF]">
                          {row.account}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isOk ? 'bg-white/10 text-[#FFFFFF]' : 'border-l-2 border-[#0062CC] bg-[#0062CC]/15 text-[#FFFFFF]'
                          }`}>
                            {isOk ? <Check size={12} /> : <AlertCircle size={12} className="text-[#0062CC]" />}
                            <span>{row.estado || 'OK'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 tabular text-[#F5F7FA] opacity-80">
                          {row.ultimo_dia_datos || row.ultimo_dia || '—'}
                        </td>
                        <td className="py-2.5 px-3 tabular text-[#F5F7FA] opacity-80">
                          {row.ultima_sincronizacion || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[#F5F7FA] opacity-70">
                          {row.motivo || row.detalle || 'Sincronización al día'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Webhook health */}
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Webhooks & Eventos de Ingesta
            </h2>
            <div className="space-y-2 text-xs">
              {(healthData?.webhookHealth || []).map((w: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <div className="font-semibold text-[#FFFFFF]">{w.servicio || w.endpoint || 'Webhook Ingest'}</div>
                    <div className="text-[11px] text-[#F5F7FA] opacity-60">Último disparo: {w.ultimo_disparo || 'reciente'}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-[#FFFFFF]">
                    {w.estado || 'Activo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTEGRIDAD DE DATOS */}
      {enGrupo('integridad') && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Integridad de datos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Cuenta</th>
                  <th className="py-2.5 px-3 font-semibold text-[#FFFFFF] text-right">Filas Campañas</th>
                  <th className="py-2.5 px-3 font-semibold text-[#FFFFFF] text-right">Filas Keywords</th>
                  <th className="py-2.5 px-3 font-semibold text-[#FFFFFF] text-right">Filas Search Terms</th>
                  <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Integridad</th>
                </tr>
              </thead>
              <tbody>
                {(healthData?.integridadDatos || []).map((r: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                    <td className="py-2.5 px-3 font-bold text-[#FFFFFF]">{r.account}</td>
                    <td className="py-2.5 px-3 text-right tabular text-[#F5F7FA] opacity-80">{r.campanas_count || r.filas_campanas || 0}</td>
                    <td className="py-2.5 px-3 text-right tabular text-[#F5F7FA] opacity-80">{r.keywords_count || r.filas_keywords || 0}</td>
                    <td className="py-2.5 px-3 text-right tabular text-[#F5F7FA] opacity-80">{r.search_terms_count || r.filas_search_terms || 0}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-[#FFFFFF]">
                        {r.estado || 'Consistente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RUN SCORECARD */}
      {enGrupo('scorecard') && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Calidad de cada análisis semanal
            </h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">
              Puntuación sobre 15 puntos, fallos detectados y campo editable de revisión humana
            </p>
          </div>

          <div className="space-y-3">
            {(healthData?.runScorecard || []).map((run: any, idx: number) => {
              const runKey = `scorecard-${run.id || run.run_date || 'date'}-${run.account || 'all'}-${idx}`;
              const revisionId = run.id || run.run_date || `run-${idx}`;
              return (
                <div 
                  key={runKey}
                  className="p-4 rounded-xl space-y-2 text-xs"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#FFFFFF] tabular">
                        {run.run_date}
                      </span>
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-[#0062CC] text-[#FFFFFF] tabular">
                        {run.score || run.puntuacion || 15} / 15 pts
                      </span>
                    </div>
                    <span className="text-[11px] text-[#F5F7FA] opacity-60">
                      Cuenta: {run.account || 'Todas'}
                    </span>
                  </div>

                  {run.que_fallo && (
                    <div className="text-xs text-[#FFFFFF] p-2 rounded" style={{ backgroundColor: 'var(--surface-1)', borderLeft: '2px solid var(--primary)' }}>
                      <span className="font-semibold">Qué falló: </span> {run.que_fallo}
                    </div>
                  )}

                  {/* Inline editable revision humana */}
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nota de revisión humana de Andrés..."
                      value={revisions[revisionId] !== undefined ? revisions[revisionId] : (run.revision_humana || '')}
                      onChange={e => setRevisions({ ...revisions, [revisionId]: e.target.value })}
                      className="flex-1 bg-transparent rounded px-3 py-1.5 text-xs text-[#FFFFFF] placeholder-[#F5F7FA]/30 outline-none"
                      style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-1)' }}
                    />
                    <button
                      onClick={() => handleSaveRevision(revisionId)}
                      disabled={savingRevisionId === revisionId}
                      className="px-3 py-1.5 bg-[#0062CC] text-[#FFFFFF] rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <Save size={12} />
                      <span>{savingRevisionId === revisionId ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CAMBIOS DETECTADOS */}
      {enGrupo('cambios') && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Cambios de configuración detectados
          </h2>

          <div className="space-y-2 text-xs">
            {(healthData?.cambiosDetectados || []).map((ch: any, idx: number) => (
              <div 
                key={idx}
                className="p-3 rounded-xl flex items-center justify-between gap-3"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="tabular text-[#F5F7FA] opacity-60 text-[11px]">{ch.fecha_actual || 'Reciente'}</span>
                    <span className="font-semibold text-[#FFFFFF]">{ch.cuenta || ch.account}</span>
                    <span className="text-[#F5F7FA] opacity-80 truncate">{ch.entidad || ch.campaign}</span>
                  </div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-70">
                    {ch.tipo_cambio || 'Ajuste de configuración'} · {ch.campo}: {ch.valor_anterior} → {ch.valor_nuevo}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: BITÁCORA DEL OPERADOR */}
      {enGrupo('bitacora') && (
        <div className="p-5 rounded-2xl space-y-5" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Registro Manual en Bitácora (operator_log)
            </h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">
              Registre cambios directos realizados en Google Ads para correlacionar con variaciones de métricas
            </p>
          </div>

          <form onSubmit={handleSubmitOperatorLog} className="space-y-3 max-w-xl text-xs">
            {logSuccess && (
              <div className="p-3 rounded bg-white/10 text-[#FFFFFF] flex items-center gap-2 font-medium">
                <Check size={14} /> Cambio registrado con éxito en operator_log
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                  Cuenta
                </label>
                <select
                  value={logAccount}
                  onChange={e => setLogAccount(e.target.value)}
                  className="w-full bg-transparent rounded p-2 text-xs text-[#FFFFFF] outline-none"
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
                >
                  <option value="360" className="bg-[#1A1F36]">360</option>
                  <option value="BHI" className="bg-[#1A1F36]">BHI</option>
                  <option value="KAREDO" className="bg-[#1A1F36]">KAREDO</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                  Dónde (Campaña / Grupo / Keyword)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Campaña Search Alemania"
                  value={logDonde}
                  onChange={e => setLogDonde(e.target.value)}
                  className="w-full bg-transparent rounded p-2 text-xs text-[#FFFFFF] outline-none"
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                Qué cambió *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Incremento de presupuesto diario de 30 a 50 EUR"
                value={logQueCambio}
                onChange={e => setLogQueCambio(e.target.value)}
                className="w-full bg-transparent rounded p-2 text-xs text-[#FFFFFF] outline-none"
                style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                  Valor anterior
                </label>
                <input
                  type="text"
                  placeholder="Ej: 30 EUR"
                  value={logValorAnt}
                  onChange={e => setLogValorAnt(e.target.value)}
                  className="w-full bg-transparent rounded p-2 text-xs text-[#FFFFFF] outline-none tabular"
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
                  className="w-full bg-transparent rounded p-2 text-xs text-[#FFFFFF] outline-none tabular"
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                Por qué (Motivo u Objetivo)
              </label>
              <textarea
                rows={2}
                placeholder="Explicación del motivo detrás del cambio..."
                value={logPorQue}
                onChange={e => setLogPorQue(e.target.value)}
                className="w-full bg-transparent rounded p-2 text-xs text-[#FFFFFF] outline-none"
                style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingLog || !logQueCambio.trim()}
                className="px-4 py-2 bg-[#0062CC] text-[#FFFFFF] font-semibold rounded text-xs disabled:opacity-50"
              >
                {savingLog ? 'Guardando...' : 'Guardar en operator_log'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: AJUSTES */}

      {enGrupo('aprendizaje') && (
        <div className="space-y-4">
          {/* Tasa de acierto: la métrica del sistema entero */}
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Tasa de acierto
            </h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">De los accionables ejecutados, cuántos movieron la métrica en la dirección esperada. Si las inferencias aciertan mucho menos que las observaciones, el sistema propone demasiado sin evidencia.</p>
            {aprendizaje.tasa_acierto.length === 0 ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Sin accionables evaluados todavía. El cron de los lunes 05:30 sincroniza los Hechos con fecha de ejecución y calcula impacto a los 14 días.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {aprendizaje.tasa_acierto.map((t: any) => (
                  <div key={t.account} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <div className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider mb-1">{t.account}</div>
                    <div className="text-2xl font-semibold text-[#FFFFFF] tabular">{t.tasa_acierto_pct != null ? `${t.tasa_acierto_pct}%` : '—'}</div>
                    <div className="text-[11px] text-[#F5F7FA] opacity-70 tabular mt-1">
                      {t.funcionaron} funcionaron · {t.neutros} neutros · {t.empeoraron} empeoraron · {t.pendientes} pendientes
                    </div>
                    {(t.acierto_observaciones_pct != null || t.acierto_inferencias_pct != null) && (
                      <div className="text-[11px] text-[#F5F7FA] opacity-60 tabular mt-1">
                        Observaciones {t.acierto_observaciones_pct ?? '—'}% · Inferencias {t.acierto_inferencias_pct ?? '—'}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Impacto por accionable */}
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Qué pasó después de cada accionable
            </h2>
            {aprendizaje.impacto.length === 0 ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Todavía no hay accionables marcados Hecho con fecha. Cuando los haya, acá se ve qué pasó 14 días después de cada uno.</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead><tr className="text-[#F5F7FA] opacity-60 text-left" style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="py-2 px-2">Cuenta</th><th className="py-2 px-2">Accionable</th><th className="py-2 px-2">Ejecutado</th><th className="py-2 px-2">Métrica</th><th className="py-2 px-2 text-right">Antes → Después</th><th className="py-2 px-2 text-right">Var.</th><th className="py-2 px-2">Veredicto</th>
                  </tr></thead>
                  <tbody>
                    {aprendizaje.impacto.map((i: any) => {
                      const m = i.metrica_objetivo;
                      const ad = m === 'cpa' ? `${i.cpa_antes ?? '—'} → ${i.cpa_despues ?? '—'}` : m === 'gasto' ? `${i.gasto_antes ?? '—'} → ${i.gasto_despues ?? '—'}` : m === 'conversiones' ? `${i.conv_antes ?? '—'} → ${i.conv_despues ?? '—'}` : `${i.ctr_antes ?? '—'} → ${i.ctr_despues ?? '—'}`;
                      const ok = String(i.veredicto).startsWith('FUNCIONO');
                      const mal = String(i.veredicto).startsWith('EMPEORO');
                      return (
                        <tr key={i.notion_id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                          <td className="py-2 px-2 font-bold text-[#FFFFFF]">{i.account}</td>
                          <td className="py-2 px-2 text-[#F5F7FA] max-w-[280px] truncate" title={i.titulo}>{i.titulo}</td>
                          <td className="py-2 px-2 tabular text-[#F5F7FA] opacity-70">{i.ejecutado_el}</td>
                          <td className="py-2 px-2 text-[#F5F7FA] opacity-70">{m || '—'}</td>
                          <td className="py-2 px-2 tabular text-right text-[#F5F7FA]">{ad}</td>
                          <td className={`py-2 px-2 tabular text-right ${ok ? 'text-[#FFFFFF] font-semibold' : mal ? 'text-[#0062CC] font-semibold' : 'text-[#F5F7FA] opacity-70'}`}>{i.variacion_pct != null ? `${i.variacion_pct > 0 ? '+' : ''}${i.variacion_pct}%` : '—'}</td>
                          <td className={`py-2 px-2 ${ok ? 'text-[#FFFFFF]' : mal ? 'text-[#0062CC]' : 'text-[#F5F7FA] opacity-70'}`}>{String(i.veredicto).split(':')[0]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lo que el sistema propone cambiar en sus instrucciones */}
          {aprendizaje.propuestas.length > 0 && (
            <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--primary)' }}>
              <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                Lo que el sistema propone cambiar en sus instrucciones
              </h2>
              <p className="text-xs text-[#F5F7FA] opacity-60">Reflexiones que aparecieron en 2 o más corridas y aún no se aplicaron. Cada una es una regla que el prompt todavía no tiene.</p>
              {aprendizaje.propuestas.map((p: any, i: number) => (
                <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#FFFFFF] uppercase">{p.account} · {p.tipo}</span>
                    <span className="text-[11px] text-[#F5F7FA] opacity-60 tabular">{p.veces} veces · {p.primera_vez} → {p.ultima_vez}</span>
                  </div>
                  <p className="text-sm text-[#F5F7FA]">{p.leccion_mas_reciente}</p>
                  {p.regla && <p className="text-[11px] text-[#F5F7FA] opacity-60 mt-1">Regla: {p.regla}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Reflexiones recientes */}
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Reflexiones de las corridas (memoria episódica)
            </h2>
            {aprendizaje.reflexiones.length === 0 ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Las tareas semanales escriben acá qué harían distinto. Empieza el lunes 7.</p>
            ) : (
              <div className="space-y-2">
                {aprendizaje.reflexiones.map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[#FFFFFF] uppercase">{r.account}</span>
                      <span className="text-[#F5F7FA] opacity-60 tabular">{r.run_date}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide" style={{ backgroundColor: r.tipo === 'acierto' ? 'var(--surface-1)' : 'var(--primary-faint)', color: '#F5F7FA' }}>{r.tipo.replace(/_/g, ' ')}</span>
                      {r.aplicada && <span className="text-[10px] text-[#F5F7FA] opacity-50">· aplicada</span>}
                    </div>
                    <p className="text-[#F5F7FA] opacity-80">{r.que_paso}</p>
                    <p className="text-[#FFFFFF] mt-1">→ {r.que_haria_distinto}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {enGrupo('tamano') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Tamaño y crecimiento
          </h2>
          <p className="text-xs text-[#F5F7FA] opacity-60">Filas por tabla, ritmo diario y proyección a un año. LIMPIAR significa que el mantenimiento de los lunes no está corriendo. VIGILAR significa que es hora de particionar.</p>
          {tamano.length === 0 ? (
            <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Cargando…</p>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead><tr className="text-[#F5F7FA] opacity-60 text-left" style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="py-2 px-2">Tabla</th><th className="py-2 px-2 text-right">Filas</th><th className="py-2 px-2 text-right">Tamaño</th><th className="py-2 px-2 text-right">Filas/día</th><th className="py-2 px-2 text-right">En un año</th><th className="py-2 px-2">Estado</th>
                </tr></thead>
                <tbody>
                  {tamano.map((t: any) => (
                    <tr key={t.tabla} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                      <td className="py-1.5 px-2 text-[#FFFFFF]">{t.tabla}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA]">{Number(t.filas).toLocaleString('es-CL')}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA] opacity-70">{t.tamano}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA] opacity-70">{t.filas_por_dia ?? '—'}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA] opacity-70">{t.filas_en_un_ano ? Number(t.filas_en_un_ano).toLocaleString('es-CL') : '—'}</td>
                      <td className={`py-1.5 px-2 ${t.estado === 'OK' ? 'text-[#F5F7FA] opacity-50' : 'text-[#0062CC] font-semibold'}`}>{t.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {enGrupo('ajustes') && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Ajustes & Conectores
          </h2>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="font-semibold text-[#FFFFFF]">Base de datos</div>
                <div className="text-[11px] text-[#F5F7FA] opacity-60">Conexión activa a vistas consolidadas</div>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-[#FFFFFF]">
                Conectado
              </span>
            </div>

            <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="font-semibold text-[#FFFFFF]">Notion</div>
                <div className="text-[11px] text-[#F5F7FA] opacity-60">Sincronización de accionables, briefs y bitácora</div>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-[#FFFFFF]">
                Sincronizado
              </span>
            </div>

            <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="font-semibold text-[#FFFFFF]">Gemini (segunda opinión)</div>
                <div className="text-[11px] text-[#F5F7FA] opacity-60">Auditoría de segunda opinión y detección de controversias</div>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-[#FFFFFF]">
                Activo
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
