import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  lastPage: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, lastPage, total, onChange }: PaginationProps) {
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
      <p className="text-sm text-neutral-500">
        {total} record{total === 1 ? '' : 's'} · page {page} of {lastPage}
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-neutral-600 hover:bg-ink-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-neutral-600 hover:bg-ink-50 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}