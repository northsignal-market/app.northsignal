import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, ChevronLeft, ChevronRight, Calendar, ArrowRight,
  ExternalLink, Clock, RefreshCw, Layers, Check
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { NotionBrief } from '../types';

interface BriefsProps {
  onOpenActionable?: (actionId: string) => void;
  initialBriefId?: string;
}

export function Briefs({ onOpenActionable, initialBriefId }: BriefsProps) {
  const { notionBriefs, selectedClient, setSelectedClient, actionables } = useAppStore();
  const activeClient = selectedClient || '360';

  const [selectedBrief, setSelectedBrief] = useState<NotionBrief | null>(null);
  const [briefBlocks, setBriefBlocks] = useState<any[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Client briefs sorted chronologically (latest first)
  const clientBriefs = useMemo(() => {
    return notionBriefs
      .filter(b => b.client?.toLowerCase() === activeClient.toLowerCase())
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [notionBriefs, activeClient]);

  // Set initial or default brief
  useEffect(() => {
    if (initialBriefId) {
      const found = notionBriefs.find(b => b.id === initialBriefId);
      if (found) {
        setSelectedBrief(found);
        return;
      }
    }
    if (clientBriefs.length > 0 && (!selectedBrief || selectedBrief.client?.toLowerCase() !== activeClient.toLowerCase())) {
      setSelectedBrief(clientBriefs[0]);
    }
  }, [clientBriefs, initialBriefId, activeClient]);

  // Fetch Notion page content blocks
  useEffect(() => {
    if (!selectedBrief?.id) {
      setBriefBlocks([]);
      return;
    }
    setLoadingBlocks(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`/api/notion/page/${selectedBrief.id}/blocks`, { credentials: 'include', headers })
      .then(async res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { blocks: [] };
        return res.json();
      })
      .then(data => setBriefBlocks(data?.blocks || []))
      .catch(err => {
        console.warn('Failed to load blocks:', err);
        setBriefBlocks([]);
      })
      .finally(() => setLoadingBlocks(false));
  }, [selectedBrief?.id]);

  // Current brief index
  const currentIndex = useMemo(() => {
    if (!selectedBrief) return -1;
    return clientBriefs.findIndex(b => b.id === selectedBrief.id);
  }, [clientBriefs, selectedBrief]);

  const hasNewer = currentIndex > 0;
  const hasOlder = currentIndex !== -1 && currentIndex < clientBriefs.length - 1;

  // Extract provisional days note if any
  const provisionalDays = selectedBrief?.provisional_days || 0;

  // Mentioned actionables
  const mentionedActions = useMemo(() => {
    if (!selectedBrief) return [];
    return actionables.filter(a => a.brief_id === selectedBrief.id || a.client.toLowerCase() === activeClient.toLowerCase());
  }, [selectedBrief, actionables, activeClient]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header with Client Selection & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">
            Briefs Ejecutivos
          </h1>
          <p className="text-xs text-[#F5F7FA] opacity-70 mt-0.5">
            ¿Qué dijo el análisis? Cadena temporal y handoff semanal de {activeClient}
          </p>
        </div>

        {/* Temporal chain buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => hasOlder && setSelectedBrief(clientBriefs[currentIndex + 1])}
            disabled={!hasOlder}
            className="px-3 py-1.5 rounded text-xs font-semibold text-[#FFFFFF] hover:bg-white/10 disabled:opacity-30 flex items-center gap-1 transition-opacity"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
          >
            <ChevronLeft size={14} />
            <span>Semana Anterior</span>
          </button>

          <button
            onClick={() => hasNewer && setSelectedBrief(clientBriefs[currentIndex - 1])}
            disabled={!hasNewer}
            className="px-3 py-1.5 rounded text-xs font-semibold text-[#FFFFFF] hover:bg-white/10 disabled:opacity-30 flex items-center gap-1 transition-opacity"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
          >
            <span>Semana Siguiente</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Main Layout: Left Brief list, Right Reader view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Briefs index */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#F5F7FA] opacity-60 block mb-1">
            Histórico de Semanas ({clientBriefs.length})
          </span>

          {clientBriefs.length === 0 ? (
            <div className="p-4 rounded-xl text-xs text-[#F5F7FA] opacity-50 italic" style={{ backgroundColor: 'var(--surface-1)' }}>
              No hay briefs sincronizados para {activeClient}.
            </div>
          ) : (
            clientBriefs.map((brief, i) => {
              const isSelected = selectedBrief?.id === brief.id;
              return (
                <div
                  key={brief.id}
                  onClick={() => setSelectedBrief(brief)}
                  className="p-3.5 rounded-xl cursor-pointer transition-all hover:bg-white/5"
                  style={{
                    backgroundColor: isSelected ? 'var(--surface-2)' : 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderLeft: isSelected ? '2px solid var(--primary)' : undefined
                  }}
                >
                  <div className="flex items-center justify-between text-[11px] text-[#F5F7FA] opacity-60 mb-1">
                    <span className="tabular font-medium">
                      {brief.date ? new Date(brief.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sin fecha'}
                    </span>
                    {i === 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#0062CC] text-[#FFFFFF]">
                        MÁS RECIENTE
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-[#FFFFFF] leading-snug line-clamp-2">
                    {brief.title}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Full Page Reading Mode */}
        <div className="lg:col-span-8 space-y-5">
          {!selectedBrief ? (
            <div className="p-8 rounded-2xl text-center text-xs text-[#F5F7FA] opacity-50 italic" style={{ backgroundColor: 'var(--surface-1)' }}>
              Seleccione un brief para comenzar la lectura.
            </div>
          ) : (
            <div 
              className="p-6 rounded-2xl space-y-5"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
            >
              {/* Brief Title & Meta */}
              <div className="space-y-2 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#0062CC]/15 text-[#FFFFFF] border border-[#0062CC]/30">
                    {selectedBrief.client}
                  </span>
                  <span className="text-xs text-[#F5F7FA] opacity-70 tabular flex items-center gap-1">
                    <Calendar size={12} />
                    {selectedBrief.date || 'Semana activa'}
                  </span>
                  {provisionalDays > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] text-[#F5F7FA] opacity-75" style={{ border: '1px solid var(--border-strong)' }}>
                      <Clock size={11} className="inline mr-1" />
                      {provisionalDays} días provisionales (atribución pendiente)
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-[#FFFFFF]">
                  {selectedBrief.title}
                </h2>
              </div>

              {/* Handoff Section (Highlighted with --primary) */}
              {selectedBrief.handoff && (
                <div 
                  className="p-4 rounded-xl space-y-1.5"
                  style={{ 
                    backgroundColor: 'var(--surface-2)', 
                    borderLeft: '2px solid var(--primary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Handoff Semanal a Andrés</span>
                  </div>
                  <p className="text-xs text-[#F5F7FA] leading-relaxed whitespace-pre-wrap">
                    {selectedBrief.handoff}
                  </p>
                </div>
              )}

              {/* Document Blocks Content */}
              <div className="space-y-3 text-xs leading-relaxed text-[#F5F7FA]">
                {loadingBlocks ? (
                  <div className="py-8 text-center opacity-50 italic">
                    Cargando documento completo desde Notion...
                  </div>
                ) : briefBlocks.length === 0 ? (
                  <div className="opacity-70 italic py-2">
                    Contenido no disponible directamente. Consulte los puntos clave del resumen arriba.
                  </div>
                ) : (
                  briefBlocks.map((block, idx) => {
                    const text = block.text || '';
                    if (block.type === 'heading_1') {
                      return <h2 key={idx} className="text-base font-bold text-[#FFFFFF] pt-3">{text}</h2>;
                    }
                    if (block.type === 'heading_2') {
                      return <h3 key={idx} className="text-sm font-semibold text-[#FFFFFF] pt-2">{text}</h3>;
                    }
                    if (block.type === 'bulleted_list_item') {
                      return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                          <span className="text-[#0062CC]">•</span>
                          <span>{text}</span>
                        </div>
                      );
                    }
                    return <p key={idx} className="opacity-90">{text}</p>;
                  })
                )}
              </div>

              {/* Mentioned Actionables */}
              {mentionedActions.length > 0 && onOpenActionable && (
                <div className="pt-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs font-semibold text-[#FFFFFF] uppercase tracking-wider block">
                    Accionables vinculados a este período
                  </span>
                  <div className="space-y-1.5">
                    {mentionedActions.slice(0, 4).map(act => (
                      <div
                        key={act.id}
                        onClick={() => onOpenActionable(act.id)}
                        className="p-2.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 transition-colors"
                        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      >
                        <span className="text-xs text-[#FFFFFF] font-medium truncate pr-2">
                          {act.title}
                        </span>
                        <span className="text-xs text-[#0062CC] font-semibold shrink-0 flex items-center gap-1">
                          Ver <ArrowRight size={11} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
