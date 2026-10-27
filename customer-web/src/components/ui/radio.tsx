import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(({ label, className, id, ...props }, ref) => {
  const inputId = id || props.name;
  return (
    <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
      <input
        ref={ref}
        type="radio"
        id={inputId}
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 border-neutral-300 text-brand-600 accent-brand-600 focus:ring-brand-600',
          className
        )}
        {...props}
      />
      {label && <span className="leading-snug">{label}</span>}
    </label>
  );
});
Radio.displayName = 'Radio';
