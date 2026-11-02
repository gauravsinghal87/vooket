import { cn } from '@/shared/utils/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-neutral-200/80 bg-white shadow-sm',
        onClick && 'cursor-pointer transition-all hover:shadow-md active:scale-[0.99]',
        className
      )}
    >
      {children}
    </div>
  );
}
