import { useCuentas } from '../lib/useCuentas';
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
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Check, Zap, FileText, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { nivelPulso } from '../lib/humano';
import type { Actionable } from '../types';
import { NOTION_STATES } from '../types';
import { detectarTipoAuto } from '../lib/tipoAuto';
import { tipoAutoDesde } from '../lib/accion';
import { fmtFechaCorta, useJSON } from './ui';
import { abrirTextoAgente } from '../lib/lectura';

interface Props { onOpenActionable: (a: Actionable) => void; onGoTo: (tab: string, client?: string, segmento?: string) => void }

export function Bandeja({ onOpenActionable, onGoTo }: Props) {
  const { actionables, setSelectedClient } = useAppStore();
  const [abierto, setAbierto] = useState<Record<string, boolean>>({ ayer: false, despues: false, novs: false });
  // Cursor de teclado sobre la cola: j/k mueven, Enter abre, 1 dispara la acción
  // rápida del ítem señalado (si tiene). El mouse no se entera.
  const [cur, setCur] = useState(-1);
  const [filtroCuenta, setFiltroCuenta] = useState<string | null>(null);

  // Estado de servidor por TanStack Query: caché compartida, dedupe, revalida al
  // volver a la pestaña, y cada 3 min de fondo (la cadencia que ya tenía el
  // setInterval — pero ahora sin carreras ni datos zombis entre montajes).
  const R = 180_000;
  const qc = useQueryClient();
  const cargar = () => { qc.invalidateQueries({ queryKey: ['json'] }); };
  const { data: briefing } = useJSON<any>('/api/briefing', null, { refetchMs: R });
  const { data: alertasRaw } = useJSON<any[]>('/api/alertas', [], { refetchMs: R });
  const { data: pulsoRaw } = useJSON<any>('/api/pulso?days=2', null, { refetchMs: R });
  const { data: ciclo } = useJSON<any>('/api/ciclo', null, { refetchMs: R });
  const { data: novedadesRaw } = useJSON<any[]>('/api/novedades', [], { refetchMs: R });
  const { data: bloqueadosRaw } = useJSON<Record<string, string>>('/api/relaciones-abiertas', {}, { refetchMs: R });
  const { data: propuestasRaw } = useJSON<any[]>('/api/propuestas', [], { refetchMs: R });
  // Lo que los agentes respondieron a lo que les preguntaste: sin eso el
  // círculo no cierra. (El desglose de esfuerzo se calcula de la cola misma.)
  const { data: notas } = useJSON<any>('/api/notas-agentes', null);
  const alertas = Array.isArray(alertasRaw) ? alertasRaw : [];
  const pulsos = pulsoRaw?.pulsos || [];
  const novedades = Array.isArray(novedadesRaw) ? novedadesRaw : [];
  const bloqueados = bloqueadosRaw || {};
  const propuestas = Array.isArray(propuestasRaw) ? propuestasRaw : [];

  const resolverAlerta = async (id: number) => { await fetch(`/api/alertas/${id}/resolver`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }); cargar(); };

  const { nombres: cuentas } = useCuentas();
  const enCuenta = (c: string) => !filtroCuenta || c === filtroCuenta;
  const hoy = alertas.filter(a => a.nivel === 'hoy' && enCuenta(a.account || ''));
  // "Listos para ejecutar" mezclaba tres cosas distintas: lo que es un clic, lo que
  // es una pregunta para vos, y lo que hay que hacer a mano. Cada una cuesta un
  // esfuerzo distinto, y verlas juntas obliga a abrir cada una para saber cuál es cuál.
  const propuestos = actionables.filter(a => a.status === NOTION_STATES.PROPUESTO && !a.reemplazado_por && enCuenta(a.client));
  const esPregunta = (a: any) => String(a.accion?.verbo || '').startsWith('preguntar');
  const esUnClic = (a: any) => !esPregunta(a) && !bloqueados[a.id] && !!(a.accion ? tipoAutoDesde(a.accion) : detectarTipoAuto(a.title, a.como_hacerlo));
  const listos = propuestos.filter(esUnClic);
  const preguntas = propuestos.filter(esPregunta);
  const aMano = propuestos.filter(a => !esUnClic(a) && !esPregunta(a));
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
  // Una sola versión ordenada por sección: el render y el cursor de teclado tienen
  // que recorrer EXACTAMENTE la misma lista o el resaltado apunta a otra fila.
  const listosOrd = [...listos].sort((a, b) => prioridadOrden(a.priority) - prioridadOrden(b.priority));
  const preguntasOrd = [...preguntas].sort((a, b) => prioridadOrden(a.priority) - prioridadOrden(b.priority));
  const aManoOrd = [...aMano].sort((a, b) => prioridadOrden(a.priority) - prioridadOrden(b.priority));
  // Procedencia en una línea, uniforme: quién lo propuso. El motivo de llegada es
  // la primera dimensión de triage; sin él cada ítem obliga a abrirlo para saber.
  const origenDe = (a: any) => a.origen === 'Pulso diario' ? 'análisis diario' : a.origen === 'Anomalias' ? 'anomalías' : a.origen ? String(a.origen).toLowerCase() : 'semanal';

  // Grupos plegables con tope: la cola muestra poco y ofrece el resto. Los dos
  // primeros grupos con ítems abren solos; el resto queda en una línea con su
  // conteo. Un grupo de 20 filas expandido de entrada es scroll, no decisión.
  const [gAbierto, setGAbierto] = useState<Record<string, boolean>>({});
  const [gTodo, setGTodo] = useState<Record<string, boolean>>({});
  const TOPE = 6;
  const ordenGrupos: [string, number][] = [['hoy', hoy.length], ['listos', listosOrd.length], ['preguntas', preguntasOrd.length], ['aMano', aManoOrd.length], ['confirmar', confirmar.length], ['prop', propPend.length], ['rep', reportes.length]];
  const abiertosDefault = ordenGrupos.filter(([, n]) => n > 0).slice(0, 2).map(([id]) => id);
  const estaAbierto = (id: string) => gAbierto[id] ?? abiertosDefault.includes(id);
  const vis = <T,>(arr: T[], id: string): T[] => !estaAbierto(id) ? [] : (gTodo[id] ? arr : arr.slice(0, TOPE));

  const nav: { id: string; click: () => void; rapida?: () => void }[] = [
    ...vis(hoy, 'hoy').map((a: any) => ({ id: 'al' + a.id, click: () => setAbierto(s => ({ ...s, ['al' + a.id]: !s['al' + a.id] })), rapida: () => resolverAlerta(a.id) })),
    ...vis(listosOrd, 'listos').map(a => ({ id: String(a.id), click: () => abrir(a) })),
    ...vis(preguntasOrd, 'preguntas').map(a => ({ id: String(a.id), click: () => abrir(a) })),
    ...vis(aManoOrd, 'aMano').map(a => ({ id: String(a.id), click: () => abrir(a) })),
    ...vis(confirmar, 'confirmar').map(a => ({ id: String(a.id), click: () => abrir(a) })),
    ...vis(propPend, 'prop').map((p: any) => ({ id: 'prop' + p.id, click: () => onGoTo('cuenta', p.account, 'diagnostico') })),
    ...vis(reportes, 'rep').map((r: any, i: number) => ({ id: 'rep' + i, click: () => onGoTo('cuenta', r.cuenta, 'reportes') })),
  ];
  const curIdx = nav.length ? Math.min(Math.max(cur, -1), nav.length - 1) : -1;
  const activaId = curIdx >= 0 ? nav[curIdx].id : null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (useAppStore.getState().selectedAction) return; // el drawer tiene su propio teclado
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCur(c => Math.min(c + 1, nav.length - 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCur(c => Math.max(0, c - 1)); }
      else if (e.key === 'Enter' && curIdx >= 0) { e.preventDefault(); nav[curIdx].click(); }
      else if (e.key === '1' && curIdx >= 0 && nav[curIdx].rapida) { e.preventDefault(); nav[curIdx].rapida!(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-5xl mx-auto">
      {/* Estado en una línea */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#EDEFF3]">{total === 0 ? 'Nada te espera' : `${total} cosa${total !== 1 ? 's' : ''} espera${total !== 1 ? 'n' : ''} tu criterio`}</h1>
          <p className="text-xs text-[#F5F7FA] opacity-60 mt-0.5">
            {briefing?.datos_al_dia === false ? <span className="text-[#4D9DFF]">Los datos tienen un problema: mirá Sistema › Salud antes de decidir nada.</span> : 'Datos al día.'}
            {' '}{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}.
          </p>
          {/* El desglose sale de la MISMA cola que ves abajo — antes venía de otro
              endpoint y podía anunciar "7 de un clic" con el grupo Un clic vacío. */}
          {total > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {[
                { n: listosOrd.length, label: 'un clic', destacado: true },
                { n: preguntasOrd.length, label: 'para responder' },
                { n: aManoOrd.length, label: 'a mano' },
                { n: confirmar.length, label: 'para confirmar' },
              ].filter(b => b.n > 0).map(b => (
                <span key={b.label} className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: b.destacado ? '#0062CC28' : 'var(--surface-2)',
                    color: b.destacado ? '#FFFFFF' : '#F5F7FA',
                    border: '1px solid var(--border)'
                  }}>
                  {b.n} {b.label}
                </span>
              ))}
              {listosOrd.length > 0 && (
                <span className="text-[10px] text-[#F5F7FA] opacity-50">
                  · empezá por los de un clic: son los que más te devuelven por minuto
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <button onClick={() => setFiltroCuenta(null)} className={`px-2.5 py-1 rounded-md text-[11px] ${!filtroCuenta ? 'bg-[#0062CC] text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-60'}`}>Todas</button>
          {cuentas.map(c => <button key={c} onClick={() => setFiltroCuenta(c)} className={`px-2.5 py-1 rounded-md text-[11px] ${filtroCuenta === c ? 'bg-[#0062CC] text-[#EDEFF3]' : 'text-[#F5F7FA] opacity-60'}`}>{c}</button>)}
        </div>
      </div>

      {/* Lo que los agentes contestaron: plegado. Cuatro párrafos completos arriba
          de la cola empujaban las decisiones fuera de la primera pantalla. */}
      {notas?.respuestas?.length > 0 && (
        <Colapsable titulo="Te respondieron" abierto={!!abierto.notas} onToggle={() => setAbierto(s => ({ ...s, notas: !s.notas }))}
          resumen={`${notas.respuestas.length} respuesta${notas.respuestas.length !== 1 ? 's' : ''} · la última del ${fmtFechaCorta(notas.respuestas[0]?.cuando)}${notas?.pendientes?.length ? ` · ${notas.pendientes.length} pregunta${notas.pendientes.length !== 1 ? 's' : ''} en espera` : ''}`}>
          <div className="space-y-2">
            {notas.respuestas.slice(0, 4).map((r: any) => (
              <div key={r.id} className="px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded tabular shrink-0" style={{ backgroundColor: 'var(--surface-1)', color: '#F5F7FA' }}>{r.cuenta}</span>
                  <span className="text-[11px] text-[#F5F7FA] opacity-60 truncate">{r.pregunta}</span>
                </div>
                <p className="text-xs text-[#EDEFF3] mt-1 leading-relaxed" style={{ maxWidth: '75ch' }}>{r.respuesta}</p>
                <span className="text-[10px] text-[#F5F7FA] opacity-40">{r.respondio} · {fmtFechaCorta(r.cuando)}</span>
              </div>
            ))}
          </div>
        </Colapsable>
      )}

      {/* La cola */}
      {total === 0 ? (
        <div className="p-8 rounded-2xl text-center" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <Check size={22} className="mx-auto text-[#4D9DFF] mb-2" />
          <p className="text-sm text-[#EDEFF3]">Cola vacía.</p>
          <p className="text-xs text-[#F5F7FA] opacity-60 mt-1">Lo próximo llega mañana a las 6:45 con el análisis diario, o el lunes con el semanal. Si querés mirar una cuenta, está en Cuenta.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          {hoy.length > 0 && (
            <Grupo id="hoy" titulo="Pide acción hoy" n={hoy.length} icono={<AlertTriangle size={13} />} destacado abierto={estaAbierto('hoy')} onToggle={() => setGAbierto(s => ({ ...s, hoy: !estaAbierto('hoy') }))} todo={!!gTodo.hoy} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, hoy: true }))}>
              {vis(hoy, 'hoy').map((a: any) => (
                <Fila key={'al' + a.id} activa={activaId === 'al' + a.id} cuenta={a.account || 'Sistema'} titulo={a.titulo} sub={[a.origen, a.accion].filter(Boolean).join(' · ')} onClick={() => setAbierto(s => ({ ...s, ['al' + a.id]: !s['al' + a.id] }))}
                  accion={<button onClick={(e) => { e.stopPropagation(); resolverAlerta(a.id); }} className="px-2.5 py-1 rounded-md text-[11px] bg-[#0062CC] text-[#EDEFF3]">Resuelta</button>} />
              ))}
            </Grupo>
          )}
          {listosOrd.length > 0 && (
            <Grupo id="listos" titulo="Un clic" nota="el ejecutor los aplica al aprobar" n={listosOrd.length} icono={<Zap size={13} />} destacado abierto={estaAbierto('listos')} onToggle={() => setGAbierto(s => ({ ...s, listos: !estaAbierto('listos') }))} todo={!!gTodo.listos} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, listos: true }))}>
              {vis(listosOrd, 'listos').map(a => (
                <Fila key={a.id} activa={activaId === String(a.id)} cuenta={a.client} titulo={a.title} sub={[origenDe(a), a.priority === 'Urgente' || a.priority === 'Alta' ? `prioridad ${a.priority.toLowerCase()}` : null].filter(Boolean).join(' · ')} onClick={() => abrir(a)} />
              ))}
            </Grupo>
          )}
          {preguntasOrd.length > 0 && (
            <Grupo id="preguntas" titulo="Lo sabés vos" nota="responder y cerrar" n={preguntasOrd.length} abierto={estaAbierto('preguntas')} onToggle={() => setGAbierto(s => ({ ...s, preguntas: !estaAbierto('preguntas') }))} todo={!!gTodo.preguntas} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, preguntas: true }))}>
              {vis(preguntasOrd, 'preguntas').map(a => (
                <Fila key={a.id} activa={activaId === String(a.id)} cuenta={a.client} titulo={a.title} sub={origenDe(a)} onClick={() => abrir(a)} />
              ))}
            </Grupo>
          )}
          {aManoOrd.length > 0 && (
            <Grupo id="aMano" titulo="A mano" nota="los pasos, adentro de cada uno" n={aManoOrd.length} abierto={estaAbierto('aMano')} onToggle={() => setGAbierto(s => ({ ...s, aMano: !estaAbierto('aMano') }))} todo={!!gTodo.aMano} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, aMano: true }))}>
              {vis(aManoOrd, 'aMano').map(a => (
                <Fila key={a.id} activa={activaId === String(a.id)} cuenta={a.client} titulo={a.title} sub={origenDe(a)} onClick={() => abrir(a)}
                  accion={bloqueados[a.id] ? <span className="text-[11px] text-[#E2B453]">conflicto abierto</span> : undefined} />
              ))}
            </Grupo>
          )}
          {confirmar.length > 0 && (
            <Grupo id="confirmar" titulo="Esperan tu confirmación" nota="deducciones: confirmá o descartá" n={confirmar.length} abierto={estaAbierto('confirmar')} onToggle={() => setGAbierto(s => ({ ...s, confirmar: !estaAbierto('confirmar') }))} todo={!!gTodo.confirmar} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, confirmar: true }))}>
              {vis(confirmar, 'confirmar').map(a => (
                <Fila key={a.id} activa={activaId === String(a.id)} cuenta={a.client} titulo={a.title} sub={[origenDe(a), a.vence ? `vence ${fmtFechaCorta(a.vence)}` : null].filter(Boolean).join(' · ')} onClick={() => abrir(a)} />
              ))}
            </Grupo>
          )}
          {propPend.length > 0 && (
            <Grupo id="prop" titulo="Propuestas estratégicas" nota="más grandes que un accionable" n={propPend.length} abierto={estaAbierto('prop')} onToggle={() => setGAbierto(s => ({ ...s, prop: !estaAbierto('prop') }))} todo={!!gTodo.prop} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, prop: true }))}>
              {vis(propPend, 'prop').map((p: any) => (
                <Fila key={'prop' + p.id} activa={activaId === 'prop' + p.id} cuenta={p.account} titulo={p.titulo} sub={p.resultado_esperado} onClick={() => onGoTo('cuenta', p.account, 'diagnostico')} />
              ))}
            </Grupo>
          )}
          {reportes.length > 0 && (
            <Grupo id="rep" titulo="Reportes para aprobar" nota="leelo, editá y aprobá" n={reportes.length} icono={<FileText size={13} />} abierto={estaAbierto('rep')} onToggle={() => setGAbierto(s => ({ ...s, rep: !estaAbierto('rep') }))} todo={!!gTodo.rep} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, rep: true }))}>
              {vis(reportes, 'rep').map((r: any, i: number) => (
                <Fila key={'rep' + i} activa={activaId === 'rep' + i} cuenta={r.cuenta} titulo={`Reporte semanal · ${r.periodo}`} onClick={() => onGoTo('cuenta', r.cuenta, 'reportes')} />
              ))}
            </Grupo>
          )}
        </div>
      )}

      {/* Actividad de los agentes: abajo de las decisiones y plegada. Mezclada con
          la cola, la actividad entierra lo que pide tu criterio — que es lo único
          por lo que esta pantalla existe. */}
      {novs.length > 0 && (
        <Colapsable titulo="Actividad de los agentes" abierto={abierto.novs} onToggle={() => setAbierto(s => ({ ...s, novs: !s.novs }))}
          resumen={`${novs.length} novedad${novs.length !== 1 ? 'es' : ''} desde tu última visita`}>
          <div className="flex justify-end pb-1">
            <button onClick={leerTodas} className="text-[10px] text-[#F5F7FA] opacity-60 hover:opacity-100">marcar todo visto</button>
          </div>
          <div className="space-y-0.5">
            {novs.slice(0, 20).map(n => (
              <div key={n.id} onClick={() => abrirNovedad(n)} className="flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5" style={{ backgroundColor: 'var(--surface-2)' }}>
                <span className="text-[10px] font-bold text-[#F5F7FA] opacity-50 w-14 shrink-0 uppercase tracking-wider pt-0.5">{n.account || 'Sist.'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#EDEFF3] truncate">{n.titulo}</div>
                  {n.texto && <div className="text-[11px] text-[#F5F7FA] opacity-60 line-clamp-2">{n.texto}</div>}
                </div>
                <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0">{(() => { const v = n.ultima || n.creada; return v ? `${fmtFechaCorta(v)} ${String(v).slice(11, 16)}` : ''; })()}</span>
              </div>
            ))}
            {novs.length > 20 && <div className="px-3 py-1 text-[10px] text-[#F5F7FA] opacity-40">y {novs.length - 20} más</div>}
          </div>
        </Colapsable>
      )}

      {/* Colapsados: contexto, no decisiones. Lado a lado en escritorio:
          la mitad del scroll con la misma información. */}
      <div className="grid md:grid-cols-2 gap-4 items-start">
      <Colapsable titulo="Ayer en cada cuenta" abierto={abierto.ayer} onToggle={() => setAbierto(s => ({ ...s, ayer: !s.ayer }))}
        resumen={cuentas.map(c => { const p = ultimoPulso[c]; return p ? `${c}: ${nivelPulso(p.nivel).etiqueta.toLowerCase()}` : `${c}: sin análisis`; }).join(' · ')}>
        <div className="space-y-1.5">
          {cuentas.map(c => { const p = ultimoPulso[c]; const nivel = p ? nivelPulso(p.nivel) : null; return (
            <button key={c} onClick={() => onGoTo('cuenta', c, 'semana')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5" style={{ backgroundColor: 'var(--surface-2)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#EDEFF3] flex items-center gap-1.5">
                  {p && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.nivel === 'critico' ? 'var(--bad)' : p.nivel === 'atencion' ? 'var(--warn)' : '#4ADE80' }} />}
                  {c}
                </span>
                <span className="text-[10px] text-[#F5F7FA] opacity-50" title={nivel?.descripcion}>{p ? `${nivel!.etiqueta} · análisis diario del ${fmtFechaCorta(p.fecha)}` : 'sin análisis todavía'}</span>
              </div>
              {/* El hallazgo va entero; el resumen largo se recorta con CSS (line-clamp),
                  nunca cortando el texto del agente a mitad de palabra. */}
              {p && (() => { const t = abrirTextoAgente(p.hallazgo_principal).titulo || abrirTextoAgente(p.hallazgo_principal).cuerpo || abrirTextoAgente(p.resumen).cuerpo; return t ? <p className="text-[11px] text-[#F5F7FA] opacity-75 mt-0.5 leading-relaxed line-clamp-2" title={t}>{t}</p> : null; })()}
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
                <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0">{fmtFechaCorta(i.ejecutado_el)}</span>
                <span className="text-[#F5F7FA] flex-1 truncate">{i.account} · {i.titulo}</span>
                <span className="tabular text-[#EDEFF3] shrink-0">{i.variacion_pct != null ? `${i.variacion_pct > 0 ? '+' : ''}${Number(i.variacion_pct).toFixed(0)}%` : (i.veredicto || '').split(':')[0]}</span>
              </div>
            ))}
            {(ciclo.predicciones || []).filter((p: any) => p.acerto !== null).slice(0, 4).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--surface-2)' }}>
                <span className="text-[10px] text-[#F5F7FA] opacity-40 tabular shrink-0">sem {fmtFechaCorta(p.semana)}</span>
                <span className="text-[#F5F7FA] flex-1">{p.account} · {p.metrica} entre {p.valor_min} y {p.valor_max}</span>
                <span className={`shrink-0 ${p.acerto ? 'text-[#EDEFF3]' : 'text-[#4D9DFF]'}`}>{p.acerto ? 'acertó' : 'falló'}: {p.valor_real}</span>
              </div>
            ))}
          </div>
        </Colapsable>
      )}
      </div>

      <p className="text-[10px] text-[#F5F7FA] opacity-30 text-center pt-2">j / k recorren la cola · Enter abre · 1 resuelve la alerta señalada · ⌥1–4 cambia de cuenta · ⌘K va a cualquier lado</p>
    </div>
  );
}

