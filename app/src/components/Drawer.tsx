import React, { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
  width?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  onBack,
  children,
  width = 'w-full sm:w-[480px]'
}: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // El foco entra al panel al abrirlo y no se escapa con Tab. Sin esto, tabular
  // lleva el foco a la pantalla de atrás, que está tapada: el usuario escribe en
  // un campo que no ve.
  const panel = React.useRef<any>(null);
  useEffect(() => {
    if (!isOpen || !panel.current) return;
    const enfocables = (): any[] => Array.prototype.slice.call(
      panel.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((el: any) => el.offsetParent !== null);
    const primeroAlAbrir = enfocables()[0];
    if (primeroAlAbrir) primeroAlAbrir.focus();
    const atrapar = (e: any) => {
      if (e.key !== 'Tab') return;
      const els = enfocables();
      if (!els.length) return;
      const primero: any = els[0], ultimo: any = els[els.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    window.addEventListener('keydown', atrapar);
    return () => window.removeEventListener('keydown', atrapar);
  }, [isOpen]);

  // Mientras el panel está abierto, el fondo no scrollea: sin esto la rueda del
  // mouse mueve la pantalla de atrás cuando el panel llega a su final.
  useEffect(() => {
    if (!isOpen) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end"
      style={{
        backgroundColor: 'rgba(15, 20, 36, 0.7)'
      }}
      onClick={onClose}
      role="presentation"
    >
      <div 
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Panel de detalle'}
        className={`glass drawer-enter ${width} h-full flex flex-col`}
        style={{ borderRadius: 0, borderTop: 0, borderBottom: 0, borderRight: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div 
          className="p-4 flex items-center justify-between shrink-0"
          style={{
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface-3)'
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {onBack && (
              <button
                onClick={onBack}
                title="Volver"
                aria-label="Volver"
                className="p-1.5 rounded hover:bg-white/10 text-[#F5F7FA] transition-colors shrink-0"
                style={{ borderRadius: '6px' }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="min-w-0">
              {title && (
                <div className="text-sm font-bold text-[#FFFFFF] truncate">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-xs text-[#F5F7FA] opacity-70 truncate">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            title="Cerrar (Esc)"
            className="p-1.5 rounded hover:bg-white/10 text-[#F5F7FA] transition-colors shrink-0"
            style={{ borderRadius: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
