<?php

namespace App\Services;

use App\Exceptions\DeliveryConfigurationException;
use App\Jobs\BroadcastOrderTracking;
use App\Models\Cart;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;
use App\Services\Integration\WebhookNotifier;
use App\Services\Maps\ZoneService;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\Pricing\GroceryDeliveryConfigService;
use App\Services\Pricing\ZoneDeliveryConfigService;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        private WalletService $walletService,
        private WebhookNotifier $webhookNotifier,
        private CouponService $couponService,
        private InventoryService $inventoryService,
        private DeliveryService $deliveryService,
        private ZoneService $zoneService,
        private DeliveryFeeService $deliveryFeeService,
        private GroceryDeliveryConfigService $groceryDeliveryConfig,
        private ZoneDeliveryConfigService $zoneConfigs,
        private ProductOptionService $optionService,
        private DeliverySlotService $deliverySlotService,
    ) {}

    public function createOrder(User $user, array $data): Order
    {
        return DB::transaction(function () use ($user, $data) {
            $idempotencyKey = $data['idempotency_key'] ?? null;
            $fingerprint = $idempotencyKey ? $this->fingerprint($data) : null;

            if ($idempotencyKey) {
                $existing = Order::where('user_id', $user->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();

                if ($existing) {
                    $this->assertFingerprintMatches($existing, $fingerprint, $idempotencyKey);

                    return $existing->load('items');
                }
            }

            $cart = Cart::where('user_id', $user->id)
                ->where('cart_type', $data['order_type'] ?? 'food')
                ->with('items.product', 'items.productVariant')
                ->first();

            if (! $cart || $cart->items->isEmpty()) {
                throw new \Exception('Cart is empty');
            }

            $vendorId = $cart->vendor_id;
            $orderType = $cart->cart_type;
            $restaurantId = null;
            $storeId = null;

            $subtotal = 0;
            $taxAmount = 0.0;
            $orderItems = [];
            foreach ($cart->items as $cartItem) {
                $product = Product::lockForUpdate()->find($cartItem->product_id);

                if (! $product || ! $product->is_active || ! $product->is_available) {
                    throw new \Exception("Product \"{$product->name}\" is no longer available");
                }

                if ($product->restaurant_id && ! $restaurantId) {
                    $restaurantId = $product->restaurant_id;
                }
                if ($product->store_id && ! $storeId) {
                    $storeId = $product->store_id;
                }

                $unitPrice = (float) $product->price;

                if ($cartItem->product_variant_id) {
                    $variant = ProductVariant::lockForUpdate()->find($cartItem->product_variant_id);
                    if ($variant && $variant->is_active) {
                        $unitPrice = (float) $variant->price;
                    }
                }

                $optionsSnapshot = $cartItem->selected_options;

                $selections = $this->optionService->normalizeSelections($cartItem->selected_options);

                if ($selections !== []) {
                    $validated = $this->optionService->validateSelections($product, $selections);
                    $unitPrice = $this->optionService->resolveUnitPrice($product, $validated);
                    $optionsSnapshot = $this->optionService->enrichSelections($product, $validated);
                }

                $quantity = (int) $cartItem->quantity;
                $lineTotal = round($unitPrice * $quantity, 2);

                $productTaxRate = (float) ($product->tax_rate ?? 0);
                if ($productTaxRate > 0) {
                    $taxAmount += $this->extractInclusiveTax($lineTotal, $productTaxRate);
                }

                $orderItems[] = [
                    'product_id' => $product->id,
                    'product_variant_id' => $cartItem->product_variant_id,
                    'product_name' => $product->name,
                    'product_image' => $product->image,
                    'sku' => $product->sku,
                    'unit_price' => $unitPrice,
                    'price_snapshot' => $unitPrice,
                    'quantity' => $quantity,
                    'line_total' => $lineTotal,
                    'selected_options' => $optionsSnapshot,
                    'selected_addons' => $cartItem->selected_addons,
                    'special_instructions' => $cartItem->special_instructions,
                    'status' => 'pending',
                ];

                $subtotal += $lineTotal;
            }

            $taxAmount = round($taxAmount, 2);

            $vendor = Vendor::find($vendorId);

            /**
             * Grocery delivery mode. Booking is row-locked for the rest of this
             * transaction, so a rollback also rolls the capacity back and two
             * concurrent checkouts cannot both take the last place.
             */
            $meta = is_array($data['meta'] ?? null) ? $data['meta'] : [];
            $deliverySlot = null;
            $deliverySlotId = null;
            $scheduledAt = $data['scheduled_at'] ?? null;

            if ($orderType === 'grocery') {
                if (! empty($data['delivery_slot_id'])) {
                    $booking = $this->deliverySlotService->book(
                        (int) $data['delivery_slot_id'],
                        (int) $vendorId,
                        $storeId === null ? null : (int) $storeId
                    );

                    $deliverySlot = $booking['slot'];
                    $deliverySlotId = $deliverySlot->id;
                    $scheduledAt = $booking['starts_at'];
                    $meta['delivery_schedule'] = $booking['snapshot'];
                } else {
                    $meta['delivery_schedule'] = $this->deliverySlotService->asapSnapshot();
                }
            }

            // One delivery destination for the order. The id in the payload
            // must be an address the customer owns — a foreign id is a hard
            // validation error, never a silently dropped reference. When the
            // payload carries none (a stale cart, an older client) fall back to
            // the same default-address rule the cart uses, so a valid saved
            // address is not thrown away at the last step. With no usable
            // address at all the order keeps whatever validation the zone
            // configuration applies below.
            $addressId = empty($data['address_id']) ? null : (int) $data['address_id'];
            $addressSnapshot = null;

            if ($addressId !== null) {
                $address = $user->addresses()->find($addressId);

                if (! $address) {
                    throw ValidationException::withMessages([
                        'address_id' => 'The selected delivery address is invalid.',
                    ]);
                }

                $addressSnapshot = $address->toArray();
            } else {
                $fallback = $user->addresses()
                    ->where('is_default', true)
                    ->first()
                    ?? $user->addresses()->first();

                if ($fallback) {
                    $addressId = $fallback->id;
                    $addressSnapshot = $fallback->toArray();
                }
            }

            // Zones are resolved from the delivery DESTINATION before pricing so
            // the same zone that authorises the order also prices it. The client
            // never supplies a zone id, and the destination zone must have a
            // complete configuration.
            [$pickupZone, $dropZone] = $this->resolveOrderZones($orderType, $vendor, $addressSnapshot);

            // Grocery pricing is resolved from the order's own delivery mode, so a
            // scheduled slot can never be priced with the instant configuration.
            $pricing = $this->resolveDeliveryPricing(
                $orderType,
                (float) $cart->delivery_fee,
                (float) $subtotal,
                $vendor,
                $addressSnapshot,
                $orderType === 'grocery'
                    ? ($deliverySlot ? GroceryDeliveryConfigService::MODE_SCHEDULED : GroceryDeliveryConfigService::MODE_INSTANT)
                    : GroceryDeliveryConfigService::MODE_INSTANT,
                $dropZone
            );

            $deliveryFee = round((float) $pricing['delivery_fee'], 2);
            $deliveryGstPercent = (float) $pricing['delivery_gst_percent'];
            $deliveryGstAmount = round($deliveryFee * $deliveryGstPercent / 100, 2);
            $packagingFee = round((float) $pricing['packaging_fee'], 2);
            $handlingFee = round((float) $pricing['handling_fee'], 2);
            $platformFee = 0;

            // The order is authoritative, but never silently reprices a cart the
            // customer already saw. If a zone configuration changed since the
            // cart was quoted, ask the client to refresh instead.
            $this->assertCartQuoteMatches($cart, $deliveryFee, $deliveryGstAmount, $packagingFee, $handlingFee);

            $meta['delivery_pricing'] = $this->groceryDeliveryConfig->snapshot(
                $pricing['config'],
                $pricing['distance_km'] === null ? null : (float) $pricing['distance_km'],
                $deliveryFee,
                $deliveryGstPercent,
                $deliveryGstAmount,
                $packagingFee,
                $handlingFee,
                (float) $pricing['admin_delivery_cost'],
                [
                    'pricing_version' => 1,
                    'module' => $pricing['config']['module'],
                    'zone_id' => $dropZone?->id,
                    'zone_name' => $dropZone?->name,
                    'delivery_address_zone_source' => $dropZone === null ? 'bootstrap_without_zones' : 'destination_zone',
                    'free_delivery_reason' => $pricing['free_delivery_reason'],
                    'subtotal' => $subtotal,
                    'partner_rate' => $pricing['partner_rate'],
                ]
            );
            $couponDiscount = Money::zero();
            $coupon = null;
            $couponCode = null;

            if ($cart->coupon_code) {
                [$coupon, $couponDiscount] = $this->couponService->resolveForRedemption(
                    $cart->coupon_code,
                    Money::fromMajor($subtotal),
                    $user,
                    [
                        'service' => $orderType,
                        'vendor_id' => $vendorId,
                        'payment_method' => $data['payment_method'] ?? 'cash_on_delivery',
                        'category_ids' => $cart->items->pluck('product.category_id')->filter()->all(),
                        'product_ids' => $cart->items->pluck('product_id')->all(),
                    ]
                );
                $couponCode = $coupon->code;
            }

            $discountAmount = $couponDiscount->major();

            $tipAmount = (float) ($data['tip_amount'] ?? 0);
            $totalAmount = round($subtotal + $deliveryFee + $deliveryGstAmount + $packagingFee + $handlingFee + $platformFee - (float) $discountAmount + $tipAmount, 2);
            $totalAmount = max(0, $totalAmount);

            $walletUsed = 0;
            if (($data['payment_method'] ?? '') === 'wallet') {
                $walletBalance = $this->walletService->getAvailableBalance($user, 'customer')->major();
                $walletUsed = min((float) $walletBalance, $totalAmount);
                $totalAmount -= $walletUsed;
            }

            $orderPayload = [
                'order_number' => $this->generateOrderNumber(),
                'user_id' => $user->id,
                'vendor_id' => $vendorId,
                'restaurant_id' => $orderType === 'food' ? $restaurantId : null,
                'store_id' => $orderType === 'grocery' ? $storeId : null,
                'order_type' => $orderType,
                'status' => $deliverySlot ? 'SCHEDULED' : 'PENDING',
                'payment_status' => $walletUsed > 0 ? 'partial_paid' : 'pending',
                'payment_method' => $data['payment_method'] ?? 'cash_on_delivery',
            'address_id' => $addressId,
            'pickup_zone_id' => $pickupZone?->id,
                'drop_zone_id' => $dropZone?->id,
                'delivery_address_snapshot' => $addressSnapshot,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'tax_amount' => $taxAmount,
                'delivery_fee' => $deliveryFee,
                'delivery_gst_percent' => $deliveryGstPercent,
                'delivery_gst_amount' => $deliveryGstAmount,
                'packaging_fee' => $packagingFee,
                'handling_fee' => $handlingFee,
                'platform_fee' => $platformFee,
                'total_amount' => $totalAmount + $walletUsed,
                'wallet_used' => $walletUsed,
                'coupon_discount' => $couponDiscount->major(),
                'coupon_code' => $couponCode,
                'tip_amount' => $tipAmount,
                'customer_note' => $data['customer_note'] ?? null,
                'substitution_preference' => $data['substitution_preference'] ?? 'contact',
                'scheduled_at' => $scheduledAt,
                'delivery_slot_id' => $deliverySlotId,
                'timing_type' => $scheduledAt ? 'scheduled' : 'instant',
                'meta' => $meta ?: null,
                'idempotency_key' => $idempotencyKey,
                'idempotency_fingerprint' => $fingerprint,
            ];

            try {
                $order = Order::create($orderPayload);
            } catch (QueryException $e) {
                if ($idempotencyKey && $this->isUniqueViolation($e)) {
                    $existing = Order::where('user_id', $user->id)
                        ->where('idempotency_key', $idempotencyKey)
                        ->first();

                    if ($existing) {
                        $this->assertFingerprintMatches($existing, $fingerprint, $idempotencyKey);

                        return $existing->load('items');
                    }
                }

                throw $e;
            }

            foreach ($orderItems as $item) {
                $item['order_id'] = $order->id;
                OrderItem::create($item);
            }

            $this->inventoryService->reserveForOrder($order, $user->id);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'notes' => $deliverySlot
                    ? "Scheduled for {$deliverySlot->slot_date->format('Y-m-d')} {$deliverySlot->label}"
                    : 'Order placed',
                'changed_by' => $user->id,
                'changed_by_type' => 'customer',
            ]);

            if ($walletUsed > 0) {
                $this->walletService->debit(
                    $user,
                    'customer',
                    $walletUsed,
                    'DEBIT',
                    Order::class,
                    $order->id,
                    "Payment for order #{$order->order_number}",
                    'order:create:'.$order->order_number,
                    ['order_id' => $order->id]
                );
            }

            if ($coupon) {
                $this->couponService->recordRedemption($coupon, $user, $order->id, $couponDiscount, 'applied');
            }

            $cart->items()->delete();
            $cart->delete();

            $this->webhookNotifier->orderCreated($order);

            DB::afterCommit(function () use ($order) {
                BroadcastOrderTracking::dispatch($order->id, [
                    ['type' => 'order_updated'],
                    ['type' => 'vendor_order_updated'],
                ]);
            });

            return $order->load('items');
        });
    }

    public function cancelOrder(Order $order, User $user, ?string $reason = null): Order
    {
        return $this->deliveryService->cancelOrder($order, $user, $reason);
    }

    /**
     * Authoritative delivery pricing for the order.
     *
     * Grocery resolves through GroceryDeliveryConfigService so Instant and
     * Scheduled Delivery are priced from their own configuration and the
     * resolved values are frozen onto the order. Food keeps its existing
     * service-prefixed behaviour untouched.
     *
     * Falls back to the cart's stored fee when coordinates are unavailable.
     *
     * @param  array<string, mixed>|null  $addressSnapshot
     * @return array<string, mixed>
     */
    private function resolveDeliveryPricing(
        string $orderType,
        float $fallback,
        float $subtotal,
        ?Vendor $vendor,
        ?array $addressSnapshot,
        string $deliveryMode,
        ?Zone $dropZone
    ): array {
        $distanceKm = $this->resolveDeliveryDistanceKm($vendor, $addressSnapshot);

        if ($orderType !== 'grocery') {
            // Food adds its configured packaging/handling line items here. They are
            // resolved from the destination zone rather than from the cart, so the
            // order is priced authoritatively at creation time and frozen on the
            // order row. A missing row is a hard error, never a global fallback.
            $zoneConfig = $this->zoneConfigs->requireForPricing(
                $dropZone,
                ZoneDeliveryConfig::MODULE_FOOD,
                ZoneDeliveryConfig::MODE_STANDARD
            );

            $settings = [
                'per_km' => (float) $zoneConfig['per_km'],
                'free_above' => $zoneConfig['free_above'],
                'gst_percent' => (float) $zoneConfig['gst_percent'],
                'free_km' => $zoneConfig['free_km'],
            ];
            $charges = [
                'packaging_charge' => (float) $zoneConfig['packaging_charge'],
                'handling_fee' => (float) $zoneConfig['handling_fee'],
            ];
            $partnerRate = $this->partnerRateFromConfig($zoneConfig);

            $zoneConfig['module'] = ZoneDeliveryConfig::MODULE_FOOD;
            $zoneConfig['delivery_mode'] = ZoneDeliveryConfig::MODE_STANDARD;
            $zoneConfig['scheduled_delivery_type'] = null;

            $explained = $distanceKm === null
                ? ['fee' => $fallback, 'free' => false, 'reason' => null]
                : $this->deliveryFeeService->explainWithSettings($settings, $subtotal, $distanceKm);

            $zoneConfig['free_delivery_reason'] = $explained['reason'];

            return [
                'delivery_fee' => $explained['fee'],
                'delivery_gst_percent' => (float) $settings['gst_percent'],
                'packaging_fee' => $charges['packaging_charge'],
                'handling_fee' => $charges['handling_fee'],
                'admin_delivery_cost' => $distanceKm === null
                    ? null
                    : round((float) $zoneConfig['admin_per_km'] * $distanceKm, 2),
                'distance_km' => $distanceKm,
                'config' => $zoneConfig,
                'partner_rate' => $partnerRate,
                'free_delivery_reason' => $explained['reason'],
            ];
        }

        $config = $this->groceryDeliveryConfig->resolve($deliveryMode, $dropZone);
        $partnerRate = $this->partnerRateFromConfig($config);

        if (($config['scheduled_delivery_type'] ?? null) === 'free') {
            $config['free_delivery_reason'] = 'scheduled_free';
        } elseif ($distanceKm === null) {
            $config['free_delivery_reason'] = null;
        } else {
            $config['free_delivery_reason'] = $this->deliveryFeeService
                ->explainWithSettings([
                    'per_km' => (float) $config['per_km'],
                    'free_above' => $config['free_above'],
                    'free_km' => $config['free_km'],
                    'gst_percent' => (float) $config['gst_percent'],
                ], $subtotal, $distanceKm)['reason'];
        }

        if ($distanceKm === null) {
            // Nothing chargeable can be computed without a distance, so the cart
            // amount is kept as-is and the per-parcel funding still applies.
            return [
                'delivery_fee' => ($config['scheduled_delivery_type'] ?? null) === 'free'
                    ? 0.0
                    : $fallback,
                'delivery_gst_percent' => (float) $config['gst_percent'],
                'packaging_fee' => round((float) $config['packaging_charge'], 2),
                'handling_fee' => round((float) $config['handling_fee'], 2),
                'admin_delivery_cost' => $this->groceryDeliveryConfig->adminDeliveryCost($config, null),
                'distance_km' => null,
                'config' => $config,
                'partner_rate' => $partnerRate,
                'free_delivery_reason' => $config['free_delivery_reason'],
            ];
        }

        $deliveryFee = $this->groceryDeliveryConfig->customerDeliveryFee(
            $this->deliveryFeeService,
            $config,
            $subtotal,
            $distanceKm
        );

        return [
            'delivery_fee' => $deliveryFee,
            'delivery_gst_percent' => (float) $config['gst_percent'],
            'packaging_fee' => round((float) $config['packaging_charge'], 2),
            'handling_fee' => round((float) $config['handling_fee'], 2),
            'admin_delivery_cost' => $this->groceryDeliveryConfig->adminDeliveryCost($config, $distanceKm),
            'distance_km' => $distanceKm,
            'config' => $config,
            'partner_rate' => $partnerRate,
            'free_delivery_reason' => $config['free_delivery_reason'],
        ];
    }

    /**
     * Freeze the partner rate that belongs to the exact configuration used to
     * price the order. Scheduled Grocery short-circuits this with its per-parcel
     * admin-funded amount, but the snapshot still records the same row's values.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function partnerRateFromConfig(array $config): array
    {
        return [
            'per_km' => (float) ($config['admin_per_km'] ?? 0),
            'per_km_key' => $config['keys']['admin_per_km'] ?? null,
            'free_distance_km' => $config['free_km'] ?? null,
            'free_distance_earning' => (float) ($config['partner_free_distance_earning'] ?? 0),
            'free_distance_earning_key' => $config['keys']['partner_free_distance_earning'] ?? null,
        ];
    }

    /**
     * Order creation must not silently reprice a cart the customer already saw.
     *
     * Carts priced by the live API carry the quote they displayed. Legacy carts
     * (created directly, or before the quote existed) have no quote and skip
     * this check, which preserves their previous behaviour.
     */
    private function assertCartQuoteMatches(
        Cart $cart,
        float $deliveryFee,
        float $deliveryGstAmount,
        float $packagingFee,
        float $handlingFee
    ): void {
        $quote = $cart->pricing_quote;

        if (! is_array($quote) || (int) ($quote['version'] ?? 0) !== 1) {
            return;
        }

        // The cart had no destination when it was priced, so there is no
        // customer-facing delivery amount to protect. Order creation must now
        // resolve and price the supplied destination authoritatively.
        if (($quote['requires_delivery_address'] ?? false) === true) {
            return;
        }

        $authoritative = [
            'delivery_fee' => $deliveryFee,
            'delivery_gst_amount' => $deliveryGstAmount,
            'packaging_fee' => $packagingFee,
            'handling_fee' => $handlingFee,
        ];

        foreach ($authoritative as $field => $value) {
            if (abs((float) ($quote[$field] ?? 0) - $value) > 0.009) {
                throw DeliveryConfigurationException::quoteChanged();
            }
        }
    }

    /**
     * Vendor-to-drop delivery distance for the order, or null when either
     * endpoint is missing.
     *
     * @param  array<string, mixed>|null  $addressSnapshot
     */
    private function resolveDeliveryDistanceKm(?Vendor $vendor, ?array $addressSnapshot): ?float
    {
        $fromLat = $vendor?->latitude;
        $fromLng = $vendor?->longitude;
        $toLat = $addressSnapshot['latitude'] ?? null;
        $toLng = $addressSnapshot['longitude'] ?? null;

        if ($fromLat === null || $fromLng === null || $toLat === null || $toLng === null) {
            return null;
        }

        return $this->deliveryFeeService->distanceKm(
            (float) $fromLat,
            (float) $fromLng,
            (float) $toLat,
            (float) $toLng,
        );
    }

    /**
     * Resolve pickup (vendor) and drop (delivery address) zones and enforce
     * serviceability. Bootstrap mode (no active zones for the service) allows
     * the order and snapshots null zones, preserving pre-zone behaviour.
     *
     * The drop zone is returned to the caller so the exact same zone prices the
     * order and is snapshotted on it.
     *
     * @param  array<string, mixed>|null  $addressSnapshot
     * @return array{0: Zone|null, 1: Zone|null}
     *
     * @throws \Exception when the vendor or drop address is outside the service area
     */
    protected function resolveOrderZones(string $orderType, ?Vendor $vendor, ?array $addressSnapshot): array
    {
        $pickupZone = $vendor?->zone_id ? Zone::find($vendor->zone_id) : null;

        if ($pickupZone === null && $vendor?->latitude !== null && $vendor?->longitude !== null) {
            $pickupCheck = $this->zoneService->isServiceable(
                (float) $vendor->latitude,
                (float) $vendor->longitude,
                $orderType
            );

            if (! $pickupCheck['serviceable'] && $pickupCheck['reason'] !== ZoneService::REASON_NO_ZONE) {
                throw new \Exception('Store is outside the delivery service area');
            }

            $pickupZone = $pickupCheck['zone'] ? Zone::find($pickupCheck['zone']['id']) : null;
        }

        $dropLat = $addressSnapshot['latitude'] ?? null;
        $dropLng = $addressSnapshot['longitude'] ?? null;

        if (($dropLat === null || $dropLng === null) && $this->zoneConfigs->zonesConfigured()) {
            throw DeliveryConfigurationException::addressRequired();
        }

        $dropZone = $dropLat !== null && $dropLng !== null
            ? $this->zoneService->resolve((float) $dropLat, (float) $dropLng, $orderType)
            : null;

        // Once zones exist, every delivery must resolve to one. There is no
        // "outside all zones" or cross-zone price that could legitimately apply:
        // the destination zone is what supplies the mandatory configuration.
        if ($dropZone === null && $this->zoneConfigs->zonesConfigured()) {
            throw new \Exception('Delivery address is outside the store service area');
        }

        return [$pickupZone, $dropZone];
    }

    /**
     * Canonical, stable fingerprint of the client-supplied order payload.
     * Two requests sharing an idempotency key must produce the exact same
     * fingerprint or the second one is rejected (409 semantics).
     */
    private function fingerprint(array $data): string
    {
        $canonical = [
            'order_type' => $data['order_type'] ?? null,
            'payment_method' => $data['payment_method'] ?? null,
            'address_id' => $data['address_id'] ?? null,
            'scheduled_at' => isset($data['scheduled_at']) ? (string) $data['scheduled_at'] : null,
            'delivery_slot_id' => $data['delivery_slot_id'] ?? null,
            'coupon_code' => $data['coupon_code'] ?? null,
            'customer_note' => $data['customer_note'] ?? null,
            'substitution_preference' => $data['substitution_preference'] ?? null,
            'tip_amount' => $data['tip_amount'] ?? null,
        ];
        ksort($canonical);

        return hash('sha256', json_encode($canonical));
    }

    private function assertFingerprintMatches(Order $existing, ?string $fingerprint, ?string $idempotencyKey): void
    {
        if ($fingerprint !== null && $existing->idempotency_fingerprint !== null
            && $existing->idempotency_fingerprint !== $fingerprint) {
            throw new \Exception('Idempotency key already used with a different payload');
        }
    }

    private function generateOrderNumber(): string
    {
        return 'ORD_'.date('Ymd').'_'.strtoupper(Str::random(8));
    }

    /**
     * Product prices are tax-inclusive: the tax component of a line is
     * extracted from the line total rather than added on top of it.
     *
     * lineTotal = priceIncludingTax
     * tax = lineTotal * rate / (100 + rate)
     */
    private function extractInclusiveTax(float $lineTotal, float $taxRate): float
    {
        return round($lineTotal * $taxRate / (100 + $taxRate), 2);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        return (string) $e->getCode() === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint failed');
    }
}
