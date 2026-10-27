import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}

export function Modal({ open, onOpenChange, title, description, children, className, wide }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl focus:outline-none animate-scale-in',
            wide ? 'max-w-2xl' : 'max-w-md',
            className
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              {title && <Dialog.Title className="text-lg font-bold text-neutral-900">{title}</Dialog.Title>}
              {description && <Dialog.Description className="mt-0.5 text-sm text-neutral-500">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 focus:outline-2 focus:outline-brand-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}