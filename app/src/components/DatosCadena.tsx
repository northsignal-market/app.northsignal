/**
 * DATOS · CUENTAS CADENA
 *
 * Cinco niveles con migas de pan, en vez de once tablas planas.
 * Por que no una tabla en arbol: funciona cuando la jerarquia es poco profunda
 * y los niveles comparten columnas. Aca son cinco niveles (objetivo, local,
 * campana, grupo, keyword) con columnas distintas en cada uno, y ahi el arbol
 * se quiebra. Va lista maestra con pantallas de detalle.
 *
 * Por que la agregacion vive en SQL y no aca: los numeros que ve Andres tienen
 * que ser exactamente los que leen los agentes. Una suma hecha en el navegador
 * es una segunda definicion de la misma metrica.
 *
 * Regla de oro: ninguna fila de grupo, keyword o termino sin local y campana.
 * "Protein Shake - Traffic" existe en 21 campanas: sin el contexto, la fila miente.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Layers, MapPin, Megaphone, Hash, Search, ArrowLeft, Sparkles } from 'lucide-react';

type Nivel = 'objetivos' | 'locales' | 'campanas' | 'grupos' | 'keywords' | 'terminos' | 'transversal';
interface Props { account: string; moneda: string }

const NIVELES: { id: Nivel; label: string; icono: any }[] = [
  { id: 'objetivos', label: 'Objetivos', icono: Layers },
  { id: 'locales', label: 'Locales', icono: MapPin },
  { id: 'campanas', label: 'Campañas', icono: Megaphone },
  { id: 'grupos', label: 'Grupos', icono: Hash },
  { id: 'keywords', label: 'Keywords', icono: Hash },
  { id: 'terminos', label: 'Términos', icono: Search },
];

export function DatosCadena({ account, moneda }: Props) {
  const [nivel, setNivel] = useState<Nivel>('objetivos');
  const [semanas, setSemanas] = useState(4);
  const [ctx, setCtx] = useState<{ objetivo?: string; local?: string; campana?: string; grupo?: string }>({});
  const [filas, setFilas] = useState<any[]>([]);
  const [contadores, setContadores] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [orden, setOrden] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'gasto', dir: 'desc' });

  const fmt = (v: any, tipo: 'moneda' | 'num' | 'pct' = 'num') => {
    if (v === null || v === undefined) return '—';
    const n = Number(v);
    if (tipo === 'moneda') return new Intl.NumberFormat('es-CL', { style: 'currency', currency: moneda, maximumFractionDigits: moneda === 'CLP' ? 0 : 2 }).format(n);
    if (tipo === 'pct') return n.toFixed(2) + '%';
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(n);
  };

  const cargar = async (n: Nivel, c: typeof ctx) => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ account, semanas: String(semanas) });
      if (c.objetivo) p.set('objetivo', c.objetivo);
      if (c.local) p.set('local', c.local);
      if (c.campana) p.set('campana', c.campana);
      if (c.grupo) p.set('grupo', c.grupo);
      const r = await fetch(`/api/cadena/${n}?${p}`, { credentials: 'include' });
      const d = await r.json();
      setFilas(r.ok ? d.filas || [] : []);
    } catch { setFilas([]); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(nivel, ctx); }, [nivel, ctx, semanas, account]);
  useEffect(() => { fetch(`/api/cadena/contadores?account=${account}&semanas=${semanas}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { filas: [] }).then(d => setContadores(d.filas || [])).catch(() => {}); }, [account, semanas]);
  useEffect(() => { setNivel('objetivos'); setCtx({}); }, [account]);

  const ir = (n: Nivel, patch: Partial<typeof ctx> = {}) => { setCtx(c => ({ ...c, ...patch })); setNivel(n); };
  const volverA = (i: number) => {
    const migas = construirMigas();
    const m = migas[i];
    setCtx(m.ctx); setNivel(m.nivel);
  };
  function construirMigas() {
    const out: { label: string; nivel: Nivel; ctx: typeof ctx }[] = [{ label: 'Objetivos', nivel: 'objetivos', ctx: {} }];
    if (ctx.objetivo) out.push({ label: etiquetaObjetivo(ctx.objetivo), nivel: 'locales', ctx: { objetivo: ctx.objetivo } });
    if (ctx.local) out.push({ label: ctx.local, nivel: 'campanas', ctx: { objetivo: ctx.objetivo, local: ctx.local } });
    if (ctx.campana) out.push({ label: ctx.campana, nivel: 'grupos', ctx: { objetivo: ctx.objetivo, local: ctx.local, campana: ctx.campana } });
    if (ctx.grupo) out.push({ label: ctx.grupo, nivel: 'keywords', ctx });
    return out;
  }
  const etiquetaObjetivo = (o: string) => contadores.find(c => c.dimension === 'objetivo' && c.valor === o)?.etiqueta || o;
  const migas = construirMigas();

  const ordenadas = useMemo(() => {
    const f = [...filas];
    f.sort((a, b) => {
      const va = a[orden.col], vb = b[orden.col];
      if (va === undefined) return 0;
      const cmp = typeof va === 'number' || !isNaN(Number(va)) ? Number(va) - Number(vb) : String(va).localeCompare(String(vb));
      return orden.dir === 'desc' ? -cmp : cmp;
    });
    return f;
  }, [filas, orden]);

  const th = (label: string, col: string, alineado: 'left' | 'right' = 'right') => (
    <th onClick={() => setOrden(o => ({ col, dir: o.col === col && o.dir === 'desc' ? 'asc' : 'desc' }))}
      className={`px-3 py-2 text-${alineado} text-[10px] uppercase tracking-wider text-[#F5F7FA] opacity-60 cursor-pointer hover:opacity-100 select-none whitespace-nowrap`}>
      {label}{orden.col === col ? (orden.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );
  const td = (v: any, tipo?: 'moneda' | 'num' | 'pct', clase = '') => <td className={`px-3 py-2 text-right tabular text-xs text-[#F5F7FA] ${clase}`}>{fmt(v, tipo)}</td>;
  // Contexto fijo a la izquierda: la regla de oro
  const tdCtx = (local: any, campana?: any, grupo?: any) => (
    <td className="px-3 py-2 text-left text-[11px] whitespace-nowrap">
      <span className="text-[#FFFFFF]">{local || <span className="opacity-50 italic">corporativa</span>}</span>
      {campana && <span className="text-[#F5F7FA] opacity-40"> · {String(campana).length > 26 ? String(campana).slice(0, 26) + '…' : campana}</span>}
      {grupo && <span className="text-[#F5F7FA] opacity-40"> · {grupo}</span>}
    </td>
  );

  return (
    <div className="space-y-3">
      {/* Migas y controles */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-xs flex-wrap">
          {migas.length > 1 && <button onClick={() => volverA(migas.length - 2)} className="text-[#F5F7FA] opacity-60 hover:opacity-100 mr-1"><ArrowLeft size={13} /></button>}
          {migas.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={12} className="text-[#F5F7FA] opacity-30" />}
              <button onClick={() => volverA(i)} className={i === migas.length - 1 ? 'text-[#FFFFFF] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}>{m.label}</button>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Semanas" value={semanas} onChange={e => setSemanas(Number(e.target.value))} className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1 text-[11px] text-[#FFFFFF]">
            {[1, 2, 4, 8, 13].map(n => <option key={n} value={n}>{n === 1 ? 'Última semana' : `Últimas ${n} semanas`}</option>)}
          </select>
          <button onClick={() => ir('transversal')} className={`px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 ${nivel === 'transversal' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA]'}`} style={{ border: '1px solid var(--border)' }}>
            <Sparkles size={11} /> Keywords entre locales
          </button>
        </div>
      </div>

      {/* Saltos de nivel */}
      {nivel !== 'transversal' && (
        <div className="flex gap-1 flex-wrap">
          {NIVELES.map(n => {
            const activo = nivel === n.id;
            const bloqueado = (n.id === 'grupos' || n.id === 'keywords' || n.id === 'terminos') && !ctx.local && !ctx.campana;
            return (
              <button key={n.id} onClick={() => setNivel(n.id)} disabled={bloqueado}
                title={bloqueado ? 'Elegí un local o una campaña primero: sin contexto son miles de filas' : ''}
                className={`px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 disabled:opacity-30 ${activo ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA]'}`} style={{ border: '1px solid var(--border)' }}>
                <n.icono size={11} /> {n.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        {cargando ? <div className="px-4 py-6 text-xs text-[#F5F7FA] opacity-50">Cargando…</div>
          : ordenadas.length === 0 ? <div className="px-4 py-6 text-xs text-[#F5F7FA] opacity-50">Sin filas con gasto en este período.</div>
          : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--surface-2)' }}><tr>
                {nivel === 'objetivos' && <>{th('Objetivo', 'nombre', 'left')}{th('Se juzga por', 'metrica', 'left')}{th('Campañas', 'campanas')}{th('Activas', 'campanas_activas')}{th('Locales', 'locales')}{th('Gasto', 'gasto')}{th('Conv', 'conv')}{th('CPA', 'cpa')}{th('ROAS', 'roas')}</>}
                {nivel === 'locales' && <>{th('Local', 'location', 'left')}{th('Grupo de pares', 'grupo_par', 'left')}{th('Objetivo', 'objetivo', 'left')}{th('Clics', 'clics')}{th('Conv', 'conv')}{th('Gasto', 'gasto')}{th('Tasa cruda', 'tasa_cruda')}{th('Tasa ajustada', 'tasa_ajustada')}{th('Puesto', 'puesto')}{th('Evidencia', 'evidencia', 'left')}</>}
                {nivel === 'campanas' && <>{th('Local', 'location', 'left')}{th('Campaña', 'campana', 'left')}{th('Objetivo', 'objetivo', 'left')}{th('Estado', 'estado', 'left')}{th('Fin', 'fin', 'left')}{th('Gasto', 'gasto')}{th('Conv', 'conv')}{th('CPA', 'cpa')}</>}
                {nivel === 'grupos' && <>{th('Local · Campaña', 'location', 'left')}{th('Grupo', 'grupo', 'left')}{th('Keywords', 'keywords')}{th('Clics', 'clics')}{th('Gasto', 'gasto')}{th('Conv', 'conv')}{th('CPA', 'cpa')}{th('CTR', 'ctr')}</>}
                {nivel === 'keywords' && <>{th('Local · Campaña · Grupo', 'location', 'left')}{th('Keyword', 'keyword', 'left')}{th('Conc.', 'concordancia', 'left')}{th('QS', 'qs')}{th('Clics', 'clics')}{th('Gasto', 'gasto')}{th('Conv', 'conv')}{th('CPA', 'cpa')}</>}
                {nivel === 'terminos' && <>{th('Local · Campaña · Grupo', 'location', 'left')}{th('Término', 'termino', 'left')}{th('Lo disparó', 'disparo_por', 'left')}{th('Clics', 'clics')}{th('Gasto', 'gasto')}{th('Conv', 'conv')}{th('CPA', 'cpa')}</>}
                {nivel === 'transversal' && <>{th('Keyword', 'keyword', 'left')}{th('Conc.', 'match_type', 'left')}{th('Locales', 'locales')}{th('Convierte en', 'locales_que_convierten')}{th('Clics', 'clics')}{th('Gasto', 'gasto')}{th('Conv', 'conv')}{th('CPA', 'cpa')}{th('Lectura', 'lectura', 'left')}</>}
              </tr></thead>
              <tbody>
                {ordenadas.map((f, i) => (
                  <tr key={i} className="hover:bg-white/5" style={{ borderTop: '1px solid var(--border)' }}>
                    {nivel === 'objetivos' && <>
                      <td className="px-3 py-2 text-left"><button onClick={() => ir('locales', { objetivo: f.objetivo })} className="text-xs text-[#FFFFFF] hover:text-[#0062CC]">{f.nombre}</button></td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-60">{f.metrica === 'roas' ? 'ROAS' : f.metrica === 'conversiones' ? 'Conversiones' : 'CPA'}</td>
                      {td(f.campanas)}{td(f.campanas_activas)}{td(f.locales)}{td(f.gasto, 'moneda')}{td(f.conv)}{td(f.cpa, 'moneda')}
                      <td className="px-3 py-2 text-right tabular text-xs text-[#F5F7FA]">{f.metrica === 'roas' ? fmt(f.roas) + 'x' : '—'}</td>
                    </>}
                    {nivel === 'locales' && <>
                      <td className="px-3 py-2 text-left"><button onClick={() => ir('campanas', { local: f.location })} className="text-xs text-[#FFFFFF] hover:text-[#0062CC]">{f.location}</button></td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-60">{String(f.grupo_par || '').replace('_', ' ')}</td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-60">{f.objetivo}</td>
                      {td(f.clics)}{td(f.conv)}{td(f.gasto, 'moneda')}
                      {td(f.tasa_cruda, 'pct', 'opacity-50')}{td(f.tasa_ajustada, 'pct', 'text-[#FFFFFF]')}
                      <td className="px-3 py-2 text-right text-xs text-[#F5F7FA] tabular">{f.puesto} de {f.de_cuantos}</td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-60 max-w-[220px] truncate" title={f.lectura}>{String(f.evidencia || '').split(':')[0]}</td>
                    </>}
                    {nivel === 'campanas' && <>
                      {tdCtx(f.location)}
                      <td className="px-3 py-2 text-left"><button onClick={() => ir('grupos', { local: f.location, campana: f.campana })} className="text-xs text-[#FFFFFF] hover:text-[#0062CC] flex items-center gap-1">{f.campana}{f.ai_max && <span className="text-[9px] px-1 rounded bg-[#0062CC]/25 text-[#FFFFFF]">AI Max</span>}</button></td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-60">{f.objetivo}</td>
                      <td className="px-3 py-2 text-left text-[11px]"><span className={f.estado === 'ENABLED' ? 'text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-50'}>{f.estado === 'FINALIZADA' ? 'terminada' : f.estado === 'ENABLED' ? 'activa' : f.estado === 'PAUSED' ? 'pausada' : String(f.estado).toLowerCase()}</span></td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-50 tabular">{f.fin || '—'}</td>
                      {td(f.gasto, 'moneda')}{td(f.conv)}{td(f.cpa, 'moneda')}
                    </>}
                    {nivel === 'grupos' && <>
                      {tdCtx(f.location, f.campana)}
                      <td className="px-3 py-2 text-left"><button onClick={() => ir('keywords', { local: f.location, campana: f.campana, grupo: f.grupo })} className="text-xs text-[#FFFFFF] hover:text-[#0062CC]">{f.grupo}</button></td>
                      {td(f.keywords)}{td(f.clics)}{td(f.gasto, 'moneda')}{td(f.conv)}{td(f.cpa, 'moneda')}{td(f.ctr, 'pct')}
                    </>}
                    {nivel === 'keywords' && <>
                      {tdCtx(f.location, f.campana, f.grupo)}
                      <td className="px-3 py-2 text-left text-xs text-[#FFFFFF]">{f.keyword}</td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-60">{f.concordancia === 'EXACT' ? 'exacta' : f.concordancia === 'PHRASE' ? 'frase' : 'amplia'}</td>
                      {td(f.qs)}{td(f.clics)}{td(f.gasto, 'moneda')}{td(f.conv)}{td(f.cpa, 'moneda')}
                    </>}
                    {nivel === 'terminos' && <>
                      {tdCtx(f.location, f.campana, f.grupo)}
                      <td className="px-3 py-2 text-left text-xs text-[#FFFFFF]">{f.termino}</td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-50">{f.disparo_por}</td>
                      {td(f.clics)}{td(f.gasto, 'moneda')}{td(f.conv)}{td(f.cpa, 'moneda')}
                    </>}
                    {nivel === 'transversal' && <>
                      <td className="px-3 py-2 text-left text-xs text-[#FFFFFF]">{f.keyword}</td>
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-60">{f.match_type === 'EXACT' ? 'exacta' : f.match_type === 'PHRASE' ? 'frase' : 'amplia'}</td>
                      {td(f.locales)}
                      <td className="px-3 py-2 text-right tabular text-xs text-[#FFFFFF]">{f.locales_que_convierten}</td>
                      {td(f.clics)}{td(f.gasto, 'moneda')}{td(f.conv)}{td(f.cpa, 'moneda')}
                      <td className="px-3 py-2 text-left text-[11px] text-[#F5F7FA] opacity-70 max-w-[300px]">{f.lectura}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2 text-[10px] text-[#F5F7FA] opacity-40 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          <span>{ordenadas.length} fila{ordenadas.length !== 1 ? 's' : ''}{['keywords', 'terminos'].includes(nivel) && ordenadas.length === 300 ? ' (tope de 300: filtrá por local o campaña)' : ''}</span>
          {nivel === 'locales' && <span>La tasa ajustada encoge cada local hacia el promedio de su grupo de pares en proporción a su ruido. Un local con evidencia poca no es bueno ni malo: es desconocido.</span>}
          {['grupos', 'keywords', 'terminos'].includes(nivel) && <span>Local y campaña van siempre a la izquierda: el mismo nombre de grupo existe en varias campañas.</span>}
        </div>
      </div>
    </div>
  );
}
