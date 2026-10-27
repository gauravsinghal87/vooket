import { cn } from '@/lib/utils';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ className, label, id, ...props }: CheckboxProps) {
  const input = (
    <input
      type="checkbox"
      id={id}
      className={cn(
        'h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-600 accent-brand-600 focus:ring-brand-500',
        className
      )}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-800">
      {input}
      {label}
    </label>
  );
}

interface SwitchProps {
  className?: string;
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ className, label, checked, onChange, disabled }: SwitchProps) {
  return (
    <span className={cn('flex items-center gap-2.5', label && 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-neutral-300',
          className
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
      {label && <span className="text-sm text-neutral-800">{label}</span>}
    </span>
  );
}