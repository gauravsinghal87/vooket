import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  Gift,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Share2,
  Store as StoreIcon,
  Tag,
  Trash2,
  Wallet as WalletIcon,
  Zap,
} from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import type { Product, Restaurant, Address } from '@/types/catalog';
import type { Cart, CartItem, OrderType } from '@/types/models';
import {
  useApplyCoupon,
  useCart,
  useRemoveCartItem,
  useRemoveCoupon,
  useSetDeliveryAddress,
  useUpdateCartItem,
} from '@/hooks/useCart';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { toast } from '@/stores/toastStore';
import { hasActiveOptionGroups, optionSignature } from '@/lib/productOptions';
import { createUsableCheckout, completeOrderPayment } from '@/lib/payments';
import { deliveryEtaText } from '@/lib/deliveryEta';
import { coordsKey, haversineKm, estimateDeliveryMinutes } from '@/lib/geo';
import { DEFAULT_LOCATION } from '@/lib/location';
import { formatCurrency } from '@/lib/utils';
import { getBranding } from '@/lib/branding';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { ProductImage } from '@/components/ui/ProductImage';
import { SelectedOptionsList } from '@/components/product/SelectedOptions';
import { ProductConfiguratorSheet } from '@/components/product/ProductConfiguratorSheet';
import { AddToCartControl } from '@/components/product/AddToCart';
import { FoodPreparationChips } from '@/components/order/FoodPreparationChips';
import { AddAddressSheet } from '@/components/address/AddAddressSheet';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState, Loader, Stepper } from '@/components/ui/primitives';
import { useStoreCatalogue } from '@/hooks/useStoreCatalogue';
import { colors, withAlpha } from '@/theme';

function discountPercent(price: string, compareAt: string | null | undefined): number | null {
  const selling = parseFloat(price);
  const mrp = parseFloat(String(compareAt));
  if (!Number.isFinite(selling) || !Number.isFinite(mrp) || mrp <= selling) return null;
  return Math.round(((mrp - selling) / mrp) * 100);
}

export default function CartRoute() {
  const params = useLocalSearchParams<{ type?: string }>();
  return params.type === 'grocery' ? <GroceryCartPage /> : <FoodCartPage />;
}

/* ================================================================== */
/* Food cart                                                          */
/* ================================================================== */

function FoodCartPage() {
  const router = useRouter();
  const setService = useAppStore((s) => s.setService);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // The delivery-address picker is opened from two places — the header's
  // location row and the delivery card — so the open state is shared here and
  // the sheet itself is mounted once below.
  const [addressOpen, setAddressOpen] = useState(false);

  useEffect(() => {
    setService('food');
  }, [setService]);

  const cartQuery = useCart('food');
  const retryCart = () => void cartQuery.refetch();
  const cart = cartQuery.data;

  const restaurantId = cart?.items[0]?.product?.restaurant_id ?? null;
  const restaurantQuery = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => repositories.food.getRestaurant(restaurantId as number),
    enabled: !!restaurantId,
  });
  const menuQuery = useQuery({
    queryKey: ['restaurant-menu', restaurantId],
    queryFn: () => repositories.food.getMenu(restaurantId as number),
    enabled: !!restaurantId,
  });
  const couponsQuery = useQuery({
    queryKey: ['coupons'],
    queryFn: () => repositories.user.getCoupons(),
    enabled: !!cart && cart.items.length > 0 && isAuthenticated,
  });

  const items = cart?.items ?? [];
  const hasItems = !cartQuery.isLoading && !cartQuery.isError && !!cart && items.length > 0;
  const restaurant = restaurantQuery.data;
  const menuProducts = useMemo(() => (menuQuery.data ?? []).flatMap((c) => c.products ?? []), [menuQuery.data]);

  if (cartQuery.isLoading) return <Screen header={<AppHeader variant="dark" title="Cart" />}><Loader label="Loading cart…" /></Screen>;

  if (!hasItems) {
    return (
      <Screen header={<AppHeader variant="dark" title="Cart" />}>
        <View style={styles.flexCenter}>
          <EmptyState
            title="Your cart is empty"
            message="Add delicious meals from a restaurant to get started."
            actionLabel="Browse restaurants"
            onAction={() => router.replace('/restaurants' as never)}
          />
        </View>
      </Screen>
    );
  }

  if (!cart) return null;

  const savedAmount = parseFloat(cart.discount);

  return (
    <Screen
      header={
        restaurant ? (
          <FoodCartHeader restaurant={restaurant} cart={cart} isAuthenticated={isAuthenticated} onChooseAddress={() => setAddressOpen(true)} />
        ) : (
          <AppHeader variant="dark" title="Cart" />
        )
      }
      bottomBar={<FoodPaymentBar cart={cart} isAuthenticated={isAuthenticated} onChooseAddress={() => setAddressOpen(true)} />}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {savedAmount > 0 && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedEmoji}>🎉</Text>
            <Text style={styles.savedText}>You saved {formatCurrency(savedAmount)} on this order</Text>
          </View>
        )}

        {cartQuery.isError && (
          <EmptyState title="Couldn't load your cart" message="Something went wrong while fetching your cart." actionLabel="Retry" onAction={retryCart} />
        )}

        {restaurant && restaurant.free_delivery_above && (
          <FreeDeliveryOffer threshold={restaurant.free_delivery_above} subtotal={cart.subtotal} />
        )}

        <CartItemsSection cart={cart} menuProducts={menuProducts} />

        {restaurantId && (
          <Pressable style={styles.addMore} onPress={() => router.push(`/restaurant/${restaurantId}` as never)}>
            <Plus size={16} color={colors.food[600]} />
            <Text style={styles.addMoreText}>Add more items</Text>
          </Pressable>
        )}

        <PreparationSection />

        <CompleteYourMeal products={menuProducts} inCartIds={new Set(items.map((i) => i.product_id))} />

        <DeliveryBlock etaMin={restaurant?.avg_delivery_time_min ?? null} isAuthenticated={isAuthenticated} onChooseAddress={() => setAddressOpen(true)} />

        <CouponsSection couponCode={cart.coupon_code} coupons={couponsQuery.data ?? []} loading={couponsQuery.isLoading} isAuthenticated={isAuthenticated} tone="food" />

        <ContactCard />

        <BillCard cart={cart} />

        <Text style={styles.cancellation}>
          <Text style={styles.cancellationHead}>CANCELLATION POLICY{'\n'}</Text>
          A 100% cancellation charge may apply. This helps us compensate the restaurant partner for food preparation.
        </Text>
      </ScrollView>

      <FoodAddressSheet cart={cart} isAuthenticated={isAuthenticated} open={addressOpen} onOpenChange={setAddressOpen} />
    </Screen>
  );
}

/**
 * Zomato's cart header: the restaurant's name over the delivery line — green
 * ETA, "to {label}", the address and a chevron that opens the address picker,
 * so the location is chosen right here in the cart.
 */
