import { useLocation, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Tag, Info } from 'lucide-react';
import type { Product } from '@/shared/types/catalog';
import { Card } from '@/shared/components/ui/card';
import { Price } from '@/shared/components/ui/price';
import { Badge } from '@/shared/components/ui/badge';
import { AddToCartControl } from '@/shared/components/product/add-to-cart';
import { ProductConfigurator } from '@/shared/components/product/product-configurator';
import { ErrorState } from '@/shared/components/ui/state';
import { needsOptionSelection } from '@/shared/utils/productOptions';

export function ProductPage() {
  const { id } = useParams();
  const location = useLocation();
  const product = (location.state as { product?: Product; type?: 'food' | 'grocery' } | null)?.product;
  const type = (location.state as { product?: Product; type?: 'food' | 'grocery' } | null)?.type ?? product?.type ?? 'grocery';

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="Product not found"
          description={`We couldn't find product #${id}. Browse from a store or search instead.`}
          action={{ label: 'Go to search', onClick: () => window.location.assign('/search') }}
        />
      </div>
    );
  }

  const hasOffer =
    product.compare_at_price !== null &&
    parseFloat(product.compare_at_price) > parseFloat(product.price);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        to={type === 'grocery' ? '/stores' : '/restaurants'}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <Card className="overflow-hidden">
        <div className="relative aspect-[4/3] w-full">
          <img src={product.image ?? ''} alt={product.name} className="h-full w-full object-cover" />
          {hasOffer && (
            <Badge variant="danger" className="absolute left-3 top-3">
              {Math.round(
                ((parseFloat(product.compare_at_price ?? '0') - parseFloat(product.price)) /
                  parseFloat(product.compare_at_price ?? '1')) *
                  100
              )}
              % off
            </Badge>
          )}
          {product.is_veg !== null && (
            <span
              className={`absolute right-3 top-3 flex items-center justify-center rounded-sm border-2 bg-white p-0.5 ${
                product.is_veg ? 'border-success' : 'border-danger'
              }`}
              title={product.is_veg ? 'Pure veg' : 'Non-veg'}
            >
              <span className={`h-3 w-3 rounded-full ${product.is_veg ? 'bg-success' : 'bg-danger'}`} />
            </span>
          )}
        </div>

        <div className="p-4">
          <h1 className="text-xl font-extrabold text-neutral-900">{product.name}</h1>
          {product.unit_label && <p className="mt-0.5 text-sm text-neutral-500">{product.unit_label}</p>}
          <div className="mt-3 flex items-center justify-between">
            <Price value={product.price} compareAt={product.compare_at_price} size="lg" />
            {!needsOptionSelection(product) && <AddToCartControl productId={product.id} type={type} />}
          </div>
        </div>
      </Card>

      {needsOptionSelection(product) && <ProductConfigurator product={product} type={type} />}

      {product.description && (
        <Card className="p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
            <Info className="h-4 w-4 text-neutral-400" /> Description
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{product.description}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {product.preparation_time_min && (
          <Card className="flex items-center gap-2 p-3">
            <Clock className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-[11px] text-neutral-500">Prep time</p>
              <p className="text-sm font-semibold text-neutral-800">{product.preparation_time_min} min</p>
            </div>
          </Card>
        )}
        {product.tax_rate != null && Number(product.tax_rate) > 0 && (
          <Card className="flex items-center gap-2 p-3">
            <Tag className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-[11px] text-neutral-500">Tax</p>
              <p className="text-sm font-semibold text-neutral-800">{product.tax_rate}%</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}