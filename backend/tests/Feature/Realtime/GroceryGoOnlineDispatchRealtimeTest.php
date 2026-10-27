<?php

namespace Tests\Feature\Realtime;

use App\Infrastructure\Interfaces\RealtimeProviderInterface;
use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Regression guard for the grocery go-online dispatch + realtime push.
 *
 * A grocery order marked READY while no eligible partner was online must be
 * offered the moment an eligible grocery partner goes online — and announced
 * on that partner's private channel (`private-delivery_partner.{id}`), never
 * on any other grocery partner's channel. This was broken by a pending
 * migration that left `delivery_partners` missing the `heading`/`speed`/
 * `accuracy` columns the location update writes, so the partner never went
 * online → no fresh location → DispatchLog::createOfferBatch() found nobody.
 */
class GroceryGoOnlineDispatchRealtimeTest extends TestCase
{
    use RefreshDatabase;

    private RealtimeProviderInterface $realtime;

    protected function setUp(): void
    {
        parent::setUp();

        // Self-contained in-memory recorder. No network, no support files.
        $this->realtime = new class implements RealtimeProviderInterface
        {
            /** @var list<array{channel: string, event: string, payload: array<string, mixed>}> */
            public array $broadcasts = [];

            public function broadcast(string $channel, string $event, array $payload): bool
            {
                $this->broadcasts[] = ['channel' => $channel, 'event' => $event, 'payload' => $payload];

                return true;
            }
        };

        $this->app->instance(RealtimeProviderInterface::class, $this->realtime);
    }

    public function test_grocery_order_is_offered_in_realtime_when_partner_goes_online(): void
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);

        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($role->id);

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'GreenMart Superstore',
            'owner_name' => 'Amit Gupta',
            'phone' => '9820000000',
            'vendor_type' => 'grocery',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $store = Store::create([
            'vendor_id' => $vendor->id,
            'name' => 'GreenMart Superstore',
            'slug' => 'greenmart-'.Str::lower(Str::random(4)),
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        $order = Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'store_id' => $store->id,
            'order_type' => 'grocery',
            'address_id' => null,
            'delivery_address_snapshot' => [
                'name' => 'Home',
                'address' => '12 MG Road, Bengaluru',
                'latitude' => 12.9705,
                'longitude' => 77.5960,
            ],
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'wallet',
            'subtotal' => 300,
            'delivery_fee' => 25,
            'total_amount' => 325,
            'meta' => ['dispatch' => ['status' => 'pending']],
        ]);

        $partnerUser = User::factory()->create([
            'user_type' => 'delivery_partner',
            'is_active' => true,
        ]);
        $partnerUser->roles()->attach(
            Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner'])->id
        );

        $partner = DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'service_type' => 'grocery',
            'status' => 'approved',
            'is_online' => false,
            'is_busy' => false,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
            'last_location_at' => now()->subSeconds(30),
        ]);

        // Precondition: NO offer exists before the partner goes online.
        $this->assertNull(
            DispatchLog::where('order_id', $order->id)->first(),
            'no offer should exist before the partner goes online'
        );

        // Partner taps Go Online → this is the request that previously 500'd
        // (SQLSTATE[42S22] unknown column "heading") and never went online.
        Sanctum::actingAs($partnerUser, ['*']);
        $this->postJson('/api/v1/delivery-partner/availability')
            ->assertOk()
            ->assertJsonPath('data.is_online', true);

        // 1) A pending offer must now exist for this grocery partner.
        $offer = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $partner->id)
            ->first();

        $this->assertNotNull($offer, 'grocery offer must be created for the partner');
        $this->assertSame(DispatchLog::STATUS_PENDING, $offer->status);

        // 2) And it must be announced on the partner's realtime private channel.
        $event = collect($this->realtime->broadcasts)->firstWhere('event', 'delivery.offer-created');
        $this->assertNotNull($event, 'delivery.offer-created must be broadcast');
        $this->assertSame('private-delivery_partner.'.$partner->id, $event['channel']);

        // 3) The payload must carry the offer metadata.
        $this->assertSame($offer->id, $event['payload']['dispatch_log_id'] ?? null);
        $this->assertSame($order->id, $event['payload']['order_id'] ?? null);
        $this->assertArrayHasKey('distance_km', $event['payload']);
    }
}
