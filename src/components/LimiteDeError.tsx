import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Red de seguridad del render.
 *
 * Sin esto, una excepción en cualquier componente desmonta el árbol entero y deja
 * la pantalla en blanco, sin mensaje y sin forma de volver. El usuario solo ve que
 * la app "dejó de andar", y no hay cómo saber qué pasó salvo abrir la consola.
 *
 * Con esto: la pantalla que falló muestra qué pasó, el resto de la app sigue viva,
 * y hay un botón para reintentar sin recargar todo.
 *
 * Va como clase porque React no tiene equivalente en función: los límites de error
 * solo existen con getDerivedStateFromError y componentDidCatch.
 */
interface LimiteProps { children: React.ReactNode; nombre?: string }
interface LimiteState { error: Error | null }

class Limite extends React.Component<LimiteProps, LimiteState> {
  constructor(props: LimiteProps) {
    super(props);
    this.state = { error: null };
    this.reintentar = this.reintentar.bind(this);
  }

  static getDerivedStateFromError(error: Error): LimiteState { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[render] ${this.props?.nombre || 'componente'} falló:`, error, info?.componentStack);
  }

  reintentar() { this.setState({ error: null }); }

  render() {
    const self = this;
    if (!self.state?.error) return self.props.children;
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 p-8 text-center">
        <AlertCircle size={28} className="text-[#fca5a5]" />
        <h2 className="text-sm font-medium text-[#EDEFF3]">
          Esta pantalla falló{self.props.nombre ? `: ${self.props.nombre}` : ''}
        </h2>
        <p className="text-xs text-[#F5F7FA] opacity-70 max-w-md leading-relaxed break-words">
          {self.state.error?.message || 'Error desconocido'}
        </p>
        <p className="text-[11px] text-[#F5F7FA] opacity-50 max-w-md">
          El resto de la app sigue funcionando. Si vuelve a pasar, mirá Sistema › Salud
          o abrí un ticket desde ahí con este mensaje.
        </p>
        <button onClick={self.reintentar} aria-label="Reintentar" title="Reintentar"
          className="mt-1 px-3 py-1.5 rounded-lg text-[11px] text-[#EDEFF3] flex items-center gap-1.5"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <RefreshCw size={12} /> Reintentar
        </button>
      </div>
    );
  }
}

export function LimiteDeError({ children, nombre }: { children: any; nombre?: string }) {
  return <Limite nombre={nombre}>{children}</Limite>;
}
