/**
 * BANDEJA · lo que te espera, y nada más.
 *
 * Principio (Linear, Superhuman, Attio 2026): la pantalla de inicio muestra
 * las decisiones adeudadas, ordenadas por urgencia, y llega a cero. Todo lo
 * demás existe un clic abajo. "Cero acciones adeudadas, no cero sin leer."
 *
 * Orden de la cola: pide acción hoy → listo para ejecutar → espera tu
 * confirmación → reporte para aprobar. Debajo, colapsados: ayer en cada
 * cuenta, y qué pasó después de tus cambios.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Check, Zap, FileText, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { nivelPulso } from '../lib/humano';
import type { Actionable } from '../types';
import { NOTION_STATES } from '../types';
import { detectarTipoAuto } from '../lib/tipoAuto';
import { tipoAutoDesde } from '../lib/accion';

interface Props { onOpenActionable: (a: Actionable) => void; onGoTo: (tab: string, client?: string, segmento?: string) => void }

export function Bandeja({ onOpenActionable, onGoTo }: Props) {
  const { actionables, setSelectedClient } = useAppStore();
  const [briefing, setBriefing] = useState<any>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [pulsos, setPulsos] = useState<any[]>([]);
  const [ciclo, setCiclo] = useState<any>(null);
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [bloqueados, setBloqueados] = useState<Record<string, string>>({});
  const [novedades, setNovedades] = useState<any[]>([]);
  const [abierto, setAbierto] = useState<Record<string, boolean>>({ ayer: false, despues: false });
  const [filtroCuenta, setFiltroCuenta] = useState<string | null>(null);

  const cargar = () => {
    fetch('/api/briefing', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setBriefing(d)).catch(() => {});
    fetch('/api/alertas', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setAlertas(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/pulso?days=2', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setPulsos(d.pulsos || [])).catch(() => {});
    fetch('/api/ciclo', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setCiclo(d)).catch(() => {});
    fetch('/api/novedades', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setNovedades(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/relaciones-abiertas', { credentials: 'include' }).then(r => r.ok ? r.json() : {}).then(d => setBloqueados(d || {})).catch(() => {});
    fetch('/api/propuestas', { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(d => setPropuestas(Array.isArray(d) ? d : [])).catch(() => {});
  };
  useEffect(() => { cargar(); const t = setInterval(cargar, 3 * 60 * 1000); return () => clearInterval(t); }, []);

  const resolverAlerta = async (id: number) => { await fetch(`/api/alertas/${id}/resolver`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }); cargar(); };

  const cuentas = ['KAREDO', 'BHI', '360'];
  const enCuenta = (c: string) => !filtroCuenta || c === filtroCuenta;
  const hoy = alertas.filter(a => a.nivel === 'hoy' && enCuenta(a.account || ''));
  const listos = actionables.filter(a => a.status === NOTION_STATES.PROPUESTO && !a.reemplazado_por && enCuenta(a.client));
  const confirmar = actionables.filter(a => a.status === NOTION_STATES.BLOQUEADO && !a.reemplazado_por && enCuenta(a.client));
  const reportes = (briefing?.reportes_por_aprobar || []).filter((r: any) => enCuenta(r.cuenta));
  const propPend = propuestas.filter(p => p.estado === 'propuesta' && enCuenta(p.account));
  const novs = novedades.filter(n => enCuenta(n.account || ''));
  const leerTodas = async () => { await fetch('/api/novedades/leer', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todas: true }) }); cargar(); };
  const abrirNovedad = (n: any) => {
    if (n.ref_tipo === 'accionable') { const a = actionables.find(x => x.id === n.ref_id); if (a) abrir(a); else onGoTo('cuenta', n.account, 'accionables'); }
    else if (n.ref_tipo === 'propuesta') onGoTo('cuenta', n.account, 'diagnostico');
    else if (n.ref_tipo === 'ticket') onGoTo('sistema');
    else if (n.ref_tipo === 'ejecucion') onGoTo('sistema');
    fetch('/api/novedades/leer', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref_tipo: n.ref_tipo, ref_id: n.ref_id }) }).then(cargar).catch(() => {});
  };
  const total = hoy.length + listos.length + confirmar.length + reportes.length + propPend.length;
  const ultimoPulso = useMemo(() => { const m: Record<string, any> = {}; pulsos.forEach(p => { if (!m[p.account] || p.fecha > m[p.account].fecha) m[p.account] = p; }); return m; }, [pulsos]);

  const abrir = (a: Actionable) => { setSelectedClient(a.client); onOpenActionable(a); };
  const prioridadOrden = (p?: string) => p === 'Urgente' ? 0 : p === 'Alta' ? 1 : p === 'Media' ? 2 : 3;

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-5xl mx-auto">
      {/* Estado en una línea */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">{total === 0 ? 'Nada te espera' : `${total} cosa${total !== 1 ? 's' : ''} espera${total !== 1 ? 'n' : ''} tu criterio`}</h1>
          <p className="text-xs text-[#F5F7FA] opacity-60 mt-0.5">
            {briefing?.datos_al_dia === false ? <span className="text-[#0062CC]">Los datos tienen un problema: mirá Sistema › Salud antes de decidir nada.</span> : 'Datos al día.'}
            {' '}{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}.
          </p>
        </div>
        <div className="flex p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <button onClick={() => setFiltroCuenta(null)} className={`px-2.5 py-1 rounded-md text-[11px] ${!filtroCuenta ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-60'}`}>Todas</button>
          {cuentas.map(c => <button key={c} onClick={() => setFiltroCuenta(c)} className={`px-2.5 py-1 rounded-md text-[11px] ${filtroCuenta === c ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-60'}`}>{c}</button>)}
        </div>
      </div>

      {/* Novedades: lo que los agentes hicieron y no viste */}
      {novs.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: 'var(--primary-faint)' }}>
            <span className="text-[11px] font-semibold text-[#FFFFFF]">Novedades</span>
            <span className="text-[10px] text-[#F5F7FA] opacity-50 tabular">{novs.length}</span>
            <span className="text-[10px] text-[#F5F7FA] opacity-50">lo que los agentes hicieron desde la última vez</span>
            <button onClick={leerTodas} className="ml-auto text-[10px] text-[#F5F7FA] opacity-60 hover:opacity-100">marcar todo visto</button>
          </div>
          {novs.slice(0, 12).map(n => (
            <div key={n.id} onClick={() => abrirNovedad(n)} className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-[10px] font-bold text-[#F5F7FA] opacity-50 w-14 shrink-0 uppercase tracking-wider pt-0.5">{n.account || 'Sist.'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#FFFFFF] truncate">{n.titulo}</div>
                {n.texto && <div className="text-[11px] text-[#F5F7FA] opacity-60 line-clamp-2">{n.texto}</div>}
              </div>
              <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0">{String(n.creada).slice(5, 16).replace('T', ' ')}</span>
            </div>
          ))}
          {novs.length > 12 && <div className="px-4 py-1.5 text-[10px] text-[#F5F7FA] opacity-40" style={{ borderTop: '1px solid var(--border)' }}>y {novs.length - 12} más</div>}
        </div>
      )}

      {/* La cola */}
      {total === 0 ? (
        <div className="p-8 rounded-2xl text-center" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <Check size={22} className="mx-auto text-[#0062CC] mb-2" />
          <p className="text-sm text-[#FFFFFF]">Cola vacía.</p>
          <p className="text-xs text-[#F5F7FA] opacity-60 mt-1">Lo próximo llega mañana a las 6:45 con el análisis diario, o el lunes con el semanal. Si querés mirar una cuenta, está en Cuenta.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          {hoy.length > 0 && (
            <Grupo titulo="Pide acción hoy" n={hoy.length} icono={<AlertTriangle size={13} />} destacado>
              {hoy.map(a => (
                <Fila key={'al' + a.id} cuenta={a.account || 'Sistema'} titulo={a.titulo} sub={a.accion} onClick={() => setAbierto(s => ({ ...s, ['al' + a.id]: !s['al' + a.id] }))}
                  accion={<button onClick={(e) => { e.stopPropagation(); resolverAlerta(a.id); }} className="px-2.5 py-1 rounded-md text-[11px] bg-[#0062CC] text-[#FFFFFF]">Resuelta</button>} />
              ))}
            </Grupo>
          )}
          {listos.length > 0 && (
            <Grupo titulo="Listos para ejecutar" n={listos.length} icono={<Zap size={13} />}>
              {listos.sort((a, b) => prioridadOrden(a.priority) - prioridadOrden(b.priority)).map(a => (
                <Fila key={a.id} cuenta={a.client} titulo={a.title} sub={a.priority === 'Urgente' || a.priority === 'Alta' ? `Prioridad ${a.priority.toLowerCase()}` : undefined} onClick={() => abrir(a)}
                  accion={<span className="text-[11px] text-[#F5F7FA] opacity-50">{bloqueados[a.id] ? <span className="text-[#0062CC]">espera: conflicto abierto</span> : a.accion?.verbo?.startsWith('preguntar') ? 'es una pregunta, no un cambio' : (a.accion ? tipoAutoDesde(a.accion) : detectarTipoAuto(a.title, a.como_hacerlo)) ? 'el sistema puede ejecutarlo' : 'a mano, con los pasos adentro'}</span>} />
              ))}
            </Grupo>
          )}
          {confirmar.length > 0 && (
            <Grupo titulo="Esperan tu confirmación" n={confirmar.length}>
              {confirmar.map(a => (
                <Fila key={a.id} cuenta={a.client} titulo={a.title} sub={a.origen && a.origen !== 'Semanal' ? `Lo propuso ${a.origen === 'Pulso diario' ? 'el análisis diario' : 'el detector de anomalías'}${a.vence ? ` · vence ${String(a.vence).slice(5)}` : ''}` : 'Es una deducción: confirmá o descartá'} onClick={() => abrir(a)} />
              ))}
            </Grupo>
          )}
          {propPend.length > 0 && (
            <Grupo titulo="Propuestas estratégicas para decidir" n={propPend.length}>
              {propPend.map((p: any) => (
                <Fila key={'prop' + p.id} cuenta={p.account} titulo={p.titulo} sub={`${p.resultado_esperado} · el sistema propone algo más grande que un accionable`} onClick={() => onGoTo('cuenta', p.account, 'diagnostico')} />
              ))}
            </Grupo>
          )}
          {reportes.length > 0 && (
            <Grupo titulo="Reportes para aprobar" n={reportes.length} icono={<FileText size={13} />}>
              {reportes.map((r: any, i: number) => (
                <Fila key={'rep' + i} cuenta={r.cuenta} titulo={`Reporte semanal · ${r.periodo}`} sub="Leelo, editalo si querés, aprobalo" onClick={() => onGoTo('cuenta', r.cuenta, 'reportes')} />
              ))}
            </Grupo>
          )}
        </div>
      )}

      {/* Colapsados: contexto, no decisiones */}
      <Colapsable titulo="Ayer en cada cuenta" abierto={abierto.ayer} onToggle={() => setAbierto(s => ({ ...s, ayer: !s.ayer }))}
        resumen={cuentas.map(c => { const p = ultimoPulso[c]; return p ? `${c}: ${nivelPulso(p.nivel).etiqueta.toLowerCase()}` : `${c}: sin análisis`; }).join(' · ')}>
        <div className="space-y-1.5">
          {cuentas.map(c => { const p = ultimoPulso[c]; return (
            <button key={c} onClick={() => onGoTo('cuenta', c, 'semana')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5" style={{ backgroundColor: 'var(--surface-2)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#FFFFFF]">{c}</span>
                <span className="text-[10px] text-[#F5F7FA] opacity-50">{p ? `${p.fecha} · ${nivelPulso(p.nivel).etiqueta}` : 'sin análisis todavía'}</span>
              </div>
              {p && <p className="text-[11px] text-[#F5F7FA] opacity-75 mt-0.5 leading-relaxed">{p.hallazgo_principal || p.resumen?.slice(0, 160)}</p>}
            </button>
          ); })}
        </div>
      </Colapsable>

      {(ciclo?.impactos?.length > 0 || ciclo?.predicciones?.length > 0) && (
        <Colapsable titulo="Qué pasó después" abierto={abierto.despues} onToggle={() => setAbierto(s => ({ ...s, despues: !s.despues }))}
          resumen={ciclo.global?.n > 0 ? `${ciclo.global.aciertos} de ${ciclo.global.n} predicciones acertadas` : `${ciclo.impactos?.length || 0} cambios con resultado a 14 días`}>
          <div className="space-y-1">
            {(ciclo.impactos || []).slice(0, 5).map((i: any, k: number) => (
              <div key={k} className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0">{String(i.ejecutado_el).slice(5)}</span>
                <span className="text-[#F5F7FA] flex-1 truncate">{i.account} · {i.titulo}</span>
                <span className="tabular text-[#FFFFFF] shrink-0">{i.variacion_pct != null ? `${i.variacion_pct > 0 ? '+' : ''}${Number(i.variacion_pct).toFixed(0)}%` : (i.veredicto || '').split(':')[0]}</span>
              </div>
            ))}
            {(ciclo.predicciones || []).filter((p: any) => p.acerto !== null).slice(0, 4).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0">sem {String(p.semana).slice(5)}</span>
                <span className="text-[#F5F7FA] flex-1">{p.account} · {p.metrica} entre {p.valor_min} y {p.valor_max}</span>
                <span className={`shrink-0 ${p.acerto ? 'text-[#FFFFFF]' : 'text-[#0062CC]'}`}>{p.acerto ? 'acertó' : 'falló'}: {p.valor_real}</span>
              </div>
            ))}
          </div>
        </Colapsable>
      )}

      <p className="text-[10px] text-[#F5F7FA] opacity-30 text-center pt-2">Cmd+K para ir a cualquier lado. El botón de abajo a la derecha para preguntar o reportar.</p>
    </div>
  );
}

