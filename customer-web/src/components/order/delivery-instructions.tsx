import { useCartStore, DELIVERY_NOTE_MAX_LENGTH } from '@/store/cartStore';
import { MessageSquare } from 'lucide-react';

/**
 * Delivery instructions typed straight into the cart — floor, gate, landmark,
 * "leave at the door" — submitted with the order as `customer_note` (max 500
 * characters, the backend's rule). The value lives in the cart store, per
 * module, so it survives the trip to checkout and back.
 */
export function DeliveryInstructions({ type }: { type: 'food' | 'grocery' }) {
  const note = useCartStore((s) => (type === 'food' ? s.foodDeliveryNote : s.groceryDeliveryNote));
  const setDeliveryNote = useCartStore((s) => s.setDeliveryNote);

  return (
    <section className="rounded-2xl border border-neutral-100 bg-white p-3.5">
      <label htmlFor={`delivery-note-${type}`} className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
          <MessageSquare className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-neutral-900">Delivery instructions</span>
          <span className="block text-xs text-neutral-500">For the delivery partner — optional</span>
        </span>
      </label>

      <textarea
        id={`delivery-note-${type}`}
        value={note}
        onChange={(e) => setDeliveryNote(type, e.target.value.slice(0, DELIVERY_NOTE_MAX_LENGTH))}
        maxLength={DELIVERY_NOTE_MAX_LENGTH}
        rows={2}
        placeholder="e.g. Ring the bell, leave at the gate, avoid calling"
        className="mt-2.5 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
      />

      <p className="mt-1 text-right text-[11px] text-neutral-400">
        {note.length}/{DELIVERY_NOTE_MAX_LENGTH}
      </p>
    </section>
  );
}
