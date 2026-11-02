import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
}

export function BottomSheet({ open, onOpenChange, title, children, className, showClose = true }: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl focus:outline-none animate-sheet-up sm:bottom-4 sm:max-w-lg sm:rounded-3xl',
            className
          )}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
            <div>
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-neutral-200 sm:hidden" />
              {title && <Dialog.Title className="text-lg font-bold text-neutral-900">{title}</Dialog.Title>}
            </div>
            {showClose && (
              <Dialog.Close
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 focus:outline-2 focus:outline-brand-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            )}
          </div>
          <div className="pb-safe px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
