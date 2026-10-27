import { cn } from '@/lib/utils';

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  variant?: 'underline' | 'pill';
  /** Optional per-value active styling (overrides the default active classes). */
  getActiveClass?: (value: T) => string | undefined;
}

export function Tabs<T extends string>({ value, onChange, options, className, variant = 'underline', getActiveClass }: TabsProps<T>) {
  if (variant === 'pill') {
    return (
      <div className={cn('flex gap-1 rounded-full bg-neutral-100 p-1', className)} role="tablist">
        {options.map((o) => (
          <button
            key={o.value}
            role="tab"
            aria-selected={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-brand-600',
              value === o.value
                ? (getActiveClass?.(o.value) ?? 'bg-white text-neutral-900 shadow-sm')
                : 'text-neutral-500 hover:text-neutral-700'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-6 overflow-x-auto no-scrollbar border-b border-neutral-200', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative shrink-0 pb-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
            value === o.value ? 'text-brand-700' : 'text-neutral-500 hover:text-neutral-700'
          )}
        >
          {o.label}
          {value === o.value && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />
          )}
        </button>
      ))}
    </div>
  );
}
