import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-5xl font-black text-brand-100">404</p>
      <h1 className="text-lg font-bold text-neutral-900">Page not found</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}