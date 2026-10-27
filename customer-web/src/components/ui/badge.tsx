import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'accent';
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-amber-700',
  danger: 'bg-danger/10 text-danger',
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-food-50 text-food-600',
};

export function Badge({ children, className, variant = 'neutral' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
