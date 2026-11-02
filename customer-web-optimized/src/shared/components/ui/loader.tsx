import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

interface LoaderProps {
  /** Optional label announced to assistive tech. */
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const;

/**
 * Shared loading indicator. Module screens keep using their own layout around
 * it; only the spinner itself is shared.
 */
export function Loader({ label = 'Loading', className, size = 'md' }: LoaderProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-brand-600', SIZES[size])} aria-hidden />
    </span>
  );
}
