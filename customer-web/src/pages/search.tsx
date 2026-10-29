import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { X, Clock, ChevronLeft, ChevronRight, Mic, Store as StoreIcon, Package } from 'lucide-react';
import { repositories } from '@/repositories';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { coordsKey } from '@/lib/geo';
import { useActiveGroceryStore } from '@/hooks/useActiveGroceryStore';
import { useStoreCatalogue } from '@/hooks/useStoreCatalogue';
import type { Restaurant, Store, Product } from '@/types/catalog';
import { ProductCard } from '@/components/product/product-card';
import { Card } from '@/components/ui/card';
import { Rating } from '@/components/ui/rating';
import { Tabs } from '@/components/ui/tabs';
import { CardSkeleton } from '@/components/ui/skeleton';
import { NoResultsState, ErrorState } from '@/components/ui/state';
import { ServiceabilityNotice } from '@/components/food/serviceability-notice';
import { GroceryServiceabilityNotice } from '@/components/grocery/serviceability-notice';
import { toast } from '@/components/ui/toast';

type Scope = 'all' | 'food' | 'grocery';

/** Minimal shapes for the Web Speech API the mic button drives. */
interface SpeechResultLike {
  transcript: string;
}
type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  start(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<SpeechResultLike>> }) => void) | null;
  onerror: (() => void) | null;
};

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem('sb-recent-searches') ?? '[]');
  } catch {
    return [];
  }
}

function writeRecent(q: string) {
  const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
  localStorage.setItem('sb-recent-searches', JSON.stringify(next));
}

