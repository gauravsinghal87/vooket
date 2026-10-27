import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
  {
    variants: {
      tone: {
        neutral: 'bg-neutral-100 text-neutral-700',
        success: 'bg-emerald-50 text-emerald-700',
        info: 'bg-brand-50 text-brand-700',
        warning: 'bg-amber-50 text-amber-700',
        danger: 'bg-red-50 text-red-700',
        accent: 'bg-accent-50 text-accent-700',
        violet: 'bg-violet-50 text-violet-700',
        slate: 'bg-slate-100 text-slate-700',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone, className, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}

export { badgeVariants };