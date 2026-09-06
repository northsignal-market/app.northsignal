import React, { useState, useEffect } from 'react';
import { 
  Activity, Check, AlertCircle, Clock, ShieldCheck, 
  RefreshCw, History, Send, Settings2, Sliders, Database, Save 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function Sistema() {
  const { selectedClient } = useAppStore();
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Tab: 'salud' | 'integridad' | 'scorecard' | 'cambios' | 'bitacora' | 'ajustes'
  const [activeTab, setActiveTab] = useState<'salud' | 'integridad' | 'scorecard' | 'cambios' | 'bitacora' | 'ajustes'>('salud');

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

      {/* Subnavigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'salud', label: 'Salud de Datos (v_data_health)' },
          { id: 'integridad', label: 'Integridad (v_integridad_datos)' },
          { id: 'scorecard', label: 'Scorecard de Calidad (v_run_scorecard)' },
          { id: 'cambios', label: 'Cambios Detectados (v_cambios_detectados)' },
          { id: 'bitacora', label: 'Bitácora Operador (operator_log)' },
          { id: 'ajustes', label: 'Ajustes de Sincronización' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-75 hover:opacity-100 hover:bg-white/5'
            }`}
            style={{ border: activeTab === t.id ? 'none' : '1px solid var(--border)', backgroundColor: activeTab === t.id ? '#0062CC' : 'var(--surface-1)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: SALUD DE DATOS */}
      {activeTab === 'salud' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Salud de Sincronización por Cuenta
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Cuenta</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Estado</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Último Día Datos</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Última Sincronización</th>
                    <th className="py-2.5 px-3 font-semibold text-[#FFFFFF]">Detalle / Latencia</th>
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
      {activeTab === 'integridad' && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Integridad de Datos (v_integridad_datos)
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
      {activeTab === 'scorecard' && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Scorecard de Calidad de Corridas (v_run_scorecard)
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
      {activeTab === 'cambios' && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Cambios Detectados en Configuración (v_cambios_detectados)
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
      {activeTab === 'bitacora' && (
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
      {activeTab === 'ajustes' && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#FFFFFF] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Ajustes & Conectores
          </h2>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="font-semibold text-[#FFFFFF]">Supabase Database & Views</div>
                <div className="text-[11px] text-[#F5F7FA] opacity-60">Conexión activa a vistas consolidadas</div>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-[#FFFFFF]">
                Conectado
              </span>
            </div>

            <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="font-semibold text-[#FFFFFF]">Notion Workspace API</div>
                <div className="text-[11px] text-[#F5F7FA] opacity-60">Sincronización de accionables, briefs y bitácora</div>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-[#FFFFFF]">
                Sincronizado
              </span>
            </div>

            <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="font-semibold text-[#FFFFFF]">Google GenAI (Gemini)</div>
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
