import { useState } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Banknote,
  ChevronRight,
  CreditCard,
  MapPin,
  Plus,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import type { Cart, OrderType } from '@/shared/types/models';
import { useSetDeliveryAddress, useSyncCartAddress } from '@/features/cart/hooks/useCart';
import { useCartStore } from '@/features/cart/store/cartStore';
import { useAppStore } from '@/shared/stores/appStore';
import { locationFromAddress } from '@/shared/utils/location';import { toast } from '@/shared/stores/toastStore';
import { useBranding } from '@/shared/hooks/useBranding';
import { createUsableCheckout, completeOrderPayment } from '@/shared/utils/payments';
import { formatCurrency } from '@/shared/utils/utils';
import { EmptyState, Loader } from '@/shared/components/ui/primitives';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { AddAddressSheet } from '@/features/profile/components/address/AddAddressSheet';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';
import { colors, withAlpha } from '@/shared/theme';

type PayMethod = 'wallet' | 'cash_on_delivery' | 'online';

const PAY_OPTIONS: { value: PayMethod; label: string; desc: string; icon: typeof WalletIcon }[] = [
  // Wallet label is rendered as `${platform name} Wallet` below.
  { value: 'wallet', label: 'Wallet', desc: 'Pay from wallet', icon: WalletIcon },
  { value: 'cash_on_delivery', label: 'Cash on delivery', desc: 'Pay when you receive', icon: Banknote },
  { value: 'online', label: 'Card / UPI', desc: 'Pay securely online', icon: CreditCard },
];

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const router = useRouter();
  const type = (params.type === 'grocery' ? 'grocery' : 'food') as OrderType;
  const { name: brandName } = useBranding();

  const [selectedAddressId, setSelectedAddressId] = useState<number | undefined>(undefined);
  const [payMethod, setPayMethod] = useState<PayMethod>('wallet');
  const [couponOpen, setCouponOpen] = useState(false);
  const [addAddressOpen, setAddAddressOpen] = useState(false);
  const [code, setCode] = useState('');

  // The grocery delivery timing is chosen on the cart (see DeliverySlotPicker
  // on `/cart?type=grocery`) and read here, so checkout can never disagree
  // with what the customer already picked.
  const deliveryMode = useCartStore((s) => s.groceryDeliveryMode);
  const selectedSlot = useCartStore((s) => s.groceryDeliverySlot);
  const resetGroceryDelivery = useCartStore((s) => s.resetGroceryDelivery);

  const foodRestaurantNote = useCartStore((s) => s.foodRestaurantNote);
  const foodNoCutlery = useCartStore((s) => s.foodNoCutlery);
  const clearFoodInstructions = useCartStore((s) => s.clearFoodInstructions);
  const foodDeliveryNote = useCartStore((s) => s.foodDeliveryNote);
  const groceryDeliveryNote = useCartStore((s) => s.groceryDeliveryNote);
  const clearDeliveryNote = useCartStore((s) => s.clearDeliveryNote);
  const deliveryNote = type === 'grocery' ? groceryDeliveryNote : foodDeliveryNote;

  const cartQuery = useQuery({ queryKey: ['cart', type], queryFn: () => repositories.cart.getByType(type) });

  // The checkout pays for the address the home header shows, so the two are
  // reconciled before anything is placed.
  useSyncCartAddress(type, cartQuery.data);
  const cart = cartQuery.data;
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => repositories.user.getAddresses() });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => repositories.wallet.getWallet() });

  const queryClient = useQueryClient();

  const applyCoupon = useMutation({
    mutationFn: (c: string) => repositories.cart.applyCoupon(c),
    onSuccess: () => {
      toast('Coupon applied');
      setCode('');
      setCouponOpen(false);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: () => toast('Invalid coupon code', 'error'),
  });
  const removeCoupon = useMutation({
    mutationFn: () => repositories.cart.removeCoupon(),
    onSuccess: () => {
      toast('Coupon removed');
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
  const setDeliveryAddress = useSetDeliveryAddress();
  const setLocation = useAppStore((s) => s.setLocation);

  const addressId = selectedAddressId ?? cart?.address_id ?? undefined;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!cart) throw new Error('Cart is empty');
      if (deliveryMode === 'scheduled' && !selectedSlot) throw new Error('Choose a delivery slot');
      const order = await repositories.orders.createOrder({
        order_type: type,
        address_id: addressId,
        payment_method: payMethod,
        customer_note: deliveryNote.trim() || undefined,
        ...(deliveryMode === 'scheduled' && selectedSlot ? { delivery_slot_id: selectedSlot.id } : {}),
        ...(type === 'food'
          ? {
              restaurant_note: foodRestaurantNote.trim() || undefined,
              send_cutlery: !foodNoCutlery,
            }
          : {}),
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
      if (type === 'food') clearFoodInstructions();
      clearDeliveryNote(type);
      // The booked slot belongs to the order that was just placed, not to the
      // next cart.
      resetGroceryDelivery();

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

  const needsSlot = type === 'grocery' && deliveryMode === 'scheduled';
  const feePending = setDeliveryAddress.isPending;
  const canPlace = !!cart && cart.items.length > 0 && !!addressId && (!needsSlot || !!selectedSlot) && !placeOrder.isPending;

  if (cartQuery.isLoading) return <Screen header={<AppHeader variant="dark" title="Checkout" />}><Loader label="Loading checkout…" /></Screen>;

  if (!cart || cart.items.length === 0) {
    return (
      <Screen header={<AppHeader variant="dark" title="Checkout" />}>
        <View style={styles.flexCenter}>
          <EmptyState
            title="Your cart is empty"
            message="Add items before checking out."
            actionLabel="Go to cart"
            onAction={() => router.replace('/cart' as never)}
          />
        </View>
      </Screen>
    );
  }

  const accent = type === 'grocery' ? colors.brand[600] : colors.food[600];

  return (
    <Screen header={<AppHeader variant="dark" title="Checkout" />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cartQuery.isError && (
          <EmptyState title="Couldn't load checkout" message="Something went wrong." actionLabel="Retry" onAction={() => void cartQuery.refetch()} />
        )}

        <View>
          <SectionTitle
            title="Delivery address"
            action={
              <Pressable onPress={() => setAddAddressOpen(true)} style={styles.addNewWrap}>
                <Plus size={13} color={colors.brand[600]} />
                <Text style={styles.addNew}>Add new</Text>
              </Pressable>
            }
          />
          {addresses.isLoading && <Loader label="Loading address…" />}
          {!addresses.isLoading && (addresses.data ?? []).length === 0 && (
            <View style={styles.emptyAddr}>
              <MapPin size={16} color={colors.neutral[300]} />
              <Text style={styles.emptyAddrText}>No saved addresses. Add one first.</Text>
            </View>
          )}
          {(addresses.data ?? []).map((a) => {
            const active = addressId === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  setSelectedAddressId(a.id);
                  // Same choice the home header displays — keep both sides.
                  setLocation(locationFromAddress(a), a.id);
                  setDeliveryAddress.mutate({
                    addressId: a.id,
                    type,
                    deliveryMode: type === 'grocery' && deliveryMode === 'scheduled' ? 'scheduled' : 'instant',
                  });
                }}
                style={[styles.addressOption, active ? { borderColor: accent, backgroundColor: withAlpha(accent, 0.06) } : undefined]}
              >
                <View style={[styles.radioOuter, { borderColor: active ? accent : colors.neutral[300] }]}>
                  {active && <View style={[styles.radioInner, { backgroundColor: accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.optionTitle}>{a.label}</Text>
                    {a.is_default && <View style={styles.defaultPill}><Text style={styles.defaultPillText}>Default</Text></View>}
                  </View>
                  <Text style={styles.optionSub}>
                    {a.address_line_1}
                    {a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city} {a.postal_code}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View>
          <SectionTitle title="Payment method" />
          {PAY_OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = payMethod === o.value;
            return (
              <Pressable key={o.value} onPress={() => setPayMethod(o.value)} style={[styles.payOption, active ? { borderColor: accent, backgroundColor: withAlpha(accent, 0.06) } : undefined]}>
                <View style={[styles.payIcon, { backgroundColor: active ? accent : colors.neutral[100] }]}>
                  <Icon size={20} color={active ? '#fff' : colors.neutral[500]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{o.value === 'wallet' ? `${brandName} Wallet` : o.label}</Text>
                  <Text style={styles.optionSub}>{o.value === 'wallet' && wallet.data?.balance ? `Balance ${formatCurrency(Number(wallet.data.balance))}` : o.desc}</Text>
                </View>
                <ChevronRight size={16} color={colors.neutral[300]} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.couponCard}>
          <Pressable onPress={() => setCouponOpen(true)} style={styles.couponRow}>
            <Text style={styles.couponText}>{cart.coupon_code ? `Coupon applied: ${cart.coupon_code}` : 'Apply a coupon'}</Text>
            <ChevronRight size={16} color={colors.neutral[300]} />
          </Pressable>
          {cart.coupon_code && (
            <Pressable onPress={() => removeCoupon.mutate()} hitSlop={6}>
              <Text style={styles.removeCoupon}>Remove coupon</Text>
            </Pressable>
          )}
        </View>

        <BillSummary cart={cart} feePending={feePending} scheduledDelivery={type === 'grocery' && deliveryMode === 'scheduled'} />

        {!addressId && (
          <View
            style={{
              borderRadius: 12,
              backgroundColor: type === 'grocery' ? colors.grocery[100] : colors.food[50],
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Outfit_600SemiBold',
                fontSize: 13,
                color: type === 'grocery' ? colors.grocery[800] : colors.food[700],
                textAlign: 'center',
              }}
            >
              Add a delivery address to place your order.
            </Text>
          </View>
        )}

        <View style={styles.placeBar}>
          <View>
            <Text style={styles.placeLabel}>Total to pay</Text>
            {feePending ? (
              <Text style={styles.placeTotalCalc}>Calculating...</Text>
            ) : (
              <Text style={styles.placeTotal}>{formatCurrency(Number(cart.total))}</Text>
            )}
          </View>
          <Pressable
            onPress={() => placeOrder.mutate()}
            disabled={!canPlace}
            style={[styles.placeBtn, { backgroundColor: accent, opacity: canPlace ? 1 : 0.5 }]}
          >
            {placeOrder.isPending ? <ActivityIndicator size={16} color="#fff" /> : <Text style={styles.placeBtnText}>Place Order</Text>}
          </Pressable>
        </View>
      </ScrollView>

      <BottomSheet visible={couponOpen} onClose={() => setCouponOpen(false)} title="Apply coupon">
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Enter coupon code"
          placeholderTextColor={colors.neutral[400]}
          style={styles.codeInput}
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={() => code.trim() && applyCoupon.mutate(code.trim())}
          returnKeyType="done"
        />
        <Pressable
          onPress={() => code.trim() && applyCoupon.mutate(code.trim())}
          disabled={!code.trim() || applyCoupon.isPending}
          style={[styles.applyBtn, { backgroundColor: accent, opacity: !code.trim() || applyCoupon.isPending ? 0.5 : 1 }]}
        >
          <Text style={styles.applyBtnText}>{applyCoupon.isPending ? 'Applying…' : 'Apply'}</Text>
        </Pressable>
      </BottomSheet>

      <AddAddressSheet
        visible={addAddressOpen}
        onClose={() => setAddAddressOpen(false)}
        onCreated={(created) => {
          setSelectedAddressId(created.id);
          setLocation(locationFromAddress(created), created.id);
          setDeliveryAddress.mutate({
            addressId: created.id,
            type,
            deliveryMode: type === 'grocery' && deliveryMode === 'scheduled' ? 'scheduled' : 'instant',
          });
        }}
      />
    </Screen>
  );
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

function BillSummary({ cart, feePending, scheduledDelivery }: { cart: Cart; feePending?: boolean; scheduledDelivery?: boolean }) {
  const packagingFee = parseFloat(cart.packaging_fee ?? '0');
  const handlingFee = parseFloat(cart.handling_fee ?? '0');
  const deliveryIsFree = parseFloat(cart.delivery_fee) === 0;

  return (
    <View style={styles.billCard}>
      <Text style={styles.cardTitle}>Order summary</Text>
      <BillRow label="Item subtotal" value={formatCurrency(Number(cart.subtotal))} />
      {parseFloat(cart.discount) > 0 && <BillRow label="Coupon discount" value={`-${formatCurrency(Number(cart.discount))}`} tone="success" />}
      {parseFloat(cart.tax) > 0 && <BillRow label="Taxes" value={formatCurrency(Number(cart.tax))} />}
      <View style={styles.billRow}>
        <Text style={styles.billLabel}>Delivery fee</Text>
        {feePending ? (
          <Text style={styles.billCalc}>Calculating...</Text>
        ) : (
          <Text style={[styles.billValue, deliveryIsFree && scheduledDelivery && { color: colors.success, fontWeight: '800' }]}>
            {deliveryIsFree && scheduledDelivery ? 'FREE' : formatCurrency(Number(cart.delivery_fee))}
          </Text>
        )}
      </View>
      {!feePending && packagingFee > 0 && <BillRow label="Packaging charge" value={formatCurrency(packagingFee)} />}
      {!feePending && handlingFee > 0 && <BillRow label="Handling fee" value={formatCurrency(handlingFee)} />}
      {!feePending && parseFloat(cart.delivery_gst_amount) > 0 && (
        <BillRow label={`Delivery GST (${Number(cart.delivery_gst_percent)}%)`} value={formatCurrency(Number(cart.delivery_gst_amount))} />
      )}
      <View style={styles.billTotalRow}>
        <Text style={styles.billToPay}>To pay</Text>
        {feePending ? <Text style={styles.billTotalCalc}>Calculating...</Text> : <Text style={styles.billTotal}>{formatCurrency(Number(cart.total))}</Text>}
      </View>
    </View>
  );
}

function BillRow({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <View style={styles.billRow}>
      <Text style={styles.billLabel}>{label}</Text>
      <Text style={[styles.billValue, tone === 'success' && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 20,
  },
  flexCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  addNewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addNew: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand[600],
  },
  emptyAddr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 14,
  },
  emptyAddrText: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
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
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  optionSub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  defaultPill: {
    backgroundColor: colors.brand[50],
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  defaultPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand[700],
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
    marginBottom: 8,
  },
  payIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 16,
    gap: 6,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  couponText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand[700],
  },
  removeCoupon: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
    marginBottom: 4,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  billValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  billCalc: {
    fontSize: 13,
    color: colors.neutral[400],
  },
  billTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: 10,
    marginTop: 2,
  },
  billToPay: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  billTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  billTotalCalc: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[400],
  },
  placeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brand[200],
    padding: 12,
  },
  placeLabel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  placeTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink[900],
  },
  placeTotalCalc: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[400],
  },
  placeBtn: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  codeInput: {
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
  applyBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});