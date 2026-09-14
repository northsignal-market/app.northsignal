import React, { useState, useEffect, useMemo } from 'react';
import { Search, Check, Cpu, SlidersHorizontal } from 'lucide-react';
import { fetchJSON, fmtFechaCorta, DosPaneles } from './ui';
import { useCuentas } from '../lib/useCuentas';
import { useAppStore } from '../store/useAppStore';
import type { Actionable } from '../types';
import { NOTION_STATES, NOTION_NATURALEZA } from '../types';
// El enum real de la revisión del analizador. No se escriben a mano los valores:
// el filtro ofrecía 'Validado', que no existe en ninguna parte del sistema.
import { NOTION_REVISION_IA, PESO_PRIORIDAD} from '../server/domain/notionSchema';

/**
 * ACCIONABLES · el archivo completo de decisiones de una cuenta.
 * No es una tabla de ocho columnas: es una LISTA DE TRABAJO agrupada por
 * estado, con el eje principal (¿qué está pendiente?) como filtro de un toque
 * y el resto de los filtros plegados hasta que alguien los pida. A la derecha,
 * el contexto que no cabe en una fila: cuánto hay de cada cosa y qué se está
 * poniendo viejo. La Bandeja tritura lo de hoy; esto es la memoria de todo.
 */

const LABEL = { color: '#ADADAD', letterSpacing: '0.3px' } as const;

const COLOR_PRIORIDAD: Record<string, string> = {
  Urgente: 'var(--bad)', Alta: 'var(--warn)', Media: 'var(--primary-text)', Baja: 'var(--border-strong)',
};

interface AccionablesProps {
  onOpenActionable: (action: Actionable) => void;
  initialClient?: string;
  initialStatus?: string;
}

