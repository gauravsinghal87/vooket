import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ShoppingBag } from 'lucide-react';
import { Modal } from '@/shared/components/ui/modal';
import { Button } from '@/shared/components/ui/button';
import { repositories } from '@/shared/repositories';
import { useCartConflictStore } from '@/features/cart/store/cartConflictStore';

/**
 * The single, app-wide cross-restaurant replacement confirmation.
 *
 * Rendered once (in the app shell) so the dialog is independent of whichever
 * menu control triggered the conflict. It owns the ordered clear-then-add
 * sequence, guards against duplicate submissions, and keeps the origin UI's
 * `onAdded` callback until the replacement actually succeeds.
 */
export function CartConflictDialog() {
  const queryClient = useQueryClient();
  const pending = useCartConflictStore((s) => s.pending);
  const processing = useCartConflictStore((s) => s.processing);
  const close = useCartConflictStore((s) => s.close);
  const setProcessing = useCartConflictStore((s) => s.setProcessing);

  const [error, setError] = useState<string | null>(null);
  // Guards against a second confirmation firing before `processing` has
  // propagated through the store (a very fast double click / tap).
  const runningRef = useRef(false);

  useEffect(() => {
    if (pending) setError(null);
  }, [pending]);

  const handleCancel = () => {
    if (processing || runningRef.current) return;
    close();
  };

  const handleConfirm = async () => {
    if (!pending || processing || runningRef.current) return;
    runningRef.current = true;
    setProcessing(true);
    setError(null);

    // 1) Clear first and treat any failure as fatal: never add on top of a cart
    //    that still belongs to the other restaurant.
    try {
      await repositories.cart.clear();
    } catch {
      runningRef.current = false;
      setProcessing(false);
      setError('We could not clear your existing cart, so nothing was changed. Please try again.');
      return;
    }

    // 2) Add the preserved request. On failure the cart is already empty, so
    //    report the partial state and resync the UI with the server.
    try {
      const cart = await repositories.cart.addItem(pending.payload);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      pending.onAdded?.(cart);
      runningRef.current = false;
      setProcessing(false);
      close();
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      runningRef.current = false;
      setProcessing(false);
      const detail = err instanceof Error && err.message ? ` ${err.message}` : '';
      setError(
        `Your previous cart was cleared, but we could not add this item.${detail} Please try again.`
      );
    }
  };

  const itemLabel = pending?.productName ? `“${pending.productName}”` : 'this item';

  return (
    <Modal
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) handleCancel();
      }}
      title="Replace your cart?"
      className="max-w-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-food-50 text-food-600">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <p className="pt-0.5 text-sm leading-relaxed text-neutral-600">
          Your cart contains items from another restaurant. Would you like to clear your existing
          cart and add {itemLabel} instead?
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-medium text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={processing}
          className="rounded-full"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="accent"
          onClick={handleConfirm}
          disabled={processing}
          aria-busy={processing}
          className="gap-1.5 rounded-full"
        >
          {processing && <Loader2 className="h-4 w-4 animate-spin" />}
          {processing ? 'Replacing…' : 'Clear cart & add item'}
        </Button>
      </div>
    </Modal>
  );
}