function FoodCartHeader({
  restaurant,
  cart,
  isAuthenticated,
  onChooseAddress,
}: {
  restaurant: Restaurant;
  cart: Cart;
  isAuthenticated: boolean;
  onChooseAddress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeLocation = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: isAuthenticated,
  });

  const selected = cart.address_id
    ? (addresses.data ?? []).find((a) => a.id === cart.address_id)
    : (addresses.data ?? []).find((a) => a.is_default) ?? null;

  const label = selected?.label ?? activeLocation.label;
  const addressText = selected
    ? `${selected.address_line_1}${selected.address_line_2 ? `, ${selected.address_line_2}` : ''}, ${selected.city}`
    : activeLocation.address;

  const eta = deliveryEtaText(restaurant);
  const etaText = eta ?? (restaurant.avg_delivery_time_min ? `${restaurant.avg_delivery_time_min} mins` : null);

  return (
    <View style={[styles.foodHeader, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.foodHeaderBack} accessibilityLabel="Go back">
        <ArrowLeft size={22} color={colors.ink[900]} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.foodHeaderName} numberOfLines={1}>{restaurant.name}</Text>
        <Pressable onPress={onChooseAddress} style={styles.foodHeaderAddrBtn} accessibilityLabel="Change delivery address">
          <Text style={styles.foodHeaderEta} numberOfLines={1}>
            {etaText ? <Text style={{ color: colors.zGreen }}>{etaText} </Text> : null}
            to {label}
          </Text>
          <Text style={styles.foodHeaderAddr} numberOfLines={1}>{' '}| {addressText}</Text>
          <ChevronDown size={16} color={colors.neutral[400]} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Zomato's delivery block: green "Delivery in … mins", then a tappable row
 * that opens the address picker (the location is chosen in the cart).
 */
function DeliveryBlock({
  etaMin,
  isAuthenticated,
  onChooseAddress,
}: {
  etaMin: string | null;
  isAuthenticated: boolean;
  onChooseAddress: () => void;
}) {
  const activeLocation = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: isAuthenticated,
  });

  const selected =
    (addresses.data ?? []).find((a) => a.is_default) ?? (addresses.data ?? [])[0] ?? null;

  const label = selected?.label ?? (isAuthenticated ? 'address' : activeLocation.label);
  const addressText = selected
    ? `${selected.address_line_1}${selected.address_line_2 ? `, ${selected.address_line_2}` : ''}, ${selected.city}`
    : activeLocation.address;

  return (
    <View style={styles.deliveryBlock}>
      <View style={styles.deliveryBlockRow}>
        <Zap size={20} color={colors.zGreen} fill={colors.zGreen} />
        <Text style={styles.deliveryBlockTitle}>
          Delivery in <Text style={{ color: colors.zGreen }}>{etaMin ? `${etaMin} mins` : 'as soon as possible'}</Text>
        </Text>
      </View>
      <View style={styles.deliveryBlockDivider} />
      <Pressable onPress={onChooseAddress} style={styles.deliveryBlockAddr}>
        <MapPin size={20} color={colors.neutral[500]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.deliveryBlockAddrRow}>
            <Text style={styles.deliveryBlockAddrTitle}>Delivery at {label}</Text>
            <ChevronRight size={16} color={colors.neutral[400]} />
          </View>
          <Text style={styles.deliveryBlockAddrText} numberOfLines={1}>
            {selected ? addressText : 'Choose a delivery address'}
          </Text>
          {!isAuthenticated && <Text style={styles.deliveryBlockLogin}>Login to add a delivery address</Text>}
        </View>
      </Pressable>
    </View>
  );
}

type FoodPayMethod = 'wallet' | 'cash_on_delivery' | 'online';

const FOOD_PAY_METHOD_KEY = 'sb-food-pay-method';

function readFoodPayMethod(): FoodPayMethod {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FOOD_PAY_METHOD_KEY) : null;
    return raw === 'wallet' || raw === 'cash_on_delivery' || raw === 'online' ? raw : 'wallet';
  } catch {
    return 'wallet';
  }
}

/**
 * Zomato's payment bar: the `PAY USING` dropdown that opens the payment-options
 * sheet, and the red button carrying the total + `Place Order`. The order is
 * placed right here — Food has no checkout screen; address and payment are
 * both chosen in the cart.
 */
