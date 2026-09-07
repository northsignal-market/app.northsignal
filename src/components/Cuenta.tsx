import { useCuentas } from '../lib/useCuentas';
/**
 * CUENTA · todo lo de una cuenta, en pestañas, con el selector arriba.
 * Reúne lo que antes eran cuatro secciones del menú (Semana, Clientes,
 * Briefs, Accionables). Nada se pierde; deja de estar todo a la vista.
 */
import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Semana } from './Semana';
import { Clientes } from './Clientes';
import { Briefs } from './Briefs';
import { Accionables } from './Accionables';
import type { Actionable } from '../types';

export type SegmentoCuenta = 'semana' | 'diagnostico' | 'brief' | 'accionables' | 'memoria' | 'reportes';
const SEGMENTOS: { id: SegmentoCuenta; label: string; ayuda: string }[] = [
  { id: 'semana', label: 'Semana', ayuda: 'Gráfico, plan de la semana, día por día, búsquedas nuevas' },
  { id: 'diagnostico', label: 'Diagnóstico', ayuda: 'Objetivos, por qué está donde está, decisiones estructurales, pendientes' },
  { id: 'brief', label: 'Brief', ayuda: 'El análisis completo del lunes' },
  { id: 'accionables', label: 'Accionables', ayuda: 'Todos, incluidos hechos y descartados' },
  { id: 'memoria', label: 'Memoria', ayuda: 'Hipótesis, aprendizajes, doc maestro' },
  { id: 'reportes', label: 'Reportes', ayuda: 'Borradores para aprobar y enviados' },
];

interface Props {
  segmento: SegmentoCuenta; onSegmento: (s: SegmentoCuenta) => void;
  onOpenActionable: (a: Actionable) => void; briefId?: string; onNavigateToBrief: (id: string) => void;
}

export function Cuenta({ segmento, onSegmento, onOpenActionable, briefId, onNavigateToBrief }: Props) {
  const { selectedClient, setSelectedClient, actionables } = useAppStore();
  const cuenta = selectedClient || 'KAREDO';
  const { nombres: cuentas } = useCuentas();
  const abiertos = actionables.filter(a => a.client === cuenta && (a.status === 'Propuesto' || a.status === 'Bloqueado')).length;
  useEffect(() => { if (briefId) onSegmento('brief'); }, [briefId]);

  return (
    <div className="h-full flex flex-col">
      {/* Cabecera: cuenta y pestañas. Fija. */}
      <div className="px-6 md:px-8 pt-5 pb-0 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            {cuentas.map(c => (
              <button key={c} onClick={() => setSelectedClient(c)} className={`px-3 py-1 rounded-md text-xs font-medium ${cuenta === c ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'}`}>{c}</button>
            ))}
          </div>
          <span className="text-[11px] text-[#F5F7FA] opacity-50">{abiertos > 0 ? `${abiertos} accionable${abiertos !== 1 ? 's' : ''} abierto${abiertos !== 1 ? 's' : ''}` : 'sin accionables abiertos'}</span>
        </div>
        <div className="flex gap-0.5 -mb-px overflow-x-auto">
          {SEGMENTOS.map(s => (
            <button key={s.id} onClick={() => onSegmento(s.id)} title={s.ayuda}
              className={`px-3.5 py-2 text-xs whitespace-nowrap transition-colors ${segmento === s.id ? 'text-[#FFFFFF] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}
              style={{ borderBottom: segmento === s.id ? '2px solid var(--primary)' : '2px solid transparent' }}>
              {s.label}{s.id === 'accionables' && abiertos > 0 ? <span className="ml-1 text-[10px] opacity-60">{abiertos}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {/* Contenido */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {segmento === 'semana' && <Semana onOpenActionable={(id: string) => { const f = actionables.find(a => a.id === id); if (f) onOpenActionable(f); }} />}
        {segmento === 'diagnostico' && <Clientes zona="diagnostico" onOpenActionable={onOpenActionable} onNavigateToBrief={onNavigateToBrief} />}
        {segmento === 'brief' && <Briefs initialBriefId={briefId} onOpenActionable={(id) => { const f = actionables.find(a => a.id === id); if (f) onOpenActionable(f); }} />}
        {segmento === 'accionables' && <Accionables onOpenActionable={onOpenActionable} initialClient={cuenta} />}
        {segmento === 'memoria' && <Clientes zona="memoria" onOpenActionable={onOpenActionable} onNavigateToBrief={onNavigateToBrief} />}
        {segmento === 'reportes' && <Clientes zona="reportes" onOpenActionable={onOpenActionable} onNavigateToBrief={onNavigateToBrief} />}
      </div>
    </div>
  );
}
