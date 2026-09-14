import { useCuentaActiva } from '../lib/useCuentas';
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
// Cuatro pestañas: brief y diagnóstico son LENTES de la misma semana (tres
// miradas del mismo objeto no son tres lugares). Viven como sub-vistas de
// Semana; las rutas viejas y ⌘K siguen llegando directo a cada una.
const SEGMENTOS: { id: SegmentoCuenta; label: string; ayuda: string }[] = [
  { id: 'semana', label: 'Semana', ayuda: 'El plan, la tendencia, el brief del lunes y el diagnóstico' },
  { id: 'accionables', label: 'Accionables', ayuda: 'Todos, incluidos hechos y descartados' },
  { id: 'memoria', label: 'Memoria', ayuda: 'Hipótesis, aprendizajes, doc maestro' },
  { id: 'reportes', label: 'Reportes', ayuda: 'Borradores para aprobar y enviados' },
];
const FAMILIA_SEMANA: SegmentoCuenta[] = ['semana', 'brief', 'diagnostico'];
const SUBVISTAS: { id: SegmentoCuenta; label: string }[] = [
  { id: 'semana', label: 'Esta semana' },
  { id: 'brief', label: 'Brief del lunes' },
  { id: 'diagnostico', label: 'Diagnóstico' },
];

interface Props {
  segmento: SegmentoCuenta; onSegmento: (s: SegmentoCuenta) => void;
  onOpenActionable: (a: Actionable) => void; briefId?: string; onNavigateToBrief: (id: string) => void;
}

export function Cuenta({ segmento, onSegmento, onOpenActionable, briefId, onNavigateToBrief }: Props) {
  const { selectedClient, actionables } = useAppStore();
  const cuenta = useCuentaActiva(selectedClient) || selectedClient || '';
  const abiertos = actionables.filter(a => a.client === cuenta && (a.status === 'Propuesto' || a.status === 'Bloqueado')).length;
  useEffect(() => { if (briefId) onSegmento('brief'); }, [briefId]);

  return (
    <div className="h-full flex flex-col">
      {/* Cabecera en UNA fila: pestañas a la izquierda, lentes de la semana a la
          derecha. El selector de cuenta NO vive acá — es el del header, y tenerlo
          dos veces en pantalla era la repetición más cara de la app (tres filas
          de chrome antes del primer dato). */}
      <div className="px-5 md:px-7 shrink-0 flex items-end justify-between gap-4 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex gap-0.5 -mb-px overflow-x-auto">
          {SEGMENTOS.map(s => {
            const activo = s.id === segmento || (s.id === 'semana' && FAMILIA_SEMANA.includes(segmento));
            return (
              <button key={s.id} onClick={() => onSegmento(s.id)} title={s.ayuda}
                className={`px-3.5 py-2.5 text-xs whitespace-nowrap transition-colors ${activo ? 'text-[#EDEFF3] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}
                style={{ borderBottom: activo ? '2px solid var(--primary)' : '2px solid transparent' }}>
                {s.label}{s.id === 'accionables' && abiertos > 0 ? <span className="ml-1.5 text-[10px] tabular px-1.5 py-px rounded-full" style={{ border: '1px solid var(--border-strong)', color: '#ADADAD' }}>{abiertos}</span> : null}
              </button>
            );
          })}
        </div>
        {/* Las tres lentes del mismo período, a un clic, sin robar una fila. */}
        {FAMILIA_SEMANA.includes(segmento) && (
          <div className="flex items-center gap-1 pb-1.5">
            {SUBVISTAS.map(v => (
              <button key={v.id} onClick={() => onSegmento(v.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${segmento === v.id ? 'bg-white/10 text-[#FAFAFA]' : 'text-[#ADADAD] hover:text-[#FAFAFA]'}`}>
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Contenido */}
      {/* `overflow-x-clip` explícito: sin él, `overflow-y-auto` hace que el navegador
          compute `overflow-x: auto` y este contenedor —el que scrollea el contenido de
          Cuenta— se vuelve un scroller HORIZONTAL. Medido en producción: 847px de
          contenido contra 619 visibles. Defensa en profundidad: la causa de esos 228px
          era el tooltip de `Pista` (ya arreglada), pero cualquier cosa ancha que entre
          mañana no tiene por qué colgar una barra acá. */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-clip custom-scrollbar">
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
