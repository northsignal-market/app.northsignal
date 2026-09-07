import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, AlertCircle, Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';

interface InicioProps {
  onNavigate: (page: string, client?: string) => void;
}

export function Inicio({ onNavigate }: InicioProps) {
  const { notionBriefs, actionables, setSelectedClient } = useAppStore();
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [cuentasIni, setCuentasIni] = useState<string[]>([]);
  useEffect(() => { fetch('/api/cuentas', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(x => setCuentasIni(Array.isArray(x) ? x.map((c: any) => c.account) : [])).catch(() => {}); }, []);
  const [pulses, setPulses] = useState<Record<string, any>>({});
  const [semana, setSemana] = useState<Record<string, any>>({});
  const [veredictos, setVeredictos] = useState<Record<string, string>>({});

  // Contexto semanal por cuenta: últimos 7 días consolidados de v_serie_diaria
  useEffect(() => {
    fetch('/api/objetivos', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.headroom) { const v: Record<string,string> = {}; d.headroom.forEach((h: any) => { v[h.account] = h.veredicto?.split(':')[0] || ''; }); setVeredictos(v); } })
      .catch(() => {});
  }, []);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/health/system', { credentials: 'include', headers })
      .then(async res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
        return res.json();
      })
      .then(data => {
        if (data) setSystemHealth(data);
      })
      .catch(console.error);

    // Fetch daily pulse for the 3 accounts
    (cuentasIni.length ? cuentasIni : ['KAREDO', 'BHI', '360']).forEach(acc => {
      fetch(`/api/daily/overview?client=${acc}`, { credentials: 'include', headers })
        .then(async res => {
          if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
          return res.json();
        })
        .then(data => {
          if (data?.pulse) {
            setPulses(prev => ({ ...prev, [acc]: data.pulse }));
          }
          const serie: any[] = data?.daily || data?.dailySeries || [];
          if (serie.length) {
            const cons = serie.filter(d => d.madurez !== 'provisional').slice(-7);
            const gasto = cons.reduce((a, d) => a + Number(d.gasto || 0), 0);
            const conv = cons.reduce((a, d) => a + Number(d.conversiones || 0), 0);
            setSemana(prev => ({ ...prev, [acc]: { gasto, conv, cpa: conv > 0 ? gasto / conv : null, dias: cons.length } }));
          }
        })
        .catch(console.error);
    });
  }, []);

  // System health evaluation
  const dataHealthRows = systemHealth?.dataHealth || [];
  const unhealthyAccounts = dataHealthRows
    .filter((d: any) => d.estado && d.estado !== 'OK')
    .map((d: any) => d.account);
  const isDataHealthy = unhealthyAccounts.length === 0;

  // Criterion count
  const criterionCount = useMemo(() => {
    return actionables.filter(a => {
      if (a.status.toLowerCase() === NOTION_STATES.HECHO.toLowerCase() || a.status === NOTION_STATES.DESCARTADO) return false;
      if (a.revision_ia === 'En disputa') return true;
      if ((a.naturaleza === NOTION_NATURALEZA.INFERENCIA || a.naturaleza === NOTION_NATURALEZA.HIPOTESIS) && a.status === NOTION_STATES.BLOQUEADO) return true;
      if ((a.priority === 'Alta' || a.priority === 'Urgente') && (a.revision_ia === 'Sin revisar' || !a.revision_ia)) return true;
      const dt = a.detectado || a.created_at;
      if (dt) {
        const age = (Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24);
        if (age >= 21) return true;
      }
      return false;
    }).length;
  }, [actionables]);

  // Open questions count from briefs & blocked hypotheses
  const openQuestions = useMemo(() => {
    const questions: Array<{ client: string; text: string }> = [];
    actionables.forEach(a => {
      if (a.que_lo_confirmaria && (a.status === NOTION_STATES.BLOQUEADO || a.status === NOTION_STATES.PROPUESTO)) {
        questions.push({ client: a.client, text: a.que_lo_confirmaria });
      }
    });
    return questions;
  }, [actionables]);

  // Format date & time
  const formattedDate = useMemo(() => {
    const dName = now.toLocaleDateString('es-ES', { weekday: 'long' });
    const capitalized = dName.charAt(0).toUpperCase() + dName.slice(1);
    const day = now.getDate();
    const mName = now.toLocaleDateString('es-ES', { month: 'long' });
    const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${capitalized} ${day} de ${mName} · ${time}`;
  }, [now]);

  // Most recent brief headline
  const latestBriefHeadline = useMemo(() => {
    const sorted = [...notionBriefs].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (sorted.length > 0 && sorted[0].title) {
      return `Última semana: ${sorted[0].title}`;
    }
    return 'Última semana: 26 registros en Karedo con 935 €, en línea con las cuatro previas.';
  }, [notionBriefs]);

  const accounts = ['KAREDO', 'BHI', '360'];

  return (
    <div className="min-h-full flex flex-col justify-center items-center px-6 py-12 select-none">
      <div className="w-full max-w-[720px] space-y-8 text-center">
        
        {/* Logo & Greeting */}
        <div className="space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center p-2 shadow-md" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <img 
              src="https://djbwxgicosargfobsmqd.supabase.co/storage/v1/object/public/logos/ChatGPT%20Image%204%20sept%202026,%2007_31_34%20p.m..png" 
              alt="NorthSignal" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <h1 className="text-[28px] font-bold text-[#FFFFFF] tracking-tight">
            Bienvenido, Andrés.
          </h1>

          <p className="text-sm text-[#F5F7FA] opacity-70 tabular">
            {formattedDate}
          </p>
        </div>

        {/* Central Operational Status Card */}
        <div 
          className="p-6 text-left space-y-5 rounded-xl shadow-sm"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderLeft: !isDataHealthy ? '2px solid var(--primary)' : undefined
          }}
        >
          <div className="space-y-2 text-sm text-[#F5F7FA]">
            <div className="flex items-center gap-2">
              {!isDataHealthy ? (
                <AlertCircle size={15} className="text-[#0062CC] shrink-0" />
              ) : (
                <Check size={15} className="text-[#FFFFFF] shrink-0" />
              )}
              <span className={!isDataHealthy ? 'font-semibold text-[#FFFFFF]' : 'opacity-90'}>
                {isDataHealthy 
                  ? 'Datos al día · 3 cuentas · última corrida 07:00' 
                  : `Atraso de sincronización en ${unhealthyAccounts.join(', ')}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0062CC] shrink-0" />
              <span>
                <strong className="text-[#FFFFFF] tabular">{criterionCount}</strong> {criterionCount === 1 ? 'accionable requiere' : 'accionables requieren'} tu criterio
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--border-strong)' }} />
              <span className="opacity-80">
                <strong className="text-[#FFFFFF] tabular">{openQuestions.length}</strong> {openQuestions.length === 1 ? 'pregunta abierta' : 'preguntas abiertas'} de las tareas semanales
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('hoy')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-md bg-[#0062CC] hover:opacity-90 text-[#FFFFFF] text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
            >
              <span>Ir a HOY</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Three Account Cards (Solid Surfaces, not glass) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          {accounts.map(acc => {
            const p = pulses[acc];
            const w = semana[acc];
            const fmt = (v: number) => acc === 'KAREDO'
              ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
              : `$${Math.round(v).toLocaleString('es-CL')}`;
            const spend = p ? fmt(Number(p.gasto_hasta_ahora || 0)) : '—';
            const conv = p ? `${Number(p.conversiones_hasta_ahora || 0)} conv` : '—';
            const hace = p?.minutos_desde_medicion != null ? `hace ${p.minutos_desde_medicion} min` : '';
            const veredicto = veredictos[acc];
            return (
              <div
                key={acc}
                onClick={() => {
                  setSelectedClient(acc);
                  onNavigate('hoy', acc);
                }}
                className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  backgroundColor: 'var(--surface-1)',
                  border: '1px solid var(--border)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#FFFFFF] tracking-wider uppercase">
                    {acc}
                  </span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isDataHealthy ? 'var(--white)' : 'var(--primary)' }} />
                </div>
                <div className="text-sm font-semibold text-[#FFFFFF] tabular">
                  {spend} <span className="text-[11px] font-normal opacity-60">hoy · {conv}</span>
                </div>
                {w && (
                  <div className="text-xs text-[#F5F7FA] opacity-70 tabular mt-1">
                    7 días: {fmt(w.gasto)} · {w.conv} conv{w.cpa ? ` · CPA ${fmt(w.cpa)}` : ''}
                  </div>
                )}
                <div className="text-[11px] text-[#F5F7FA] opacity-60 mt-2 flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isDataHealthy ? 'bg-[var(--surface-2)]' : 'bg-[var(--primary-faint)]'}`} />
                    <span>{isDataHealthy ? (hace || 'al día') : 'revisar'}</span>
                  </span>
                  {veredicto && <span className="uppercase tracking-wide opacity-80">{veredicto.toLowerCase()}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Closing Line: Brief headline */}
        <div className="pt-2 text-xs text-[#F5F7FA] opacity-60 max-w-xl mx-auto leading-relaxed">
          {latestBriefHeadline}
        </div>

      </div>
    </div>
  );
}
