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
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      {Icon && (
        <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-ink-50', toneClasses[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      )}
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}