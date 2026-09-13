import { useCuentas } from '../lib/useCuentas';
/**
 * BANDEJA · lo que te espera, y nada más.
 *
 * Estructura (referencia dashboard noir, 13/9): dos columnas — la principal
 * lleva KPIs sin caja separados por hairlines, la "Lectura del sistema"
 * (una frase calculada, grande y legible) y la cola de decisión; el rail
 * derecho lleva el contexto (ayer por cuenta, respuestas, actividad,
 * resultados). Jerarquía por tipografía y líneas, no por cajas.
 * Tipos de la referencia: label 12px #ADADAD ls .3px · cifra 24px/500
 * ls -.6px #FAFAFA · lectura 17px con negritas.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { nivelPulso } from '../lib/humano';
import type { Actionable } from '../types';
import { NOTION_STATES } from '../types';
import { detectarTipoAuto } from '../lib/tipoAuto';
import { tipoAutoDesde } from '../lib/accion';
import { fmtFechaCorta, useJSON } from './ui';
import { abrirTextoAgente } from '../lib/lectura';

interface Props { onOpenActionable: (a: Actionable) => void; onGoTo: (tab: string, client?: string, segmento?: string) => void }

const LABEL = { color: '#ADADAD', letterSpacing: '0.3px' } as const;
const HAIR = { borderColor: 'var(--border)' } as const;

export function Bandeja({ onOpenActionable, onGoTo }: Props) {
  const { actionables, setSelectedClient } = useAppStore();
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  // Cursor de teclado sobre la cola: j/k mueven, Enter abre, 1 dispara la acción
  // rápida del ítem señalado (si tiene). El mouse no se entera.
  const [cur, setCur] = useState(-1);
  const [filtroCuenta, setFiltroCuenta] = useState<string | null>(null);

  // Estado de servidor por TanStack Query: caché compartida, dedupe, revalida al
  // volver a la pestaña, y cada 3 min de fondo.
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
  const listosOrd = [...listos].sort((a, b) => prioridadOrden(a.priority) - prioridadOrden(b.priority));
  const preguntasOrd = [...preguntas].sort((a, b) => prioridadOrden(a.priority) - prioridadOrden(b.priority));
  const aManoOrd = [...aMano].sort((a, b) => prioridadOrden(a.priority) - prioridadOrden(b.priority));
  const origenDe = (a: any) => a.origen === 'Pulso diario' ? 'análisis diario' : a.origen === 'Anomalias' ? 'anomalías' : a.origen ? String(a.origen).toLowerCase() : 'semanal';

  // Grupos plegables con tope: los dos primeros con ítems abren solos.
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
      if (useAppStore.getState().selectedAction) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCur(c => Math.min(c + 1, nav.length - 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCur(c => Math.max(0, c - 1)); }
      else if (e.key === 'Enter' && curIdx >= 0) { e.preventDefault(); nav[curIdx].click(); }
      else if (e.key === '1' && curIdx >= 0 && nav[curIdx].rapida) { e.preventDefault(); nav[curIdx].rapida!(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // La "Lectura del sistema": UNA frase calculada de la cola, con la guía en
  // segunda línea. Frases enteras, prioridad fija — el estilo AI-Insights de la
  // referencia, sin IA en runtime.
  const lecturaSistema = (() => {
    if (briefing?.datos_al_dia === false) return {
      frase: <>Los datos tienen un problema: mirá <strong className="font-semibold" style={{ color: '#9BC8FF' }}>Sistema › Salud</strong> antes de decidir nada.</>,
      guia: 'Ninguna decisión conviene sobre datos rotos.',
    };
    if (total === 0) return {
      frase: <>Nada pide tu criterio ahora.</>,
      guia: 'Lo próximo llega con el análisis diario de la mañana, o el lunes con el semanal.',
    };
    if (hoy.length > 0) return {
      frase: <><strong className="font-semibold" style={{ color: '#9BC8FF' }}>{hoy.length} alerta{hoy.length !== 1 ? 's' : ''}</strong> pide{hoy.length !== 1 ? 'n' : ''} acción hoy{listosOrd.length > 0 ? <> y quedan <strong className="font-semibold" style={{ color: '#9BC8FF' }}>{listosOrd.length} de un clic</strong> esperando</> : null}.</>,
      guia: 'Empezá por las alertas: el resto puede esperar.',
    };
    if (listosOrd.length > 0) return {
      frase: <>Lo que más devuelve por minuto: <strong className="font-semibold" style={{ color: '#9BC8FF' }}>{listosOrd.length} decisi{listosOrd.length !== 1 ? 'ones' : 'ón'} de un clic</strong>.</>,
      guia: 'El ejecutor las aplica dentro de la hora después de aprobar.',
    };
    if (confirmar.length > 0) return {
      frase: <><strong className="font-semibold" style={{ color: '#9BC8FF' }}>{confirmar.length} deducci{confirmar.length !== 1 ? 'ones' : 'ón'}</strong> espera{confirmar.length !== 1 ? 'n' : ''} tu confirmación.</>,
      guia: 'Confirmá o descartá: son hipótesis del sistema, no hechos.',
    };
    return {
      frase: <>Quedan <strong className="font-semibold" style={{ color: '#9BC8FF' }}>{total} pendiente{total !== 1 ? 's' : ''}</strong>, ninguno urgente.</>,
      guia: 'Podés resolverlos cuando quieras: nada vence hoy.',
    };
  })();

  const fechaHoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="px-5 md:px-7 py-5 max-w-[1440px] mx-auto space-y-5">

      {/* La fecha es el contexto; el nombre de la vista ya lo dice el menú.
          Un h1 "Bandeja" arriba del menú que dice "Bandeja" era una fila
          gastada en repetirse. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs first-letter:uppercase" style={LABEL}>{fechaHoy}</p>
        <div className="flex p-0.5 rounded-lg" style={{ border: '1px solid var(--border)' }}>
          <button onClick={() => setFiltroCuenta(null)} className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${!filtroCuenta ? 'bg-white/10 text-[#FAFAFA]' : 'text-[#ADADAD] hover:text-[#FAFAFA]'}`}>Todas</button>
          {cuentas.map(c => <button key={c} onClick={() => setFiltroCuenta(c)} className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${filtroCuenta === c ? 'bg-white/10 text-[#FAFAFA]' : 'text-[#ADADAD] hover:text-[#FAFAFA]'}`}>{c}</button>)}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_312px] gap-x-8 gap-y-8 items-start">

        {/* ==================== COLUMNA PRINCIPAL ==================== */}
        <div className="min-w-0">

          {/* KPIs sin caja, separados por hairlines verticales */}
          <div className="grid grid-cols-3 divide-x pb-5" style={HAIR}>
            <div className="pr-6">
              <div className="text-xs" style={LABEL}>Esperan tu criterio</div>
              <div className="text-2xl font-medium tabular mt-1 cifra-luz" style={{ letterSpacing: '-0.6px' }}>{total}</div>
              <div className="text-xs mt-1" style={LABEL}>{hoy.length > 0 ? `${hoy.length} con urgencia de hoy` : 'sin urgencias de hoy'}</div>
            </div>
            <div className="px-6">
              <div className="text-xs" style={LABEL}>De un clic</div>
              <div className="text-2xl font-medium tabular mt-1 text-[#FAFAFA]" style={{ letterSpacing: '-0.6px' }}>{listosOrd.length}</div>
              <div className="text-xs mt-1" style={LABEL}>{listosOrd.length > 0 ? 'las más rentables por minuto' : 'ninguna lista para ejecutar'}</div>
            </div>
            {/* Eco del canónico (Sistema › Salud): un vistazo acá, el detalle allá. */}
            <button className="pl-6 text-left group" onClick={() => onGoTo('sistema')} title="Ver el detalle en Sistema › Salud">
              <div className="text-xs" style={LABEL}>Datos</div>
              <div className="text-2xl font-medium mt-1 flex items-center gap-2 group-hover:opacity-90" style={{ letterSpacing: '-0.6px', color: briefing?.datos_al_dia === false ? 'var(--warn)' : '#FAFAFA' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: briefing?.datos_al_dia === false ? 'var(--warn)' : '#4ADE80' }} />
                {briefing?.datos_al_dia === false ? 'problema' : 'al día'}
              </div>
              <div className="text-xs mt-1 group-hover:text-[#FAFAFA] transition-colors" style={LABEL}>{briefing?.datos_al_dia === false ? 'mirá Sistema › Salud →' : 'detalle en Sistema →'}</div>
            </button>
          </div>

          {/* Lectura del sistema — el bloque grande y legible de la referencia */}
          <div className="py-5 border-t" style={HAIR}>
            <div className="flex items-center gap-1.5 text-xs mb-3" style={LABEL}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              Lectura del sistema
            </div>
            <p className="text-[17px] leading-[26px] text-[#FAFAFA]" style={{ maxWidth: '52ch' }}>{lecturaSistema.frase}</p>
            <p className="text-sm mt-1.5" style={LABEL}>{lecturaSistema.guia}</p>
          </div>

          {/* La cola: sin caja — headers de grupo como títulos de sección, hairlines */}
          <div className="border-t" style={HAIR}>
            {total === 0 ? (
              <div className="py-14 text-center">
                <Check size={22} className="mx-auto mb-2" style={{ color: '#4ADE80' }} />
                <p className="text-sm text-[#FAFAFA]">Cola vacía.</p>
                <p className="text-xs mt-1" style={LABEL}>Si querés mirar una cuenta, está en Cuenta.</p>
              </div>
            ) : (
              <>
                {hoy.length > 0 && (
                  <Grupo id="hoy" titulo="Pide acción hoy" urgente n={hoy.length} abierto={estaAbierto('hoy')} onToggle={() => setGAbierto(s => ({ ...s, hoy: !estaAbierto('hoy') }))} todo={!!gTodo.hoy} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, hoy: true }))}>
                    {vis(hoy, 'hoy').map((a: any) => (
                      <Fila key={'al' + a.id} activa={activaId === 'al' + a.id} cuenta={a.account || 'Sistema'} titulo={a.titulo} sub={[a.origen, a.accion].filter(Boolean).join(' · ')} onClick={() => setAbierto(s => ({ ...s, ['al' + a.id]: !s['al' + a.id] }))}
                        accion={<button onClick={(e) => { e.stopPropagation(); resolverAlerta(a.id); }} className="px-2.5 py-1 rounded-md text-[11px] text-[#FAFAFA] hover:bg-white/10 transition-colors" style={{ border: '1px solid var(--border-strong)' }}>Resuelta</button>} />
                    ))}
                  </Grupo>
                )}
                {listosOrd.length > 0 && (
                  <Grupo id="listos" titulo="De un clic" nota="el ejecutor las aplica al aprobar" n={listosOrd.length} abierto={estaAbierto('listos')} onToggle={() => setGAbierto(s => ({ ...s, listos: !estaAbierto('listos') }))} todo={!!gTodo.listos} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, listos: true }))}>
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
                        accion={bloqueados[a.id] ? <span className="text-[11px]" style={{ color: 'var(--warn)' }}>conflicto abierto</span> : undefined} />
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
                  <Grupo id="rep" titulo="Reportes para aprobar" nota="leelo, editá y aprobá" n={reportes.length} abierto={estaAbierto('rep')} onToggle={() => setGAbierto(s => ({ ...s, rep: !estaAbierto('rep') }))} todo={!!gTodo.rep} tope={TOPE} onVerTodo={() => setGTodo(s => ({ ...s, rep: true }))}>
                    {vis(reportes, 'rep').map((r: any, i: number) => (
                      <Fila key={'rep' + i} activa={activaId === 'rep' + i} cuenta={r.cuenta} titulo={`Reporte semanal · ${r.periodo}`} onClick={() => onGoTo('cuenta', r.cuenta, 'reportes')} />
                    ))}
                  </Grupo>
                )}
              </>
            )}
          </div>

          <p className="text-[10px] text-center pt-5 opacity-40" style={LABEL}>j / k recorren la cola · Enter abre · 1 resuelve la alerta señalada · ⌥1–4 cambia de cuenta · ⌘K va a cualquier lado</p>
        </div>

        {/* ==================== RAIL DERECHO ==================== */}
        <aside className="space-y-7 lg:border-l lg:pl-8 min-w-0" style={HAIR}>

          {/* Ayer en cada cuenta */}
          <section>
            <div className="text-xs mb-3" style={LABEL}>Ayer en cada cuenta</div>
            <div className="space-y-3">
              {cuentas.map(c => { const p = ultimoPulso[c]; const nivel = p ? nivelPulso(p.nivel) : null; return (
                <button key={c} onClick={() => onGoTo('cuenta', c, 'semana')} className="w-full text-left group">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-[#FAFAFA] flex items-center gap-2 min-w-0">
                      {p && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.nivel === 'critico' ? 'var(--bad)' : p.nivel === 'atencion' ? 'var(--warn)' : '#4ADE80' }} />}
                      <span className="truncate">{c}</span>
                    </span>
                    <span className="text-[11px] shrink-0 group-hover:text-[#FAFAFA] transition-colors" style={LABEL} title={nivel?.descripcion}>{p ? nivel!.etiqueta : 'sin análisis'}</span>
                  </div>
                  {p && (() => { const t = abrirTextoAgente(p.hallazgo_principal).titulo || abrirTextoAgente(p.hallazgo_principal).cuerpo || abrirTextoAgente(p.resumen).cuerpo; return t ? <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={LABEL} title={t}>{t}</p> : null; })()}
                </button>
              ); })}
            </div>
          </section>

          {/* Te respondieron */}
          {notas?.respuestas?.length > 0 && (
            <section className="border-t pt-6" style={HAIR}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={LABEL}>Te respondieron</span>
                <span className="text-[10px] tabular px-1.5 py-0.5 rounded-full" style={{ border: '1px solid var(--border-strong)', color: '#ADADAD' }}>{notas.respuestas.length}</span>
              </div>
              <div className="space-y-4">
                {notas.respuestas.slice(0, 2).map((r: any) => (
                  <div key={r.id}>
                    <div className="text-[11px] truncate" style={LABEL}>{r.cuenta} · {r.pregunta}</div>
                    <p className="text-[13px] text-[#EDEFF3] leading-relaxed line-clamp-3 mt-0.5" title={r.respuesta}>{r.respuesta}</p>
                    <div className="text-[10px] mt-0.5 opacity-70" style={LABEL}>{r.respondio} · {fmtFechaCorta(r.cuando)}</div>
                  </div>
                ))}
              </div>
              {notas.respuestas.length > 2 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] select-none hover:text-[#FAFAFA] transition-colors" style={LABEL}>ver las {notas.respuestas.length} respuestas</summary>
                  <div className="space-y-4 mt-3">
                    {notas.respuestas.slice(2).map((r: any) => (
                      <div key={r.id}>
                        <div className="text-[11px] truncate" style={LABEL}>{r.cuenta} · {r.pregunta}</div>
                        <p className="text-[13px] text-[#EDEFF3] leading-relaxed mt-0.5">{r.respuesta}</p>
                        <div className="text-[10px] mt-0.5 opacity-70" style={LABEL}>{r.respondio} · {fmtFechaCorta(r.cuando)}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {notas?.pendientes?.length > 0 && <p className="text-[10px] mt-3 opacity-70" style={LABEL}>{notas.pendientes.length} pregunta{notas.pendientes.length !== 1 ? 's' : ''} esperando la próxima corrida.</p>}
            </section>
          )}

          {/* Actividad de los agentes — lista compacta estilo "needs attention" */}
          {novs.length > 0 && (
            <section className="border-t pt-6" style={HAIR}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={LABEL}>Actividad de los agentes</span>
                <button onClick={leerTodas} className="text-[10px] hover:text-[#FAFAFA] transition-colors" style={LABEL}>marcar visto</button>
              </div>
              <div className="space-y-1">
                {novs.slice(0, abierto.novs ? 20 : 5).map(n => (
                  <button key={n.id} onClick={() => abrirNovedad(n)} className="w-full flex items-center gap-2 py-1.5 text-left group">
                    <span className="text-[13px] font-medium truncate flex-1 group-hover:text-[#FAFAFA] transition-colors" style={LABEL} title={n.texto || n.titulo}>{n.titulo}</span>
                    <span className="text-[10px] tabular shrink-0 opacity-60" style={LABEL}>{(() => { const v = n.ultima || n.creada; return v ? fmtFechaCorta(v) : ''; })()}</span>
                    <ChevronRight size={12} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: '#ADADAD' }} />
                  </button>
                ))}
              </div>
              {novs.length > 5 && !abierto.novs && (
                <button onClick={() => setAbierto(s => ({ ...s, novs: true }))} className="text-[11px] mt-2 hover:text-[#FAFAFA] transition-colors" style={LABEL}>ver las {novs.length} novedades</button>
              )}
            </section>
          )}

          {/* Qué pasó después — pares label → valor, estilo card de datos */}
          {(ciclo?.impactos?.length > 0 || ciclo?.predicciones?.length > 0) && (
            <section className="border-t pt-6" style={HAIR}>
              <div className="text-xs mb-3" style={LABEL}>Qué pasó después</div>
              <div className="space-y-2 text-[13px]">
                {ciclo.global?.n > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span style={LABEL}>Predicciones acertadas</span>
                    <span className="text-[#FAFAFA] tabular">{ciclo.global.aciertos} de {ciclo.global.n}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span style={LABEL}>Cambios con resultado a 14 días</span>
                  <span className="text-[#FAFAFA] tabular">{ciclo.impactos?.length || 0}</span>
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] select-none hover:text-[#FAFAFA] transition-colors" style={LABEL}>ver el detalle</summary>
                <div className="space-y-2 mt-3">
                  {(ciclo.impactos || []).slice(0, 5).map((i: any, k: number) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="tabular shrink-0 opacity-60" style={LABEL}>{fmtFechaCorta(i.ejecutado_el)}</span>
                      <span className="flex-1 truncate" style={LABEL}>{i.account} · {i.titulo}</span>
                      <span className="tabular text-[#FAFAFA] shrink-0">{i.variacion_pct != null ? `${i.variacion_pct > 0 ? '+' : ''}${Number(i.variacion_pct).toFixed(0)}%` : (i.veredicto || '').split(':')[0]}</span>
                    </div>
                  ))}
                  {(ciclo.predicciones || []).filter((p: any) => p.acerto !== null).slice(0, 4).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="tabular shrink-0 opacity-60" style={LABEL}>sem {fmtFechaCorta(p.semana)}</span>
                      <span className="flex-1 truncate" style={LABEL}>{p.account} · {p.metrica} entre {p.valor_min} y {p.valor_max}</span>
                      <span className="shrink-0" style={{ color: p.acerto ? '#4ADE80' : 'var(--bad)' }}>{p.acerto ? 'acertó' : 'falló'}</span>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Grupo de la cola: título de sección gris + contador, plegable, hairlines. */
function Grupo({ titulo, nota, n, urgente, abierto, onToggle, todo, tope, onVerTodo, children }: {
  id?: string; titulo: string; nota?: string; n: number; urgente?: boolean;
  abierto: boolean; onToggle: () => void; todo: boolean; tope: number; onVerTodo: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 py-2.5 text-left group">
        <ChevronRight size={12} className={`shrink-0 transition-transform opacity-50 ${abierto ? 'rotate-90' : ''}`} style={{ color: '#ADADAD' }} />
        {urgente && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--warn)' }} />}
        <span className="text-xs group-hover:text-[#FAFAFA] transition-colors" style={{ color: abierto ? '#FAFAFA' : '#ADADAD', letterSpacing: '0.3px' }}>{titulo}</span>
        <span className="text-[10px] tabular px-1.5 py-px rounded-full shrink-0" style={{ border: '1px solid var(--border-strong)', color: '#ADADAD' }}>{n}</span>
        {nota && <span className="text-[10px] truncate hidden sm:inline opacity-70" style={{ color: '#ADADAD' }}>{nota}</span>}
      </button>
      {abierto && <div className="pb-1">{children}</div>}
      {abierto && !todo && n > tope && (
        <button onClick={onVerTodo} className="w-full pb-2.5 pl-5 text-left text-[11px] text-[#4D9DFF] hover:opacity-80">
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
      className={`flex items-center gap-3 pl-5 pr-2 py-[7px] rounded-lg cursor-pointer transition-colors ${activa ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
      style={activa ? { boxShadow: 'inset 2px 0 0 var(--primary-text)' } : undefined}>
      <span className="text-[10px] tabular w-[86px] shrink-0 truncate" style={{ color: '#ADADAD', letterSpacing: '0.3px' }} title={cuenta}>{cuenta}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[#EDEFF3] truncate">{titulo}</div>
        {sub && <div className="text-[11px] truncate opacity-80" style={{ color: '#ADADAD' }}>{sub}</div>}
      </div>
      {accion || <ChevronRight size={13} className="shrink-0 opacity-30" style={{ color: '#ADADAD' }} />}
    </div>
  );
}

// ChevronDown queda para futuros plegados del rail.
void ChevronDown;
