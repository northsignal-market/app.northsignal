import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

/**
 * Avisos de la app, abajo a la derecha.
 *
 * Reemplaza los alert() nativos, que bloquean la pantalla, no se pueden estilar
 * y en algunos navegadores se pueden silenciar sin que el usuario lo note.
 *
 * El icono ahora depende del tipo: antes siempre mostraba el de exito, asi que
 * un error se veia igual que un guardado correcto.
 */
export function GlobalToast() {
  const { notifications, removeNotification } = useAppStore();
  if (!notifications.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[400] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      {notifications.map((n: any) => (
        <ToastItem key={n.id} notification={n} onRemove={() => removeNotification(n.id)} />
      ))}
    </div>
  );
}

const ToastItem: React.FC<{ notification: any; onRemove: () => void }> = ({ notification, onRemove }) => {
  const tipo = notification.tipo || notification.type || 'ok';
  useEffect(() => {
    // Un error queda mas tiempo: hay que poder leerlo y decidir que hacer.
    const ms = tipo === 'error' ? 9000 : 5000;
    const timer = setTimeout(onRemove, ms);
    return () => clearTimeout(timer);
  }, [onRemove, tipo]);

  const Icono = tipo === 'error' ? AlertCircle : tipo === 'info' ? Info : CheckCircle2;
  const color = tipo === 'error' ? '#fca5a5' : tipo === 'info' ? '#fcd34d' : '#0062CC';
  const borde = tipo === 'error' ? '#b42318' : tipo === 'info' ? '#b45309' : '#0062CC';

  return (
    <div className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300 w-80"
      style={{ backgroundColor: 'var(--surface-1)', border: `1px solid ${borde}66` }}>
      <Icono className="shrink-0 mt-0.5" size={18} style={{ color }} />
      <div className="flex-1 min-w-0">
        {notification.title && <h4 className="text-sm font-semibold text-[#FFFFFF]">{notification.title}</h4>}
        <p className="text-xs text-[#F5F7FA]/80 mt-1 leading-relaxed break-words">{notification.message}</p>
      </div>
      <button onClick={onRemove} aria-label="Cerrar aviso" className="text-[#F5F7FA]/60 hover:text-[#FFFFFF] transition-colors shrink-0">
        <X size={16} />
      </button>
    </div>
  );
};
