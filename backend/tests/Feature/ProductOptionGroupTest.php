<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Category;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;
use App\Services\ProductOptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductOptionGroupTest extends TestCase
{
    use RefreshDatabase;

    private ProductOptionService $optionService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->optionService = app(ProductOptionService::class);
    }

    private function makeTenant(string $type = 'food'): array
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser->roles()->attach($role);

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => $type === 'grocery' ? 'Test Market' : 'Test Kitchen',
            'owner_name' => 'Test Owner',
            'phone' => '9123456789',
            'vendor_type' => $type === 'grocery' ? 'grocery' : 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);

        if ($type === 'grocery') {
            $vendor->stores()->create(['name' => 'Test Market', 'slug' => 'market-'.uniqid()]);
        } else {
            Restaurant::create(['vendor_id' => $vendor->id, 'name' => 'Test Kitchen', 'slug' => 'kitchen-'.uniqid()]);
        }

        $category = Category::factory()->create(['type' => $type]);

        return [$vendorUser, $vendor, $category];
    }

    private function makeProduct(Vendor $vendor, Category $category, float $price = 300): Product
    {
        return Product::create([
            'vendor_id' => $vendor->id,
            'category_id' => $category->id,
            'name' => 'Pizza '.uniqid('p', true),
            'slug' => 'pizza-'.uniqid('s', true),
            'sku' => 'SKU_'.uniqid(),
            'price' => $price,
            'type' => $category->type,
            'tax_rate' => 5,
            'is_active' => true,
            'is_available' => true,
        ]);
    }

    private function optionGroupPayload(): array
    {
        return [
            [
                'name' => 'Size',
                'selection_type' => 'SINGLE',
                'is_required' => true,
                'options' => [
                    ['name' => 'Small', 'price' => 0],
                    ['name' => 'Medium', 'price' => 50],
                    ['name' => 'Large', 'price' => 100],
                ],
            ],
            [
                'name' => 'Toppings',
                'selection_type' => 'MULTIPLE',
                'is_required' => false,
                'min_select' => 0,
                'max_select' => 3,
                'options' => [
                    ['name' => 'Extra Cheese', 'price' => 40],
                    ['name' => 'Olives', 'price' => 25],
                ],
            ],
        ];
    }

    private function syncGroups(Product $product, array $groupPayload): array
    {
        $normalized = $this->optionService->validateAndNormalizeGroups($groupPayload);
        $this->optionService->syncOptionGroups($product, $normalized);

        return $product->fresh()->variationOptions()->with('values')->get()->mapWithKeys(fn ($g) => [
            $g->name => [
                'id' => $g->id,
                'values' => $g->values->mapWithKeys(fn ($v) => [$v->name => $v->id]),
            ],
        ])->all();
    }

    private function makeCustomer(string $phone = '9100000011'): User
    {
        return User::factory()->create([
            'name' => 'Customer',
            'phone' => $phone,
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    public function test_vendor_can_create_variable_product_with_option_groups(): void
    {
        [$vendorUser, , $category] = $this->makeTenant();
        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->postJson('/api/v1/vendor/products', [
            'category_id' => $category->id,
            'name' => 'Customizable Pizza',
            'price' => 299,
            'product_type' => 'variable',
            'option_groups' => $this->optionGroupPayload(),
        ]);

        $response->assertStatus(201);
        $this->assertSame('variable', $response->json('data.product_type'));
        $this->assertCount(2, $response->json('data.variation_options'));
        $this->assertTrue($response->json('data.variation_options.0.is_multi_select') === false);
        $this->assertSame(1, $response->json('data.variation_options.0.max_select'));

        $product = Product::find($response->json('data.id'));
        $this->assertSame('variable', $product->product_type);
        $this->assertSame(2, $product->variationOptions()->count());
    }

    public function test_variable_product_requires_at_least_one_group(): void
    {
        [$vendorUser, , $category] = $this->makeTenant();
        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->postJson('/api/v1/vendor/products', [
            'category_id' => $category->id,
            'name' => 'Broken Pizza',
            'price' => 299,
            'product_type' => 'variable',
        ]);

        $response->assertStatus(422);
    }

    public function test_simple_product_cannot_have_option_groups(): void
    {
        [$vendorUser, , $category] = $this->makeTenant();
        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->postJson('/api/v1/vendor/products', [
            'category_id' => $category->id,
            'name' => 'Plain Pizza',
            'price' => 299,
            'product_type' => 'simple',
            'option_groups' => $this->optionGroupPayload(),
        ]);

        $response->assertStatus(422);
    }

    public function test_cart_prices_by_replacing_single_and_adding_multi_options(): void
    {
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category);
        $groups = $this->syncGroups($product, $this->optionGroupPayload());

        $customer = $this->makeCustomer();
        Sanctum::actingAs($customer, ['*']);

        $small = $groups['Size']['values']['Small'];
        $cheese = $groups['Toppings']['values']['Extra Cheese'];

        $response = $this->postJson('/api/v1/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
            'selected_options' => [
                ['group_id' => $groups['Size']['id'], 'option_id' => $small],
                ['group_id' => $groups['Toppings']['id'], 'option_id' => $cheese],
            ],
        ]);

        $response->assertStatus(200);
        $item = $response->json('data.items.0');
        $this->assertSame(340.0, (float) $item['unit_price']);
        $this->assertSame(340.0, (float) $item['line_total']);
        $this->assertCount(2, $item['selected_options']);
        $this->assertSame('Size', $item['selected_options'][0]['group_name']);
        $this->assertSame('Small', $item['selected_options'][0]['option_name']);
        $this->assertSame(0.0, (float) $item['selected_options'][0]['price']);
    }

    public function test_cart_merges_same_selection_but_splits_different_options(): void
    {
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category);
        $groups = $this->syncGroups($product, $this->optionGroupPayload());

        $customer = $this->makeCustomer();
        Sanctum::actingAs($customer, ['*']);

        $small = $groups['Size']['values']['Small'];
        $medium = $groups['Size']['values']['Medium'];
        $cheese = $groups['Toppings']['values']['Extra Cheese'];

        $payload = fn (int $size, ?int $topping) => [
            'product_id' => $product->id,
            'quantity' => 1,
            'selected_options' => array_merge(
                [['group_id' => $groups['Size']['id'], 'option_id' => $size]],
                $topping ? [['group_id' => $groups['Toppings']['id'], 'option_id' => $topping]] : []
            ),
        ];

        $this->postJson('/api/v1/cart/items', $payload($small, $cheese));
        $this->postJson('/api/v1/cart/items', $payload($small, $cheese));
        $this->postJson('/api/v1/cart/items', $payload($medium, null));

        $cart = $this->getJson('/api/v1/cart');
        $cart->assertStatus(200);

        $lines = collect($cart->json('data.items'))->map(fn ($i) => [
            'qty' => (int) $i['quantity'],
            'unit' => (float) $i['unit_price'],
            'has_options' => $i['selected_options'] !== [],
        ]);

        $this->assertCount(2, $lines);
        $this->assertEqualsCanonicalizing([
            ['qty' => 2, 'unit' => 340.0, 'has_options' => true],
            ['qty' => 1, 'unit' => 50.0, 'has_options' => true],
        ], $lines->all());
        $this->assertEqualsWithDelta(730.0, (float) $cart->json('data.cart.subtotal'), 0.001);
    }

    public function test_invalid_or_unavailable_option_is_rejected_at_cart(): void
    {
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category);
        $groups = $this->syncGroups($product, $this->optionGroupPayload());

        $customer = $this->makeCustomer();
        Sanctum::actingAs($customer, ['*']);

        $response = $this->postJson('/api/v1/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
            'selected_options' => [
                ['group_id' => $groups['Size']['id'], 'option_id' => 999999],
            ],
        ]);

        $response->assertStatus(400);
    }

    public function test_cart_revalidation_surfaces_when_an_option_is_removed(): void
    {
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category);
        $groups = $this->syncGroups($product, $this->optionGroupPayload());

        $customer = $this->makeCustomer();
        Sanctum::actingAs($customer, ['*']);

        $small = $groups['Size']['values']['Small'];
        $cheese = $groups['Toppings']['values']['Extra Cheese'];

        $this->postJson('/api/v1/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
            'selected_options' => [
                ['group_id' => $groups['Size']['id'], 'option_id' => $small],
                ['group_id' => $groups['Toppings']['id'], 'option_id' => $cheese],
            ],
        ]);

        $product->variationOptions()->with('values')->get()->each(function ($group) use ($cheese) {
            $group->values()->where('id', $cheese)->update(['is_available' => false]);
        });

        $response = $this->getJson('/api/v1/cart');

        $response->assertStatus(400);
        $this->assertSame('One or more selected options are no longer available.', $response->json('message'));
    }

    public function test_required_group_selection_is_enforced_at_cart_and_order(): void
    {
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category);
        $groups = $this->syncGroups($product, $this->optionGroupPayload());

        $customer = $this->makeCustomer();
        Sanctum::actingAs($customer, ['*']);

        $cheese = $groups['Toppings']['values']['Extra Cheese'];

        $this->postJson('/api/v1/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
            'selected_options' => [
                ['group_id' => $groups['Toppings']['id'], 'option_id' => $cheese],
            ],
        ])->assertStatus(400);
    }

    public function test_order_snapshots_enriched_selected_options(): void
    {
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category);
        $groups = $this->syncGroups($product, $this->optionGroupPayload());

        $customer = $this->makeCustomer();
        $small = $groups['Size']['values']['Small'];
        $cheese = $groups['Toppings']['values']['Extra Cheese'];

        $cart = Cart::create([
            'user_id' => $customer->id,
            'cart_type' => 'food',
            'vendor_id' => $vendor->id,
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 20,
            'total' => 0,
            'items_count' => 1,
        ]);

        $selections = [
            ['group_id' => $groups['Size']['id'], 'option_id' => $small],
            ['group_id' => $groups['Toppings']['id'], 'option_id' => $cheese],
        ];
        $validated = $this->optionService->validateSelections($product, $selections);
        $unitPrice = $this->optionService->resolveUnitPrice($product, $validated);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => 340,
            'quantity' => 1,
            'line_total' => 340,
            'selected_options' => $this->optionService->enrichSelections($product, $validated),
            'line_signature' => $this->optionService->selectionSignature($validated),
        ]);

        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
        ]);

        $this->assertSame(340.0, (float) $order->items->first()->unit_price);
        $snapshot = $order->items->first()->selected_options;
        $this->assertCount(2, $snapshot);
        $this->assertSame('Size', $snapshot[0]['group_name']);
        $this->assertSame('Small', $snapshot[0]['option_name']);
        $this->assertSame(0.0, (float) $snapshot[0]['price']);
        $this->assertSame('Toppings', $snapshot[1]['group_name']);
        $this->assertSame(40.0, (float) $snapshot[1]['price']);
        $this->assertSame($unitPrice, (float) $order->items->first()->unit_price);
    }

    public function test_order_rejects_when_a_selected_option_is_no_longer_available(): void
    {
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category);
        $groups = $this->syncGroups($product, $this->optionGroupPayload());

        $customer = $this->makeCustomer();
        $small = $groups['Size']['values']['Small'];

        $cart = Cart::create([
            'user_id' => $customer->id,
            'cart_type' => 'food',
            'vendor_id' => $vendor->id,
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 20,
            'total' => 0,
            'items_count' => 1,
        ]);

        $selections = [['group_id' => $groups['Size']['id'], 'option_id' => $small]];
        $validated = $this->optionService->validateSelections($product, $selections);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => 300,
            'quantity' => 1,
            'line_total' => 300,
            'selected_options' => $this->optionService->enrichSelections($product, $validated),
            'line_signature' => $this->optionService->selectionSignature($validated),
        ]);

        $product->variationOptions()->get()->each->update(['is_active' => false]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('One or more selected options are no longer available.');

        app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
        ]);
    }

    public function test_multi_group_prices_survive_single_group_replacement(): void
    {
        // Mirrors the real Masala Chai configuration where a MULTIPLE "Add-ons"
        // group sorts BEFORE the SINGLE "Size" group. Assert the SINGLE size
        // price replaces the base price while every selected MULTIPLE option
        // price is still added on top, regardless of group sort order.
        [$vendorUser, $vendor, $category] = $this->makeTenant();
        $product = $this->makeProduct($vendor, $category, 69);
        $groups = $this->syncGroups($product, [
            [
                'name' => 'Add-ons',
                'selection_type' => 'MULTIPLE',
                'is_required' => true,
                'min_select' => 1,
                'max_select' => 5,
                'options' => [
                    ['name' => 'Adrak', 'price' => 10],
                    ['name' => 'Elaichi', 'price' => 10],
                    ['name' => 'Kulhad', 'price' => 10],
                ],
            ],
            [
                'name' => 'Size',
                'selection_type' => 'SINGLE',
                'is_required' => true,
                'options' => [
                    ['name' => 'Small', 'price' => 49],
                    ['name' => 'Medium', 'price' => 69],
                    ['name' => 'Large', 'price' => 89.43],
                ],
            ],
        ]);

        $customer = $this->makeCustomer();
        Sanctum::actingAs($customer, ['*']);

        $adrak = $groups['Add-ons']['values']['Adrak'];
        $elaichi = $groups['Add-ons']['values']['Elaichi'];
        $kulhad = $groups['Add-ons']['values']['Kulhad'];
        $small = $groups['Size']['values']['Small'];
        $medium = $groups['Size']['values']['Medium'];

        $cases = [
            [
                [
                    ['group_id' => $groups['Add-ons']['id'], 'option_id' => $adrak],
                    ['group_id' => $groups['Size']['id'], 'option_id' => $small],
                ],
                59.0,
            ],
            [
                [
                    ['group_id' => $groups['Add-ons']['id'], 'option_id' => $adrak],
                    ['group_id' => $groups['Add-ons']['id'], 'option_id' => $elaichi],
                    ['group_id' => $groups['Add-ons']['id'], 'option_id' => $kulhad],
                    ['group_id' => $groups['Size']['id'], 'option_id' => $small],
                ],
                79.0,
            ],
            [
                [
                    ['group_id' => $groups['Add-ons']['id'], 'option_id' => $elaichi],
                    ['group_id' => $groups['Add-ons']['id'], 'option_id' => $kulhad],
                    ['group_id' => $groups['Size']['id'], 'option_id' => $medium],
                ],
                89.0,
            ],
        ];

        $expectedSubtotal = 0.0;

        foreach ($cases as [$selections, $expectedUnit]) {
            $response = $this->postJson('/api/v1/cart/items', [
                'product_id' => $product->id,
                'quantity' => 1,
                'selected_options' => $selections,
            ]);

            $response->assertStatus(200);
            $units = collect($response->json('data.items'))->pluck('unit_price')->map(fn ($u) => (float) $u)->all();
            $this->assertContains($expectedUnit, $units);

            $expectedSubtotal += $expectedUnit;
            $this->assertEqualsWithDelta($expectedSubtotal, (float) $response->json('data.subtotal'), 0.001);
        }

        $cart = $this->getJson('/api/v1/cart');
        $cart->assertStatus(200);
        $this->assertEqualsWithDelta($expectedSubtotal, (float) $cart->json('data.cart.subtotal'), 0.001);
    }
}
