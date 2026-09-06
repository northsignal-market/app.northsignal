/**
 * <Termino>: envuelve un término del glosario con subrayado punteado y
 * tooltip en hover. Radix Tooltip: accesible, delay compartido entre
 * términos vecinos (no espera de nuevo al pasar de uno a otro), solo hover.
 */
import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { definir } from '../lib/glosario';

export function TerminoProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={350} skipDelayDuration={600}>{children}</Tooltip.Provider>;
}

export function Termino({ t, children, className = '' }: { t: string; children?: React.ReactNode; className?: string }) {
  const def = definir(t);
  if (!def) return <span className={className}>{children ?? t}</span>;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className={`cursor-help ${className}`} style={{ textDecoration: 'underline dotted', textDecorationColor: 'rgba(245,247,250,0.4)', textUnderlineOffset: '3px' }}>
          {children ?? t}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={6} collisionPadding={8}
          className="z-[100] max-w-[280px] rounded-lg px-3 py-2 text-[11px] leading-relaxed text-[#F5F7FA]"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <span className="font-semibold text-[#FFFFFF]">{t}</span>
          <span className="opacity-90"> · {def}</span>
          <Tooltip.Arrow style={{ fill: 'var(--surface-2)' }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
