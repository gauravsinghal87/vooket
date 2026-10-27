import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

function initials(name?: string): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, name, size = 'md', className }, ref) => {
    if (src) {
      return (
        <img
          src={src}
          alt={alt || name || 'avatar'}
          loading="lazy"
          className={cn('rounded-full object-cover', sizes[size], className)}
        />
      );
    }
    return (
      <div
        ref={ref}
        aria-label={alt || name || 'avatar'}
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white',
          sizes[size],
          className
        )}
      >
        {initials(name)}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';