function Grupo({ titulo, nota, n, icono, destacado, abierto, onToggle, todo, tope, onVerTodo, children }: {
  id?: string; titulo: string; nota?: string; n: number; icono?: React.ReactNode; destacado?: boolean;
  abierto: boolean; onToggle: () => void; todo: boolean; tope: number; onVerTodo: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/5 transition-colors" style={{ backgroundColor: destacado && abierto ? 'var(--primary-faint)' : 'transparent' }}>
        <ChevronRight size={12} className={`text-[#F5F7FA] opacity-40 shrink-0 transition-transform ${abierto ? 'rotate-90' : ''}`} />
        {icono && <span className={destacado ? 'text-[#4D9DFF]' : 'text-[#F5F7FA] opacity-50'}>{icono}</span>}
        <span className="text-[11px] font-semibold text-[#EDEFF3]">{titulo}</span>
        <span className="text-[10px] tabular px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{n}</span>
        {nota && <span className="text-[10px] text-[#F5F7FA] opacity-40 truncate hidden sm:inline">{nota}</span>}
      </button>
      {abierto && <div>{children}</div>}
      {abierto && !todo && n > tope && (
        <button onClick={onVerTodo} className="w-full px-4 py-1.5 text-left text-[10px] text-[#4D9DFF] hover:bg-white/5" style={{ borderTop: '1px solid var(--border)' }}>
          ver los {n} de este grupo
        </button>
      )}
    </div>
  );
}

