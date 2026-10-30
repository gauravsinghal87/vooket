import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, ChevronRight, MapPin, Plus, Wallet as WalletIcon, Banknote, CreditCard } from 'lucide-react';
import { repositories } from '@/repositories';
import { useAppStore } from '@/store/appStore';
import { locationFromAddress } from '@/lib/location';
import type { OrderType } from '@/types/models';
import { useApplyCoupon, useRemoveCoupon, useSetDeliveryAddress, useSyncCartAddress } from '@/hooks/useCart';
import { Card } from '@/components/ui/card';
import { Price } from '@/components/ui/price';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { completeOrderPayment, createUsableCheckout } from '@/lib/razorpay';
import { getBranding } from '@/lib/branding';
import { useCartStore } from '@/store/cartStore';
import { cn } from '@/lib/utils';

type PayMethod = 'wallet' | 'cash_on_delivery' | 'online';

export function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const type = (params.get('type') === 'grocery' ? 'grocery' : 'food') as OrderType;

  const [selectedAddressId, setSelectedAddressId] = useState<number | undefined>(undefined);
  const [payMethod, setPayMethod] = useState<PayMethod>('wallet');
  const [couponOpen, setCouponOpen] = useState(false);
  const [code, setCode] = useState('');

  // The grocery delivery timing is chosen on the cart (see DeliverySlotPicker
  // on `/cart?type=grocery`) and read here, so checkout can never disagree
  // with what the customer already picked.
  const deliveryMode = useCartStore((s) => s.groceryDeliveryMode);
  const selectedSlot = useCartStore((s) => s.groceryDeliverySlot);
  const resetGroceryDelivery = useCartStore((s) => s.resetGroceryDelivery);

  // Instructions: food's preparation note is collected in the cart; the
  // delivery note is collected per module and travels as `customer_note`.
  const foodRestaurantNote = useCartStore((s) => s.foodRestaurantNote);
  const foodNoCutlery = useCartStore((s) => s.foodNoCutlery);
  const clearFoodInstructions = useCartStore((s) => s.clearFoodInstructions);
  const foodDeliveryNote = useCartStore((s) => s.foodDeliveryNote);
  const groceryDeliveryNote = useCartStore((s) => s.groceryDeliveryNote);
  const clearDeliveryNote = useCartStore((s) => s.clearDeliveryNote);
  const deliveryNote = type === 'grocery' ? groceryDeliveryNote : foodDeliveryNote;

  const cart = useQuery({ queryKey: ['cart', type], queryFn: () => repositories.cart.getByType(type) });
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => repositories.user.getAddresses() });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => repositories.wallet.getWallet() });

  // The checkout pays for the address the home header shows, so the two are
  // reconciled before anything is placed.
  useSyncCartAddress(type, cart.data);

  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const setDeliveryAddress = useSetDeliveryAddress();
  const setLocation = useAppStore((s) => s.setLocation);

  const addressId = selectedAddressId ?? cart.data?.address_id ?? undefined;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!cart.data) throw new Error('Cart is empty');
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
        navigate(`/order-confirmation/${order.id}`);
        return;
      }

      try {
        const result = await completeOrderPayment(checkout);
        if (result.status === 'paid') {
          toast('Order placed successfully!');
          navigate(`/order-confirmation/${order.id}`);
          return;
        }
        toast('Payment cancelled. You can pay again from the order page.', 'error');
        navigate(`/order/${order.id}`);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Payment could not be completed.', 'error');
        navigate(`/order/${order.id}`);
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not place order.', 'error'),
  });

  const needsSlot = type === 'grocery' && deliveryMode === 'scheduled';
  const canPlace =
    !!cart.data &&
    cart.data.items.length > 0 &&
    !!addressId &&
    (!needsSlot || !!selectedSlot) &&
    !placeOrder.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-neutral-900">Checkout</h1>
        <p className="text-sm text-neutral-500">{type === 'grocery' ? 'Grocery order' : 'Food order'}</p>
      </div>

      {cart.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {cart.isError && <ErrorState title="Couldn't load checkout" action={{ label: 'Retry', onClick: () => cart.refetch() }} />}

      {!cart.isLoading && !cart.isError && (!cart.data || cart.data.items.length === 0) && (
        <EmptyState
          title="Your cart is empty"
          description="Add items before checking out."
          action={{ label: 'Go to cart', onClick: () => navigate('/cart') }}
        />
      )}

      {cart.data && cart.data.items.length > 0 && (
        <>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900">Delivery address</h2>
              <Link
                to={`/${type}/profile/addresses`}
                className="flex items-center gap-0.5 text-xs font-semibold text-brand-600"
              >
                <Plus className="h-3.5 w-3.5" /> Add new
              </Link>
            </div>

            {addresses.isLoading && <Skeleton className="h-20 w-full rounded-2xl" />}

            {!addresses.isLoading && addresses.data && addresses.data.length === 0 && (
              <Card className="flex items-center gap-2 p-4 text-sm text-neutral-500">
                <MapPin className="h-4 w-4 text-neutral-300" /> No saved addresses. Add one first.
              </Card>
            )}

            {addresses.data && addresses.data.length > 0 && (
              <div className="space-y-2">
                {addresses.data.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedAddressId(a.id);
                      // Same choice the home header displays — keep both sides.
                      setLocation(locationFromAddress(a), a.id);
                      setDeliveryAddress.mutate({
                        addressId: a.id,
                        type,
                        deliveryMode: type === 'grocery' && deliveryMode === 'scheduled' ? 'scheduled' : 'instant',
                      });
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
                      addressId === a.id
                        ? type === 'grocery'
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-food-600 bg-food-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                        addressId === a.id
                          ? type === 'grocery'
                            ? 'border-brand-600'
                            : 'border-food-600'
                          : 'border-neutral-300'
                      )}
                    >
                      {addressId === a.id && (
                        <span className={cn('h-2.5 w-2.5 rounded-full', type === 'grocery' ? 'bg-brand-600' : 'bg-food-600')} />
                      )}
                    </span>
                    <span>
                      <span className="mb-0.5 flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-900">{a.label}</span>
                        {a.is_default && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                            Default
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {a.address_line_1}
                        {a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city} {a.postal_code}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <PaymentSelection type={type} payMethod={payMethod} setPayMethod={setPayMethod} walletBalance={wallet.data?.balance} />

          <CouponCard
            type={type}
            couponCode={cart.data.coupon_code}
            onOpen={() => setCouponOpen(true)}
            onRemove={() => removeCoupon.mutate()}
          />

          <BillSummary
            cart={cart.data}
            feePending={setDeliveryAddress.isPending}
            scheduledDelivery={type === 'grocery' && deliveryMode === 'scheduled'}
          />

          <div className="sticky bottom-[calc(var(--bottom-dock-h)+var(--spacing)*4)] z-30">
            <div className="mx-auto max-w-2xl">
              {!addressId && (
                <p className="mb-2 rounded-xl bg-brand-50 px-3 py-2 text-center text-[13px] font-semibold text-brand-700">
                  Add a delivery address to place your order.
                </p>
              )}
              <Card className="flex items-center justify-between gap-4 border-brand-200 bg-white p-3 shadow-lg">
                <div>
                  <p className="text-xs text-neutral-500">Total to pay</p>
                  {setDeliveryAddress.isPending ? (
                    <p className="text-sm font-extrabold text-neutral-400">Calculating...</p>
                  ) : (
                    <p className="text-lg font-extrabold text-neutral-900">
                      <Price value={cart.data.total} />
                    </p>
                  )}
                </div>
                <Button onClick={() => placeOrder.mutate()} disabled={!canPlace} className="px-6" variant={type === 'grocery' ? 'default' : 'accent'}>
                  {placeOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Place Order
                </Button>
              </Card>
            </div>
          </div>

          <BottomSheet title="Apply coupon" open={couponOpen} onOpenChange={setCouponOpen}>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!code.trim()) return;
                applyCoupon.mutate(code.trim(), {
                  onSuccess: () => {
                    toast('Coupon applied');
                    setCode('');
                    setCouponOpen(false);
                  },
                  onError: () => toast('Invalid coupon code', 'error'),
                });
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter coupon code"
                className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm uppercase tracking-wider placeholder:normal-case focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <Button type="submit" className="w-full" disabled={!code.trim()}>
                Apply
              </Button>
            </form>
          </BottomSheet>
        </>
      )}
    </div>
  );
}

function PaymentSelection({
  type,
  payMethod,
  setPayMethod,
  walletBalance,
}: {
  type: OrderType;
  payMethod: PayMethod;
  setPayMethod: (m: PayMethod) => void;
  walletBalance?: string;
}) {
  const options: { value: PayMethod; label: string; desc: string; icon: typeof WalletIcon }[] = [
    { value: 'wallet', label: `${getBranding().name} Wallet`, desc: walletBalance ? `Balance ${walletBalance}` : 'Pay from wallet', icon: WalletIcon },
    { value: 'cash_on_delivery', label: 'Cash on delivery', desc: 'Pay when you receive', icon: Banknote },
    { value: 'online', label: 'Card / UPI', desc: 'Pay securely online', icon: CreditCard },
  ];

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-neutral-900">Payment method</h2>
      <div className="space-y-2">
        {options.map((o) => {
          const Icon = o.icon;
          const active = payMethod === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setPayMethod(o.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                active
                  ? type === 'grocery'
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-food-600 bg-food-50'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  active ? (type === 'grocery' ? 'bg-brand-600 text-white' : 'bg-food-600 text-white') : 'bg-neutral-100 text-neutral-500'
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-neutral-900">{o.label}</span>
                <span className="block text-xs text-neutral-500">{o.desc}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-neutral-300" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CouponCard({
  type,
  couponCode,
  onOpen,
  onRemove,
}: {
  type: OrderType;
  couponCode: string | null;
  onOpen: () => void;
  onRemove: () => void;
}) {
  void type;
  return (
    <Card className="p-4">
      <button onClick={onOpen} className="flex w-full items-center justify-between text-sm font-semibold text-brand-700">
        <span>{couponCode ? `Coupon applied: ${couponCode}` : 'Apply a coupon'}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
      {couponCode && (
        <button onClick={onRemove} className="mt-2 text-xs font-medium text-danger hover:underline">
          Remove coupon
        </button>
      )}
    </Card>
  );
}

function BillSummary({
  cart,
  feePending,
  scheduledDelivery,
}: {
  cart: NonNullable<Awaited<ReturnType<typeof repositories.cart.getByType>>>;
  feePending?: boolean;
  scheduledDelivery?: boolean;
}) {
  const packagingFee = parseFloat(cart.packaging_fee ?? '0');
  const handlingFee = parseFloat(cart.handling_fee ?? '0');
  const deliveryIsFree = parseFloat(cart.delivery_fee) === 0;

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-bold text-neutral-900">Order summary</h2>
      <div className="space-y-1.5 text-sm">
        <Row label="Item subtotal" value={cart.subtotal} />
        {parseFloat(cart.discount) > 0 && <Row label="Coupon discount" value={`-${cart.discount}`} tone="text-success" />}
        {parseFloat(cart.tax) > 0 && <Row label="Taxes" value={cart.tax} />}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Delivery fee</span>
          {feePending ? (
            <span className="font-medium text-neutral-400">Calculating...</span>
          ) : (
            <span className="font-medium text-neutral-800">
              {deliveryIsFree && scheduledDelivery ? (
                <span className="font-semibold text-success">FREE</span>
              ) : (
                <Price value={cart.delivery_fee} size="sm" />
              )}
            </span>
          )}
        </div>
        {!feePending && packagingFee > 0 && <Row label="Packaging charge" value={cart.packaging_fee ?? '0'} />}
        {!feePending && handlingFee > 0 && <Row label="Handling fee" value={cart.handling_fee ?? '0'} />}
        {!feePending && parseFloat(cart.delivery_gst_amount) > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Delivery GST ({Number(cart.delivery_gst_percent)}%)</span>
            <span className="font-medium text-neutral-800">
              <Price value={cart.delivery_gst_amount} size="sm" />
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
          <span className="font-bold text-neutral-900">To pay</span>
          {feePending ? (
            <span className="text-lg font-extrabold text-neutral-400">Calculating...</span>
          ) : (
            <span className="text-lg font-extrabold text-neutral-900">
              <Price value={cart.total} />
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={cn('font-medium text-neutral-800', tone)}>
        <Price value={value} size="sm" />
      </span>
    </div>
  );
}