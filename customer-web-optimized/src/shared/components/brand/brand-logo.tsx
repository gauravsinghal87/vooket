import { useState } from 'react';
import { cn } from '@/shared/utils/utils';
import { useBranding } from '@/shared/hooks/useBranding';
import { brandInitials } from '@/shared/utils/branding';

export function BrandLogo({
  className,
  size = 'md',
  tone = 'dark',
  responsiveText = false,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'light';
  responsiveText?: boolean;
}) {
  const { name, logo } = useBranding();
  const [imageFailed, setImageFailed] = useState(false);
  const showLogo = Boolean(logo) && !imageFailed;

  const dims = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  }[size];
  const text = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size];

  // Preserve the Super[accent]Basket wordmark styling for an arbitrary platform
  // name: leading words in the base tone, the final word in the brand accent.
  const words = name.trim().split(/\s+/).filter(Boolean);
  const leading = words.length > 1 ? words.slice(0, -1).join(' ') : '';
  const finalWord = words[words.length - 1] ?? '';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLogo ? (
        <img
          src={logo ?? undefined}
          alt=""
          onError={() => setImageFailed(true)}
          className={cn('shrink-0 rounded-xl bg-transparent object-cover', dims)}
        />
      ) : (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 font-black text-white shadow-sm',
            dims
          )}
        >
          {brandInitials(name)}
        </div>
      )}
      <span
        className={cn(
          'font-extrabold tracking-tight',
          responsiveText && 'hidden sm:inline',
          text,
          tone === 'dark' ? 'text-neutral-900' : 'text-white'
        )}
      >
        {leading && <>{leading} </>}
        <span className="text-accent-500">{finalWord}</span>
      </span>
    </div>
  );
}