function Grupo({ titulo, n, icono, destacado, children }: { titulo: string; n: number; icono?: React.ReactNode; destacado?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: destacado ? 'var(--primary-faint)' : 'transparent' }}>
        {icono && <span className={destacado ? 'text-[#0062CC]' : 'text-[#F5F7FA] opacity-50'}>{icono}</span>}
        <span className="text-[11px] font-semibold text-[#FFFFFF]">{titulo}</span>
        <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular">{n}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Fila({ cuenta, titulo, sub, onClick, accion }: { cuenta: string; titulo: string; sub?: string; onClick: () => void; accion?: React.ReactNode; key?: any }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5 transition-colors" style={{ borderTop: '1px solid var(--border)' }}>
      <span className="text-[10px] font-bold text-[#F5F7FA] opacity-50 w-14 shrink-0 uppercase tracking-wider">{cuenta}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#FFFFFF] truncate">{titulo}</div>
        {sub && <div className="text-[11px] text-[#F5F7FA] opacity-55 truncate">{sub}</div>}
      </div>
      {accion || <ChevronRight size={14} className="text-[#F5F7FA] opacity-30 shrink-0" />}
    </div>
  );
}

function Colapsable({ titulo, resumen, abierto, onToggle, children }: { titulo: string; resumen?: string; abierto: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {abierto ? <ChevronDown size={14} className="text-[#F5F7FA] opacity-50" /> : <ChevronRight size={14} className="text-[#F5F7FA] opacity-50" />}
        <span className="text-xs font-medium text-[#FFFFFF]">{titulo}</span>
        {!abierto && resumen && <span className="text-[11px] text-[#F5F7FA] opacity-50 truncate">{resumen}</span>}
      </button>
      {abierto && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
