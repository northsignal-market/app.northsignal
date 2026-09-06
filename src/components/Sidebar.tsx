import React from 'react';
import { Inbox, Building2, Table2, Wrench, Settings, LogOut } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside 
      className="glass-dense group w-16 hover:w-60 h-screen fixed top-0 left-0 flex flex-col z-50 transition-all duration-300 ease-in-out overflow-hidden"
      style={{ borderRadius: 0, borderTop: 0, borderBottom: 0, borderLeft: 0 }}
    >
      {/* Header: Logo NorthSignal — clic lleva a Inicio */}
      <button 
        onClick={() => onTabChange('inicio')}
        title="Ir a Inicio"
        className="h-16 flex items-center px-3.5 shrink-0 overflow-hidden text-left transition-colors hover:bg-white/5 cursor-pointer w-full"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center overflow-hidden p-1.5 shadow-sm"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
          >
            <img 
              src="https://djbwxgicosargfobsmqd.supabase.co/storage/v1/object/public/logos/ChatGPT%20Image%204%20sept%202026,%2007_31_34%20p.m..png" 
              alt="NorthSignal Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-bold text-[#FFFFFF] tracking-tight text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            North Signal
          </span>
        </div>
      </button>

      {/* Navigation Sections */}
      <nav className="flex-1 py-4 px-2 space-y-5 overflow-y-auto custom-scrollbar">
          <NavItem icon={<Inbox size={18} />} label="Bandeja" active={activeTab === 'bandeja'} onClick={() => onTabChange('bandeja')} />
          <NavItem icon={<Building2 size={18} />} label="Cuenta" active={activeTab === 'cuenta'} onClick={() => onTabChange('cuenta')} />
          <NavItem icon={<Table2 size={18} />} label="Datos" active={activeTab === 'datos'} onClick={() => onTabChange('datos')} />
          <NavItem icon={<Wrench size={18} />} label="Herramientas" active={activeTab === 'herramientas'} onClick={() => onTabChange('herramientas')} />
          <NavItem icon={<Settings size={18} />} label="Sistema" active={activeTab === 'sistema'} onClick={() => onTabChange('sistema')} />
        </nav>

      {/* Footer: Logout */}
      <div className="p-2 shrink-0 overflow-hidden" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={async () => {
            try {
              await fetch('/api/logout', { method: 'POST', credentials: 'include' });
              useAppStore.getState().setIsAuthenticated(false);
            } catch (e) {
              console.error('Logout failed');
            }
          }}
          title="Cerrar Sesión"
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-[#F5F7FA] opacity-70 hover:opacity-100 hover:bg-white/10"
        >
          <div className="w-6 h-6 shrink-0 flex items-center justify-center">
            <LogOut size={16} />
          </div>
          <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Cerrar Sesión
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ 
  icon, 
  label, 
  active = false, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick?: () => void 
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all duration-150 text-left ${
        active 
          ? 'bg-[#0062CC] text-[#FFFFFF] font-semibold shadow-sm' 
          : 'text-[#F5F7FA] opacity-75 hover:opacity-100 hover:bg-white/5 font-normal'
      }`}
    >
      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {label}
      </span>
    </button>
  );
}
