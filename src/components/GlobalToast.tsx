import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

export function GlobalToast() {
  const { notifications, removeNotification } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <ToastItem key={n.id} notification={n} onRemove={() => removeNotification(n.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ notification: any; onRemove: () => void }> = ({ notification, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div className="pointer-events-auto flex items-start gap-3 p-4 bg-[#1A1F36] border border-[#0062CC]/30 rounded-2xl shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300 w-80">
      <CheckCircle2 className="text-[#0062CC] shrink-0 mt-0.5" size={18} />
      
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-[#FFFFFF]">{notification.title}</h4>
        <p className="text-xs text-[#F5F7FA]/70 mt-1 leading-relaxed">{notification.message}</p>
      </div>
      
      <button onClick={onRemove} className="text-[#F5F7FA]/60 hover:text-[#FFFFFF] transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};
