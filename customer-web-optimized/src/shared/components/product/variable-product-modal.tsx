import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Image } from '@/shared/components/ui/image';
import { discountPercent } from '@/shared/components/product/product-card';
import { ProductConfigurator } from '@/shared/components/product/product-configurator';
import type { Product } from '@/shared/types/catalog';
import type { OrderType } from '@/shared/types/models';
import { cn } from '@/shared/utils/utils';

interface VariableProductModalProps {
  product: Product;
  type: OrderType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Zomato's variable-product add-to-cart sheet: a compact header (dish photo,
 * veg mark, name and price) over the option-group cards, a cooking-request
 * note, and the stepper + "Add item" bar pinned to the bottom. The sheet's own
 * title bar is dropped in favour of that header, so the dish photo leads.
 */
export function VariableProductModal({ product, type, open, onOpenChange }: VariableProductModalProps) {
  const off = discountPercent(product);
  const hasDiscount =
    off !== null && product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} className="sm:max-w-md">
      {/* Header: photo + identity, exactly how the reference heads the sheet. */}
      <div className="-mx-5 -mt-4 border-b border-neutral-100 px-5 pb-4 pt-1">
        <div className="flex items-center gap-3.5">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {product.is_veg !== null && (
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 bg-white',
                    product.is_veg ? 'border-success' : 'border-danger'
                  )}
                  title={product.is_veg ? 'Pure veg' : 'Non-veg'}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', product.is_veg ? 'bg-success' : 'bg-danger')} />
                </span>
              )}
              {hasDiscount && product.is_available && (
                <span className="rounded-md bg-food-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {off}% off
                </span>
              )}
            </div>
            <h3 className="mt-1 truncate text-[17px] font-extrabold tracking-tight text-neutral-900">
              {product.name}
            </h3>
            <p className="mt-0.5 text-sm font-bold text-neutral-800">
              ₹{Number(product.price).toLocaleString('en-IN')}
              {hasDiscount && (
                <span className="ml-1.5 text-xs font-normal text-neutral-400 line-through">
                  ₹{Number(product.compare_at_price).toLocaleString('en-IN')}
                </span>
              )}
            </p>
          </div>
        </div>
        {product.description && (
          <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-neutral-500">{product.description}</p>
        )}
      </div>

      <ProductConfigurator
        product={product}
        type={type}
        variant="bare"
        sticky
        onAdded={() => onOpenChange(false)}
      />
    </BottomSheet>
  );
}
