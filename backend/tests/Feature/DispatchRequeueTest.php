<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\Dispatch\OrderDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DispatchRequeueTest extends TestCase
{
    use RefreshDatabase;

    public function test_does_not_requeue_while_a_recent_attempt_exists(): void
    {
        [$vendor, $order] = $this->makeReadyOrder();
        $nearPartner = $this->makePartner(12.9717, 77.5947);
        $latePartner = $this->makePartner(0, 0);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $activeOffer = DispatchLog::where('order_id', $order->id)->where('candidate_id', $nearPartner->id)->first();
        $this->assertNotNull($activeOffer);
        $activeOffer->update(['status' => DispatchLog::STATUS_REJECTED]);

        $latePartner->update(['latitude' => 12.9718, 'longitude' => 77.5948]);

        $this->artisan('dispatch:requeue')->assertSuccessful();

        $this->assertNull(
            DispatchLog::where('order_id', $order->id)->where('candidate_id', $latePartner->id)->first()
        );
    }

    public function test_requeues_after_interval_and_offers_a_new_candidate(): void
    {
        [$vendor, $order] = $this->makeReadyOrder();
        $nearPartner = $this->makePartner(12.9717, 77.5947);
        $latePartner = $this->makePartner(0, 0);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $activeOffer = DispatchLog::where('order_id', $order->id)->where('candidate_id', $nearPartner->id)->first();
        $activeOffer->update(['status' => DispatchLog::STATUS_REJECTED]);
        $activeOffer->forceFill(['created_at' => now()->subMinutes(10)])->save();

        $latePartner->update(['latitude' => 12.9718, 'longitude' => 77.5948]);

        $this->artisan('dispatch:requeue')->assertSuccessful();

        // A rejected offer must not blacklist a partner permanently. The
        // previously-rejected nearest partner becomes the active offer again,
        // and the newly-in-range partner is queued behind it.
        $reOffered = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $nearPartner->id)
            ->where('id', '!=', $activeOffer->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($reOffered);
        $this->assertSame(DispatchLog::STATUS_PENDING, $reOffered->status);
        $this->assertNotNull($reOffered->expires_at);

        $queuedOffer = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $latePartner->id)
            ->first();

        $this->assertNotNull($queuedOffer);
        $this->assertSame(DispatchLog::STATUS_SENT, $queuedOffer->status);
    }

    public function test_requeues_an_order_whose_only_offer_expired(): void
    {
        [$vendor, $order] = $this->makeReadyOrder();
        $nearPartner = $this->makePartner(12.9717, 77.5947);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $offer = DispatchLog::where('order_id', $order->id)->where('candidate_id', $nearPartner->id)->first();
        $this->assertNotNull($offer);
        $offer->update(['status' => DispatchLog::STATUS_EXPIRED]);
        $offer->forceFill(['created_at' => now()->subMinutes(10)])->save();

        $before = DispatchLog::where('order_id', $order->id)->count();

        $this->artisan('dispatch:requeue')->assertSuccessful();

        $this->assertGreaterThan($before, DispatchLog::where('order_id', $order->id)->count());

        $reOffered = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $nearPartner->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($reOffered);
        $this->assertSame(DispatchLog::STATUS_PENDING, $reOffered->status);
    }

    public function test_requeues_order_with_no_prior_offers_when_partner_is_online_in_range(): void
    {
        [$vendor, $order] = $this->makeReadyOrder();
        $this->makePartner(12.9718, 77.5948);

        $this->artisan('dispatch:requeue')->assertSuccessful();

        $offer = DispatchLog::where('order_id', $order->id)->first();
        $this->assertNotNull($offer);
        $this->assertSame(DispatchLog::STATUS_PENDING, $offer->status);
    }

    private function makeReadyOrder(): array
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($role->id);

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Spice Villa',
            'owner_name' => 'Rahul Sharma',
            'phone' => '9898989898',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        Restaurant::create([
            'vendor_id' => $vendor->id,
            'name' => 'Spice Villa',
            'slug' => 'spice-villa',
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        $order = Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'restaurant_id' => Restaurant::where('vendor_id', $vendor->id)->value('id'),
            'order_type' => 'food',
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);

        return [$vendor, $order];
    }

    private function makePartner(float $latitude, float $longitude): DeliveryPartner
    {
        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partnerUser->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'last_location_at' => now(),
        ]);
    }
}
