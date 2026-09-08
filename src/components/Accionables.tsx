import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Check, Cpu, AlertCircle, X, ChevronDown, ChevronUp,
  ArrowUpDown, Filter, Sparkles
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Actionable } from '../types';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';

interface AccionablesProps {
  onOpenActionable: (action: Actionable) => void;
  initialClient?: string;
  initialStatus?: string;
}

export function Accionables({
  onOpenActionable,
  initialClient,
  initialStatus
}: AccionablesProps) {
  const { actionables, updateActionableStatus } = useAppStore();

  const [search, setSearch] = useState('');
  const [cuentasApi, setCuentasApi] = useState<any[]>([]);
  useEffect(() => { fetch('/api/cuentas', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(x => setCuentasApi(Array.isArray(x) ? x : [])).catch(() => {}); }, []);
  const [novedadesIds, setNovedadesIds] = useState<Set<string>>(new Set());
  useEffect(() => { fetch('/api/novedades', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then((d: any[]) => setNovedadesIds(new Set((Array.isArray(d) ? d : []).filter(n => n.ref_tipo === 'accionable').map(n => n.ref_id)))).catch(() => {}); }, []);
  const [filterClient, setFilterClient] = useState<string>(initialClient || 'all');
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterNaturaleza, setFilterNaturaleza] = useState<string>('all');
  const [filterRevision, setFilterRevision] = useState<string>('all');
  const [sortField, setSortField] = useState<'priority' | 'weeks' | 'client'>('priority');
  const [sortAsc, setSortAsc] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Record<string, boolean>>({});

  // Compute weeks pending for an actionable
  const getWeeksPending = (a: Actionable) => {
    const dt = a.detectado || a.created_at;
    if (!dt) return 0;
    const diff = (Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24 * 7);
    return Math.max(0, Math.floor(diff));
  };

  const priorityWeights: Record<string, number> = {
    'Urgente': 4,
    'Alta': 3,
    'Media': 2,
    'Baja': 1
  };

  // Filtered and sorted actionables
  const filtered = useMemo(() => {
    return actionables.filter(a => {
      if (filterClient !== 'all' && a.client.toLowerCase() !== filterClient.toLowerCase()) return false;
      if (filterStatus !== 'all' && a.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
      if (filterPriority !== 'all' && a.priority.toLowerCase() !== filterPriority.toLowerCase()) return false;
      if (filterNaturaleza !== 'all' && (a.naturaleza || '').toLowerCase() !== filterNaturaleza.toLowerCase()) return false;
      if (filterRevision !== 'all' && (a.revision_ia || '').toLowerCase() !== filterRevision.toLowerCase()) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (a.title || '').toLowerCase().includes(q);
        const matchWhy = (a.why || '').toLowerCase().includes(q);
        const matchWhere = (a.where || '').toLowerCase().includes(q);
        if (!matchTitle && !matchWhy && !matchWhere) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'priority') {
        const wa = priorityWeights[a.priority] || 0;
        const wb = priorityWeights[b.priority] || 0;
        if (wa !== wb) return sortAsc ? wa - wb : wb - wa;
        return getWeeksPending(b) - getWeeksPending(a);
      }
      if (sortField === 'weeks') {
        const wa = getWeeksPending(a);
        const wb = getWeeksPending(b);
        return sortAsc ? wa - wb : wb - wa;
      }
      if (sortField === 'client') {
        return sortAsc ? a.client.localeCompare(b.client) : b.client.localeCompare(a.client);
      }
      return 0;
    });
  }, [actionables, filterClient, filterStatus, filterPriority, filterNaturaleza, filterRevision, search, sortField, sortAsc]);

  const handleQuickAnalyze = async (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation();
    setAnalyzingIds(prev => ({ ...prev, [actionId]: true }));
    try {
      await fetch(`/api/notion/actionables/${actionId}/analyze`, { method: 'POST', credentials: 'include' });
      // update state if needed
    } catch(err) {
      console.error(err);
    } finally {
      setAnalyzingIds(prev => ({ ...prev, [actionId]: false }));
    }
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (filterClient !== 'all') chips.push({ key: 'client', label: `Cliente: ${filterClient}`, onClear: () => setFilterClient('all') });
    if (filterStatus !== 'all') chips.push({ key: 'status', label: `Estado: ${filterStatus}`, onClear: () => setFilterStatus('all') });
    if (filterPriority !== 'all') chips.push({ key: 'priority', label: `Prioridad: ${filterPriority}`, onClear: () => setFilterPriority('all') });
    if (filterNaturaleza !== 'all') chips.push({ key: 'nat', label: `Naturaleza: ${filterNaturaleza}`, onClear: () => setFilterNaturaleza('all') });
    if (filterRevision !== 'all') chips.push({ key: 'rev', label: `Revisión: ${filterRevision}`, onClear: () => setFilterRevision('all') });
    if (search) chips.push({ key: 'search', label: `Buscar: "${search}"`, onClear: () => setSearch('') });
    return chips;
  }, [filterClient, filterStatus, filterPriority, filterNaturaleza, filterRevision, search]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">
            Accionables
          </h1>
          <p className="text-xs text-[#F5F7FA] opacity-70 mt-0.5">
            ¿Qué tengo que ejecutar? Lista unificada de acciones con trazabilidad en Notion
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F5F7FA] opacity-50" />
          <input aria-label="Search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar accionables..."
            className="w-full bg-transparent rounded-md pl-9 pr-3 py-1.5 text-xs text-[#FFFFFF] placeholder-[#F5F7FA]/40 outline-none"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--surface-1)' }}
          />
        </div>
      </div>

      {/* Filter Selectors Bar */}
      <div 
        className="p-3 rounded-xl flex items-center gap-3 flex-wrap text-xs"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1.5 text-[#F5F7FA] opacity-70">
          <Filter size={13} />
          <span className="font-semibold uppercase text-[10px] tracking-wider">Filtros:</span>
        </div>

        {/* Client */}
        <select aria-label="Filter Client"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
        >
          <option value="all" className="bg-[#1A1F36]">Todos los Clientes</option>
          {(cuentasApi.length ? cuentasApi.map((c: any) => c.account) : ['KAREDO']).map((a: string) => <option key={a} value={a} className="bg-[#1A1F36]">{a}</option>)}
        </select>

        {/* Status */}
        <select aria-label="Filter Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
        >
          <option value="all" className="bg-[#1A1F36]">Todos los Estados</option>
          <option value={NOTION_STATES.PROPUESTO} className="bg-[#1A1F36]">Propuesto</option>
          <option value={NOTION_STATES.EN_CURSO} className="bg-[#1A1F36]">En Curso</option>
          <option value={NOTION_STATES.HECHO} className="bg-[#1A1F36]">Hecho</option>
          <option value={NOTION_STATES.BLOQUEADO} className="bg-[#1A1F36]">Bloqueado</option>
          <option value={NOTION_STATES.DESCARTADO} className="bg-[#1A1F36]">Descartado</option>
        </select>

        {/* Priority */}
        <select aria-label="Filter Priority"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
        >
          <option value="all" className="bg-[#1A1F36]">Todas las Prioridades</option>
          <option value="Urgente" className="bg-[#1A1F36]">Urgente</option>
          <option value="Alta" className="bg-[#1A1F36]">Alta</option>
          <option value="Media" className="bg-[#1A1F36]">Media</option>
          <option value="Baja" className="bg-[#1A1F36]">Baja</option>
        </select>

        {/* Naturaleza */}
        <select aria-label="Filter Naturaleza"
          value={filterNaturaleza}
          onChange={(e) => setFilterNaturaleza(e.target.value)}
          className="bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
        >
          <option value="all" className="bg-[#1A1F36]">Toda Naturaleza</option>
          <option value={NOTION_NATURALEZA.DATO} className="bg-[#1A1F36]">Dato</option>
          <option value={NOTION_NATURALEZA.INFERENCIA} className="bg-[#1A1F36]">Inferencia</option>
          <option value={NOTION_NATURALEZA.HIPOTESIS} className="bg-[#1A1F36]">Hipótesis</option>
        </select>

        {/* Revision IA */}
        <select aria-label="Filter Revision"
          value={filterRevision}
          onChange={(e) => setFilterRevision(e.target.value)}
          className="bg-transparent rounded px-2.5 py-1 text-xs text-[#FFFFFF] outline-none"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
        >
          <option value="all" className="bg-[#1A1F36]">Todas las Revisiones IA</option>
          <option value="En disputa" className="bg-[#1A1F36]">En Disputa</option>
          <option value="Consenso" className="bg-[#1A1F36]">Consenso</option>
          <option value="Sin revisar" className="bg-[#1A1F36]">Sin segunda opinión</option>
        </select>
      </div>

      {/* Removable Chips */}
      {activeFilterChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilterChips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#FFFFFF]"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}
            >
              <span>{chip.label}</span>
              <button aria-label="Cerrar" title="Cerrar" onClick={chip.onClear} className="hover:opacity-70">
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              setFilterClient('all');
              setFilterStatus('all');
              setFilterPriority('all');
              setFilterNaturaleza('all');
              setFilterRevision('all');
              setSearch('');
            }}
            className="text-xs text-[#0062CC] hover:underline font-semibold ml-1"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Actions Table */}
      <div 
        className="rounded-xl overflow-hidden shadow-sm"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-0)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-1)', borderBottom: '1px solid var(--border)' }}>
                <th className="py-3 px-4 font-semibold text-[#FFFFFF]">Acción</th>
                <th 
                  className="py-3 px-3 font-semibold text-[#FFFFFF] cursor-pointer"
                  onClick={() => { setSortField('client'); setSortAsc(!sortAsc); }}
                >
                  <div className="flex items-center gap-1">
                    <span>Cliente</span>
                    <ArrowUpDown size={11} className="opacity-60" />
                  </div>
                </th>
                <th 
                  className="py-3 px-3 font-semibold text-[#FFFFFF] cursor-pointer"
                  onClick={() => { setSortField('priority'); setSortAsc(!sortAsc); }}
                >
                  <div className="flex items-center gap-1">
                    <span>Prioridad</span>
                    <ArrowUpDown size={11} className="opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold text-[#FFFFFF]">Estado</th>
                <th className="py-3 px-3 font-semibold text-[#FFFFFF]">Naturaleza</th>
                <th 
                  className="py-3 px-3 font-semibold text-[#FFFFFF] text-right cursor-pointer"
                  onClick={() => { setSortField('weeks'); setSortAsc(!sortAsc); }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Semanas</span>
                    <ArrowUpDown size={11} className="opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold text-[#FFFFFF]">Revisión IA</th>
                <th className="py-3 px-4 font-semibold text-[#FFFFFF] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#F5F7FA] opacity-50 italic">
                    No se encontraron accionables con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((action, idx) => {
                  const weeks = getWeeksPending(action);
                  const isDone = action.status.toLowerCase() === NOTION_STATES.HECHO.toLowerCase();
                  const isDispute = action.revision_ia === 'En disputa';
                  const isStale = weeks >= 3 && !isDone;

                  return (
                    <tr
                      key={action.id}
                      onClick={() => onOpenActionable(action)}
                      className="cursor-pointer transition-colors hover:bg-white/5"
                      style={{
                        backgroundColor: idx % 2 === 0 ? 'var(--surface-0)' : 'color-mix(in oklab, var(--surface-1) 50%, transparent)',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: isDispute ? '2px solid var(--primary)' : undefined,
                        opacity: isDone ? 0.6 : 1
                      }}
                    >
                      {/* Title & context */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-semibold text-[#FFFFFF] truncate flex items-center gap-1.5">
                          {novedadesIds.has(action.id) && <span className="w-1.5 h-1.5 rounded-full bg-[#0062CC] shrink-0" title="Un agente comentó o editó esto y no lo viste" />}
                          {action.title}
                        </div>
                        {action.why && (
                          <div className="text-[11px] text-[#F5F7FA] opacity-60 truncate mt-0.5">
                            {action.why}
                          </div>
                        )}
                      </td>

                      {/* Client */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0062CC]/15 text-[#FFFFFF] border border-[#0062CC]/30">
                          {action.client}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-semibold ${action.priority === 'Urgente' || action.priority === 'Alta' ? 'text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-75'}`}>
                          {action.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[#F5F7FA] opacity-80">
                          {action.status}
                        </span>
                      </td>

                      {/* Naturaleza */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[11px] text-[#F5F7FA] opacity-70">
                          {action.naturaleza || 'Dato'}
                        </span>
                      </td>

                      {/* Semanas Pendiente */}
                      <td className="py-3 px-3 text-right whitespace-nowrap tabular font-medium">
                        <span className={isStale ? 'font-bold text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-75'}>
                          {weeks > 0 ? `${weeks} sem` : '< 1 sem'}
                        </span>
                      </td>

                      {/* Revisión IA */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          isDispute ? 'font-semibold text-[#FFFFFF] border-l-2 border-[#0062CC]' : 'text-[#F5F7FA] opacity-70'
                        }`} style={{ backgroundColor: 'var(--surface-2)' }}>
                          {action.revision_ia || 'Sin revisar'}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                          {/* Toggle Hecho */}
                          <button
                            onClick={() => {
                              const next = isDone ? NOTION_STATES.PROPUESTO : NOTION_STATES.HECHO;
                              updateActionableStatus(action.id, next);
                            }}
                            title={isDone ? 'Marcar Propuesto' : 'Marcar Hecho'}
                            className={`p-1.5 rounded hover:bg-white/10 transition-colors ${
                              isDone ? 'text-[#FFFFFF]' : 'text-[#0062CC]'
                            }`}
                          >
                            <Check size={14} />
                          </button>

                          {/* Quick Gemini analyze */}
                          <button
                            onClick={(e) => handleQuickAnalyze(e, action.id)}
                            disabled={analyzingIds[action.id]}
                            title="Pedir 2da opinión a Gemini"
                            className="p-1.5 rounded hover:bg-white/10 text-[#F5F7FA] opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <Cpu size={14} className={analyzingIds[action.id] ? 'animate-spin text-[#0062CC]' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div 
          className="p-3 text-xs text-[#F5F7FA] opacity-60 flex items-center justify-between"
          style={{ backgroundColor: 'var(--surface-1)', borderTop: '1px solid var(--border)' }}
        >
          <span>Mostrando <strong className="text-[#FFFFFF] tabular">{filtered.length}</strong> accionables</span>
          <span>Haga clic en una fila para abrir el detalle completo</span>
        </div>
      </div>

    </div>
  );
}
