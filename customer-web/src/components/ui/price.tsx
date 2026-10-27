import { formatCurrency } from '@/lib/utils';

interface PriceProps {
  value: string | number;
  compareAt?: string | number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Price({ value, compareAt, size = 'md', className }: PriceProps) {
  const hasCompare = compareAt !== undefined && compareAt !== null && parseFloat(String(compareAt)) > parseFloat(String(value));
  return (
    <span className={className}>
      <span className={`font-bold ${sizes[size]}`}>{formatCurrency(value)}</span>
      {hasCompare && (
        <span className="ml-1.5 text-xs text-neutral-400 line-through">{formatCurrency(compareAt)}</span>
      )}
    </span>
  );
}
