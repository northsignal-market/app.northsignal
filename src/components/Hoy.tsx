import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, ShieldAlert, Check, Clock, ArrowRight, 
  HelpCircle, ExternalLink, RefreshCw 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Actionable, PulseData } from '../types';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';

interface HoyProps {
  onOpenActionable: (action: Actionable) => void;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

function formatCurrency(val: number, client?: string | null) {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (client?.toUpperCase() === 'KAREDO') {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
  }
  return `$${val.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function Hoy({ onOpenActionable, onNavigate }: HoyProps) {
  const { selectedClient, setSelectedClient, actionables, updateActionableStatus, notionBriefs } = useAppStore();
  
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [headroomAll, setHeadroomAll] = useState<any[]>([]);

  // Veredictos de escalamiento de las tres cuentas: si alguna tiene HEADROOM
  // o TECHO, es una decisión del lunes
  useEffect(() => {
    fetch('/api/objetivos', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setHeadroomAll(d.headroom || []))
      .catch(() => {});
  }, []);
  const cuentasConDecision = headroomAll.filter((h: any) => /^(HEADROOM|TECHO)/.test(h.veredicto || ''));

  const activeClient = selectedClient || '360';

  const fetchPulse = async () => {
    setLoadingPulse(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/daily/overview?client=${activeClient}`, { credentials: 'include', headers });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.pulse) {
        setPulse(data.pulse);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPulse(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/health/system', { credentials: 'include', headers });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      setSystemHealth(data);
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPulse();
  }, [activeClient]);

  useEffect(() => {
    fetchHealth();
  }, []);

  // Data health
  const dataHealthRows = systemHealth?.dataHealth || [];
  const unhealthyAccounts = useMemo(() => {
    return dataHealthRows.filter((d: any) => d.estado && d.estado !== 'OK').map((d: any) => d.account);
  }, [dataHealthRows]);
  const isDataHealthy = unhealthyAccounts.length === 0;

  // Stale actionables (> 21 days)
  const isStaleAction = (a: any) => {
    if (a.status.toLowerCase() === NOTION_STATES.HECHO.toLowerCase() || a.status === NOTION_STATES.DESCARTADO) return false;
    const dt = a.detectado || a.created_at;
    if (!dt) return false;
    const ageDays = (Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= 21;
  };

  const staleActions = useMemo(() => {
    return actionables.filter(isStaleAction);
  }, [actionables]);

  const disputeActions = useMemo(() => {
    return actionables.filter(a => a.revision_ia === 'En disputa' && a.status.toLowerCase() !== NOTION_STATES.HECHO.toLowerCase());
  }, [actionables]);

  // Requiere tu criterio items (across all 3 accounts)
  const criterioItems = useMemo(() => {
    const items: Array<{
      id: string;
      action: Actionable;
      client: string;
      title: string;
      reason: string;
      type: 'dispute' | 'blocked_inference' | 'urgent_unreviewed' | 'stale';
    }> = [];

    actionables.forEach(a => {
      if (a.status.toLowerCase() === NOTION_STATES.HECHO.toLowerCase() || a.status === NOTION_STATES.DESCARTADO) return;
      if (items.some(i => i.action.id === a.id)) return;

      if (a.revision_ia === 'En disputa') {
        items.push({
          id: `disp-${a.id}`,
          action: a,
          client: a.client,
          title: a.title,
          reason: a.punto_disputa || 'Discrepancia entre modelo base y segunda opinión de Gemini',
          type: 'dispute'
        });
        return;
      }

      if (
        (a.naturaleza === NOTION_NATURALEZA.INFERENCIA || a.naturaleza === NOTION_NATURALEZA.HIPOTESIS) &&
        a.status === NOTION_STATES.BLOQUEADO
      ) {
        items.push({
          id: `bloq-${a.id}`,
          action: a,
          client: a.client,
          title: a.title,
          reason: a.que_lo_confirmaria ? `Qué lo confirmaría: ${a.que_lo_confirmaria}` : 'Hipótesis pendiente de confirmación de Andrés',
          type: 'blocked_inference'
        });
        return;
      }

      if (
        (a.priority === 'Alta' || a.priority === 'Urgente') &&
        (a.revision_ia === 'Sin revisar' || !a.revision_ia)
      ) {
        items.push({
          id: `urg-${a.id}`,
          action: a,
          client: a.client,
          title: a.title,
          reason: 'Prioridad urgente pendiente de auditoría de consenso',
          type: 'urgent_unreviewed'
        });
        return;
      }

      if (isStaleAction(a)) {
        items.push({
          id: `stale-${a.id}`,
          action: a,
          client: a.client,
          title: a.title,
          reason: 'Arrastra más de 21 días pendiente sin ejecución ni descarte',
          type: 'stale'
        });
      }
    });

    return items.slice(0, 8);
  }, [actionables]);

  // Preguntas abiertas from briefs / hypotheses
  const openQuestions = useMemo(() => {
    const list: Array<{ id: string; client: string; text: string; briefId?: string }> = [];
    
    // Check hypotheses / criteria on actionables
    actionables.forEach(a => {
      if (a.que_lo_confirmaria && (a.status === NOTION_STATES.BLOQUEADO || a.status === NOTION_STATES.PROPUESTO)) {
        if (!list.some(item => item.id === `q-${a.id}`)) {
          list.push({
            id: `q-${a.id}`,
            client: a.client,
            text: a.que_lo_confirmaria,
            briefId: a.brief_id
          });
        }
      }
    });

    return list.slice(0, 5);
  }, [actionables]);

  // Date formatted
  const statusDateStr = useMemo(() => {
    const d = new Date();
    const dayName = d.toLocaleDateString('es-ES', { weekday: 'long' });
    const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'short' });
    const health = isDataHealthy ? 'datos al día' : `atraso en ${unhealthyAccounts.join(', ')}`;
    return `${cap} ${day} ${month} · 3 cuentas · ${health} · ${disputeActions.length} accionables en disputa · ${staleActions.length} arrastran 3 semanas`;
  }, [isDataHealthy, unhealthyAccounts, disputeActions.length, staleActions.length]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* BLOQUE 1: LÍNEA DE ESTADO (ESTRICTA) */}
      <div 
        className="p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs"
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderLeft: !isDataHealthy ? '2px solid var(--primary)' : undefined
        }}
      >
        <div className="flex items-center gap-2.5">
          {!isDataHealthy ? (
            <AlertCircle size={15} className="text-[#0062CC] shrink-0" />
          ) : (
            <Check size={14} className="text-[#FFFFFF] shrink-0" />
          )}
          <span className={!isDataHealthy ? 'font-semibold text-[#FFFFFF] tabular' : 'text-[#F5F7FA] opacity-90 tabular'}>
            {statusDateStr}
          </span>
        </div>

        <button
          onClick={() => { fetchPulse(); fetchHealth(); }}
          title="Refrescar pulso"
          className="p-1 rounded hover:bg-white/10 text-[#F5F7FA] opacity-70 hover:opacity-100 transition-opacity"
        >
          <RefreshCw size={13} className={loadingPulse ? 'animate-spin text-[#0062CC]' : ''} />
        </button>
      </div>

      {/* BLOQUE 1B: VEREDICTOS DE ESCALAMIENTO, solo si alguna cuenta pide decisión */}
      {cuentasConDecision.length > 0 && (
        <div className="p-3.5 rounded-xl text-xs space-y-1.5" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', borderLeft: '2px solid var(--primary)' }}>
          {cuentasConDecision.map((h: any) => (
            <div key={h.account} className="flex items-start gap-2">
              <span className="font-semibold text-[#FFFFFF] shrink-0 w-16">{h.account}</span>
              <span className="text-[#F5F7FA] opacity-90">{h.veredicto}{h.objetivos_provisionales ? ' · objetivos provisionales' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* BLOQUE 2: REQUIERE TU CRITERIO (MAX 8 TARJETAS) */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#0062CC]" />
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Requiere tu criterio
            </h2>
            {criterioItems.length > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#0062CC] text-[#FFFFFF] tabular">
                {criterioItems.length}
              </span>
            )}
          </div>

          <button
            onClick={() => onNavigate('accionables')}
            className="text-xs text-[#0062CC] hover:underline font-medium flex items-center gap-1"
          >
            <span>Ver todos en Accionables</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {criterioItems.length === 0 ? (
          <div className="py-4 text-xs text-[#F5F7FA] opacity-50 italic">
            Sin decisiones pendientes. Todos los accionables están acordados o en curso.
          </div>
        ) : (
          <div className="space-y-2">
            {criterioItems.map(item => {
              const isDisp = item.type === 'dispute';
              return (
                <div
                  key={item.id}
                  onClick={() => onOpenActionable(item.action)}
                  className="p-3.5 rounded-xl cursor-pointer transition-colors hover:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderLeft: isDisp ? '2px solid var(--primary)' : undefined
                  }}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0062CC]/15 text-[#FFFFFF] border border-[#0062CC]/30">
                        {item.client}
                      </span>
                      <span className={`text-[11px] ${isDisp ? 'font-semibold text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70'}`}>
                        {item.type === 'dispute' ? 'En Disputa' :
                         item.type === 'blocked_inference' ? 'Inferencia Bloqueada' :
                         item.type === 'urgent_unreviewed' ? 'Urgente Sin Revisión' :
                         '3+ Semanas Pendiente'}
                      </span>
                      <span className="text-xs text-[#FFFFFF] font-medium truncate max-w-md">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-[#F5F7FA] opacity-70 truncate">
                      {item.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.type === 'blocked_inference' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await updateActionableStatus(item.action.id, NOTION_STATES.PROPUESTO);
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#0062CC] hover:opacity-90 text-[#FFFFFF] text-xs font-semibold flex items-center gap-1"
                      >
                        <Check size={12} /> Confirmar
                      </button>
                    )}
                    <span className="text-xs text-[#0062CC] font-semibold flex items-center gap-1">
                      Detalle <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BLOQUE 3: PULSO (4 TARJETAS EN UNA FILA) */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Pulso de Hoy · {activeClient}
            </h2>
            {pulse?.is_provisional && (
              <span className="px-2 py-0.5 rounded text-[10px] text-[#F5F7FA] opacity-80" style={{ border: '1px solid var(--border-strong)' }}>
                <Clock size={10} className="inline mr-1" />
                Madurando
              </span>
            )}
          </div>
          <span className="text-xs text-[#F5F7FA] opacity-60 tabular">
            Actualizado {pulse?.last_updated || 'intradía'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Gasto Hoy */}
          <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-xs text-[#F5F7FA] opacity-60 mb-1">Gasto Hoy</div>
            <div className="text-lg font-bold text-[#FFFFFF] tabular">
              {pulse ? formatCurrency(pulse.gasto_hoy || 0, activeClient) : '—'}
            </div>
            <div className="text-[11px] text-[#F5F7FA] opacity-50 tabular mt-1">
              Ritmo: {pulse?.ritmo_gasto ? `${pulse.ritmo_gasto}%` : 'normal'}
            </div>
          </div>

          {/* Conversiones Hoy */}
          <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-xs text-[#F5F7FA] opacity-60 mb-1">Conversiones</div>
            <div className="text-lg font-bold text-[#FFFFFF] tabular">
              {pulse?.conv_hoy !== undefined ? pulse.conv_hoy : '—'}
            </div>
            <div className="text-[11px] text-[#F5F7FA] opacity-50 tabular mt-1">
              vs ayer: {pulse?.conv_ayer !== undefined ? pulse.conv_ayer : '—'}
            </div>
          </div>

          {/* CPA Hoy */}
          <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-xs text-[#F5F7FA] opacity-60 mb-1">CPA Hoy</div>
            <div className="text-lg font-bold text-[#FFFFFF] tabular">
              {pulse?.cpa_hoy ? formatCurrency(pulse.cpa_hoy, activeClient) : '—'}
            </div>
            <div className="text-[11px] text-[#F5F7FA] opacity-50 tabular mt-1">
              {pulse?.cpa_hoy && pulse?.cpa_ayer ? (pulse.cpa_hoy <= pulse.cpa_ayer ? 'estable' : 'bajo supervisión') : '—'}
            </div>
          </div>

          {/* Madurez de Datos */}
          <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-xs text-[#F5F7FA] opacity-60 mb-1">Estado de Madurez</div>
            <div className="text-sm font-semibold text-[#FFFFFF] mt-1">
              {pulse?.madurez || 'Consolidado'}
            </div>
            <div className="text-[11px] text-[#F5F7FA] opacity-50 mt-1">
              {pulse?.is_provisional ? 'Atribución pendiente' : 'Lectura final'}
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 4: PREGUNTAS ABIERTAS DE LAS TAREAS SEMANALES */}
      <div 
        className="p-5 rounded-2xl space-y-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-[#F5F7FA] opacity-70" />
            <h2 className="text-[15px] font-medium text-[#FFFFFF]">
              Preguntas abiertas de las tareas semanales
            </h2>
          </div>
          <span className="text-xs text-[#F5F7FA] opacity-50">
            Lo que el sistema necesita de Andrés
          </span>
        </div>

        {openQuestions.length === 0 ? (
          <div className="py-4 text-xs text-[#F5F7FA] opacity-50 italic">
            No hay preguntas abiertas ni hipótesis pendientes en los briefs actuales.
          </div>
        ) : (
          <div className="space-y-2">
            {openQuestions.map(q => (
              <div 
                key={q.id}
                className="p-3 rounded-xl flex items-start justify-between gap-3 text-xs"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-[#FFFFFF]">
                      {q.client}
                    </span>
                    <span className="font-semibold text-[#FFFFFF]">
                      {q.text}
                    </span>
                  </div>
                </div>

                {q.briefId && (
                  <button
                    onClick={() => onNavigate('briefs', { briefId: q.briefId! })}
                    className="px-2.5 py-1 rounded text-xs font-semibold text-[#FFFFFF] hover:bg-white/10 flex items-center gap-1 shrink-0"
                    style={{ border: '1px solid var(--border-strong)' }}
                  >
                    <span>Ver brief</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
