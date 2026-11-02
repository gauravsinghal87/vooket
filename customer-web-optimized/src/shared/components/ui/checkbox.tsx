import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ label, className, id, ...props }, ref) => {
  const inputId = id || props.name;
  return (
    <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
      <input
        ref={ref}
        type="checkbox"
        id={inputId}
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-600 accent-brand-600 focus:ring-brand-600',
          className
        )}
        {...props}
      />
      {label && <span className="leading-snug">{label}</span>}
    </label>
  );
});
Checkbox.displayName = 'Checkbox';
