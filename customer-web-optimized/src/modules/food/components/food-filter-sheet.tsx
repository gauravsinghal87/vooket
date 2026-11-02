import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDownWideNarrow,
  BadgePercent,
  Bookmark,
  IndianRupee,
  ShieldCheck,
  Star,
  Timer,
  X,
} from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import {
  DEFAULT_FOOD_FILTERS,
  DISH_PRICE_BANDS,
  activeFoodFilterCount,
  type FoodFilters,
  type FoodSortId,
} from '@/modules/food/components/food-filters';

interface FoodFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FoodFilters;
  onApply: (next: FoodFilters) => void;
}

const SORT_OPTIONS: { id: FoodSortId; label: string }[] = [
  { id: 'recommended', label: 'Relevance' },
  { id: 'rating', label: 'Rating: high to low' },
  { id: 'fast', label: 'Delivery time' },
];

const TIME_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any time' },
  { value: 30, label: 'Under 30 mins' },
  { value: 45, label: 'Under 45 mins' },
];

const RATING_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 3.5, label: 'Rated 3.5+' },
  { value: 4, label: 'Rated 4.0+' },
  { value: 4.5, label: 'Rated 4.5+' },
];

/** Section ids in visual order — the left rail scrolls the right column to them. */
const TABS: { id: string; label: string; icon: typeof Star }[] = [
  { id: 'sort', label: 'Sort By', icon: ArrowDownWideNarrow },
  { id: 'time', label: 'Time', icon: Timer },
  { id: 'rating', label: 'Rating', icon: Star },
  { id: 'offers', label: 'Offers', icon: BadgePercent },
  { id: 'price', label: 'Dish Price', icon: IndianRupee },
  { id: 'trust', label: 'Trust Markers', icon: ShieldCheck },
  { id: 'collections', label: 'Collections', icon: Bookmark },
];

/**
 * The Zomato "Filters and sorting" sheet: a floating dark close button above a
 * rounded sheet, a vertical tab rail on the left and one continuously scrolling
 * column of grouped option cards on the right. Tapping a rail tab scrolls the
 * column to that section and the rail marks the section in view. Editing
 * happens on a draft copy, so closing without applying leaves the committed
 * filters untouched; `Close` / `Show results` live in a fixed footer.
 */
