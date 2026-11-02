import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus, SlidersHorizontal } from 'lucide-react-native';
import type { Product } from '@/shared/types/catalog';
import { hasActiveOptionGroups, needsOptionSelection } from '@/shared/utils/productOptions';
import { ProductConfiguratorSheet } from '@/shared/components/product/ProductConfiguratorSheet';
import { useCart, useCartAdd, useUpdateCartItem, useRemoveCartItem, resolveCartLine } from '@/features/cart/hooks/useCart';
import { useCartConflictStore } from '@/features/cart/store/cartConflictStore';
import { hasCrossStoreConflict } from '@/shared/utils/cartConflict';
import { toast } from '@/shared/stores/toastStore';
import { colors } from '@/shared/theme';

interface AddToCartProps {
  productId: number;
  type: 'food' | 'grocery';
  size?: 'sm' | 'md' | 'icon' | 'outline' | 'add';
  product?: Product;
}

/**
 * Native port of customer-web components/product/add-to-cart.tsx.
 * Variable / option-required products open the configurator bottom sheet over
 * the current screen; simple products add directly with a stepper.
 */
export function AddToCartControl({ productId, type, size = 'md', product }: AddToCartProps) {
  const [configuring, setConfiguring] = useState(false);
  const { data: cart } = useCart(type);
  const { submit, isPending } = useCartAdd();
  const openConflict = useCartConflictStore((s) => s.open);
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  const requiresOptions = !!product && needsOptionSelection(product);
  const isVariable = product?.product_type === 'variable';
  const selectable = !!product && hasActiveOptionGroups(product);
  const requiresConfigurator = isVariable || requiresOptions;

  // Bind to the product's canonical cart line (see resolveCartLine) so simple
  // *and* customisable products surface their real quantity.
  const item = resolveCartLine(cart?.items, productId);
  const qty = item?.quantity ?? 0;
  const busy = isPending || update.isPending || remove.isPending;

  const grocery = type === 'grocery';
  const serviceSolid = grocery ? colors.grocery[500] : colors.food[600];
  const serviceText = grocery ? colors.ink[900] : '#fff';

  const dim = size === 'sm' ? 24 : 32;
  const iconOnly = size === 'icon';
  const outline = size === 'outline';
  // The `add` size is the compact Zomato-style recommendation-card action: a
  // small white control with a hairline service border, red ADD label and `+`,
  // sized to sit beside the price inside the narrow `Complete your meal` card.
  const add = size === 'add';
  const compact = size === 'sm' || add;
  const addDiameter = iconOnly ? (grocery ? 44 : 32) : dim;

  /**
   * The `outline` size is the Zomato menu action: a wide tinted pill carrying a
   * large `ADD` with a small `+` tucked into its top-right corner — the shape
   * that straddles the bottom edge of the dish photo. Used by the food menu
   * list rows for both simple and configurable items.
   */
  const outlineContent = (
    <View style={[styles.outlineBtn, { borderColor: serviceSolid, backgroundColor: grocery ? colors.grocery[100] : colors.food[50] }]}>
      <Text style={[styles.outlineText, { color: serviceSolid }]}>Add</Text>
      <View style={styles.outlinePlus}>
        <Plus size={12} color={serviceSolid} strokeWidth={2.6} />
      </View>
    </View>
  );

  const addContent = (
    <View style={[styles.addBtn, { borderColor: serviceSolid }]}>
      <Text style={[styles.addBtnText, { color: serviceSolid }]}>Add</Text>
      <Plus size={14} color={serviceSolid} />
    </View>
  );

  const openConfigurator = () => {
    if (!selectable) {
      toast('This item is unavailable right now', 'error');
      return;
    }
    setConfiguring(true);
  };

  /**
   * Simple-product add. When the cart already belongs to another restaurant the
   * conflict is known up front, so the replacement dialog opens without a
   * doomed POST; otherwise the request runs and the server response is the
   * authority (the cart cache may be stale).
   */
  const handleAdd = () => {
    const payload = { product_id: productId, quantity: 1, cart_type: type };
    if (hasCrossStoreConflict(cart, product?.vendor_id)) {
      openConflict({
        payload,
        productName: product?.name,
        onAdded: () => toast('Added to cart'),
      });
      return;
    }
    submit(payload, {
      productName: product?.name,
      onError: (err) => toast(err instanceof Error ? err.message : 'Could not add to cart', 'error'),
    });
  };

  // With no matching line in the cart the action is the entry point: a direct
  // add for simple products, or the customisation selector for variable ones. A
  // variable product is never added with an arbitrary default variation.
  if (qty === 0) {
    return (
      <>
        <Pressable
          onPress={
            requiresConfigurator
              ? openConfigurator
              : handleAdd
          }
          disabled={busy}
          accessibilityLabel="Add to cart"
          hitSlop={add || outline ? 6 : undefined}
          style={add || outline ? undefined : [styles.btn, { backgroundColor: serviceSolid, width: addDiameter, height: addDiameter, borderRadius: addDiameter / 2 }]}
        >
          {add ? (
            busy ? <ActivityIndicator size="small" color={serviceSolid} /> : addContent
          ) : outline ? (
            busy ? <ActivityIndicator size="small" color={serviceSolid} /> : outlineContent
          ) : busy ? (
            <ActivityIndicator size="small" color={serviceText} />
          ) : iconOnly ? (
            <Plus size={grocery ? 20 : 16} color={serviceText} />
          ) : requiresConfigurator ? (
            <SlidersHorizontal size={16} color={serviceText} />
          ) : (
            <Plus size={14} color={serviceText} />
          )}
        </Pressable>
        {configuring && product && (
          <ProductConfiguratorSheet
            key={product.id}
            product={product}
            type={type}
            visible
            onClose={() => setConfiguring(false)}
          />
        )}
      </>
    );
  }

  /**
   * Once an item is in the cart, the `outline` (menu-row) action becomes the
   * compact Zomato-style selector: a solid service-coloured pill with a minus on
   * the left, the live quantity centred and a plus on the right, all in the
   * service text colour. It overhangs the bottom edge of the product image (the
   * row positions it), and every tap drives the real cart mutation — there is no
   * separate UI quantity state.
   */
  if (outline) {
    return (
      <View style={[styles.pill, { backgroundColor: serviceSolid }]}>
        <Pressable
          onPress={() => (qty - 1 <= 0 ? remove.mutate(item!.id) : update.mutate({ itemId: item!.id, quantity: qty - 1 }))}
          disabled={busy}
          accessibilityLabel="Decrease quantity"
          style={styles.pillBtn}
          hitSlop={4}
        >
          <Minus size={15} color={serviceText} />
        </Pressable>
        <Text style={[styles.pillQty, { color: serviceText }]}>{qty}</Text>
        <Pressable
          onPress={() => update.mutate({ itemId: item!.id, quantity: qty + 1 })}
          disabled={busy}
          accessibilityLabel="Increase quantity"
          style={styles.pillBtn}
          hitSlop={4}
        >
          <Plus size={15} color={serviceText} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => (qty - 1 <= 0 ? remove.mutate(item!.id) : update.mutate({ itemId: item!.id, quantity: qty - 1 }))}
        accessibilityLabel="Decrease"
        style={styles.stepBtn}
      >
        <Minus size={compact ? 12 : 14} color={colors.neutral[700]} />
      </Pressable>
      <Text style={styles.stepQty}>{qty}</Text>
      <Pressable
        onPress={() => update.mutate({ itemId: item!.id, quantity: qty + 1 })}
        accessibilityLabel="Increase"
        style={[styles.stepBtn, { backgroundColor: serviceSolid }]}
      >
        <Plus size={compact ? 12 : 14} color={serviceText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  outlineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    /* Matches the reference: the pill is as wide as the photo it overlaps, so
       swapping ADD for the stepper never shifts the row. */
    minWidth: 136,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  outlinePlus: {
    position: 'absolute',
    top: 7,
    right: 10,
  },
  outlineText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Compact recommendation-card action (Zomato style): hairline service border,
  // matching uppercase label and small `+`, kept short so it fits beside the
  // price without widening the card.
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  // Zomato-style active selector (menu rows): solid service pill, white/ink
  // icons and count. It mirrors the ADD pill's 136x44 footprint so the swap
  // between the two never nudges the photo or the caption below it.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 136,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillQty: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    backgroundColor: '#fff',
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  stepQty: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
});