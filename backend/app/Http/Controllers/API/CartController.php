<?php

namespace App\Http\Controllers\API;

use App\Exceptions\DeliveryConfigurationException;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\CouponService;
use App\Services\Maps\ZoneService;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\Pricing\GroceryDeliveryConfigService;
use App\Services\Pricing\ZoneDeliveryConfigService;
use App\Services\ProductOptionService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CartController extends BaseController
{
    public function __construct(
        private CouponService $couponService,
        private DeliveryFeeService $deliveryFeeService,
        private GroceryDeliveryConfigService $groceryDeliveryConfig,
        private ProductOptionService $optionService,
        private ZoneService $zoneService,
        private ZoneDeliveryConfigService $zoneConfigs,
    ) {}

    public function show(Request $request)
    {
        $query = Cart::where('user_id', $request->user()->id)
            ->with(['items.product', 'items.productVariant']);

        if ($request->has('type')) {
            $query->where('cart_type', $request->type);
        }

        $cart = $query->first();

        if ($cart) {
            $invalid = $this->invalidOptionSelection($cart);

            if ($invalid) {
                return $this->error('One or more selected options are no longer available.', null, 400);
            }

            $this->recalculateCart($cart);
            $cart = $cart->fresh(['items.product', 'items.productVariant']);
        }

        return $this->success([
            'cart' => $cart,
            'items' => $cart?->items ?? [],
        ]);
    }

    public function addItem(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'product_id' => 'required|exists:products,id',
            'product_variant_id' => 'sometimes|exists:product_variants,id',
            'quantity' => 'required|integer|min:1',
            'cart_type' => 'sometimes|in:food,grocery',
            'selected_options' => 'sometimes|array',
            'selected_addons' => 'sometimes|array',
            'special_instructions' => 'sometimes|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $product = Product::find($request->product_id);

            if (! $product) {
                return $this->error('Product not found', null, 404);
            }

            if (! $product->is_active || ! $product->is_available) {
                return $this->error('Product is not available', null, 400);
            }

            $normalized = $this->optionService->normalizeSelections($request->selected_options);
            $hasOptionGroups = $product->variationOptions()->where('is_active', true)->exists();

            if ($hasOptionGroups) {
                $selections = $this->optionService->validateSelections($product, $normalized);
                $unitPrice = $this->optionService->resolveUnitPrice($product, $selections);
                $enrichedOptions = $this->optionService->enrichSelections($product, $selections);
                $signature = $this->optionService->selectionSignature($selections);
            } else {
                $unitPrice = (float) $product->price;
                if ($request->product_variant_id) {
                    $variant = ProductVariant::find($request->product_variant_id);
                    if ($variant && $variant->is_active) {
                        $unitPrice = (float) $variant->price;
                    }
                }
                $enrichedOptions = null;
                $signature = $this->optionService->selectionSignature([]);
            }

            $cartType = $request->cart_type ?? 'food';
            $vendorId = $product->vendor_id;

            $cart = Cart::firstOrCreate(
                [
                    'user_id' => $request->user()->id,
                    'cart_type' => $cartType,
                ],
                [
                    'vendor_id' => $vendorId,
                    'subtotal' => 0,
                    'discount' => 0,
                    'tax' => 0,
                    'delivery_fee' => 0,
                    'total' => 0,
                    'items_count' => 0,
                ]
            );

            if ($cart->vendor_id && $cart->vendor_id !== $vendorId && $cart->items()->exists()) {
                return $this->error('Cannot add items from a different store to the cart', null, 400);
            }

            if ($cart->vendor_id !== $vendorId) {
                $cart->update([
                    'vendor_id' => $vendorId,
                    'coupon_code' => null,
                ]);
            }

            $variantId = $request->product_variant_id ?? null;

            $existingItem = CartItem::where('cart_id', $cart->id)
                ->where('product_id', $request->product_id)
                ->where('product_variant_id', $variantId)
                ->get()
                ->first(fn ($item) => $this->signatureForItem($item) === $signature);

            if ($existingItem) {
                $existingItem->update([
                    'quantity' => $existingItem->quantity + $request->quantity,
                    'unit_price' => $unitPrice,
                    'selected_options' => $enrichedOptions,
                    'line_signature' => $signature,
                    'line_total' => round((int) $existingItem->quantity * $unitPrice, 2),
                ]);
            } else {
                CartItem::create([
                    'cart_id' => $cart->id,
                    'product_id' => $request->product_id,
                    'product_variant_id' => $variantId,
                    'unit_price' => $unitPrice,
                    'quantity' => $request->quantity,
                    'line_total' => round($unitPrice * $request->quantity, 2),
                    'selected_options' => $enrichedOptions,
                    'selected_addons' => $request->selected_addons,
                    'special_instructions' => $request->special_instructions,
                    'line_signature' => $signature,
                ]);
            }

            $this->recalculateCart($cart);

            return $this->success($cart->fresh(['items.product', 'items.productVariant']), 'Item added to cart');
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), null, 400);
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function updateItem(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $item = CartItem::where('id', $id)
                ->whereHas('cart', fn ($q) => $q->where('user_id', $request->user()->id))
                ->first();

            if (! $item) {
                return $this->error('Cart item not found', null, 404);
            }

            $item->update([
                'quantity' => $request->quantity,
                'line_total' => round($item->unit_price * $request->quantity, 2),
            ]);

            $this->recalculateCart($item->cart);

            return $this->success($item->cart->fresh(['items.product']), 'Cart updated');
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function removeItem(Request $request, $id)
    {
        try {
            $item = CartItem::where('id', $id)
                ->whereHas('cart', fn ($q) => $q->where('user_id', $request->user()->id))
                ->first();

            if (! $item) {
                return $this->error('Cart item not found', null, 404);
            }

            $cart = $item->cart;
            $item->delete();

            if ($cart->items()->count() === 0) {
                $cart->update([
                    'subtotal' => 0,
                    'tax' => 0,
                    'discount' => 0,
                    'delivery_gst_amount' => 0,
                    'total' => 0,
                    'items_count' => 0,
                    'coupon_code' => null,
                ]);

                return $this->success($cart->fresh(['items.product', 'items.productVariant']), 'Cart is now empty');
            }

            $this->recalculateCart($cart);

            return $this->success($cart->fresh(['items.product']), 'Item removed');
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function setDeliveryAddress(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'address_id' => 'nullable|integer',
            'cart_type' => 'sometimes|in:food,grocery',
            'delivery_mode' => 'sometimes|in:instant,scheduled',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $cartType = $request->cart_type ?? 'food';

            $cart = Cart::where('user_id', $request->user()->id)
                ->where('cart_type', $cartType)
                ->first();

            if (! $cart || $cart->items()->doesntExist()) {
                return $this->error('Cart is empty', null, 400);
            }

            if ($request->address_id !== null) {
                $address = $request->user()->addresses()->find($request->address_id);

                if (! $address) {
                    return $this->error('Address not found', null, 404);
                }
            }

            // An omitted mode keeps whatever the customer already selected, so
            // setting only the address cannot silently reset a Scheduled cart.
            $cart->update([
                'address_id' => $request->address_id,
                'delivery_mode' => $cart->cart_type === 'grocery'
                    ? ($request->delivery_mode ?? $cart->delivery_mode ?? GroceryDeliveryConfigService::MODE_INSTANT)
                    : GroceryDeliveryConfigService::MODE_INSTANT,
            ]);

            $this->recalculateCart($cart);

            return $this->success($cart->fresh(['items.product', 'items.productVariant']), 'Delivery address updated');
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function applyCoupon(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $cart = Cart::where('user_id', $request->user()->id)->first();

            if (! $cart || $cart->items->isEmpty()) {
                return $this->error('Cart is empty', null, 400);
            }

            $coupon = Coupon::where('code', $request->code)->first();

            if (! $coupon) {
                return $this->error('Invalid or expired coupon', null, 400);
            }

            $subtotal = Money::fromMajor($cart->subtotal);

            try {
                $this->couponService->validateForUser($coupon, $request->user(), $subtotal, [
                    'service' => $cart->cart_type,
                    'vendor_id' => $cart->vendor_id,
                    'payment_method' => null,
                    'category_ids' => $cart->items->pluck('product.category_id')->filter()->all(),
                    'product_ids' => $cart->items->pluck('product_id')->all(),
                ]);
            } catch (\Exception $e) {
                return $this->error($e->getMessage(), null, 400);
            }

            $discount = $this->couponService->calculateDiscount($coupon, $subtotal);

            $cart->update([
                'coupon_code' => $coupon->code,
            ]);

            $this->recalculateCart($cart);

            return $this->success($cart->fresh(['items.product', 'items.productVariant']), 'Coupon applied');
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function removeCoupon(Request $request)
    {
        try {
            $cart = Cart::where('user_id', $request->user()->id)->first();

            if (! $cart) {
                return $this->error('Cart not found', null, 404);
            }

            $cart->update([
                'coupon_code' => null,
            ]);

            $this->recalculateCart($cart);

            return $this->success($cart->fresh(), 'Coupon removed');
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function clear(Request $request)
    {
        try {
            Cart::where('user_id', $request->user()->id)->each(function ($cart) {
                $cart->items()->delete();
                $cart->delete();
            });

            return $this->success(null, 'Cart cleared');
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    private function invalidOptionSelection(Cart $cart): bool
    {
        foreach ($cart->items as $item) {
            $product = $item->product;

            if (! $product || ! $product->is_active || ! $product->is_available) {
                return true;
            }

            $selections = $this->optionService->normalizeSelections($item->selected_options);

            if ($selections === []) {
                continue;
            }

            try {
                $this->optionService->validateSelections($product, $selections);
            } catch (\InvalidArgumentException) {
                return true;
            }
        }

        return false;
    }

    private function signatureForItem(CartItem $item): string
    {
        return $this->optionService->selectionSignature(
            $this->optionService->normalizeSelections($item->selected_options)
        );
    }

    private function recalculateCart(Cart $cart): void
    {
        $cart->load(['items.product.variationOptions.values']);

        foreach ($cart->items as $item) {
            $product = $item->product;

            if ($product && $product->variationOptions->contains(fn ($group) => $group->is_active)) {
                $selections = $this->optionService->normalizeSelections($item->selected_options);

                if ($selections !== []) {
                    $item->update([
                        'unit_price' => $this->optionService->resolveUnitPrice($product, $selections),
                        'selected_options' => $this->optionService->enrichSelections($product, $selections),
                        'line_signature' => $this->optionService->selectionSignature($selections),
                        'line_total' => round((float) $this->optionService->resolveUnitPrice($product, $selections) * $item->quantity, 2),
                    ]);

                    continue;
                }
            }

            $item->update(['line_signature' => $this->optionService->selectionSignature([])]);
        }

        $subtotal = (float) $cart->items->sum('line_total');
        $tax = 0.0;

        $discountPaise = 0;
        $couponCode = $cart->coupon_code;

        if ($couponCode) {
            $coupon = Coupon::where('code', $couponCode)->first();

            if ($coupon && $cart->user) {
                try {
                    $this->couponService->validateForUser($coupon, $cart->user, Money::fromMajor($subtotal), [
                        'service' => $cart->cart_type,
                        'vendor_id' => $cart->vendor_id,
                        'payment_method' => null,
                        'category_ids' => $cart->items->pluck('product.category_id')->filter()->all(),
                        'product_ids' => $cart->items->pluck('product_id')->all(),
                    ]);
                    $discountPaise = $this->couponService->calculateDiscount($coupon, Money::fromMajor($subtotal))->paise();
                } catch (\Exception $e) {
                    $couponCode = null;
                }
            } else {
                $couponCode = null;
            }
        }

        $deliveryDistance = null;
        $deliveryZone = null;
        $deliveryAddress = null;

        if ($cart->vendor?->latitude !== null && $cart->vendor?->longitude !== null) {
            $deliveryAddress = $cart->address_id
                ? $cart->user?->addresses()->find($cart->address_id)
                : null;

            $deliveryAddress ??= $cart->user?->addresses()
                ->where('is_default', true)
                ->first()
                ?? $cart->user?->addresses()->first();

            if ($deliveryAddress?->latitude !== null && $deliveryAddress?->longitude !== null) {
                $deliveryDistance = $this->deliveryFeeService->distanceKm(
                    (float) $cart->vendor->latitude,
                    (float) $cart->vendor->longitude,
                    (float) $deliveryAddress->latitude,
                    (float) $deliveryAddress->longitude,
                );

                // The delivery DESTINATION decides which zone's configuration
                // prices this cart. A client-supplied zone is never consulted.
                $deliveryZone = $this->zoneService->resolve(
                    (float) $deliveryAddress->latitude,
                    (float) $deliveryAddress->longitude,
                    $cart->cart_type
                );
            }
        }

        // Without a destination we cannot resolve a mandatory zone config. Keep
        // the cart usable (no delivery line yet) and require an address at
        // checkout; do NOT silently price the cart with global settings.
        $pricingUnavailable = $deliveryAddress?->latitude === null
            || $deliveryAddress?->longitude === null;

        $pricingUnavailable = $pricingUnavailable && $this->zoneConfigs->zonesConfigured();

        // Grocery resolves through the Instant/Scheduled configuration so the cart
        // preview matches what checkout will charge. Food adds its own configured
        // packaging/handling line items on top of the unchanged distance fee.
        $pricingConfig = null;
        $foodSettings = null;

        if ($pricingUnavailable) {
            $deliveryFee = 0.0;
            $deliveryGstPercent = 0.0;
            $packagingFee = 0.0;
            $handlingFee = 0.0;
        } elseif ($cart->cart_type === 'grocery') {
            $config = $this->groceryDeliveryConfig->resolve(
                $cart->delivery_mode === GroceryDeliveryConfigService::MODE_SCHEDULED
                    ? GroceryDeliveryConfigService::MODE_SCHEDULED
                    : GroceryDeliveryConfigService::MODE_INSTANT,
                $deliveryZone
            );
            $pricingConfig = $config;

            $deliveryFee = $this->groceryDeliveryConfig->customerDeliveryFee(
                $this->deliveryFeeService,
                $config,
                $subtotal,
                $deliveryDistance
            );
            $deliveryGstPercent = (float) $config['gst_percent'];
            $packagingFee = round((float) $config['packaging_charge'], 2);
            $handlingFee = round((float) $config['handling_fee'], 2);
        } else {
            $foodSettings = $this->deliveryFeeService->settings($cart->cart_type, $deliveryZone);
            $deliveryFee = $this->deliveryFeeService->calculateWithSettings($foodSettings, $subtotal, $deliveryDistance);
            $deliveryGstPercent = (float) $foodSettings['gst_percent'];
            $charges = $this->deliveryFeeService->serviceCharges($cart->cart_type, $deliveryZone);
            $packagingFee = $charges['packaging_charge'];
            $handlingFee = $charges['handling_fee'];
        }

        $discount = $discountPaise / 100;

        $deliveryGstAmount = round($deliveryFee * $deliveryGstPercent / 100, 2);

        $total = round($subtotal + $tax + $deliveryFee + $deliveryGstAmount + $packagingFee + $handlingFee - $discount, 2);

        // Freeze the quote the customer is looking at. Order creation resolves
        // the zone and configuration again; if either moved, the order is
        // rejected with a "refresh your cart" message instead of silently
        // charging a price the customer never saw.
        $quoteModule = $cart->cart_type === 'grocery' ? 'grocery' : 'food';
        $quoteMode = $cart->cart_type === 'grocery'
            ? ($cart->delivery_mode === GroceryDeliveryConfigService::MODE_SCHEDULED
                ? 'scheduled'
                : 'instant')
            : 'standard';

        $zoneConfig = $pricingUnavailable
            ? null
            : $this->zoneConfigs->find($deliveryZone, $quoteModule, $quoteMode);

        if ($pricingUnavailable) {
            $freeReason = null;
        } elseif ($pricingConfig !== null && ($pricingConfig['scheduled_delivery_type'] ?? null) === 'free') {
            $freeReason = 'scheduled_free';
        } else {
            $quoteSettings = $pricingConfig !== null
                ? [
                    'per_km' => (float) $pricingConfig['per_km'],
                    'free_above' => $pricingConfig['free_above'],
                    'free_km' => $pricingConfig['free_km'],
                    'gst_percent' => (float) $pricingConfig['gst_percent'],
                ]
                : $foodSettings;

            $freeReason = $this->deliveryFeeService
                ->explainWithSettings($quoteSettings, $subtotal, $deliveryDistance)['reason'];
        }

        $pricingQuote = [
            'version' => 1,
            'priced_at' => now()->toIso8601String(),
            'module' => $quoteModule,
            'delivery_mode' => $quoteMode,
            'zone' => $deliveryZone === null ? null : [
                'id' => $deliveryZone->id,
                'name' => $deliveryZone->name,
            ],
            'config_source' => $pricingUnavailable
                ? 'address_required'
                : ($pricingConfig['config_source'] ?? $zoneConfig['source'] ?? ZoneDeliveryConfigService::SOURCE_GLOBAL),
            'requires_delivery_address' => $pricingUnavailable,
            'zone_config_id' => $pricingConfig['zone_config_id'] ?? $zoneConfig['id'] ?? null,
            'distance_km' => $deliveryDistance,
            'subtotal' => $subtotal,
            'delivery_fee' => $deliveryFee,
            'delivery_gst_percent' => $deliveryGstPercent,
            'delivery_gst_amount' => $deliveryGstAmount,
            'packaging_fee' => $packagingFee,
            'handling_fee' => $handlingFee,
            'total' => max(0, $total),
            'free_delivery_applied' => ! $pricingUnavailable && $deliveryFee <= 0.0,
            'free_delivery_reason' => $freeReason,
            'resolved_settings' => $pricingUnavailable
                ? null
                : ($pricingConfig !== null
                    ? [
                        'per_km' => (float) $pricingConfig['per_km'],
                        'admin_per_km' => (float) $pricingConfig['admin_per_km'],
                        'admin_per_parcel' => $pricingConfig['admin_per_parcel'],
                        'free_above' => $pricingConfig['free_above'],
                        'free_km' => $pricingConfig['free_km'],
                        'gst_percent' => (float) $pricingConfig['gst_percent'],
                        'packaging_charge' => (float) $pricingConfig['packaging_charge'],
                        'handling_fee' => (float) $pricingConfig['handling_fee'],
                    ]
                    : $foodSettings),
        ];

        $cart->update([
            'subtotal' => $subtotal,
            'tax' => $tax,
            'discount' => round($discount, 2),
            'coupon_code' => $couponCode,
            'delivery_fee' => $deliveryFee,
            'delivery_gst_percent' => $deliveryGstPercent,
            'delivery_gst_amount' => $deliveryGstAmount,
            'packaging_fee' => $packagingFee,
            'handling_fee' => $handlingFee,
            'pricing_quote' => $pricingQuote,
            'total' => max(0, $total),
            'items_count' => $cart->items->sum('quantity'),
        ]);
    }
}
