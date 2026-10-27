import { forwardRef, cloneElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:outline-neutral-900',
  outline: 'border border-ink-200 bg-white text-neutral-800 hover:bg-ink-50/60 focus-visible:outline-neutral-400',
  ghost: 'bg-transparent text-neutral-700 hover:bg-ink-50/60',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, asChild, className = '', children, disabled, ...props },
    ref
  ) => {
    const classes = [
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].join(' ');

    if (asChild) {
      const child = children as ReactElement<{ className?: string }>;
      return cloneElement(child, {
        className: [child.props.className, classes].filter(Boolean).join(' '),
      });
    }

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';