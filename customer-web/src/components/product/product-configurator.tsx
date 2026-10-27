import { useMemo, useState, type ReactNode } from 'react';
import { Info, Loader2, Minus, Plus, Tag } from 'lucide-react';
import type { Product, ProductOption, OptionGroup } from '@/types/catalog';
import type { OrderType } from '@/types/models';
import {
  activeOptionGroups,
  defaultSelections,
  groupIsSingle,
  groupMaxSelect,
  groupMinSelect,
  optionAvailable,
  optionPrice,
  unitPricePreview,
} from '@/lib/productOptions';
import { useCartAdd } from '@/hooks/useCartAdd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn, formatCurrency } from '@/lib/utils';

export interface ProductConfiguratorAddPayload {
  productId: number;
  quantity: number;
  selected_options: { group_id: number; option_id: number }[];
}

interface ProductConfiguratorProps {
  product: Product;
  type: OrderType;
  onAdded?: (payload: ProductConfiguratorAddPayload) => void;
  footerAction?: ReactNode;
  variant?: 'card' | 'bare';
  sticky?: boolean;
  initialSelections?: Record<number, number[]>;
  initialQuantity?: number;
}

const COLLAPSE_THRESHOLD = 3;

/** Max length of Zomato's per-item "cooking request" note. */
const NOTE_MAX = 100;

/** Zomato's group caption: `Required • Select any 1 option`. */
function groupSubtitle(group: OptionGroup): string {
  const min = groupMinSelect(group);
  const max = groupMaxSelect(group);
  const need = min > 0 ? 'Required' : 'Optional';
  let rule: string;
  if (groupIsSingle(group)) rule = 'Select any 1 option';
  else if (min === max) rule = `Select ${min} option${min > 1 ? 's' : ''}`;
  else if (min > 0) rule = `Select any ${min}–${max} options`;
  else rule = `Select up to ${max} options`;
  return `${need} • ${rule}`;
}