function FoodPaymentBar({
  cart,
  isAuthenticated,
  onChooseAddress,
}: {
  cart: Cart;
  isAuthenticated: boolean;
  onChooseAddress: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Food preparation instructions are collected above, before placement.
  const foodRestaurantNote = useCartStore((s) => s.foodRestaurantNote);
  const foodNoCutlery = useCartStore((s) => s.foodNoCutlery);
  const clearFoodInstructions = useCartStore((s) => s.clearFoodInstructions);

  const [payMethod, setPayMethod] = useState<FoodPayMethod>(readFoodPayMethod);
  const [sheetOpen, setSheetOpen] = useState(false);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => repositories.wallet.getWallet(),
    enabled: isAuthenticated,
  });

  const chooseMethod = (m: FoodPayMethod) => {
    setPayMethod(m);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(FOOD_PAY_METHOD_KEY, m);
    } catch {
      // Not persisting the preference is harmless.
    }
    setSheetOpen(false);
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      const order = await repositories.orders.createOrder({
        order_type: 'food',
        address_id: cart.address_id ?? undefined,
        payment_method: payMethod,
        restaurant_note: foodRestaurantNote.trim() || undefined,
        send_cutlery: !foodNoCutlery,
      });
      if (payMethod !== 'online') return { order };
      const checkout = await createUsableCheckout(
        (idempotencyKey) =>
          repositories.payments.initiate({
            payable_type: 'order',
            payable_id: order.id,
            payment_method: 'card',
            idempotency_key: idempotencyKey,
          }),
        `checkout:${order.id}`
      );
      return { order, checkout };
    },
    onSuccess: async ({ order, checkout }) => {
      clearFoodInstructions();

      if (!checkout) {
        toast('Order placed successfully!');
        router.replace(`/order-confirmation/${order.id}` as never);
        return;
      }

      try {
        const result = await completeOrderPayment(checkout);
        if (result.status === 'paid') {
          toast('Order placed successfully!');
          router.replace(`/order-confirmation/${order.id}` as never);
          return;
        }
        toast('Payment cancelled. You can pay again from the order page.', 'error');
        router.replace(`/order/${order.id}` as never);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Payment could not be completed.', 'error');
        router.replace(`/order/${order.id}` as never);
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not place order.', 'error'),
  });

  const brand = getBranding().name;
  const hasAddress = !!cart.address_id;
  const pending = placeOrder.isPending;

  const methodLabel =
    payMethod === 'wallet'
      ? `${brand} Wallet`
      : payMethod === 'cash_on_delivery'
        ? 'Cash on delivery'
        : 'Card / UPI';
  const MethodIcon = payMethod === 'wallet' ? WalletIcon : payMethod === 'cash_on_delivery' ? Banknote : CreditCard;

  const cta = !isAuthenticated ? 'Sign in to order' : !hasAddress ? 'Choose address' : 'Place Order';
  const onCta = () => {
    if (pending) return;
    if (!isAuthenticated) {
      router.push('/auth/login' as never);
      return;
    }
    if (!hasAddress) {
      onChooseAddress();
      return;
    }
    placeOrder.mutate();
  };

  const options: { value: FoodPayMethod; label: string; desc: string; icon: typeof WalletIcon }[] = [
    {
      value: 'wallet',
      label: `${brand} Wallet`,
      desc: wallet.data ? `Balance ${formatCurrency(Number(wallet.data.balance))}` : 'Pay from your balance',
      icon: WalletIcon,
    },
    { value: 'online', label: 'Card / UPI', desc: 'Pay securely online', icon: CreditCard },
    { value: 'cash_on_delivery', label: 'Cash on delivery', desc: 'Pay when you receive', icon: Banknote },
  ];

  return (
    <>
      <View style={[styles.payBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {isAuthenticated && (
          <Pressable style={styles.payBarWallet} onPress={() => router.push('/wallet' as never)}>
            <WalletIcon size={14} color={colors.neutral[400]} />
            <Text style={styles.payBarWalletText} numberOfLines={1}>
              {brand} Money Balance: <Text style={styles.payBarWalletBalance}>{wallet.data ? formatCurrency(Number(wallet.data.balance)) : '—'}</Text>
            </Text>
            <Text style={styles.payBarAdd}>• Add money</Text>
          </Pressable>
        )}

        <View style={styles.payBarRow}>
          <Pressable style={styles.payUsing} onPress={() => setSheetOpen(true)} accessibilityLabel="Choose payment method">
            <Text style={styles.payUsingLabel}>PAY USING <ChevronUp size={12} color={colors.neutral[500]} /></Text>
            <View style={styles.payUsingMethod}>
              <MethodIcon size={14} color={colors.neutral[500]} />
              <Text style={styles.payUsingMethodText} numberOfLines={1}>{methodLabel}</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.placeOrderBtn, pending && { opacity: 0.6 }]} onPress={onCta} disabled={pending} accessibilityLabel={cta}>
            <View style={styles.placeOrderTotalWrap}>
              <Text style={styles.placeOrderTotal}>{formatCurrency(Number(cart.total))}</Text>
              <Text style={styles.placeOrderTotalLabel}>TOTAL</Text>
            </View>
            <View style={styles.placeOrderDivider} />
            <View style={styles.placeOrderRow}>
              {pending && <ActivityIndicator size="small" color="#fff" />}
              <Text style={styles.placeOrderText}>{cta}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Zomato's payment-options screen, presented as the PAY USING sheet. */}
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Payment options">
        <View style={{ gap: 8 }}>
          {options.map((o) => {
            const Icon = o.icon;
            const active = payMethod === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => chooseMethod(o.value)}
                style={[styles.payOption, active ? styles.payOptionActive : styles.payOptionIdle]}
              >
                <View style={[styles.payOptionIcon, active && { backgroundColor: colors.food[600] }]}>
                  <Icon size={20} color={active ? '#fff' : colors.neutral[500]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.payOptionLabel}>{o.label}</Text>
                  <Text style={styles.payOptionDesc} numberOfLines={1}>{o.desc}</Text>
                </View>
                <View style={[styles.payOptionRadio, active && { borderColor: colors.food[600] }]}>
                  {active && <View style={styles.payOptionRadioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

/** The address picker opened from the cart header and the delivery card. */
function FoodAddressSheet({
  cart,
  isAuthenticated,
  open,
  onOpenChange,
}: {
  cart: Cart;
  isAuthenticated: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const setDeliveryAddress = useSetDeliveryAddress();
  const [addOpen, setAddOpen] = useState(false);
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: open && isAuthenticated,
  });

  const handleError = (err: unknown) => toast(err instanceof Error ? err.message : 'Could not update delivery address.', 'error');

  return (
    <>
      <BottomSheet visible={open} onClose={() => onOpenChange(false)} title="Select delivery address">
        {!isAuthenticated ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.sheetPrompt}>Add a delivery address to continue</Text>
            <Pressable style={styles.sheetLoginBtn} onPress={() => { onOpenChange(false); router.push('/auth/login' as never); }}>
              <Text style={styles.sheetLoginText}>Login now</Text>
              <ChevronRight size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {addresses.isLoading && <Loader label="Loading addresses…" />}
            {!addresses.isLoading && (addresses.data ?? []).length === 0 && (
              <Text style={styles.emptyAddress}>No saved addresses. Add one first.</Text>
            )}
            {(addresses.data ?? []).map((a) => {
              const active = cart.address_id === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setDeliveryAddress.mutate({ addressId: a.id, type: 'food' }, { onError: handleError });
                    onOpenChange(false);
                  }}
                  style={[styles.payOption, active ? styles.payOptionActive : styles.payOptionIdle]}
                >
                  <View style={[styles.payOptionRadio, active && { borderColor: colors.food[600] }]}>
                    {active && <View style={styles.payOptionRadioDot} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.payOptionLabel}>{a.label}</Text>
                      {a.is_default && <View style={styles.defaultPill}><Text style={styles.defaultPillText}>Default</Text></View>}
                    </View>
                    <Text style={styles.payOptionDesc} numberOfLines={1}>
                      {a.address_line_1}{a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city} {a.postal_code}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable style={styles.sheetAddBtn} onPress={() => { onOpenChange(false); setAddOpen(true); }}>
              <Plus size={16} color={colors.food[600]} />
              <Text style={styles.sheetAddText}>Add new address</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>

      <AddAddressSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) =>
          setDeliveryAddress.mutate({ addressId: created.id, type: 'food' }, { onError: handleError })
        }
      />
    </>
  );
}

function FreeDeliveryOffer({ threshold, subtotal }: { threshold: string; subtotal: string }) {
  const thresholdValue = parseFloat(threshold);
  const subtotalValue = parseFloat(subtotal);
  const remaining = Math.max(0, thresholdValue - subtotalValue);
  const unlocked = remaining <= 0;
  const progress = Math.min(100, (subtotalValue / thresholdValue) * 100);

  return (
    <View style={[styles.freeDelivery, { backgroundColor: withAlpha(colors.food[50], 0.6), borderColor: colors.food[100] }]}>
      <View style={styles.freeDeliveryRow}>
        <View style={[styles.freeDeliveryIcon, { backgroundColor: colors.food[100] }]}>
          <Gift size={18} color={colors.food[600]} />
        </View>
        <View style={styles.freeDeliveryBody}>
          <View style={styles.freeDeliveryTitleRow}>
            <Text style={styles.freeDeliveryTitle}>Special offer for you</Text>
            {unlocked && (
              <View style={styles.unlockedPill}>
                <CheckCircle2 size={11} color={colors.success} />
                <Text style={styles.unlockedPillText}>Unlocked</Text>
              </View>
            )}
          </View>
          <Text style={styles.freeDeliverySub}>
            {unlocked ? 'Free delivery is applied automatically at checkout.' : `Get free delivery on orders above ${formatCurrency(thresholdValue)}.`}
          </Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: unlocked ? colors.success : colors.food[500] }]} />
      </View>
      {!unlocked && <Text style={styles.progressHint}>Add {formatCurrency(remaining)} more to unlock</Text>}
    </View>
  );
}

