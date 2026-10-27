import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Skeleton({ className = '', rows = 6 }: { className?: string; rows?: number }) {
  return (
    <div className={`w-full space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded-full bg-ink-100" style={{ width: `${100 - (i % 3) * 20}%` }} />
      ))}
    </div>
  );
}

export function LoadingState({ className = '' }: { className?: string }) {
  return (
    <div className={`flex min-h-[40vh] items-center justify-center ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  className = '',
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}>
      <p className="text-sm font-medium text-neutral-700">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}