function Fila({ cuenta, titulo, sub, onClick, accion, activa }: { cuenta: string; titulo: string; sub?: string; onClick: () => void; accion?: React.ReactNode; activa?: boolean; key?: any }) {
  return (
    <div onClick={onClick}
      ref={el => { if (activa && el) el.scrollIntoView({ block: 'nearest' }); }}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${activa ? 'bg-white/10' : 'hover:bg-white/5'}`}
      style={{ borderTop: '1px solid var(--border)', boxShadow: activa ? 'inset 2px 0 0 var(--primary-text)' : undefined }}>
      <span className="text-[9px] font-bold text-[#F5F7FA] opacity-50 w-20 shrink-0 uppercase tracking-wide truncate" title={cuenta}>{cuenta}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#EDEFF3] truncate">{titulo}</div>
        {sub && <div className="text-[11px] text-[#F5F7FA] opacity-55 truncate">{sub}</div>}
      </div>
      {accion || <ChevronRight size={14} className="text-[#F5F7FA] opacity-30 shrink-0" />}
    </div>
  );
}

function Colapsable({ titulo, resumen, abierto, onToggle, children }: { titulo: string; resumen?: string; abierto: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left min-w-0">
        {abierto ? <ChevronDown size={14} className="text-[#F5F7FA] opacity-50 shrink-0" /> : <ChevronRight size={14} className="text-[#F5F7FA] opacity-50 shrink-0" />}
        <span className="text-xs font-medium text-[#EDEFF3] whitespace-nowrap shrink-0">{titulo}</span>
        {!abierto && resumen && <span className="text-[11px] text-[#F5F7FA] opacity-50 truncate min-w-0">{resumen}</span>}
      </button>
      {abierto && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
