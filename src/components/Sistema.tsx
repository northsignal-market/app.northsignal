import { useCuentas } from '../lib/useCuentas';
import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { PageShell, fetchJSON, fmtFechaCorta } from './ui';
import { useAppStore } from '../store/useAppStore';
import { NOTION_STATES } from '../types';

export function Sistema() {
  const { nombres: nombresCuentas } = useCuentas();
  const { actionables } = useAppStore();
  const [latidos, setLatidos] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [aprendizaje, setAprendizaje] = useState<any>({ impacto: [], tasa_acierto: [], reflexiones: [], propuestas: [] });
  const [tamano, setTamano] = useState<any[]>([]);
  // Salud completa: las 32 verificaciones, tareas caidas y cuarentena.
  const [saludSistema, setSaludSistema] = useState<any>(null);
  const [respaldo, setRespaldo] = useState<any>(null);
  // 8 sep 2026. Antes TODO el bloque estaba envuelto en {respaldo && (...)}: si este
  // fetch fallaba, el estado quedaba en null y la seccion no se renderizaba. No es que
  // el boton no funcionara, es que no existia en pantalla y sin ningun mensaje.
  // Falla en silencio, que es el patron que mas caro sale en este sistema.
  const [respaldoError, setRespaldoError] = useState<string | null>(null);
  const bajarRespaldo = async (url: string, nombre: string) => {
    // Por fetch + blob y no por <a href download>: asi la descarga usa las mismas
    // credenciales que el resto de la app, y un 401 o un 500 se ve como mensaje en vez
    // de bajar un archivo con el error adentro.
    setRespaldoError(null);
    try {
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const texto = await r.text();
      const href = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = href; a.download = nombre;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(href); a.remove(); }, 0);
    } catch (e: any) {
      setRespaldoError('No se pudo bajar ' + nombre + ': ' + (e?.message || 'error desconocido'));
    }
  };

  useEffect(() => {
    fetchJSON<any>('/api/aprendizaje', null).then(d => d && setAprendizaje(d));
    fetchJSON<any[]>('/api/salud-sistema', []).then(d => d.length && setTamano(d));
    fetchJSON<any>('/api/salud', null).then(d => d && setSaludSistema(d));
    fetchJSON<any[]>('/api/latidos', []).then(d => setLatidos(Array.isArray(d) ? d : []));
    fetchJSON<any>('/api/respaldo', null).then(d => {
      if (d) setRespaldo(d);
      else setRespaldoError('No se pudo consultar el respaldo.');
    });
  }, []);
  const [loading, setLoading] = useState(false);

  // Tab: 'salud' | 'integridad' | 'scorecard' | 'cambios' | 'bitacora' | 'ajustes'
  // Cuatro grupos en vez de doce pestañas. Cada grupo apila los bloques que antes eran pestañas.
  const GRUPOS: { id: string; label: string; tabs: string[]; ayuda: string }[] = [
    { id: 'salud', label: 'Salud', tabs: ['salud', 'integridad', 'tamano'], ayuda: 'Si los datos están al día y cuadran' },
    { id: 'aprendizaje', label: 'Aprendizaje', tabs: ['scorecard', 'aprendizaje', 'coherencia'], ayuda: 'Qué tan bien analiza el sistema y cómo se corrige' },
    { id: 'automatizacion', label: 'Automatización', tabs: ['alertas', 'ejecuciones', 'cambios'], ayuda: 'Alertas, qué puede hacer el sistema solo, ejecuciones, cambios de configuración' },
    { id: 'soporte', label: 'Soporte', tabs: ['tickets', 'bitacora'], ayuda: 'Tickets para Claude y tu bitácora' },
  ];
  const [grupo, setGrupo] = useState<string>('salud');
  const enGrupo = (tab: string) => (GRUPOS.find(g => g.id === grupo)?.tabs || []).includes(tab);
  const [ejecuciones, setEjecuciones] = useState<any[]>([]);
  const [reconciliaciones, setReconciliaciones] = useState<any[]>([]);
  const [aprendido, setAprendido] = useState<any>(null);
  const [politicas, setPoliticas] = useState<{ politicas: any[]; general: boolean }>({ politicas: [], general: false });
  const cargarPoliticas = () => fetchJSON<any>('/api/politicas', null).then(d => d && setPoliticas(d));
  const guardarPolitica = async (tipo: string, cambios: any) => { await fetch(`/api/politicas/${tipo}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) }); cargarPoliticas(); };
  const guardarGeneral = async (activa: boolean) => { if (activa && !confirm('Con esto encendido, el sistema ejecuta en Google Ads las negativas y pausas que cumplan las reglas de abajo, sin preguntarte. ¿Seguro?')) return; await fetch('/api/politicas/general', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activa }) }); cargarPoliticas(); };
  const [coherencia, setCoherencia] = useState<any>({ escritores: [], reconciliaciones: [] });
  const [alertas, setAlertas] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  useEffect(() => {
    fetchJSON<any[]>('/api/alertas', []).then(d => setAlertas(Array.isArray(d) ? d : []));
    fetchJSON<any[]>('/api/tickets', []).then(d => setTickets(Array.isArray(d) ? d : []));
    fetchJSON<any>('/api/coherencia', null).then(d => d && setCoherencia(d));
    cargarPoliticas();
    fetchJSON<any>('/api/aprendido', null).then(d => setAprendido(d));
    fetchJSON<any[]>('/api/acciones-aprobadas', []).then(d => setEjecuciones(Array.isArray(d) ? d : []));
    fetchJSON<any[]>('/api/reconciliaciones', []).then(d => setReconciliaciones(Array.isArray(d) ? d : []));
  }, [grupo]);
  const accionAlerta = async (id: number, accion: string, extra: any = {}) => { await fetch(`/api/alertas/${id}/${accion}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extra) }); setAlertas(await fetchJSON<any[]>('/api/alertas', [])); };

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
    const data = await fetchJSON<any>('/api/health/system', null);
    if (data) setHealthData(data);
    setLoading(false);
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
    <PageShell
      titulo="Sistema"
      subtitulo="¿Está funcionando? Salud, integridad, calidad de corridas, automatización y bitácora"
      derecha={
        <button aria-label="Actualizar" title="Actualizar"
          onClick={fetchHealth}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#EDEFF3] hover:bg-white/10 flex items-center gap-1.5 transition-colors shrink-0"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-[#4D9DFF]' : ''} />
          <span>Actualizar</span>
        </button>
      }
    >

      {/* Cuatro grupos */}
      <div className="flex gap-1 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {GRUPOS.map(g => {
          const n = g.id === 'automatizacion' ? alertas.length + ejecuciones.filter((e: any) => e.estado === 'pendiente').length : g.id === 'soporte' ? tickets.filter((t: any) => t.estado === 'abierto').length : 0;
          return (
            <button key={g.id} onClick={() => setGrupo(g.id)} title={g.ayuda} className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors ${grupo === g.id ? 'bg-[#0062CC] text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'}`}>
              {g.label}{n > 0 ? <span className="ml-1.5 text-[10px] opacity-70">{n}</span> : null}
            </button>
          );
        })}
      </div>


      {/* TAB: LO QUE APRENDIÓ (lecciones + conocimiento externo + acierto por tipo) */}
      {enGrupo('aprendizaje') && aprendido && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px] font-medium text-[#EDEFF3]">Lecciones</h2>
              <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Lo que el sistema aprendió de sus propias decisiones, hacia atrás: en qué contexto, qué se hizo, qué pasó, qué regla queda. Los errores valen más que los aciertos. La confianza sube cada vez que otra corrida ve lo mismo.">Lo que el sistema aprendió de sus propias decisiones, hacia atrás: en qué contexto, qué se hizo, qué pasó, qué regla queda. Los errores valen más que los aciertos. La confianza sube cada vez que otra corrida ve lo mismo.</p>
            </div>
            {aprendido.lecciones.length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Todavía ninguna. La tarea del lunes escribe al menos una por cuenta.</p> : (
              <div className="space-y-1.5">
                {aprendido.lecciones.map((l: any) => (
                  <div key={l.id} className="px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)', borderLeft: l.tipo === 'error' ? '2px solid var(--bad)' : '2px solid transparent' }}>
                    <div className="flex items-center gap-2 text-[10px] text-[#F5F7FA] opacity-50"><span className="uppercase tracking-wider">{l.tipo}</span><span>{l.account || 'general'} · {fmtFechaCorta(l.fecha)}</span><span className="ml-auto tabular">confianza {Math.round(l.confianza * 100)}%{l.veces_confirmada > 1 ? ` · vista ${l.veces_confirmada} veces` : ''}</span></div>
                    <div className="text-xs text-[#EDEFF3] mt-0.5">{l.leccion}</div>
                    <div className="text-[11px] text-[#F5F7FA] opacity-60 mt-0.5">{l.contexto} → {l.decision} → {l.resultado}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px] font-medium text-[#EDEFF3]">Lo que aprendió afuera</h2>
              <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Cambios de Google Ads, benchmarks, métodos y regulación que el sistema buscó y registró con fuente. Nunca cambia una regla por esto: lo propone.">Cambios de Google Ads, benchmarks, métodos y regulación que el sistema buscó y registró con fuente. Nunca cambia una regla por esto: lo propone.</p>
            </div>
            <div className="space-y-1.5">
              {aprendido.conocimiento.map((k: any) => (
                <div key={k.id} className="px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 text-[10px] text-[#F5F7FA] opacity-50"><span className="uppercase tracking-wider">{k.tema}</span><span>{fmtFechaCorta(k.fecha)}</span>{k.vigente_hasta && <span>· hasta {fmtFechaCorta(k.vigente_hasta)}</span>}<span className="ml-auto">{(k.aplica_a || []).join(', ')} · {String(k.fuente_tipo).replace(/_/g, ' ')}{k.verificado ? ' · verificado' : ''}</span></div>
                  <div className="text-xs text-[#EDEFF3] mt-0.5">{k.titulo}</div>
                  <div className="text-[11px] text-[#F5F7FA] opacity-70 mt-0.5">{k.resumen}</div>
                  {k.accion_derivada && <div className="text-[11px] text-[#F5F7FA] mt-1"><span className="opacity-50">Qué hacer:</span> {k.accion_derivada}</div>}
                  <a href={String(k.fuente).split(' ')[0]} target="_blank" rel="noreferrer" className="text-[10px] text-[#4D9DFF] opacity-70 hover:opacity-100">{String(k.fuente).split(' ')[0].slice(0, 70)}</a>
                </div>
              ))}
            </div>
          </div>
          {(aprendido.invalidos || []).length > 0 && (
            <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-[15px] font-medium text-[#EDEFF3]">Accionables que no cumplen el estándar</h2>
                <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Sin acción estructurada válida, el sistema no puede ejecutarlos ni deduplicarlos bien. Los anteriores al estándar se van cerrando; los nuevos de la tarea del lunes vienen con él.">Sin acción estructurada válida, el sistema no puede ejecutarlos ni deduplicarlos bien. Los anteriores al estándar se van cerrando; los nuevos de la tarea del lunes vienen con él.</p>
              </div>
              <div className="space-y-1">
                {aprendido.invalidos.map((a: any) => (
                  <div key={a.notion_id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <span className="text-[#F5F7FA] opacity-50 w-14 shrink-0">{a.account}</span>
                    <span className="text-[#EDEFF3] flex-1 truncate">{a.titulo}</span>
                    <span className="text-[10px] text-[#F5F7FA] opacity-50 shrink-0 max-w-[280px] truncate" title={a.accion_error}>{a.accion_error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aprendido.acierto_por_tipo.length > 0 && (
            <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-[15px] font-medium text-[#EDEFF3]">Qué tipo de cambio funciona en cada cuenta</h2>
                <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Tasa de acierto por tipo de accionable ejecutado, medida 14 días después. El sistema no repite un tipo que “suele empeorar” sin decir por qué esta vez es distinto.">Tasa de acierto por tipo de accionable ejecutado, medida 14 días después. El sistema no repite un tipo que “suele empeorar” sin decir por qué esta vez es distinto.</p>
              </div>
              <div className="space-y-1">
                {aprendido.acierto_por_tipo.map((t: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <span className="text-[#EDEFF3] w-16 shrink-0">{t.account}</span><span className="text-[#F5F7FA] w-28 shrink-0">{t.tipo}</span>
                    <span className="tabular text-[#F5F7FA] opacity-70 w-24 shrink-0">{t.mejoraron}/{t.n} mejoraron</span>
                    <span className="text-[#F5F7FA] opacity-80 flex-1">{t.veredicto}</span>
                    {t.variacion_promedio_pct != null && <span className="tabular text-[#F5F7FA] opacity-60">{t.variacion_promedio_pct > 0 ? '+' : ''}{t.variacion_promedio_pct}%</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* TAB: ALERTAS — lo urgente, arriba de todo en Automatización */}
      {enGrupo('alertas') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">Alertas</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Una alerta existe solo si hay algo concreto que hacer. Tres niveles: pide acción hoy, para mirar esta semana, y las de fondo que no avisan. Silenciar registra por qué y hasta cuándo.">Una alerta existe solo si hay algo concreto que hacer. Tres niveles: pide acción hoy, para mirar esta semana, y las de fondo que no avisan. Silenciar registra por qué y hasta cuándo.</p>
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
                      <div className="text-xs text-[#EDEFF3] font-medium mt-0.5">{a.titulo}</div>
                      {a.detalle && <div className="text-[11px] text-[#F5F7FA] opacity-70">{a.detalle}</div>}
                      {a.accion && <div className="text-[11px] text-[#F5F7FA] mt-1"><span className="opacity-60">Qué hacer:</span> {a.accion}</div>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => accionAlerta(a.id, 'resolver')} className="px-2 py-0.5 rounded text-[10px] bg-[#0062CC] text-[#EDEFF3]">Resuelta</button>
                      <button onClick={() => { const pq = prompt('¿Por qué la silenciás? (queda registrado)'); if (pq !== null) accionAlerta(a.id, 'silenciar', { dias: 7, por_que: pq }); }} className="px-2 py-0.5 rounded text-[10px] text-[#F5F7FA] opacity-60 hover:opacity-100" style={{ border: '1px solid var(--border)' }}>Silenciar 7d</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: EJECUCIONES */}
      {enGrupo('ejecuciones') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">Lo que aprobaste para que el sistema ejecute</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Negativas, pausas, concordancia, y también presupuesto, objetivo y estrategia de puja (siempre con el valor anterior guardado para revertir). Un script de Google Ads las lee cada hora. En simulación escribe qué haría; en real lo aplica y marca Hecho.">Negativas, pausas, concordancia, y también presupuesto, objetivo y estrategia de puja (siempre con el valor anterior guardado para revertir). Un script de Google Ads las lee cada hora. En simulación escribe qué haría; en real lo aplica y marca Hecho.</p>
            {(() => {
              // Salud del propio control: si de N decisiones no rechazaste ninguna,
              // no hay humano en el circuito — hay un botón lento.
              const decididos = actionables.filter(a => a.status === NOTION_STATES.HECHO || a.status === NOTION_STATES.DESCARTADO);
              const rechazados = decididos.filter(a => a.status === NOTION_STATES.DESCARTADO).length;
              return decididos.length >= 10 && rechazados === 0 ? (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--warn)' }}>
                  De los últimos {decididos.length} accionables decididos rechazaste 0. Si todo pasa, el control no está controlando: mirá si estás aprobando por inercia.
                </p>
              ) : null;
            })()}
          </div>
          {ejecuciones.length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Ninguna todavía. Aparecen cuando aprobás una acción desde el accionable: negativas, pausas, concordancia, presupuesto o puja.</p> : (
            <div className="space-y-1">
              {ejecuciones.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0 w-24">{fmtFechaCorta(e.aprobada_el)} {String(e.aprobada_el).slice(11, 16)}</span>
                  <span className={`text-[10px] uppercase tracking-wider shrink-0 w-24 ${e.estado === 'ejecutada' ? 'text-[#EDEFF3]' : e.estado === 'fallida' ? 'text-[#F97066]' : 'text-[#F5F7FA] opacity-60'}`}>{e.estado}{e.modo === 'simular' ? ' (sim)' : ''}{e.por_politica ? ' · política' : ''}</span>
                  <span className="text-[#F5F7FA] flex-1">{e.account} · {e.tipo.replace(/_/g, ' ')} · <span className="text-[#EDEFF3]">{e.keyword || e.ad_id || (e.valor_actual != null ? `${e.valor_actual} → ${e.valor_nuevo ?? 'sin objetivo'}` : e.estrategia_destino || e.etiqueta || '—')}</span> en {e.campana}{e.grupo ? ` › ${e.grupo}` : ''}</span>
                  {e.resultado && <span className="text-[10px] text-[#F5F7FA] opacity-50 max-w-[260px] truncate" title={e.resultado}>{e.resultado}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: POLÍTICAS DE EJECUCIÓN AUTOMÁTICA */}
      {enGrupo('ejecuciones') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: politicas.general ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-4 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 className="text-[15px] font-medium text-[#EDEFF3]">Qué puede hacer el sistema sin preguntarte</h2>
              <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Negativas, pausas y cambios de concordancia, que se deshacen. Cada tipo tiene su regla: quién lo puede proponer, con qué confianza, hasta qué gasto. Con el interruptor general apagado, nada se ejecuta solo aunque las reglas estén activas. Empezá en simular: el script escribe qué haría y vos lo mirás una semana.">Negativas, pausas y cambios de concordancia, que se deshacen. Cada tipo tiene su regla: quién lo puede proponer, con qué confianza, hasta qué gasto. Con el interruptor general apagado, nada se ejecuta solo aunque las reglas estén activas. Empezá en simular: el script escribe qué haría y vos lo mirás una semana.</p>
            </div>
            <label className="flex items-center gap-2 shrink-0 cursor-pointer">
              <span className="text-xs text-[#F5F7FA]">{politicas.general ? 'Encendido' : 'Apagado'}</span>
              <button onClick={() => guardarGeneral(!politicas.general)} className="w-10 h-5 rounded-full relative transition-colors" style={{ backgroundColor: politicas.general ? 'var(--primary)' : 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-[#FFFFFF] transition-all" style={{ left: politicas.general ? 20 : 2 }} />
              </button>
            </label>
          </div>
          <div className="space-y-2">
            {politicas.politicas.map((p: any) => (
              <div key={p.tipo} className={`p-3 rounded-xl space-y-2 ${!p.activa ? 'opacity-70' : ''}`} style={{ backgroundColor: 'var(--surface-2)', border: p.activa && politicas.general ? '1px solid var(--primary)' : '1px solid transparent' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={p.activa} onChange={e => guardarPolitica(p.tipo, { activa: e.target.checked })} className="accent-[#0062CC]" /><span className="text-xs font-medium text-[#EDEFF3]">{({ negativa_grupo: 'Negativas a nivel de grupo', negativa_campana: 'Negativas a nivel de campaña', pausar_keyword: 'Pausar keywords', pausar_anuncio: 'Pausar anuncios', cambiar_concordancia: 'Cambiar concordancia de keywords' } as any)[p.tipo]}</span></label>
                  <div className="flex p-0.5 rounded-md ml-auto" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
                    {(['simular', 'ejecutar'] as const).map(m => <button key={m} onClick={() => guardarPolitica(p.tipo, { modo: m })} className={`px-2 py-0.5 rounded text-[10px] ${p.modo === m ? 'bg-[#0062CC] text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-60'}`}>{m === 'simular' ? 'Solo simular' : 'Ejecutar de verdad'}</button>)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#F5F7FA]">
                  <label className="flex items-center gap-1.5">Confianza mínima <input aria-label="P" type="number" step="0.05" min="0.5" max="1" value={p.confianza_min} onChange={e => guardarPolitica(p.tipo, { confianza_min: Number(e.target.value) })} className="w-14 bg-[#1A1F36] border border-[#0062CC]/30 rounded px-1.5 py-0.5 text-xs text-[#EDEFF3]" /></label>
                  {p.tipo === 'pausar_keyword' && <label className="flex items-center gap-1.5">Solo si gastó menos de <input type="number" value={p.gasto_max ?? ''} placeholder="sin tope" onChange={e => guardarPolitica(p.tipo, { gasto_max: e.target.value === '' ? null : Number(e.target.value) })} className="w-16 bg-[#1A1F36] border border-[#0062CC]/30 rounded px-1.5 py-0.5 text-xs text-[#EDEFF3]" /> en 14 días</label>}
                  <div className="flex items-center gap-1.5">Lo puede proponer: {['Semanal', 'Pulso diario', 'Anomalias'].map(o => (
                    <label key={o} className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={(p.solo_origen || []).includes(o)} onChange={e => guardarPolitica(p.tipo, { solo_origen: e.target.checked ? [...(p.solo_origen || []), o] : (p.solo_origen || []).filter((x: string) => x !== o) })} className="accent-[#0062CC]" />{o === 'Pulso diario' ? 'análisis diario' : o === 'Anomalias' ? 'anomalías' : 'semanal'}</label>
                  ))}</div>
                  <div className="flex items-center gap-1.5">Cuentas: {nombresCuentas.map(c => (
                    <label key={c} className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={(p.cuentas || []).includes(c)} onChange={e => guardarPolitica(p.tipo, { cuentas: e.target.checked ? [...(p.cuentas || []), c] : (p.cuentas || []).filter((x: string) => x !== c) })} className="accent-[#0062CC]" />{c}</label>
                  ))}</div>
                </div>
                {p.nota && <p className="text-[10px] text-[#F5F7FA] opacity-40">{p.nota}</p>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#F5F7FA] opacity-40">Cada ejecución automática queda en Ejecuciones con la marca "por política", en tu bitácora, y como comentario en el accionable. Presupuesto, puja y conversiones nunca entran acá.</p>
        </div>
      )}

      {/* TAB: COHERENCIA */}
      {enGrupo('coherencia') && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px] font-medium text-[#EDEFF3]">Quién es dueño de qué</h2>
              <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Cada cosa tiene un solo escritor. Los demás proponen, y lo que proponen nace bloqueado con vencimiento hasta que el dueño lo confirme. Así ninguno pisa lo que escribió otro.">Cada cosa tiene un solo escritor. Los demás proponen, y lo que proponen nace bloqueado con vencimiento hasta que el dueño lo confirme. Así ninguno pisa lo que escribió otro.</p>
            </div>
            <div className="space-y-1">
              {(coherencia.escritores || []).map((e: any) => (
                <div key={e.entidad} className="grid grid-cols-[160px_110px_1fr] gap-3 items-start px-2.5 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <span className="text-[#EDEFF3] font-medium">{e.entidad.replace(/_/g, ' ')}</span>
                  <span className="text-[#F5F7FA] opacity-80">{e.dueno}{e.proponen?.length ? <span className="opacity-50"> · proponen: {e.proponen.join(', ')}</span> : ''}</span>
                  <span className="text-[11px] text-[#F5F7FA] opacity-60 leading-relaxed">{e.regla}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px] font-medium text-[#EDEFF3]">Lo que el reconciliador corrigió</h2>
              <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Cada día a las 6:35 compara lo que cada proceso escribió. Vence lo que nadie tocó en siete días, marca duplicados por entidad, avisa si algo propuesto ya se hizo en Google Ads, y cierra alertas cuya condición cesó. Sin modelo: reglas.">Cada día a las 6:35 compara lo que cada proceso escribió. Vence lo que nadie tocó en siete días, marca duplicados por entidad, avisa si algo propuesto ya se hizo en Google Ads, y cierra alertas cuya condición cesó. Sin modelo: reglas.</p>
            </div>
            {(coherencia.reconciliaciones || []).length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Nada que corregir todavía. Corre por primera vez mañana.</p> : (
              <div className="space-y-1">
                {coherencia.reconciliaciones.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 px-2.5 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0 w-24">{fmtFechaCorta(r.corrida)} {String(r.corrida).slice(11, 16)}</span>
                    <span className="text-[10px] uppercase tracking-wider shrink-0 w-24 text-[#F5F7FA] opacity-70">{r.accion.replace('_', ' ')}</span>
                    <span className="text-[#F5F7FA] opacity-80 flex-1">{r.account ? <span className="text-[#EDEFF3]">{r.account} · </span> : ''}{r.detalle}</span>
                    <span className={`text-[10px] shrink-0 ${r.aplicada ? 'text-[#F5F7FA] opacity-50' : 'text-[#4D9DFF]'}`}>{r.aplicada ? 'aplicada' : 'pendiente'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: TICKETS */}
      {enGrupo('tickets') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">Tickets para Claude</h2>
            <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Lo que reportaste desde el botón de abajo a la derecha. Claude los lee al empezar cada sesión de trabajo y responde acá o los resuelve en el siguiente fix.">Lo que reportaste desde el botón de abajo a la derecha. Claude los lee al empezar cada sesión de trabajo y responde acá o los resuelve en el siguiente fix.</p>
          </div>
          {tickets.length === 0 ? <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Ningún ticket todavía.</p> : (
            <div className="space-y-1.5">
              {tickets.map((t: any) => (
                <div key={t.id} className={`p-3 rounded-lg ${t.estado === 'resuelto' ? 'opacity-60' : ''}`} style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 text-[10px] text-[#F5F7FA] opacity-50">
                    <span className="tabular">#{t.id}</span><span>{fmtFechaCorta(t.creado)} {String(t.creado).slice(11, 16)}</span><span>{t.pagina}{t.cuenta ? ` · ${t.cuenta}` : ''}</span>
                    <span className={`ml-auto uppercase tracking-wider ${t.estado === 'abierto' ? 'text-[#4D9DFF]' : ''}`}>{t.estado.replace('_', ' ')}</span>
                  </div>
                  <div className="text-xs text-[#EDEFF3] font-medium mt-0.5">{t.titulo}</div>
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
          {/* Agentes, cada uno contra SU cadencia. El latido dice que el proceso
              corrió; "en silencio" es el estado más peligroso porque no grita —
              por eso los silencios vienen primero y el marco se tiñe. */}
          {latidos.length > 0 && (
            <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: latidos.some((l: any) => l.en_silencio) ? '1px solid rgba(249,112,102,0.4)' : '1px solid var(--border)' }}>
              <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-[15px] font-medium text-[#EDEFF3]">Agentes</h2>
                <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Último éxito de cada tarea contra su propia cadencia. El latido mide que corrió, no que escribió: el efecto lo vigilan las relaciones de verdad.">Último éxito de cada tarea contra su propia cadencia. El latido mide que corrió, no que escribió: el efecto lo vigilan las relaciones de verdad.</p>
              </div>
              <div className="space-y-0.5">
                {latidos.map((l: any) => (
                  <div key={l.tarea} className={`flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs ${l.vigilado === false ? 'opacity-45' : ''}`} style={{ backgroundColor: l.en_silencio ? 'var(--bad-faint)' : 'var(--surface-2)' }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.en_silencio ? 'var(--bad)' : l.vigilado === false ? 'var(--border-strong)' : '#4ADE80' }} />
                    <span className={`w-52 shrink-0 truncate ${l.en_silencio ? 'text-[#EDEFF3] font-medium' : 'text-[#F5F7FA]'}`}>{String(l.tarea).replace(/_/g, ' ')}</span>
                    <span className="tabular text-[#F5F7FA] opacity-70 shrink-0 w-44">{l.horas_sin_ok != null ? `hace ${l.horas_sin_ok} h` : 'nunca corrió'} · tol. {l.tolerancia_horas} h</span>
                    <span className="flex-1 text-[11px] text-[#F5F7FA] opacity-60 truncate" title={l.ultimo_error || ''}>{l.vigilado === false ? 'fuera de vigilancia · decisión registrada' : l.en_silencio ? (l.ultimo_error || 'sin error registrado: dejó de correr en silencio') : ''}</span>
                    <span className="text-[10px] tabular text-[#F5F7FA] opacity-40 shrink-0">{l.corridas_ok} ok{l.corridas_falla > 0 ? ` · ${l.corridas_falla} fallas` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Veredicto del sistema. Reune las 32 verificaciones, las tareas caidas y
              la cuarentena. Antes esto solo se veia consultando SQL a mano. */}
          {saludSistema && (
            <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-[15px] font-medium text-[#EDEFF3]">Estado del sistema</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{
                  backgroundColor: saludSistema.veredicto === 'todo bien' ? '#16653433' : saludSistema.veredicto === 'hay algo roto' ? '#b4231833' : '#b4530933',
                  color: saludSistema.veredicto === 'todo bien' ? '#4ade80' : saludSistema.veredicto === 'hay algo roto' ? '#fca5a5' : '#fcd34d' }}>
                  {saludSistema.veredicto} · {saludSistema.ok} verificaciones
                </span>
              </div>
              {(saludSistema.fallas || []).map((f: any, i: number) => (
                <div key={'f'+i} className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#b4231815', border: '1px solid #b4231840' }}>
                  <span className="text-[#fca5a5] font-medium">{f.area} · {f.cuenta}</span>
                  <p className="text-[#F5F7FA] opacity-80 mt-0.5">{f.detalle}</p>
                </div>
              ))}
              {(saludSistema.atencion || []).map((a: any, i: number) => (
                <div key={'a'+i} className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <span className="text-[#fcd34d]">{a.area} · {a.cuenta}</span>
                  <p className="text-[#F5F7FA] opacity-70 mt-0.5">{a.detalle}</p>
                </div>
              ))}
              {!(saludSistema.fallas || []).length && !(saludSistema.atencion || []).length && (
                <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Nada roto y nada para mirar.">Nada roto y nada para mirar.</p>
              )}
              {(saludSistema.esperando_despliegue || []).length > 0 && (
                <p className="text-[11px] text-[#F5F7FA] opacity-50">
                  Esperando despliegue del script: {(saludSistema.esperando_despliegue || []).join(', ')}. No cuentan como caidas hasta su primer latido.
                </p>
              )}
              {Number(saludSistema.en_cuarentena) > 0 && (
                <p className="text-[11px] text-[#F5F7FA] opacity-50">
                  {saludSistema.en_cuarentena} registro(s) en cuarentena: escritos sobre datos que después resultaron falsos. Los agentes no los reciben.
                </p>
              )}
            </div>
          )}

          {/* Respaldo del esquema. Sin esto habia que escribir la URL a mano. */}
          <div className="p-5 rounded-2xl space-y-2" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Respaldo del esquema
            </h2>
            <p className="text-[11px] text-[#F5F7FA] opacity-60">
              Se generan frescos en cada descarga. Van a <span className="tabular">supabase/migrations/</span> en el repo: son lo que permite reconstruir la base entera si se pierde.
            </p>
            {respaldoError && (
              <p className="text-[11px]" style={{ color: '#F97066' }}>
                {respaldoError}
              </p>
            )}
            {!respaldo && !respaldoError && (
              <p className="text-[11px] text-[#F5F7FA] opacity-40">Consultando…</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {(respaldo?.archivos || []).map((a: any) => (
                <button key={a.nombre} type="button" onClick={() => bajarRespaldo(a.url, a.nombre)}
                  className="px-3 py-1.5 rounded-lg text-[11px] text-[#EDEFF3] hover:opacity-80"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  {a.nombre} <span className="opacity-50">{a.kb} KB</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Datos por cuenta
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th className="py-2.5 px-3 font-semibold text-[#EDEFF3]">Cuenta</th>
                    <th className="py-2.5 px-3 font-semibold text-[#EDEFF3]">Estado</th>
                    <th className="py-2.5 px-3 font-semibold text-[#EDEFF3]">Último día con datos</th>
                    <th className="py-2.5 px-3 font-semibold text-[#EDEFF3]">Última extracción</th>
                    <th className="py-2.5 px-3 font-semibold text-[#EDEFF3]">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {(healthData?.dataHealth || []).map((row: any, i: number) => {
                    const isOk = row.estado === 'OK';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-bold text-[#EDEFF3]">
                          {row.account}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isOk ? 'bg-white/10 text-[#EDEFF3]' : 'border-l-2 border-[#0062CC] bg-[#0062CC]/15 text-[#EDEFF3]'
                          }`}>
                            {isOk ? <Check size={12} /> : <AlertCircle size={12} className="text-[#4D9DFF]" />}
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
            <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Webhooks & Eventos de Ingesta
            </h2>
            <div className="space-y-2 text-xs">
              {(healthData?.webhookHealth || []).map((w: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <div className="font-semibold text-[#EDEFF3]">{w.servicio || w.endpoint || 'Webhook Ingest'}</div>
                    <div className="text-[11px] text-[#F5F7FA] opacity-60">Último disparo: {w.ultimo_disparo || 'reciente'}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-[#EDEFF3]">
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
          <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Integridad de datos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th className="py-2.5 px-3 font-semibold text-[#EDEFF3]">Cuenta</th>
                  <th className="py-2.5 px-3 font-semibold text-[#EDEFF3] text-right">Filas Campañas</th>
                  <th className="py-2.5 px-3 font-semibold text-[#EDEFF3] text-right">Filas Keywords</th>
                  <th className="py-2.5 px-3 font-semibold text-[#EDEFF3] text-right">Filas Search Terms</th>
                  <th className="py-2.5 px-3 font-semibold text-[#EDEFF3]">Integridad</th>
                </tr>
              </thead>
              <tbody>
                {(healthData?.integridadDatos || []).map((r: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                    <td className="py-2.5 px-3 font-bold text-[#EDEFF3]">{r.account}</td>
                    <td className="py-2.5 px-3 text-right tabular text-[#F5F7FA] opacity-80">{r.campanas_count || r.filas_campanas || 0}</td>
                    <td className="py-2.5 px-3 text-right tabular text-[#F5F7FA] opacity-80">{r.keywords_count || r.filas_keywords || 0}</td>
                    <td className="py-2.5 px-3 text-right tabular text-[#F5F7FA] opacity-80">{r.search_terms_count || r.filas_search_terms || 0}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-[#EDEFF3]">
                        {r.estado || 'Consistente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* El contralor diario: la API de Google verifica y corrige cada mañana (10:50 UTC) */}
          <div className="pt-2 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-50">Reconciliación contra la API de Google · corre sola cada mañana y corrige con el dato real</span>
            {reconciliaciones.length === 0 ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-1">Sin corridas todavía. La primera queda registrada acá con su veredicto por cuenta y capa.</p>
            ) : (
              <div className="space-y-1">
                {reconciliaciones.slice(0, 8).map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0 w-24">{fmtFechaCorta(r.corrida)} {String(r.corrida).slice(11, 16)}</span>
                    <span className={`text-[10px] uppercase tracking-wider shrink-0 w-24 ${r.veredicto === 'limpio' ? 'text-[#F5F7FA] opacity-60' : r.veredicto === 'corregido' ? 'text-[#EDEFF3]' : 'text-[#4D9DFF]'}`}>{r.veredicto}</span>
                    <span className="text-[#F5F7FA] flex-1">{r.account} · {r.capa} · {r.filas_comparadas} comparadas{r.filas_corregidas ? `, ${r.filas_corregidas} corregidas` : ''}{r.filas_insertadas ? `, ${r.filas_insertadas} insertadas` : ''}</span>
                    {r.detalle && <span className="text-[10px] text-[#F5F7FA] opacity-50 max-w-[280px] truncate" title={r.detalle}>{r.detalle}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RUN SCORECARD */}
      {enGrupo('scorecard') && (
        <div className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">
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
                      <span className="font-bold text-[#EDEFF3] tabular">
                        {run.run_date}
                      </span>
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-[#0062CC] text-[#EDEFF3] tabular">
                        {run.score || run.puntuacion || 15} / 15 pts
                      </span>
                    </div>
                    <span className="text-[11px] text-[#F5F7FA] opacity-60">
                      Cuenta: {run.account || 'Todas'}
                    </span>
                  </div>

                  {run.que_fallo && (
                    <div className="text-xs text-[#EDEFF3] p-2 rounded" style={{ backgroundColor: 'var(--surface-1)', borderLeft: '2px solid var(--primary)' }}>
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
                      className="flex-1 bg-transparent rounded px-3 py-1.5 text-xs text-[#EDEFF3] placeholder-[#F5F7FA]/30 outline-none"
                      style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-1)' }}
                    />
                    <button
                      onClick={() => handleSaveRevision(revisionId)}
                      disabled={savingRevisionId === revisionId}
                      className="px-3 py-1.5 bg-[#0062CC] text-[#EDEFF3] rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
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
          <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
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
                    <span className="font-semibold text-[#EDEFF3]">{ch.cuenta || ch.account}</span>
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
            <h2 className="text-[15px] font-medium text-[#EDEFF3]">
              Registro Manual en Bitácora (operator_log)
            </h2>
            <p className="text-xs text-[#F5F7FA] opacity-60">
              Registre cambios directos realizados en Google Ads para correlacionar con variaciones de métricas
            </p>
          </div>

          <form onSubmit={handleSubmitOperatorLog} className="space-y-3 max-w-xl text-xs">
            {logSuccess && (
              <div className="p-3 rounded bg-white/10 text-[#EDEFF3] flex items-center gap-2 font-medium">
                <Check size={14} /> Cambio registrado con éxito en operator_log
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-semibold text-[#F5F7FA] opacity-60 block mb-1">
                  Cuenta
                </label>
                <select aria-label="Log Account"
                  value={logAccount}
                  onChange={e => setLogAccount(e.target.value)}
                  className="w-full bg-transparent rounded p-2 text-xs text-[#EDEFF3] outline-none"
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
                  className="w-full bg-transparent rounded p-2 text-xs text-[#EDEFF3] outline-none"
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
                className="w-full bg-transparent rounded p-2 text-xs text-[#EDEFF3] outline-none"
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
                  className="w-full bg-transparent rounded p-2 text-xs text-[#EDEFF3] outline-none tabular"
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
                  className="w-full bg-transparent rounded p-2 text-xs text-[#EDEFF3] outline-none tabular"
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
                className="w-full bg-transparent rounded p-2 text-xs text-[#EDEFF3] outline-none"
                style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-2)' }}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingLog || !logQueCambio.trim()}
                className="px-4 py-2 bg-[#0062CC] text-[#EDEFF3] font-semibold rounded text-xs disabled:opacity-50"
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
            <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Tasa de acierto
            </h2>
            <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="De los accionables ejecutados, cuántos movieron la métrica en la dirección esperada. Si las inferencias aciertan mucho menos que las observaciones, el sistema propone demasiado sin evidencia.">De los accionables ejecutados, cuántos movieron la métrica en la dirección esperada. Si las inferencias aciertan mucho menos que las observaciones, el sistema propone demasiado sin evidencia.</p>
            {aprendizaje.tasa_acierto.length === 0 ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Sin accionables evaluados todavía. El cron de los lunes 05:30 sincroniza los Hechos con fecha de ejecución y calcula impacto a los 14 días.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {aprendizaje.tasa_acierto.map((t: any) => (
                  <div key={t.account} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <div className="text-xs font-bold text-[#EDEFF3] uppercase tracking-wider mb-1">{t.account}</div>
                    <div className="text-2xl font-semibold text-[#EDEFF3] tabular">{t.tasa_acierto_pct != null ? `${t.tasa_acierto_pct}%` : '—'}</div>
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
            <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
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
                          <td className="py-2 px-2 font-bold text-[#EDEFF3]">{i.account}</td>
                          <td className="py-2 px-2 text-[#F5F7FA] max-w-[280px] truncate" title={i.titulo}>{i.titulo}</td>
                          <td className="py-2 px-2 tabular text-[#F5F7FA] opacity-70">{fmtFechaCorta(i.ejecutado_el)}</td>
                          <td className="py-2 px-2 text-[#F5F7FA] opacity-70">{m || '—'}</td>
                          <td className="py-2 px-2 tabular text-right text-[#F5F7FA]">{ad}</td>
                          <td className={`py-2 px-2 tabular text-right ${ok ? 'text-[#EDEFF3] font-semibold' : mal ? 'text-[#F97066] font-semibold' : 'text-[#F5F7FA] opacity-70'}`}>{i.variacion_pct != null ? `${i.variacion_pct > 0 ? '+' : ''}${i.variacion_pct}%` : '—'}</td>
                          <td className={`py-2 px-2 ${ok ? 'text-[#EDEFF3]' : mal ? 'text-[#F97066]' : 'text-[#F5F7FA] opacity-70'}`}>{String(i.veredicto).split(':')[0]}</td>
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
              <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                Lo que el sistema propone cambiar en sus instrucciones
              </h2>
              <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Reflexiones que aparecieron en 2 o más corridas y aún no se aplicaron. Cada una es una regla que el prompt todavía no tiene.">Reflexiones que aparecieron en 2 o más corridas y aún no se aplicaron. Cada una es una regla que el prompt todavía no tiene.</p>
              {aprendizaje.propuestas.map((p: any, i: number) => (
                <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#EDEFF3] uppercase">{p.account} · {p.tipo}</span>
                    <span className="text-[11px] text-[#F5F7FA] opacity-60 tabular">{p.veces} veces · {fmtFechaCorta(p.primera_vez)} → {fmtFechaCorta(p.ultima_vez)}</span>
                  </div>
                  <p className="text-sm text-[#F5F7FA]">{p.leccion_mas_reciente}</p>
                  {p.regla && <p className="text-[11px] text-[#F5F7FA] opacity-60 mt-1">Regla: {p.regla}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Reflexiones recientes */}
          <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              Reflexiones de las corridas (memoria episódica)
            </h2>
            {aprendizaje.reflexiones.length === 0 ? (
              <p className="text-xs text-[#F5F7FA] opacity-50 italic py-3">Las tareas semanales escriben acá qué harían distinto. Empieza el lunes 7.</p>
            ) : (
              <div className="space-y-2">
                {aprendizaje.reflexiones.map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[#EDEFF3] uppercase">{r.account}</span>
                      <span className="text-[#F5F7FA] opacity-60 tabular">{fmtFechaCorta(r.run_date)}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide" style={{ backgroundColor: r.tipo === 'acierto' ? 'var(--surface-1)' : 'var(--primary-faint)', color: '#F5F7FA' }}>{r.tipo.replace(/_/g, ' ')}</span>
                      {r.aplicada && <span className="text-[10px] text-[#F5F7FA] opacity-50">· aplicada</span>}
                    </div>
                    <p className="text-[#F5F7FA] opacity-80">{r.que_paso}</p>
                    <p className="text-[#EDEFF3] mt-1">→ {r.que_haria_distinto}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {enGrupo('tamano') && (
        <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-medium text-[#EDEFF3] pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            Tamaño y crecimiento
          </h2>
          <p className="text-xs text-[#F5F7FA] opacity-60 line-clamp-1" title="Filas por tabla, ritmo diario y proyección a un año. LIMPIAR significa que el mantenimiento de los lunes no está corriendo. VIGILAR significa que es hora de particionar.">Filas por tabla, ritmo diario y proyección a un año. LIMPIAR significa que el mantenimiento de los lunes no está corriendo. VIGILAR significa que es hora de particionar.</p>
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
                      <td className="py-1.5 px-2 text-[#EDEFF3]">{t.tabla}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA]">{Number(t.filas).toLocaleString('es-CL')}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA] opacity-70">{t.tamano}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA] opacity-70">{t.filas_por_dia ?? '—'}</td>
                      <td className="py-1.5 px-2 tabular text-right text-[#F5F7FA] opacity-70">{t.filas_en_un_ano ? Number(t.filas_en_un_ano).toLocaleString('es-CL') : '—'}</td>
                      <td className={`py-1.5 px-2 ${t.estado === 'OK' ? 'text-[#F5F7FA] opacity-50' : 'text-[#E2B453] font-semibold'}`}>{t.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </PageShell>
  );
}