function CartItemsSection({ cart, menuProducts }: { cart: Cart; menuProducts: Product[] }) {
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const [editingId, setEditingId] = useState<number | null>(null);

  const busyId = (id: number) => updateItem.isPending && updateItem.variables?.itemId === id;

  const editingItem = cart.items.find((i) => i.id === editingId) ?? null;
  const editingProduct = editingItem
    ? menuProducts.find((p) => p.id === editingItem.product_id) ?? null
    : null;

  const initialSelections = useMemo(() => {
    const selections: Record<number, number[]> = {};
    for (const option of editingItem?.selected_options ?? []) {
      (selections[option.group_id] ??= []).push(option.option_id);
    }
    return selections;
  }, [editingItem]);

  const originalSignature = optionSignature(editingItem?.selected_options);

  const handleAdded = (payload: { selected_options: { group_id: number; option_id: number }[] }) => {
    if (!editingItem) return;
    if (optionSignature(payload.selected_options) !== originalSignature) {
      removeItem.mutate(editingItem.id);
    }
  };

  return (
    <View>
      <SectionRow title="Cart items" meta={`${cart.items.length} item${cart.items.length === 1 ? '' : 's'}`} />
      <View style={styles.itemsCard}>
        {cart.items.map((item, index) => (
          <View key={item.id}>
            {index > 0 && <View style={styles.divider} />}
            <View style={styles.cartLineWrap}>
              <CartLine
                item={item}
                busy={busyId(item.id)}
                tone="food"
                showEdit
                editable={item.product_id ? menuProducts.some((p) => p.id === item.product_id && (p.product_type === 'variable' || hasActiveOptionGroups(p))) : false}
                onQuantity={(quantity) => updateItem.mutate({ itemId: item.id, quantity })}
                onRemove={() => removeItem.mutate(item.id)}
                onEdit={() => setEditingId(item.id)}
              />
            </View>
          </View>
        ))}
      </View>

      {editingItem && editingProduct && (
        <ProductConfiguratorSheet
          key={editingItem.id}
          product={editingProduct}
          type="food"
          visible
          onClose={() => setEditingId(null)}
          initialSelections={initialSelections}
          initialQuantity={editingItem.quantity}
          onAdded={handleAdded}
        />
      )}
    </View>
  );
}

