import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  tone?: 'brand' | 'food';
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  tone = 'brand',
  className,
}: QuantityStepperProps) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const plusTone = tone === 'food' ? 'bg-food-600 hover:bg-food-700' : 'bg-brand-600 hover:bg-brand-700';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1',
        className
      )}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(
          'flex items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-40',
          dim
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(
          'flex items-center justify-center rounded-full text-white transition-colors disabled:opacity-40',
          dim,
          plusTone
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
