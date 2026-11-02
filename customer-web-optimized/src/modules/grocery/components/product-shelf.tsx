import { ProductCard } from '@/shared/components/product/product-card';
import { Rail } from '@/shared/components/home/section-header';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { Product } from '@/shared/types/catalog';

interface ProductShelfProps {
  title: string;
  subtitle?: string;
  products: Product[];
  loading?: boolean;
}

/**
 * Horizontally scrollable product shelf. Every product passed in here has
 * already been filtered to the active store by the page.
 */
export function ProductShelf({
  title,
  subtitle,
  products,
  loading,
  action,
}: ProductShelfProps & { action?: React.ReactNode }) {
  if (!loading && products.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-extrabold tracking-tight text-ink-900 sm:text-lg">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {loading ? (
        <Rail>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[172px] shrink-0 snap-start">
              <Skeleton className="h-[248px] w-full rounded-2xl" />
            </div>
          ))}
        </Rail>
      ) : (
        <Rail>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} type="grocery" horizontal />
          ))}
        </Rail>
      )}
    </section>
  );
}

/** Responsive product grid used when a single category is selected. */
export function ProductGrid({ products, loading }: { products: Product[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[248px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} type="grocery" addSize="icon" />
      ))}
    </div>
  );
}