export function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const typeParam = params.get('type') === 'grocery' ? 'grocery' : params.get('type') === 'food' ? 'food' : 'all';
  const qParam = params.get('q') ?? '';
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(qParam);
  const [submitted, setSubmitted] = useState(qParam);
  // A search opened from inside a module (`/search?type=food|grocery`) already
  // knows which module owns it, so the scope is locked to the route param and
  // the All / Food / Grocery selector is dropped. Only the genuinely global
  // `/search` (no type) keeps the selector, and only there is `globalScope`
  // ever used. Deriving `scope` from the param every render also means a
  // module switch that re-opens this route picks up the new module even when
  // the same component instance is reused.
  const moduleScoped = typeParam !== 'all';
  const [globalScope, setGlobalScope] = useState<Scope>('all');
  const scope: Scope = moduleScoped ? typeParam : globalScope;
  const [sort, setSort] = useState<'relevance' | 'rating' | 'price_low' | 'price_high'>('relevance');
  const [recent, setRecent] = useState<string[]>([]);

  // Same effective location as the Food home so zone-gated search results stay
  // consistent with the rest of the Food browsing surfaces.
  const location = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);

  useEffect(() => {
    if (!qParam) return;
    writeRecent(qParam);
    setRecent(readRecent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Grocery search is scoped to the single active (nearest) store, so the
   * cross-store discovery endpoint is not used for that scope. Food and ride
   * search keep using it exactly as before.
   */
  const { activeStore, activeStoreId } = useActiveGroceryStore();
  const storeScopedGrocery = scope === 'grocery' && activeStoreId !== null;
  const hasQuery = submitted.trim().length > 0;

  const storeSearch = useStoreCatalogue(activeStoreId, {
    search: submitted,
    perPage: 40,
    enabled: storeScopedGrocery && hasQuery,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['search', submitted, scope, location.latitude, location.longitude],
    queryFn: () =>
      repositories.search.search(
        submitted,
        scope === 'all' ? undefined : scope,
        { latitude: location.latitude, longitude: location.longitude }
      ),
    enabled: hasQuery && !storeScopedGrocery,
  });

  const loading = storeScopedGrocery ? storeSearch.isLoading : isLoading;
  const errored = storeScopedGrocery ? storeSearch.isError : isError;

  const results = useMemo(() => {
    if (storeScopedGrocery) {
      const products = [...storeSearch.products];
      if (sort === 'price_low') products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      else if (sort === 'price_high') products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      return {
        restaurants: [] as Restaurant[],
        stores: activeStore ? [activeStore] : [],
        products,
        categories: [] as never[],
      };
    }

    if (!data) return null;
    let restaurants = [...data.restaurants];
    let stores = [...data.stores];
    let products = [...data.products];
    if (scope === 'all') {
      const q = submitted.toLowerCase();
      products = products.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
      );
    }
    if (scope === 'food') stores = [];
    if (scope === 'grocery') restaurants = [];
    if (sort === 'rating') {
      restaurants.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
      stores.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    } else if (sort === 'price_low') {
      products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sort === 'price_high') {
      products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    }
    return { restaurants, stores, products, categories: data.categories };
  }, [data, scope, sort, submitted, storeScopedGrocery, storeSearch.products, activeStore]);

  const runSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    writeRecent(trimmed);
    setRecent(readRecent());
    setSubmitted(trimmed);
    setQuery(trimmed);
  };

  // Zomato searches as you type: debounce the raw input into the submitted
  // query so results appear while typing without one request per keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSubmitted('');
      return;
    }
    if (trimmed === submitted) return;
    const t = window.setTimeout(() => setSubmitted(trimmed), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // The mic renders only where the browser really supports speech input, so it
  // is never a dead control.
  const [SpeechImpl] = useState<SpeechCtor | null>(() => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  });

  const startVoice = () => {
    if (!SpeechImpl) return;
    try {
      const rec = new SpeechImpl();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript ?? '';
        if (text) runSearch(text);
      };
      rec.onerror = () => toast('Voice input is unavailable right now', 'error');
      rec.start();
    } catch {
      toast('Voice input is unavailable right now', 'error');
    }
  };

  const totalResults = results
    ? results.restaurants.length +
    (storeScopedGrocery ? 0 : results.stores.length) +
    results.products.length
    : 0;

  // The backend resolves the delivery location for every search too. When it
  // reports the location as unserviceable, food-scope results are replaced by
  // the unavailable-location state instead of showing a partial/empty set —
  // grocery scope is store-catalogue driven and keeps its own behaviour.
  const serviceability = storeScopedGrocery ? null : (data?.serviceability ?? null);
  const foodNotServiceable = !storeScopedGrocery && serviceability?.is_serviceable === false && scope !== 'grocery';

  // Grocery results have their own backend verdict: the store-catalogue path
  // reads it from that request, the discovery path from `grocery_serviceability`.
  // When it reports the location as unserviceable the grocery results are
  // replaced by the unavailable state rather than an empty/partial result set.
  const groceryServiceability = storeScopedGrocery
    ? (storeSearch.serviceability ?? null)
    : (data?.groceryServiceability ?? null);
  const groceryNotServiceable =
    scope !== 'food' && groceryServiceability?.is_serviceable === false;
  const showGroceryNotice = groceryNotServiceable && !foodNotServiceable;
  // Only a grocery-only search is fully replaced by the notice: in the "all"
  // scope a healthy Food side keeps its results and the grocery notice explains
  // why no stores or grocery products appear next to them.
  const resultsBlocked = foodNotServiceable || (groceryNotServiceable && scope === 'grocery');

  const hasTyped = submitted.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Zomato's search pill: back chevron, underline-free input, mic. */}
      <form
        className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-2 pl-2 pr-4 shadow-sm transition-colors focus-within:border-food-400"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-food-600 transition-colors hover:bg-food-50"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Restaurant name or a dish..."
          aria-label="Search"
          autoFocus
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] font-medium text-neutral-900 outline-none placeholder:font-normal placeholder:text-neutral-400"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQuery('');
              setSubmitted('');
            }}
            className="tap flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {SpeechImpl && (
          <button
            type="button"
            aria-label="Voice search"
            onClick={startVoice}
            className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-food-600 transition-colors hover:bg-food-50"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </form>

      {/* Module-scoped searches skip the selector entirely: the route already
          says Food or Grocery, and dropping the node (rather than hiding it)
          collapses the container's `space-y-5` gap so no hole is left behind. */}
      {!moduleScoped && (
        <Tabs<Scope>
          value={scope}
          onChange={setGlobalScope}
          variant="pill"
          options={[
            { value: 'all', label: 'All' },
            { value: 'food', label: 'Food' },
            { value: 'grocery', label: 'Grocery' },
          ]}
          className="max-w-sm"
        />
      )}

      {hasTyped && !resultsBlocked && results && totalResults > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">{totalResults} results</span>          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort results"
            className="ml-auto h-9 rounded-lg border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="relevance">Relevance</option>
            <option value="rating">Top rated</option>
            <option value="price_low">Price: Low to high</option>
            <option value="price_high">Price: High to low</option>
          </select>
        </div>
      )}

      {!hasTyped && (
        <div className="space-y-7">
          {recent.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-neutral-900">
                <Clock className="h-4 w-4 text-neutral-400" /> Recent searches
              </h2>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => runSearch(r)}
                    className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm text-neutral-700 transition-colors hover:border-food-300 hover:text-food-600"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-400">
              What's on your mind?
            </h2>
            <WhatsOnYourMind scope={scope} onPick={runSearch} />
          </section>
        </div>
      )}

      {hasTyped && loading && <CardSkeleton count={4} />}

      {hasTyped && errored && (
        <ErrorState
          title="Search failed"
          description={
            storeScopedGrocery
              ? "We couldn't load products from your nearest store. Try again."
              : 'Something went wrong while searching. Try again.'
          }
          action={{
            label: 'Retry',
            onClick: () => void (storeScopedGrocery ? storeSearch.refetch() : refetch()),
          }}
        />
      )}

      {hasTyped && foodNotServiceable && !loading && !errored && (
        <ServiceabilityNotice serviceability={serviceability} onChangeLocation={openLocationSelector} />
      )}

      {hasTyped && showGroceryNotice && !loading && !errored && (
        <GroceryServiceabilityNotice
          serviceability={groceryServiceability}
          onChangeLocation={openLocationSelector}
        />
      )}

      {hasTyped && !resultsBlocked && results && totalResults === 0 && !loading && !errored && (
        <NoResultsState
          query={submitted}
          onClear={() => setSubmitted('')}
        />
      )}

      {hasTyped && !resultsBlocked && results && !loading && !errored && (
        <div className="space-y-7">
          {storeScopedGrocery && activeStore && (
            <p className="flex items-center gap-2 rounded-xl bg-success/[0.06] px-3 py-2 text-xs font-semibold text-neutral-700">
              <StoreIcon className="h-3.5 w-3.5 shrink-0 text-success" />
              Showing results from your nearest store, {activeStore.name}
            </p>
          )}
          <ResultGroup
            title="Restaurants"
            show={scope !== 'grocery'}
            restaurants={results.restaurants}
            emptyText={scope === 'grocery' ? undefined : 'No restaurants found'}
          />
          <ResultGroup
            title="Stores"
            show={scope !== 'food' && !storeScopedGrocery}
            stores={results.stores}
            emptyText={scope === 'food' ? undefined : 'No stores found'}
          />
          <ResultGroup
            title="Products"
            show
            products={results.products}
            emptyText={storeScopedGrocery ? `No matches at ${activeStore?.name ?? 'your store'}` : 'No products found'}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Zomato's "WHAT'S ON YOUR MIND" grid: a three-column wall of food imagery
 * with the label underneath. Tapping a tile runs that term through the search,
 * exactly like the reference's discovery tiles.
 */
function WhatsOnYourMind({ scope, onPick }: { scope: Scope; onPick: (q: string) => void }) {
  // Grocery categories are zone-gated, so they are requested for the current
  // delivery address (and keyed by it) exactly like the grocery page does.
  const location = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const { data } = useQuery({
    queryKey: ['categories', scope, coordsKey(location)],
    queryFn: async () => {
      // Ask only the active module for its categories: a module-scoped search
      // never requests the other module's list just to discard it.
      if (scope === 'grocery') {
        const g = await repositories.grocery.getCategories({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        return { list: g.categories, kind: 'grocery' as const };
      }
      const f = await repositories.food.getCategories();
      return { list: f, kind: 'food' as const };
    },
  });
  const cats = (data?.list ?? []).slice(0, scope === 'all' ? 18 : 18);
  const kind = data?.kind ?? 'food';

  if (cats.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5">
      {cats.map((c) => (
        <button key={`${kind}-${c.id}`} type="button" onClick={() => onPick(c.name)} className="group text-center">
          <span className="block aspect-[4/3] w-full overflow-hidden rounded-2xl">
            {c.image ? (
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
                🍽️
              </span>
            )}
          </span>
          <span className="mt-2 block truncate text-[13px] font-medium text-neutral-800">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

function FoodResultCard({ r }: { r: Restaurant }) {
  return (
    <Link to={`/restaurant/${r.id}`} className="block">
      <Card className="flex items-center gap-3 p-3 transition-colors hover:border-brand-200">
        <img src={r.cover_image ?? ''} alt={r.name} className="h-16 w-16 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-neutral-900">{r.name}</p>
            {r.is_veg && (
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center border border-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{r.cuisine_type}</p>
          <p className="mt-0.5">
            <Rating value={r.rating} count={r.rating_count} />
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
      </Card>
    </Link>
  );
}

function StoreResultCard({ s }: { s: Store }) {
  return (
    <Link to={`/store/${s.id}`} className="block">
      <Card className="flex items-center gap-3 p-3 transition-colors hover:border-success/50">
        <img src={s.cover_image ?? ''} alt={s.name} className="h-16 w-16 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StoreIcon className="h-4 w-4 shrink-0 text-success" />
            <p className="truncate text-sm font-bold text-neutral-900">{s.name}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{s.address}</p>
          <p className="mt-0.5">
            <Rating value={s.rating} count={s.rating_count} />
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
      </Card>
    </Link>
  );
}

function ResultGroup({
  title,
  show = true,
  restaurants = [],
  stores = [],
  products = [],
  emptyText,
}: {
  title: string;
  show?: boolean;
  restaurants?: Restaurant[];
  stores?: Store[];
  products?: Product[];
  emptyText?: string;
}) {
  if (!show) return null;
  if (restaurants.length === 0 && stores.length === 0 && products.length === 0) {
    if (!emptyText) return null;
    return (
      <section>
        <h2 className="mb-2 text-sm font-bold text-neutral-900">{title}</h2>
        <Card className="flex items-center gap-2 p-3 text-sm text-neutral-500">
          <Package className="h-4 w-4 text-neutral-300" /> {emptyText}
        </Card>
      </section>
    );
  }
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-neutral-900">{title}</h2>
      <div className="space-y-2">
        {restaurants.map((r) => (
          <FoodResultCard key={`r-${r.id}`} r={r} />
        ))}
        {stores.map((s) => (
          <StoreResultCard key={`s-${s.id}`} s={s} />
        ))}
        {products.length > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 md:grid-cols-4">
            {products.map((p) => (
              <ProductCard
                key={`p-${p.id}`}
                product={p}
                type={p.type === 'grocery' ? 'grocery' : 'food'}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}