export function ProductConfigurator({
  product,
  type,
  onAdded,
  footerAction,
  variant = 'card',
  sticky = false,
  initialSelections,
  initialQuantity,
}: ProductConfiguratorProps) {
  const groups = useMemo(() => activeOptionGroups(product), [product]);
  const [selected, setSelected] = useState<Record<number, number[]>>(() => {
    const base = Object.fromEntries(groups.map((g) => [g.id, defaultSelections(g)]));
    if (initialSelections) {
      for (const group of groups) {
        const valid = (initialSelections[group.id] ?? []).filter(
          (id) => (group.values ?? []).some((v) => v.id === id && optionAvailable(v))
        );
        if (valid.length) base[group.id] = valid.slice(0, groupMaxSelect(group));
      }
    }
    return base;
  });
  const [quantity, setQuantity] = useState(initialQuantity ?? 1);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { submit, isPending } = useCartAdd();

  const unitPrice = useMemo(() => unitPricePreview(product, selected), [product, selected]);
  const total = Math.round(unitPrice * quantity * 100) / 100;

  // The struck-through original in the Add button: only when the product is
  // actually cheaper than its compare-at price.
  const compareAt = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const hasDiscount = compareAt !== null && Number.isFinite(compareAt) && compareAt > parseFloat(product.price);
  const compareTotal = hasDiscount ? Math.round(compareAt * quantity * 100) / 100 : null;

  const canSubmit = groups.every((group) => {
    const ids = selected[group.id] ?? [];
    return ids.length >= groupMinSelect(group) && ids.length <= groupMaxSelect(group);
  });

  if (groups.length === 0) return null;

  const selectSingle = (groupId: number, optionId: number) => {
    setError(null);
    setSelected((prev) => ({ ...prev, [groupId]: [optionId] }));
  };

  const toggleMultiple = (group: (typeof groups)[number], optionId: number) => {
    setError(null);
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= groupMaxSelect(group)) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const handleAdd = () => {
    const payload: { group_id: number; option_id: number }[] = [];

    for (const group of groups) {
      const ids = selected[group.id] ?? [];
      const min = groupMinSelect(group);
      const max = groupMaxSelect(group);

      if (ids.length === 0 && min > 0) {
        setError(`Please select "${group.name}".`);
        return;
      }
      if (ids.length < min) {
        setError(`Please select at least ${min} option(s) for "${group.name}".`);
        return;
      }
      if (ids.length > max) {
        setError(`You can select at most ${max} option(s) for "${group.name}".`);
        return;
      }

      for (const id of ids) payload.push({ group_id: group.id, option_id: id });
    }

    submit(
      {
        product_id: product.id,
        quantity,
        cart_type: type,
        selected_options: payload,
        ...(type === 'food' && note.trim() ? { special_instructions: note.trim() } : {}),
      },
      {
        productName: product.name,
        onSuccess: () => {
          toast('Added to cart');
          onAdded?.({ productId: product.id, quantity, selected_options: payload });
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Could not add to cart';
          setError(message);
          toast(message, 'error');
        },
      }
    );
  };

  const groupContent = (group: (typeof groups)[number]) => {
    const values = (group.values ?? []).slice();
    const isOpen = expanded[group.id] ?? false;
    const visibleValues = values.length > COLLAPSE_THRESHOLD && !isOpen ? values.slice(0, COLLAPSE_THRESHOLD) : values;
    const hiddenCount = values.length - visibleValues.length;
    const single = groupIsSingle(group);

    return (
      <div
        key={group.id}
        className={cn(
          variant === 'bare' ? 'mb-3.5 rounded-2xl border border-neutral-100 bg-white p-4' : 'mb-1'
        )}
      >
        <div className="mb-1.5">
          <p className="text-[17px] font-bold leading-tight tracking-tight text-neutral-900">{group.name}</p>
          <p className="mt-0.5 text-[13px] text-neutral-500">{groupSubtitle(group)}</p>
        </div>

        <div role={single ? 'radiogroup' : 'group'} aria-label={group.name}>
          {visibleValues.map((value: ProductOption) => {
            const price = optionPrice(value);
            const active = (selected[group.id] ?? []).includes(value.id);
            const available = optionAvailable(value);
            const maxed = !single && !active && (selected[group.id] ?? []).length >= groupMaxSelect(group);
            const disabled = !available || maxed;

            return (
              <label
                key={value.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 border-b border-neutral-100 py-3 transition-opacity last:border-b-0',
                  disabled && 'cursor-not-allowed opacity-40'
                )}
              >
                {single ? (
                  <input
                    type="radio"
                    name={`group-${group.id}`}
                    checked={active}
                    disabled={!available}
                    onChange={() => selectSingle(group.id, value.id)}
                    className="sr-only"
                  />
                ) : (
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={disabled}
                    onChange={() => toggleMultiple(group, value.id)}
                    className="sr-only"
                  />
                )}

                <span className={cn('min-w-0 flex-1 text-[15px]', active ? 'font-bold text-neutral-900' : 'font-medium text-neutral-700')}>
                  {value.name}
                </span>

                {price > 0 && (
                  <span className="shrink-0 text-[15px] font-bold text-neutral-900">
                    ₹{price.toLocaleString('en-IN')}
                  </span>
                )}

                {/* Control sits hard right, Zomato-style: red radio circle or
                    filled checkbox depending on the group's selection type. */}
                <span
                  aria-hidden
                  className={cn(
                    'flex shrink-0 items-center justify-center border-2 transition-colors',
                    single
                      ? 'h-[19px] w-[19px] rounded-full'
                      : 'h-[18px] w-[18px] rounded-[5px]',
                    active
                      ? type === 'grocery'
                        ? 'border-success'
                        : 'border-food-600'
                      : 'border-neutral-300 bg-white'
                  )}
                >
                  {single ? (
                    active && <span className={cn('h-2.5 w-2.5 rounded-full', type === 'grocery' ? 'bg-success' : 'bg-food-600')} />
                  ) : (
                    active && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none">
                        <path d="M2.5 6.2 5 8.7 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )
                  )}
                </span>
              </label>
            );
          })}
        </div>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: true }))}
            className={cn('mt-2 text-[13px] font-bold', type === 'grocery' ? 'text-success' : 'text-food-600')}
          >
            +{hiddenCount} more
          </button>
        )}
      </div>
    );
  };

  const noteCard = (
    <div className="mb-3.5 rounded-2xl border border-neutral-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-bold text-neutral-900">Add a cooking request (optional)</p>
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
      </div>
      <div className="relative mt-2.5">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          placeholder="e.g. Don't make it too spicy"
          aria-label="Cooking request"
          className="w-full resize-none rounded-xl bg-neutral-50 px-3.5 py-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-food-600/15"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] font-medium text-neutral-400">
          {NOTE_MAX - note.length}
        </span>
      </div>
    </div>
  );

  const stepper = (tone: 'food' | 'grocery') => (
    <div
      className={cn(
        'inline-flex h-11 shrink-0 items-center overflow-hidden rounded-xl border bg-white',
        tone === 'grocery' ? 'border-success/40' : 'border-food-300'
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        disabled={quantity <= 1}
        className={cn(
          'flex h-full w-10 items-center justify-center transition-colors disabled:opacity-35',
          tone === 'grocery' ? 'text-success' : 'text-food-600'
        )}
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <span className="min-w-6 text-center text-[15px] font-extrabold text-neutral-900">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => setQuantity((q) => q + 1)}
        className={cn(
          'flex h-full w-10 items-center justify-center transition-colors',
          tone === 'grocery' ? 'text-success' : 'text-food-600'
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );

  const footer =
    type === 'grocery' ? (
      // Grocery keeps its original footer: stepper, explicit total, add button.
      <div
        className={cn(
          'flex items-center gap-3 pt-3',
          sticky && 'sticky bottom-0 z-10 -mx-5 -mb-4 border-t border-neutral-100 bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4'
        )}
      >
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-neutral-200">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200 active:scale-90 disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-5 text-center text-sm font-bold text-neutral-900">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => q + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white transition-colors active:scale-90 hover:bg-success/90"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="ml-auto shrink-0 text-sm font-bold text-neutral-900">{formatCurrency(total)}</span>

        {footerAction}

        <Button
          onClick={handleAdd}
          disabled={!canSubmit || isPending}
          variant="default"
          className="h-11 shrink-0 gap-1.5 rounded-full px-5 text-sm"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Add item {formatCurrency(total)}
        </Button>
      </div>
    ) : (
      // Food: Zomato's footer — bordered stepper hard left, one full-width red
      // "Add item" button carrying the struck original and the effective total.
      <div
        className={cn(
          'flex items-center gap-3 pt-4',
          sticky && 'sticky bottom-0 z-10 -mx-5 -mb-4 border-t border-neutral-100 bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3.5'
        )}
      >
        {stepper('food')}
        {footerAction}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canSubmit || isPending}
          className="tap flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-food-600 px-4 text-[15px] font-extrabold text-white transition-colors hover:bg-food-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span>Add item</span>
              {compareTotal !== null && (
                <span className="text font-semibold text-white/80 line-through">
                  {formatCurrency(compareTotal)}
                </span>
              )}
              <span>{formatCurrency(total)}</span>
            </>
          )}
        </button>
      </div>
    );

  const groupsNode = (
    <>
      {groups.map(groupContent)}
      {type === 'food' && noteCard}
      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      {footer}
    </>
  );

  if (variant === 'card') {
    return (
      <Card className="p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
          <Tag className="h-4 w-4 text-neutral-400" /> Customize
        </h2>
        <div className="mt-3">{groupsNode}</div>
      </Card>
    );
  }

  return groupsNode;
}