export function Accionables({ onOpenActionable, initialClient, initialStatus }: AccionablesProps) {
  const { actionables, updateActionableStatus, analyzeAction, analyzingActions } = useAppStore();
  const { nombres: cuentasNombres } = useCuentas();

  const [search, setSearch] = useState('');
  const [novedadesIds, setNovedadesIds] = useState<Set<string>>(new Set());
  // El punto azul es por accionable, así que hace falta la novedad SUELTA: sin
  // `?todas` el endpoint devuelve `v_novedades_agrupadas`, que no tiene `ref_tipo`
  // ni `ref_id` —un grupo son N entidades—, y el filtro por `ref_tipo` no matcheaba
  // nunca: el punto era código muerto. `v_novedades_7d` sí los trae, pero incluye
  // las ya leídas: sin ese segundo filtro el punto diría "no lo viste" sobre algo
  // que sí se vio.
  useEffect(() => { fetchJSON<any[]>('/api/novedades?todas', []).then((d) => setNovedadesIds(new Set((Array.isArray(d) ? d : []).filter(n => n.ref_tipo === 'accionable' && n.leida_el == null).map(n => String(n.ref_id))))); }, []);

  const [filterClient, setFilterClient] = useState<string>(initialClient || 'all');
  // El filtro SIGUE al selector del header: si cambiás de cuenta con esta
  // pestaña abierta, la lista se mueve con vos.
  useEffect(() => { if (initialClient) setFilterClient(initialClient); }, [initialClient]);

  // El eje principal es el estado del trabajo, no un select entre cinco.
  type Eje = 'pendientes' | 'curso' | 'cerrados' | 'todos';
  const [eje, setEje] = useState<Eje>(initialStatus ? 'todos' : 'pendientes');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterNaturaleza, setFilterNaturaleza] = useState<string>('all');
  const [filterRevision, setFilterRevision] = useState<string>('all');
  const [masFiltros, setMasFiltros] = useState(false);

  const semanasPendiente = (a: Actionable) => {
    const dt = a.detectado || a.created_at;
    if (!dt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dt).getTime()) / 6048e5));
  };

  const enEje = (a: Actionable) => {
    const s = (a.status || '').toLowerCase();
    if (eje === 'todos') return true;
    if (eje === 'pendientes') return s === NOTION_STATES.PROPUESTO.toLowerCase() || s === NOTION_STATES.BLOQUEADO.toLowerCase();
    if (eje === 'curso') return s === NOTION_STATES.EN_CURSO.toLowerCase();
    return s === NOTION_STATES.HECHO.toLowerCase() || s === NOTION_STATES.DESCARTADO.toLowerCase();
  };

  const filtrados = useMemo(() => {
    return actionables.filter(a => {
      if (filterClient !== 'all' && a.client.toLowerCase() !== filterClient.toLowerCase()) return false;
      if (!enEje(a)) return false;
      if (filterPriority !== 'all' && a.priority.toLowerCase() !== filterPriority.toLowerCase()) return false;
      if (filterNaturaleza !== 'all' && (a.naturaleza || '').toLowerCase() !== filterNaturaleza.toLowerCase()) return false;
      if (filterRevision !== 'all' && (a.revision_ia || '').toLowerCase() !== filterRevision.toLowerCase()) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!`${a.title || ''} ${a.why || ''} ${a.where || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const w = (PESO_PRIORIDAD[b.priority] || 0) - (PESO_PRIORIDAD[a.priority] || 0);
      return w !== 0 ? w : semanasPendiente(b) - semanasPendiente(a);
    });
  }, [actionables, filterClient, eje, filterPriority, filterNaturaleza, filterRevision, search]);

  // Agrupados por estado: el estado es el título del grupo, no una columna
  // repetida en cada fila.
  const grupos = useMemo(() => {
    const orden = [NOTION_STATES.PROPUESTO, NOTION_STATES.BLOQUEADO, NOTION_STATES.EN_CURSO, NOTION_STATES.HECHO, NOTION_STATES.DESCARTADO];
    const por: Record<string, Actionable[]> = {};
    filtrados.forEach(a => { (por[a.status] = por[a.status] || []).push(a); });
    return Object.entries(por).sort((x, y) => orden.indexOf(x[0] as any) - orden.indexOf(y[0] as any));
  }, [filtrados]);

  const delCliente = useMemo(
    () => actionables.filter(a => filterClient === 'all' || a.client.toLowerCase() === filterClient.toLowerCase()),
    [actionables, filterClient]);
  const cuenta = (fn: (a: Actionable) => boolean) => delCliente.filter(fn).length;
  const conteos = {
    pendientes: cuenta(a => [NOTION_STATES.PROPUESTO, NOTION_STATES.BLOQUEADO].includes(a.status as any)),
    curso: cuenta(a => a.status === NOTION_STATES.EN_CURSO),
    cerrados: cuenta(a => [NOTION_STATES.HECHO, NOTION_STATES.DESCARTADO].includes(a.status as any)),
    todos: delCliente.length,
  };

  const masViejos = useMemo(() => delCliente
    .filter(a => [NOTION_STATES.PROPUESTO, NOTION_STATES.BLOQUEADO].includes(a.status as any))
    .map(a => ({ a, sem: semanasPendiente(a) }))
    .filter(x => x.sem >= 1)
    .sort((x, y) => y.sem - x.sem)
    .slice(0, 5), [delCliente]);

  /** El servidor exige `req.body.action` y responde 400 sin él: este POST iba sin
   *  body y sin mirar `res.ok`, así que el ícono giraba, volvía, y no pasaba nada.
   *  `analyzeAction` del store manda el cuerpo correcto, avisa si falla y maneja el
   *  409 de "ya tiene análisis" — la llamada buena existía y nadie la usaba. */
  const analizar = async (e: React.MouseEvent, a: Actionable) => {
    e.stopPropagation();
    const r = await analyzeAction(a);
    if (r?.requiresConfirmation && confirm('Este accionable ya tiene una segunda opinión. ¿Pedirla de nuevo?')) {
      await analyzeAction(a, true);
    }
  };

  const EJES: { id: Eje; label: string; n: number }[] = [
    { id: 'pendientes', label: 'Pendientes', n: conteos.pendientes },
    { id: 'curso', label: 'En curso', n: conteos.curso },
    { id: 'cerrados', label: 'Cerrados', n: conteos.cerrados },
    { id: 'todos', label: 'Todos', n: conteos.todos },
  ];
  const hayFiltroFino = filterPriority !== 'all' || filterNaturaleza !== 'all' || filterRevision !== 'all';

  return (
    <div className="px-5 md:px-7 py-5 max-w-[1480px] mx-auto">
      {/* Una sola barra: el eje del trabajo, la búsqueda y el resto plegado. */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex p-0.5 rounded-lg" style={{ border: '1px solid var(--border)' }}>
          {EJES.map(x => (
            <button key={x.id} onClick={() => setEje(x.id)}
              className={`px-3 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${eje === x.id ? 'bg-white/10 text-[#FAFAFA]' : 'text-[#ADADAD] hover:text-[#FAFAFA]'}`}>
              {x.label}<span className="ml-1.5 tabular opacity-60">{x.n}</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-80" style={{ color: '#ADADAD' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en título, causa o dónde…"
            className="w-full bg-transparent rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] text-[#EDEFF3] placeholder-[#F5F7FA]/30 outline-none"
            style={{ border: '1px solid var(--border)' }} />
        </div>

        <button onClick={() => setMasFiltros(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${masFiltros || hayFiltroFino ? 'text-[#FAFAFA] bg-white/10' : 'text-[#ADADAD] hover:text-[#FAFAFA]'}`}
          style={{ border: '1px solid var(--border)' }}>
          <SlidersHorizontal size={12} /> Filtros{hayFiltroFino ? ' ·' : ''}
        </button>

        <span className="ml-auto text-[11px] tabular" style={LABEL}>{filtrados.length} de {conteos.todos}</span>
      </div>

      {/* Los filtros finos existen, pero no ocupan pantalla hasta que se piden. */}
      {masFiltros && (
        <div className="flex items-center gap-2 flex-wrap mb-4 p-2.5 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          {[
            { v: filterClient, set: setFilterClient, todos: 'Todas las cuentas', ops: cuentasNombres },
            { v: filterPriority, set: setFilterPriority, todos: 'Toda prioridad', ops: ['Urgente', 'Alta', 'Media', 'Baja'] },
            { v: filterNaturaleza, set: setFilterNaturaleza, todos: 'Toda naturaleza', ops: [NOTION_NATURALEZA.OBSERVACION, NOTION_NATURALEZA.INFERENCIA, NOTION_NATURALEZA.HIPOTESIS] },
            // 'Validado' no existe en el enum: el filtro devolvía siempre cero filas
            // y los estados que el analizador SÍ escribe no se podían pedir desde acá.
            // Es el patrón que Clientes.tsx ya tiene anotado: conocimiento fabricado
            // disfrazado de medido.
            { v: filterRevision, set: setFilterRevision, todos: 'Toda revisión', ops: Object.values(NOTION_REVISION_IA) as string[] },
          ].map((f, i) => (
            <select key={i} aria-label={f.todos} value={f.v} onChange={e => f.set(e.target.value)}
              className="bg-transparent rounded-md px-2 py-1 text-[11px] text-[#EDEFF3] outline-none"
              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
              <option value="all">{f.todos}</option>
              {f.ops.filter(Boolean).map((o: any) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {hayFiltroFino && (
            <button onClick={() => { setFilterPriority('all'); setFilterNaturaleza('all'); setFilterRevision('all'); }}
              className="text-[11px] text-[#4D9DFF] hover:opacity-80">Limpiar</button>
          )}
        </div>
      )}

      <DosPaneles id="accionables" defIzq={76} izquierda={
        // LA LISTA: agrupada por estado, filas densas de dos líneas.
        <div className="min-w-0">
          {filtrados.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-[#FAFAFA]">
                {conteos.todos === 0 ? 'Esta cuenta todavía no tiene accionables.' : 'Ninguno con estos filtros.'}
              </p>
              <p className="text-xs mt-1" style={LABEL}>
                {conteos.todos === 0 ? 'Los escribe la tarea del lunes.' : 'Probá otro eje o limpiá los filtros.'}
              </p>
            </div>
          ) : grupos.map(([estado, items]) => (
            <section key={estado}>
              <div className="grupo-sticky">
                <div className="grupo-sticky-inner flex items-baseline gap-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs text-[#FAFAFA]">{estado}</span>
                  <span className="text-[10px] tabular px-1.5 py-px rounded-full" style={{ border: '1px solid var(--border-strong)', color: '#ADADAD' }}>{items.length}</span>
                </div>
              </div>
              {items.map(a => {
                const sem = semanasPendiente(a);
                const hecho = a.status.toLowerCase() === NOTION_STATES.HECHO.toLowerCase();
                const disputa = a.revision_ia === 'En disputa';
                const viejo = sem >= 3 && !hecho;
                return (
                  <div key={a.id} onClick={() => onOpenActionable(a)}
                    className={`group flex items-start gap-3 pl-2 pr-2 py-2 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.04] ${hecho ? 'opacity-55' : ''}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]"
                      title={`Prioridad ${a.priority}`}
                      style={{ backgroundColor: COLOR_PRIORIDAD[a.priority] || 'var(--border-strong)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {novedadesIds.has(a.id) && <span className="w-1.5 h-1.5 rounded-full bg-[#0062CC] shrink-0" title="Un agente lo tocó y no lo viste" />}
                        <span className="text-[13px] text-[#EDEFF3] truncate">{a.title}</span>
                      </div>
                      <div className="text-[11px] truncate" style={LABEL}>
                        {[filterClient === 'all' ? a.client : null, a.naturaleza || 'Dato', a.why].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
                      {disputa && <span className="text-[10px] px-1.5 py-px rounded" style={{ color: '#4D9DFF', border: '1px solid rgba(77,157,255,0.3)' }}>en disputa</span>}
                      <span className={`text-[11px] tabular ${viejo ? 'text-[#EDEFF3]' : ''}`} style={viejo ? undefined : LABEL}>
                        {sem > 0 ? `${sem} sem` : fmtFechaCorta(a.detectado || a.created_at)}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={() => updateActionableStatus(a.id, hecho ? NOTION_STATES.PROPUESTO : NOTION_STATES.HECHO)}
                          title={hecho ? 'Volver a Propuesto' : 'Marcar Hecho'}
                          className="p-1 rounded hover:bg-white/10 text-[#4D9DFF]"><Check size={13} /></button>
                        <button onClick={(e) => analizar(e, a)} disabled={!!analyzingActions[a.id]}
                          title="Pedir segunda opinión"
                          className="p-1 rounded hover:bg-white/10 opacity-70 hover:opacity-100" style={{ color: '#ADADAD' }}>
                          <Cpu size={13} className={analyzingActions[a.id] ? 'animate-spin text-[#4D9DFF]' : ''} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>

      } derecha={
        // EL RAIL: lo que no cabe en una fila y sí cambia una decisión.
        <aside className="space-y-6 min-w-0">
          <section>
            <div className="text-xs mb-2.5" style={LABEL}>Dónde está el trabajo</div>
            <div className="space-y-1">
              {EJES.filter(x => x.id !== 'todos').map(x => (
                <button key={x.id} onClick={() => setEje(x.id)} className="w-full flex items-center justify-between gap-2 py-1 group">
                  <span className="text-[13px] group-hover:text-[#FAFAFA] transition-colors" style={{ color: eje === x.id ? '#FAFAFA' : '#ADADAD' }}>{x.label}</span>
                  <span className="text-[13px] tabular text-[#EDEFF3]">{x.n}</span>
                </button>
              ))}
            </div>
          </section>

          {masViejos.length > 0 && (
            <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs mb-2.5" style={LABEL}>Lo que se está poniendo viejo</div>
              <div className="space-y-2.5">
                {masViejos.map(({ a, sem }) => (
                  <button key={a.id} onClick={() => onOpenActionable(a)} className="w-full text-left group">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] text-[#EDEFF3] truncate group-hover:text-[#FAFAFA]">{a.title}</span>
                      <span className="text-[11px] tabular shrink-0" style={{ color: sem >= 3 ? 'var(--warn)' : '#ADADAD' }}>{sem} sem</span>
                    </div>
                    <div className="text-[10px] truncate" style={LABEL}>{a.client} · {a.status}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] mt-3 leading-relaxed" style={{ ...LABEL, opacity: 0.75 }}>
                Un accionable de tres semanas ya no dice lo mismo que el día que se escribió: confirmalo o descartalo.
              </p>
            </section>
          )}

          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] leading-relaxed" style={{ ...LABEL, opacity: 0.75 }}>
              Todo esto vive en Notion con su historial. Acá se decide; allá queda el rastro.
            </p>
          </section>
        </aside>
      } />
    </div>
  );
}
