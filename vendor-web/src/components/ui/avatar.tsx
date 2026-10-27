import { forwardRef } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ name, src, className = '' }, ref) => {
    if (src) {
      return (
        <span
          ref={ref}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-100 ${className}`}
        >
          <img src={src} alt={name} className="h-full w-full object-cover" />
        </span>
      );
    }
    const initial = name?.charAt(0)?.toUpperCase() ?? '?';
    return (
      <span
        ref={ref}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 ${className}`}
      >
        {initial}
      </span>
    );
  }
);
Avatar.displayName = 'Avatar';