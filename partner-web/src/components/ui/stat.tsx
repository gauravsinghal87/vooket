import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'success' | 'accent' | 'violet' | 'slate' | 'warning';

const toneClasses: Record<Tone, string> = {
  brand: 'text-brand-600',
  success: 'text-emerald-600',
  accent: 'text-amber-500',
  violet: 'text-violet-600',
  slate: 'text-neutral-500',
  warning: 'text-amber-600',
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Tighter type and padding for dense rows, e.g. a six-across stats strip. */
  dense?: boolean;
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand', dense = false }: StatCardProps) {
  return (
    <div className={cn('rounded-2xl border border-ink-100 bg-white shadow-card', dense ? 'p-3' : 'p-4')}>
      {Icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-xl bg-ink-50',
            toneClasses[tone],
            dense ? 'mb-2 h-8 w-8' : 'mb-3 h-9 w-9',
          )}
        >
          <Icon className={dense ? 'h-4 w-4' : 'h-4.5 w-4.5'} />
        </div>
      )}
      <p className={cn('font-medium text-neutral-500', dense ? 'text-xs leading-snug' : 'text-xs')}>{label}</p>
      <p
        className={cn(
          'font-bold tracking-tight text-neutral-900',
          dense ? 'mt-0.5 truncate text-lg' : 'mt-1 text-2xl',
        )}
      >
        {value}
      </p>
      {sub && <p className={cn('text-neutral-400', dense ? 'mt-0.5 text-[11px] leading-snug' : 'mt-1 text-xs')}>{sub}</p>}
    </div>
  );
}