export function FoodFilterSheet({ open, onClose, filters, onApply }: FoodFilterSheetProps) {
  const [draft, setDraft] = useState<FoodFilters>(filters);
  const [activeTab, setActiveTab] = useState('sort');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Re-seed the draft each time the sheet opens so it reflects the committed
  // state (active filters show correctly after reopening) and reset the rail
  // to the first section.
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setActiveTab('sort');
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [open, filters]);

  const count = activeFoodFilterCount(draft);

  const scrollToTab = (id: string) => {
    setActiveTab(id);
    const container = scrollRef.current;
    const section = container?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (container && section) container.scrollTo({ top: section.offsetTop - container.offsetTop, behavior: 'smooth' });
  };

  // Scroll spy: the rail highlights the section whose top edge is closest above
  // the column's top edge as the user scrolls the right column.
  const onScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const top = container.scrollTop + 8;
    let current = TABS[0].id;
    for (const tab of TABS) {
      const section = container.querySelector<HTMLElement>(`[data-section="${tab.id}"]`);
      if (section && section.offsetTop - container.offsetTop <= top) current = tab.id;
    }
    setActiveTab(current);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />

        {/* Zomato's floating circular close button, hovering above the sheet. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-[min(88dvh,44rem)] z-50 flex justify-center">
          <Dialog.Close
            aria-label="Close filters"
            className="tap pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-900/85 text-white shadow-lg transition-colors hover:bg-ink-900 focus:outline-2 focus:outline-brand-600 animate-fade-in"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
        </div>

        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl focus:outline-none animate-sheet-up',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-[min(94vw,44rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl'
          )}
        >
          {/* Header: title left, Clear all right. */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">
            <Dialog.Title className="text-[19px] font-extrabold tracking-tight text-neutral-900">
              Filters and sorting
            </Dialog.Title>
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_FOOD_FILTERS)}
              disabled={count === 0}
              className="rounded-full px-2 py-1 text-[15px] font-medium text-neutral-400 transition-colors hover:text-neutral-600 disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              Clear all
            </button>
          </div>

          {/* Body: fixed tab rail + continuously scrolling option cards. */}
          <div className="flex min-h-0 flex-1">
            <nav
              aria-label="Filter sections"
              className="w-[92px] shrink-0 overflow-y-auto border-r border-neutral-100 sm:w-[104px]"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => scrollToTab(tab.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'relative flex w-full flex-col items-center gap-1 px-1 py-3.5 text-center transition-colors',
                      active ? 'bg-food-50 text-food-600' : 'text-neutral-500 hover:text-neutral-700'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute right-0 top-0 h-full w-[3px] transition-colors',
                        active ? 'bg-food-600' : 'bg-transparent'
                      )}
                    />
                    <Icon className="h-5 w-5" strokeWidth={2} />
                    <span className="text-[11px] font-bold leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div ref={scrollRef} onScroll={onScroll} className="min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {/* Sort by — Zomato's single value row. */}
              <section data-section="sort">
                <div className="mb-2 flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
                  <h3 className="text-[15px] font-bold text-neutral-900">Sort by</h3>
                  <span className="text-[15px] font-semibold text-food-600">
                    {SORT_OPTIONS.find((o) => o.id === draft.sort)?.label ?? 'Relevance'}
                  </span>
                </div>
                <div className="space-y-2">
                  {SORT_OPTIONS.map((o) => {
                    const active = draft.sort === o.id;
                    return (
                      <OptionCard
                        key={o.id}
                        active={active}
                        onClick={() => setDraft((d) => ({ ...d, sort: o.id }))}
                        label={o.label}
                      />
                    );
                  })}
                </div>
              </section>

              <FilterSection title="Time">
                {TIME_OPTIONS.map((o) => (
                  <OptionCard
                    key={String(o.value)}
                    active={draft.maxDelivery === o.value}
                    onClick={() => setDraft((d) => ({ ...d, maxDelivery: o.value }))}
                    label={o.label}
                    icon={<Timer className="h-5 w-5" strokeWidth={1.6} />}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Restaurant Rating">
                {RATING_OPTIONS.map((o) => (
                  <OptionCard
                    key={String(o.value)}
                    active={draft.minRating === o.value}
                    onClick={() => setDraft((d) => ({ ...d, minRating: o.value }))}
                    label={o.label}
                    icon={<Star className="h-5 w-5 text-z-green" strokeWidth={1.6} />}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Offers">
                <OptionCard
                  active={draft.freeDelivery}
                  onClick={() => setDraft((d) => ({ ...d, freeDelivery: !d.freeDelivery }))}
                  label="Free delivery"
                  icon={<BadgePercent className="h-5 w-5" strokeWidth={1.6} />}
                />
                <OptionCard
                  active={draft.featured}
                  onClick={() => setDraft((d) => ({ ...d, featured: !d.featured }))}
                  label="Deals of the Day"
                  icon={<BadgePercent className="h-5 w-5" strokeWidth={1.6} />}
                />
              </FilterSection>

              <FilterSection title="Dish Price">
                {DISH_PRICE_BANDS.map((band) => (
                  <OptionCard
                    key={band.id}
                    active={draft.dishPrice === band.id}
                    onClick={() =>
                      setDraft((d) => ({ ...d, dishPrice: d.dishPrice === band.id ? null : band.id }))
                    }
                    label={band.label}
                    icon={<span className="text-[15px] font-bold tracking-tight text-z-green">{band.symbols}</span>}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Trust Markers">
                <OptionCard
                  active={draft.halal}
                  onClick={() => setDraft((d) => ({ ...d, halal: !d.halal }))}
                  label="Halal"
                  icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.6} />}
                />
                <OptionCard
                  active={draft.dineIn}
                  onClick={() => setDraft((d) => ({ ...d, dineIn: !d.dineIn }))}
                  label="Dine-in"
                  icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.6} />}
                />
                <OptionCard
                  active={draft.veg}
                  onClick={() => setDraft((d) => ({ ...d, veg: !d.veg }))}
                  label="Pure veg only"
                  icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.6} />}
                />
              </FilterSection>

              <FilterSection title="Collections">
                <OptionCard
                  active={draft.featured}
                  onClick={() => setDraft((d) => ({ ...d, featured: !d.featured }))}
                  label="Featured kitchens"
                  icon={<Bookmark className="h-5 w-5" strokeWidth={1.6} />}
                />
              </FilterSection>
            </div>
          </div>

          {/* Fixed footer: Close / Show results. */}
          <div className="flex shrink-0 items-center gap-4 border-t border-neutral-100 px-5 py-3.5 pb-safe">
            <Dialog.Close className="tap flex-1 rounded-2xl border border-neutral-200 bg-white py-3 text-[15px] font-bold text-neutral-700 transition-colors hover:border-neutral-300 focus:outline-2 focus:outline-brand-600">
              Close
            </Dialog.Close>
            <button
              type="button"
              onClick={() => onApply(draft)}
              disabled={count === 0}
              className={cn(
                'tap flex-[1.6] rounded-2xl py-3 text-[15px] font-extrabold transition-colors focus:outline-2 focus:outline-brand-600',
                count > 0
                  ? 'bg-food-600 text-white hover:bg-food-700'
                  : 'cursor-not-allowed bg-neutral-100 text-neutral-400'
              )}
            >
              {count > 0 ? `Show results (${count})` : 'Show results'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Grey rounded panel with a title, holding white option cards (Zomato group). */
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[15px] font-bold text-neutral-900">{title}</h3>
      <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-neutral-50 p-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

/**
 * One selectable option card: white tile, optional leading glyph, red radio
 * mark hard right when active — the sheet's universal option treatment.
 */
function OptionCard({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'tap flex min-h-[52px] flex-1 items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.98]',
        active ? 'border-food-600 shadow-[0_0_0_1px_var(--color-food-600)]' : 'border-neutral-200 hover:border-neutral-300'
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-neutral-700">{icon}</span>}
        <span className={cn('text-[13px] leading-snug', active ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-700')}>
          {label}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          active ? 'border-food-600' : 'border-neutral-300'
        )}
      >
        {active && <span className="h-2.5 w-2.5 rounded-full bg-food-600" />}
      </span>
    </button>
  );
}