function CartLine({
  item,
  busy,
  tone,
  showEdit,
  editable,
  onQuantity,
  onRemove,
  onEdit,
}: {
  item: CartItem;
  busy: boolean;
  tone: 'food' | 'grocery';
  showEdit?: boolean;
  editable?: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onEdit?: () => void;
}) {
  const accent = tone === 'grocery' ? colors.grocery[600] : colors.food[600];
  const name = item.product?.name ?? 'Item';
  const unitOff = discountPercent(item.unit_price, item.product?.compare_at_price ?? null);

  return (
    <View style={styles.cartLine}>
      <ProductImage src={item.product?.image} size={72} />
      <View style={styles.cartLineBody}>
        <View style={styles.cartLineTop}>
          <View style={styles.cartLineNameWrap}>
            <Text style={styles.cartLineName} numberOfLines={1}>{name}</Text>
            {item.product?.unit_label && <Text style={styles.cartLineUnit}>{item.product.unit_label}</Text>}
          </View>
          <Pressable onPress={onRemove} hitSlop={8} disabled={busy} accessibilityLabel={`Remove ${name}`}>
            {busy ? <ActivityIndicator size={14} color={colors.neutral[400]} /> : <Trash2 size={16} color={colors.neutral[300]} />}
          </Pressable>
        </View>

        <SelectedOptionsList options={item.selected_options} />

        <Text style={styles.cartLinePrice}>
          {formatCurrency(Number(item.unit_price))}
          <Text style={styles.cartLineTimes}> × {item.quantity}</Text>
          {unitOff !== null && <Text style={[styles.offText, { color: colors.success }]}>  {unitOff}% off</Text>}
        </Text>

        <View style={styles.cartLineBottom}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {showEdit && editable && onEdit && (
              <Pressable onPress={onEdit} disabled={busy} style={[styles.editPill, { borderColor: colors.neutral[200] }]}>
                <Pencil size={11} color={tone === 'food' ? colors.food[600] : colors.grocery[700]} />
                <Text style={[styles.editPillText, { color: tone === 'food' ? colors.food[600] : colors.grocery[700] }]}>Edit</Text>
              </Pressable>
            )}
            <Stepper size="sm" color={accent} quantity={item.quantity} onChange={onQuantity} />
          </View>
          <View style={styles.cartLineTotalWrap}>
            <Text style={styles.cartLineTotal}>{formatCurrency(Number(item.line_total))}</Text>
            {item.product?.compare_at_price && (
              <Text style={styles.mrpText}>MRP {formatCurrency(Number(item.product.compare_at_price) * item.quantity)}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function PreparationSection() {
  const foodRestaurantNote = useCartStore((s) => s.foodRestaurantNote);
  const foodNoCutlery = useCartStore((s) => s.foodNoCutlery);
  const setFoodRestaurantNote = useCartStore((s) => s.setFoodRestaurantNote);
  const setFoodNoCutlery = useCartStore((s) => s.setFoodNoCutlery);

  return (
    <FoodPreparationChips
      note={foodRestaurantNote}
      noCutlery={foodNoCutlery}
      onNoteChange={setFoodRestaurantNote}
      onNoCutleryChange={setFoodNoCutlery}
    />
  );
}

function CompleteYourMeal({ products, inCartIds }: { products: Product[]; inCartIds: Set<number> }) {
  const suggestions = useMemo(
    () =>
      products
        .filter((p) => p.is_available && !inCartIds.has(p.id))
        .sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
        .slice(0, 10),
    [products, inCartIds]
  );

  if (suggestions.length === 0) return null;

  return (
    <View>
      <SectionRow title="Complete your meal" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {suggestions.map((p) => (
          <View key={p.id} style={styles.mealCard}>
            <ProductImage src={p.image} size={130} />
            <Text style={styles.mealName} numberOfLines={1}>{p.name}</Text>
            <View style={styles.mealFooter}>
              <Text style={styles.mealPrice}>{formatCurrency(Number(p.price))}</Text>
              <AddToCartControl productId={p.id} type="food" size="add" product={p} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ================================================================== */
/* Grocery cart                                                       */
/* ================================================================== */

function GroceryCartPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const cartQuery = useCart('grocery');
  const retryCart = () => void cartQuery.refetch();
  const cart = cartQuery.data;
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const setDeliveryAddress = useSetDeliveryAddress();

  const [addressOpen, setAddressOpen] = useState(false);
  const [addAddressOpen, setAddAddressOpen] = useState(false);

  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: isAuthenticated,
  });

  const coupons = useQuery({
    queryKey: ['coupons'],
    queryFn: () => repositories.user.getCoupons(),
    enabled: isAuthenticated && !!cart && cart.items.length > 0,
  });

  const selectedAddress = useMemo<Address | null>(() => {
    const list = addresses.data ?? [];
    if (!cart) return null;
    return list.find((a) => a.id === cart.address_id) ?? list.find((a) => a.is_default) ?? list[0] ?? null;
  }, [addresses.data, cart]);

  const items = cart?.items ?? [];
  const hasItems = !cartQuery.isLoading && !cartQuery.isError && !!cart && items.length > 0;
  const storeId = items.find((item) => item.product?.store_id)?.product?.store_id ?? null;

  /**
   * Serviceability is checked against the delivery address of the cart (falling
   * back to the browsing location), so the store row keeps working for a
   * servable address while an unservable one reports no store instead of
   * quietly showing a store that cannot deliver.
   */
  const appLocation = useAppStore((st) => st.location) ?? DEFAULT_LOCATION;
  const addressLatitude =
    selectedAddress?.latitude != null && selectedAddress.latitude !== '' ? Number(selectedAddress.latitude) : NaN;
  const addressLongitude =
    selectedAddress?.longitude != null && selectedAddress.longitude !== '' ? Number(selectedAddress.longitude) : NaN;
  const storeLocation =
    Number.isFinite(addressLatitude) && Number.isFinite(addressLongitude)
      ? { latitude: addressLatitude, longitude: addressLongitude }
      : { latitude: appLocation.latitude, longitude: appLocation.longitude };

  const storeQuery = useQuery({
    queryKey: ['store', storeId, coordsKey(storeLocation)],
    queryFn: () => repositories.grocery.getStore(storeId as number, storeLocation),
    enabled: hasItems && storeId !== null,
  });

  // Null when the backend says this location cannot reach the store.
  const storeData = storeQuery.data?.store ?? null;

  const distanceKm = storeData && selectedAddress ? haversineKm(storeData, selectedAddress) : null;
  const etaMin = estimateDeliveryMinutes(distanceKm);
  const isScheduled = cart?.delivery_mode === 'scheduled';

  const feePending = setDeliveryAddress.isPending;
  const busyItem = (id: number) => updateItem.isPending && updateItem.variables?.itemId === id;

  const handleAddressError = (err: unknown) => toast(err instanceof Error ? err.message : 'Could not update delivery address.', 'error');

  const shareCart = () => {
    void Share.share({ message: `Check out my ${getBranding().name} grocery cart` }).catch(() => undefined);
  };

  if (cartQuery.isLoading) return <Screen header={<AppHeader variant="dark" title="Checkout" />}><Loader label="Loading cart…" /></Screen>;

  if (!hasItems) {
    return (
      <Screen header={<AppHeader variant="dark" title="Checkout" />}>
        <View style={styles.flexCenter}>
          <EmptyState
            title="Your cart is empty"
            message="Add groceries from a store to get started."
            actionLabel="Browse stores"
            onAction={() => router.replace('/stores' as never)}
          />
        </View>
      </Screen>
    );
  }

  if (!cart) return null;

  return (
    <Screen
      background={colors.grocery[50]}
      header={
        <View style={[styles.groceryHeader, { paddingTop: insets.top }]}>
          <View style={styles.groceryHeaderRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.groceryHeaderBtn} accessibilityLabel="Go back">
              <ArrowLeft size={20} color={colors.ink[900]} />
            </Pressable>
            <View style={styles.groceryHeaderText}>
              <Text style={styles.groceryHeaderTitle} numberOfLines={1}>Checkout</Text>
              {cart.items_count > 0 && (
                <Text style={styles.groceryHeaderSub} numberOfLines={1}>Shipment of {cart.items_count} item{cart.items_count === 1 ? '' : 's'}</Text>
              )}
            </View>
            <Pressable onPress={shareCart} hitSlop={8} style={styles.groceryHeaderBtn} accessibilityLabel="Share cart">
              <Share2 size={18} color={colors.ink[900]} />
            </Pressable>
          </View>
        </View>
      }
      bottomBar={
        <View style={styles.groceryBar}>
          <View style={styles.groceryBarTop}>
            <View style={styles.groceryBarLabelWrap}>
              <Clock size={12} color={colors.neutral[500]} />
              <Text style={styles.groceryBarLabel}>Total payable</Text>
            </View>
            {feePending ? (
              <Text style={styles.groceryBarCalc}>Calculating…</Text>
            ) : (
              <Text style={styles.groceryBarTotal}>{formatCurrency(Number(cart.total))}</Text>
            )}
          </View>
          <Pressable
            onPress={() => router.push('/checkout?type=grocery' as never)}
            accessibilityRole="button"
            style={styles.groceryBarBtn}
          >
            <Text style={styles.groceryBarBtnText}>Choose address at next step</Text>
            <ChevronRight size={16} color={colors.ink[900]} />
          </Pressable>
        </View>
      }
    >
      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: colors.grocery[50] }]} showsVerticalScrollIndicator={false}>
        {cartQuery.isError && (
          <EmptyState title="Couldn't load your cart" message="Something went wrong while fetching your cart." actionLabel="Retry" onAction={retryCart} />
        )}

        <DeliveryGroup
          storeName={storeData?.name ?? null}
          storeLoading={storeQuery.isLoading}
          distanceKm={distanceKm}
          etaMin={etaMin}
          scheduled={isScheduled}
          itemsCount={cart.items_count}
        />

        <View>
          <SectionRow title={`Shipment of ${cart.items_count} item${cart.items_count === 1 ? '' : 's'}`} />
          <View style={styles.itemsCard}>
            {items.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.cartLineWrap}>
                  <CartLine
                    item={item}
                    busy={busyItem(item.id)}
                    tone="grocery"
                    onQuantity={(quantity) => updateItem.mutate({ itemId: item.id, quantity })}
                    onRemove={() => removeItem.mutate(item.id)}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <YouMightAlsoLike storeId={storeId} inCartIds={new Set(items.map((i) => i.product_id))} />

        <CouponsSection
          couponCode={cart.coupon_code}
          coupons={coupons.data ?? []}
          loading={coupons.isLoading}
          isAuthenticated={isAuthenticated}
          tone="grocery"
          deliveryFee={cart.delivery_fee}
          discount={cart.discount}
        />

        <BillCard cart={cart} tone="grocery" />

        <View style={styles.deliverToCard}>
          <View style={styles.deliverToHead}>
            <Text style={styles.deliverLabel}>Delivering to</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {cart.address_id && (
                <Pressable onPress={() => setDeliveryAddress.mutate({ addressId: null, type: 'grocery' }, { onError: handleAddressError })}>
                  <Text style={styles.deliverToClear}>Clear</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setAddressOpen(true)}>
                <Text style={styles.deliverToChange}>Change</Text>
              </Pressable>
            </View>
          </View>
          {addresses.isLoading ? (
            <Loader label="Loading address…" />
          ) : selectedAddress ? (
            <Pressable onPress={() => setAddressOpen(true)} style={styles.deliverToRow}>
              <MapPin size={16} color={colors.grocery[600]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.deliverToName}>{selectedAddress.label}</Text>
                  {selectedAddress.is_default && <View style={[styles.defaultPill, { backgroundColor: colors.grocery[100] }]}><Text style={[styles.defaultPillText, { color: colors.grocery[800] }]}>Default</Text></View>}
                </View>
                <Text style={styles.deliverToAddr} numberOfLines={1}>
                  {selectedAddress.address_line_1}
                  {selectedAddress.address_line_2 ? `, ${selectedAddress.address_line_2}` : ''}, {selectedAddress.city} {selectedAddress.postal_code}
                </Text>
                {feePending && <Text style={styles.deliverToBusy}>Updating delivery fee…</Text>}
              </View>
            </Pressable>
          ) : (
            <Pressable onPress={() => setAddressOpen(true)} style={styles.deliverToRow}>
              <MapPin size={16} color={colors.neutral[400]} />
              <Text style={{ fontFamily: 'Outfit_700Bold', flex: 1, fontSize: 13, color: colors.neutral[700] }}>Select delivery address</Text>
              <Text style={styles.deliverToChange}>Choose</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <AddressSheet
        visible={addressOpen}
        onClose={() => setAddressOpen(false)}
        cartType="grocery"
        addresses={addresses}
        activeId={cart.address_id}
        onSelect={(addressId) => setDeliveryAddress.mutate({ addressId, type: 'grocery' }, { onError: handleAddressError })}
        onAddNew={() => {
          setAddressOpen(false);
          setAddAddressOpen(true);
        }}
      />

      <AddAddressSheet
        visible={addAddressOpen}
        onClose={() => setAddAddressOpen(false)}
        onCreated={(created) =>
          setDeliveryAddress.mutate({ addressId: created.id, type: 'grocery' }, { onError: handleAddressError })
        }
      />
    </Screen>
  );
}

function DeliveryGroup({
  storeName,
  storeLoading,
  distanceKm,
  etaMin,
  scheduled,
  itemsCount,
}: {
  storeName: string | null;
  storeLoading: boolean;
  distanceKm: number | null;
  etaMin: number | null;
  scheduled: boolean;
  itemsCount: number;
}) {
  return (
    <View style={[styles.card, styles.deliveryGroupCard]}>
      <View style={[styles.deliveryInfoIcon, { width: 40, height: 40, backgroundColor: colors.grocery[100] }]}>
        {scheduled ? <CalendarClock size={20} color={colors.grocery[700]} /> : <Zap size={20} color={colors.grocery[700]} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.deliveryInfoTitle}>
          {scheduled ? 'Scheduled' : etaMin !== null ? `Delivery in ${etaMin} min` : 'Delivery time shown at checkout'}
        </Text>
        <Text style={styles.deliveryInfoSub}>
          {scheduled ? 'Delivery slot booked' : `Shipment of ${itemsCount} item${itemsCount === 1 ? '' : 's'}`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <StoreIcon size={11} color={colors.grocery[700]} />
          <Text style={styles.storeLine} numberOfLines={1}>
            {storeLoading ? 'Loading store…' : (storeName ?? 'Your grocery store')}
            {distanceKm !== null ? ` · ${distanceKm.toFixed(1)} km` : ''}
          </Text>
        </View>
      </View>
      <View style={[styles.deliveryBadge, { backgroundColor: colors.grocery[100] }]}>
        <Text style={[styles.deliveryBadgeText, { color: colors.grocery[800] }]}>{scheduled ? 'Slot' : 'ASAP'}</Text>
      </View>
    </View>
  );
}

function YouMightAlsoLike({ storeId, inCartIds }: { storeId: number | null; inCartIds: Set<number> }) {
  const router = useRouter();
  const { products, isLoading } = useStoreCatalogue(storeId, { perPage: 24 });

  const suggestions = useMemo(
    () => products.filter((p) => p.is_available && !inCartIds.has(p.id)).slice(0, 10),
    [products, inCartIds],
  );

  if (!isLoading && suggestions.length === 0) return null;

  return (
    <View>
      <SectionRow
        title="You might also like"
        action={
          <Pressable onPress={() => router.push('/grocery' as never)} hitSlop={6}>
            <Text style={styles.sectionAction}>See all products</Text>
          </Pressable>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {isLoading && suggestions.length === 0
          ? Array.from({ length: 3 }).map((_, i) => <View key={i} style={styles.recoSkeleton} />)
          : suggestions.map((p) => {
              const off = discountPercent(p.price, p.compare_at_price);
              return (
                <View key={p.id} style={styles.recoCard}>
                  <View>
                    <ProductImage src={p.image} size={116} />
                    {off !== null && (
                      <View style={styles.offBadge}>
                        <Text style={styles.offBadgeText}>{off}% off</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.recoName} numberOfLines={2}>{p.name}</Text>
                  {p.unit_label && <Text style={styles.cartLineUnit}>{p.unit_label}</Text>}
                  <Text style={styles.mealPrice}>{formatCurrency(Number(p.price))}</Text>
                  <AddToCartControl productId={p.id} type="grocery" size="sm" product={p} />
                </View>
              );
            })}
      </ScrollView>
    </View>
  );
}

/* ================================================================== */
/* Shared: coupons, address, bill, contact                            */
/* ================================================================== */

function CouponsSection({
  couponCode,
  coupons,
  loading,
  isAuthenticated,
  tone,
  deliveryFee,
  discount,
}: {
  couponCode: string | null;
  coupons: { id: number; name: string; code: string; description?: string | null; min_order_amount: string }[];
  loading: boolean;
  isAuthenticated: boolean;
  tone: 'food' | 'grocery';
  deliveryFee?: string;
  discount?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const isGrocery = tone === 'grocery';
  const accent = isGrocery ? colors.grocery[600] : colors.food[600];
  const applyColor = isGrocery ? colors.grocery[500] : colors.food[600];
  const applyTextColor = isGrocery ? colors.ink[900] : '#fff';
  const discountValue = parseFloat(discount ?? '0');
  const freeDelivery = isGrocery && parseFloat(deliveryFee ?? '0') === 0;

  const applyCode = (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    applyCoupon.mutate(trimmed, {
      onSuccess: () => {
        toast('Coupon applied');
        setCode('');
        setOpen(false);
      },
      onError: () => toast('This coupon can\u2019t be applied', 'error'),
    });
  };

  const shown = coupons.slice(0, tone === 'grocery' ? 2 : 3);

  return (
    <View>
      <SectionRow title={isGrocery ? 'Coupons & offers' : 'Offers & coupons'} />
      {!isAuthenticated ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apply a coupon</Text>
          <Text style={styles.cardSub}>Login to apply coupons and save on this order.</Text>
          <Pressable onPress={() => router.push('/auth/login' as never)}>
            <Text style={[styles.loginLink, { color: accent }]}>Login now {''}<ChevronRight size={12} color={accent} /></Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          {couponCode ? (
            <View style={styles.couponAppliedRow}>
              <View style={[styles.taggedIcon, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                <Check size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Coupon applied</Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {couponCode}
                  {isGrocery && discountValue > 0 ? ` · you saved ${formatCurrency(discountValue)}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => removeCoupon.mutate()}>
                <Text style={styles.removeCoupon}>Remove</Text>
              </Pressable>
            </View>
          ) : loading ? (
            <Loader label="Loading coupons…" />
          ) : (
            <>
              {freeDelivery && (
                <View style={styles.couponRow}>
                  <View style={[styles.taggedIcon, { backgroundColor: colors.grocery[100] }]}>
                    <Tag size={16} color={colors.grocery[700]} />
                  </View>
                  <Text style={{ fontFamily: 'Outfit_600SemiBold', flex: 1, fontSize: 13, color: colors.neutral[700] }}>
                    Yay! You got <Text style={{ fontWeight: '800', color: colors.grocery[800] }}>FREE delivery</Text>
                  </Text>
                </View>
              )}
              {shown.map((coupon) => (
                <View key={coupon.id} style={styles.couponRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponName}>{coupon.name}</Text>
                    <Text style={styles.couponDesc} numberOfLines={1}>{coupon.description ?? `Use code ${coupon.code}`}</Text>
                  </View>
                  <Pressable onPress={() => applyCode(coupon.code)} disabled={applyCoupon.isPending} style={[styles.applyBtn, { backgroundColor: applyColor }]}>
                    <Text style={[styles.applyBtnText, { color: applyTextColor }]}>{applyCoupon.isPending ? '…' : 'Apply'}</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}
          <Pressable onPress={() => setOpen(true)} style={styles.couponFooter}>
            <View style={[styles.taggedIcon, { backgroundColor: colors.neutral[100] }]}>
              <Tag size={16} color={colors.neutral[500]} />
            </View>
            <Text style={{ fontFamily: 'Outfit_700Bold', flex: 1, fontSize: 13, color: colors.neutral[700] }}>
              {couponCode ? 'Change coupon' : isGrocery ? 'Apply coupon' : 'Have a coupon code?'}
            </Text>
            <ChevronRight size={16} color={colors.neutral[300]} />
          </Pressable>
        </View>
      )}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Apply coupon">
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Enter coupon code"
          placeholderTextColor={colors.neutral[400]}
          style={styles.codeInput}
          autoCapitalize="characters"
          onSubmitEditing={() => applyCode(code)}
          returnKeyType="done"
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable onPress={() => setOpen(false)} style={[styles.cancelBtn, { flex: 1 }]}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => applyCode(code)} disabled={!code.trim() || applyCoupon.isPending} style={[styles.applyBtnBig, { flex: 1, backgroundColor: accent, opacity: !code.trim() || applyCoupon.isPending ? 0.5 : 1 }]}>
            <Text style={styles.applyBtnText}>{applyCoupon.isPending ? 'Applying…' : 'Apply'}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

function AddressSheet({
  visible,
  onClose,
  cartType,
  addresses,
  activeId,
  onSelect,
  onAddNew,
}: {
  visible: boolean;
  onClose: () => void;
  cartType: OrderType;
  addresses: { isLoading: boolean; data?: Address[] };
  activeId: number | null;
  onSelect: (addressId: number) => void;
  onAddNew: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select delivery address">
      {addresses.isLoading && <Loader label="Loading address…" />}
      {!addresses.isLoading && (addresses.data ?? []).length === 0 && (
        <Text style={styles.emptyAddress}>No saved addresses. Add one first.</Text>
      )}
      {(addresses.data ?? []).map((a) => {
        const active = activeId === a.id;
        return (
          <Pressable
            key={a.id}
            onPress={() => {
              onSelect(a.id);
              onClose();
            }}
            style={[styles.addressRow, active ? { borderColor: cartType === 'grocery' ? colors.grocery[500] : colors.food[600], backgroundColor: withAlpha(cartType === 'grocery' ? colors.grocery[500] : colors.food[600], 0.06) } : undefined]}
          >
            <View style={[styles.radioOuter, { borderColor: active ? (cartType === 'grocery' ? colors.grocery[600] : colors.food[600]) : colors.neutral[300] }]}>
              {active && <View style={[styles.radioInner, { backgroundColor: cartType === 'grocery' ? colors.grocery[600] : colors.food[600] }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.deliverToName}>{a.label}</Text>
                {a.is_default && <View style={[styles.defaultPill, { backgroundColor: cartType === 'grocery' ? colors.brand[50] : colors.food[50] }]}><Text style={[styles.defaultPillText, { color: cartType === 'grocery' ? colors.brand[700] : colors.food[700] }]}>Default</Text></View>}
              </View>
              <Text style={styles.deliverToAddr} numberOfLines={1}>
                {a.address_line_1}
                {a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city} {a.postal_code}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Pressable onPress={onAddNew} style={styles.addAddressBtn}>
        <Plus size={16} color={cartType === 'grocery' ? colors.grocery[700] : colors.food[600]} />
        <Text style={[styles.addAddressText, { color: cartType === 'grocery' ? colors.grocery[700] : colors.food[600] }]}>Add new address</Text>
      </Pressable>
    </BottomSheet>
  );
}

function ContactCard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.deliverLabel}>Contact</Text>
        <Text style={styles.deliverToName}>{user.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, marginTop: 4 }}>
          {user.phone ? (
            <Text style={styles.contactLine}><Phone size={11} color={colors.neutral[500]} /> {user.country_code ? `${user.country_code} ` : ''}{user.phone}</Text>
          ) : null}
          {user.email ? (
            <Text style={styles.contactLine}><Mail size={11} color={colors.neutral[500]} /> {user.email}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function BillCard({ cart, tone = 'food' }: { cart: Cart; tone?: OrderType }) {
  const isGrocery = tone === 'grocery';
  const rows: { label: string; value: number; tone?: 'success' | 'default' }[] = [{ label: isGrocery ? 'Items total' : 'Item subtotal', value: Number(cart.subtotal) }];

  if (parseFloat(cart.discount) > 0) {
    rows.push({ label: `Coupon discount${cart.coupon_code ? ` (${cart.coupon_code})` : ''}`, value: -Number(cart.discount), tone: 'success' });
  }
  if (parseFloat(cart.tax) > 0) rows.push({ label: 'Taxes', value: Number(cart.tax) });

  const deliveryFee = parseFloat(cart.delivery_fee);
  const hasGst = parseFloat(cart.delivery_gst_amount) > 0;
  const packagingFee = parseFloat(cart.packaging_fee ?? '0');
  const handlingFee = parseFloat(cart.handling_fee ?? '0');

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Bill details</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.billRow}>
          <Text style={styles.billLabel}>{r.label}</Text>
          <Text style={[styles.billValue, r.tone === 'success' && { color: colors.success }]}>
            {r.tone === 'success' ? '-' : ''}{formatCurrency(Math.abs(r.value))}
          </Text>
        </View>
      ))}
      <View style={styles.billRow}>
        <Text style={styles.billLabel}>{isGrocery ? 'Delivery charge' : 'Delivery fee'}</Text>
        <Text style={[styles.billValue, deliveryFee === 0 && { color: colors.success }, deliveryFee === 0 && isGrocery && { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          {deliveryFee === 0 ? (isGrocery ? 'FREE' : 'Free') : formatCurrency(deliveryFee)}
        </Text>
      </View>
      {packagingFee > 0 && (
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Packaging charge</Text>
          <Text style={styles.billValue}>{formatCurrency(packagingFee)}</Text>
        </View>
      )}
      {handlingFee > 0 && (
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Handling fee</Text>
          <Text style={styles.billValue}>{formatCurrency(handlingFee)}</Text>
        </View>
      )}
      {hasGst && (
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Delivery GST ({Number(cart.delivery_gst_percent)}%)</Text>
          <Text style={styles.billValue}>{formatCurrency(Number(cart.delivery_gst_amount))}</Text>
        </View>
      )}
      <View style={styles.billTotalRow}>
        <Text style={styles.billToPay}>{isGrocery ? 'Grand total' : 'To pay'}</Text>
        <Text style={styles.billTotal}>{formatCurrency(Number(cart.total))}</Text>
      </View>
    </View>
  );
}

function SectionRow({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      {action}
    </View>
  );
}

/* ================================================================== */
/* Styles                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    /* Food cart: Zomato's cart sits on plain white with bordered cards.
       The grocery cart overrides this with its own tint inline. */
    backgroundColor: colors.white,
  },
  flexCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.ink[900],
  },
  cardSub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.neutral[500],
  },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  sectionMeta: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: colors.neutral[400],
  },
  restaurantContext: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  contextLabel: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  contextTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#fff',
  },
  contextPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  contextPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  contextPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextPillText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  freeDelivery: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  freeDeliveryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  freeDeliveryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeDeliveryBody: {
    flex: 1,
  },
  freeDeliveryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  freeDeliveryTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  unlockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: withAlpha(colors.success, 0.1),
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unlockedPillText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    color: colors.success,
  },
  freeDeliverySub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressHint: {
    fontFamily: 'Outfit_700Bold',
    textAlign: 'right',
    fontSize: 11,
    color: colors.neutral[500],
  },
  cartLineWrap: {
    padding: 14,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartLineBody: {
    flex: 1,
    minWidth: 0,
  },
  cartLineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cartLineNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  cartLineName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: colors.ink[900],
  },
  cartLineUnit: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: colors.neutral[500],
  },
  cartLinePrice: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 4,
  },
  cartLineTimes: {
    fontFamily: 'Outfit_400Regular',
    color: colors.neutral[400],
  },
  offText: {
    fontWeight: '800',
  },
  cartLineBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editPillText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
  },
  cartLineTotalWrap: {
    alignItems: 'flex-end',
  },
  cartLineTotal: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.ink[900],
  },
  mrpText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: colors.neutral[400],
  },
  rail: {
    gap: 10,
    paddingRight: 8,
  },
  mealCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 8,
    gap: 6,
  },
  mealName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: colors.ink[900],
  },
  mealFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  mealPrice: {
    fontFamily: 'Outfit_800ExtraBold',
    flexShrink: 0,
    fontSize: 13,
    color: colors.ink[900],
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveryGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveryInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryInfoTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  deliveryInfoSub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  storeLine: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: colors.grocery[800],
    marginTop: 2,
  },
  deliveryBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deliveryBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.food[700],
  },
  taggedIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  couponName: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  couponDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  applyBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  applyBtnText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: '#fff',
  },
  applyBtnBig: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: colors.ink[900],
  },
  couponFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeCoupon: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: colors.danger,
  },
  codeInput: {
    fontFamily: 'Outfit_400Regular',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.ink[900],
  },
  loginLink: {
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: 8,
    fontSize: 12,
    color: colors.brand[600],
  },
  deliverLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.neutral[400],
    marginBottom: 4,
  },
  deliverToHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliverToChange: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: colors.brand[600],
  },
  deliverToClear: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: colors.neutral[500],
  },
  deliverToRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  deliverToName: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  deliverToAddr: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  deliverToBusy: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: colors.brand[600],
    marginTop: 2,
  },
  defaultPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  defaultPillText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
  },
  deliverToCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 14,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
    marginBottom: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyAddress: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: colors.neutral[500],
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  addAddressText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  contactLine: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.neutral[500],
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.neutral[500],
  },
  billValue: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: colors.ink[800],
  },
  billTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: 10,
    marginTop: 4,
  },
  billToPay: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.ink[900],
  },
  billTotal: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.ink[900],
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.neutral[200],
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  addMoreText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: colors.food[600],
  },
  checkoutBar: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: 10,
    paddingBottom: 10,
  },
  checkoutBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
  },
  checkoutMeta: {
    gap: 2,
  },
  checkoutPayHint: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: colors.neutral[500],
  },
  checkoutTotal: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: colors.ink[900],
  },
  offBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    color: '#fff',
  },
  groceryHeader: {
    backgroundColor: colors.grocery[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.grocery[200],
  },
  groceryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 56,
    paddingHorizontal: 8,
  },
  groceryHeaderBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  groceryHeaderTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  groceryHeaderSub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: colors.neutral[500],
  },
  groceryBar: {
    gap: 6,
  },
  groceryBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groceryBarLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groceryBarLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: colors.neutral[500],
  },
  groceryBarCalc: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.neutral[400],
  },
  groceryBarTotal: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.ink[900],
  },
  groceryBarBtn: {
    marginTop: 6,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.grocery[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  groceryBarBtnText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  sectionAction: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: colors.grocery[700],
  },
  recoCard: {
    width: 132,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 8,
    gap: 6,
  },
  recoName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: colors.ink[900],
  },
  recoSkeleton: {
    width: 132,
    height: 176,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
  },

  /* ---- Zomato food cart (header, delivery, payment bar) ---- */
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.brand[50],
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedEmoji: {
    fontSize: 14,
  },
  savedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand[700],
  },
  cancellation: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.neutral[400],
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  cancellationHead: {
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.neutral[400],
  },

  foodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  foodHeaderBack: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodHeaderName: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 4,
  },
  foodHeaderAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  foodHeaderEta: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  foodHeaderAddr: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '500',
    color: colors.neutral[700],
  },

  deliveryBlock: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  deliveryBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deliveryBlockTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  deliveryBlockDivider: {
    height: 1,
    backgroundColor: colors.ink[50],
    marginHorizontal: 16,
  },
  deliveryBlockAddr: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deliveryBlockAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryBlockAddrTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  deliveryBlockAddrText: {
    marginTop: 2,
    fontSize: 13,
    color: colors.neutral[500],
  },
  deliveryBlockLogin: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand[600],
  },

  payBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: 6,
  },
  payBarWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  payBarWalletText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  payBarWalletBalance: {
    fontWeight: '800',
    color: colors.ink[900],
  },
  payBarAdd: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.food[600],
  },
  payBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  payUsing: {
    flexShrink: 0,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  payUsingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.neutral[500],
  },
  payUsingMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    maxWidth: 130,
  },
  payUsingMethodText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  placeOrderBtn: {
    flex: 1,
    minWidth: 0,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: colors.food[600],
    paddingHorizontal: 16,
  },
  placeOrderTotalWrap: {
    alignItems: 'flex-start',
  },
  placeOrderTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  placeOrderTotalLabel: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.8)',
  },
  placeOrderDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  placeOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeOrderText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },

  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  payOptionIdle: {
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  payOptionActive: {
    borderColor: colors.food[600],
    backgroundColor: colors.food[50],
  },
  payOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  payOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  payOptionDesc: {
    marginTop: 1,
    fontSize: 12,
    color: colors.neutral[500],
  },
  payOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  payOptionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.food[600],
  },

  sheetPrompt: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  sheetLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: colors.food[600],
    paddingVertical: 12,
  },
  sheetLoginText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  sheetAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    paddingVertical: 12,
  },
  sheetAddText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.food[600],
  },
});