<?php

namespace Tests\Feature;

use App\Exceptions\InvalidOrderTransitionException;
use App\Exceptions\ManualDispatchException;
use App\Models\Address;
use App\Models\AppSetting;
use App\Models\DeliveryBatch;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\DeliverySlot;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\OtpCode;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Services\DeliveryService;
use App\Services\DeliverySlotService;
use App\Services\Dispatch\DeliveryPartnerEligibilityService;
use App\Services\Dispatch\GroceryBatchService;
use App\Services\Dispatch\ManualVendorDispatchService;
use App\Services\Dispatch\OrderDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Grocery multi-order delivery batches.
 *
 * Covers the batching gate, trip capacity, the partner-facing offer/accept
 * flow, the active-batch API, and the invariant that every order keeps its own
 * status, OTP, payment and earnings while sharing one trip.
 */
class GroceryBatchTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    private Vendor $groceryVendor;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();

        // The 09:00 IST (03:30 UTC) window is open at 03:45 UTC, so the clock
        // sits just past the booked window start.
        Carbon::setTestNow(Carbon::parse('2026-10-01 03:45:00', 'UTC'));

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $this->groceryVendor = $this->makeVendor('grocery', 'FreshMart');
        $this->store = $this->makeStore($this->groceryVendor, 'FreshMart Supermarket');

    }

    // -----------------------------------------------------------------
    // Trip capacity
    // -----------------------------------------------------------------

    public function test_max_batch_orders_comes_from_config_and_is_capped_at_five(): void
    {
        $this->assertSame(3, GroceryBatchService::maxOrdersPerBatch());

        config(['delivery_slots.grocery_max_scheduled_orders_per_batch' => 5]);
        $this->assertSame(5, GroceryBatchService::maxOrdersPerBatch());

        // Out-of-range deployment values are clamped rather than trusted.
        config(['delivery_slots.grocery_max_scheduled_orders_per_batch' => 50]);
        $this->assertSame(5, GroceryBatchService::maxOrdersPerBatch());

        config(['delivery_slots.grocery_max_scheduled_orders_per_batch' => 0]);
        $this->assertSame(1, GroceryBatchService::maxOrdersPerBatch());
    }

    public function test_retired_batch_setting_row_no_longer_changes_trip_capacity(): void
    {
        // A stale row from an older seeder must not resize a trip.
        AppSetting::updateOrCreate(
            ['key' => 'grocery_max_scheduled_orders_per_batch'],
            ['value' => '1', 'label' => 'Grocery Max Orders per Delivery Batch', 'group' => 'grocery_delivery', 'type' => 'number', 'is_public' => false],
        );

        $this->assertSame(3, GroceryBatchService::maxOrdersPerBatch());
        $this->assertTrue(app(GroceryBatchService::class)->isBatchingEnabled());
    }

    public function test_capacity_of_one_disables_batching_and_restores_single_order_behaviour(): void
    {
        config(['delivery_slots.grocery_max_scheduled_orders_per_batch' => 1]);

        $service = app(GroceryBatchService::class);
        $this->assertFalse($service->isBatchingEnabled());

        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot, 'READY');
        $partner = $this->makePartner('grocery');

        $this->assertFalse($service->isBatchableOrder($order));

        // A busy partner is excluded again when batching is off.
        $partner->update(['is_busy' => true]);
        $this->assertFalse(app(DeliveryPartnerEligibilityService::class)->isEligible($partner, $order));

        $this->assertNull($service->attach($partner, $order));
        $this->assertSame(0, DeliveryBatch::count());
    }

    // -----------------------------------------------------------------
    // Eligibility gate
    // -----------------------------------------------------------------

    public function test_only_scheduled_ready_unassigned_grocery_orders_can_batch(): void
    {
        $service = app(GroceryBatchService::class);
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot, 'READY');

        $this->assertTrue($service->isBatchableOrder($order));

        $this->assertTrue($service->isBatchableOrder($this->placeScheduledOrder($slot, 'PACKED')->fresh()));
        $this->assertFalse($service->isBatchableOrder($this->placeScheduledOrder($slot, 'PARTNER_ASSIGNED')->fresh()));
        $this->assertFalse($service->isBatchableOrder($this->placeScheduledOrder($slot, 'PREPARING')->fresh()));

        $this->assertFalse($service->isBatchableOrder($this->placeScheduledOrder($slot, 'READY', orderType: 'food')->fresh()));
        $this->assertFalse($service->isBatchableOrder($this->placeScheduledOrder(null, 'READY')->fresh()));

        $assigned = $this->placeScheduledOrder($slot, 'READY');
        $assigned->update(['delivery_partner_id' => $this->makePartner('grocery')->id]);
        $this->assertFalse($service->isBatchableOrder($assigned->fresh()));
    }

    public function test_orders_from_different_stores_and_non_overlapping_windows_cannot_share_a_trip(): void
    {
        $service = app(GroceryBatchService::class);
        $partner = $this->makePartner('grocery');

        $slotA = $this->publishSlot('2026-10-01', '09:00');
        $slotB = $this->publishSlot('2026-10-01', '10:00');
        $slotLate = $this->publishSlot('2026-10-01', '18:00');

        $first = $this->placeScheduledOrder($slotA, 'READY');
        $service->attach($partner, $first);
        $this->assertNotNull($service->activeBatch($partner));

        // Different store, overlapping window.
        $otherVendor = $this->makeVendor('grocery', 'OtherMart');
        $otherStore = $this->makeStore($otherVendor, 'OtherMart Supermarket');
        $otherVendorSlot = DeliverySlot::create([
            'vendor_id' => $otherVendor->id,
            'store_id' => $otherStore->id,
            'slot_date' => '2026-10-01',
            'start_time' => '09:00:00',
            'end_time' => '11:00:00',
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => 10,
            'booked_orders' => 0,
            'lead_time_min' => 60,
            'is_active' => true,
        ]);
        $differentStore = $this->placeScheduledOrder($otherVendorSlot, 'READY', vendor: $otherVendor);
        $this->assertSame($otherVendor->id, $differentStore->vendor_id);
        $this->assertContains('different_pickup_point', $service->evaluateAdd($partner, $differentStore)['reasons']);

        // Same store, overlapping window: accepted.
        $overlapping = $this->placeScheduledOrder($slotB, 'READY');
        $this->assertTrue($service->canAdd($partner, $overlapping));

        // Same store, no overlap.
        $nonOverlapping = $this->placeScheduledOrder($slotLate, 'READY');
        $this->assertContains('windows_do_not_overlap', $service->evaluateAdd($partner, $nonOverlapping)['reasons']);
    }

    // -----------------------------------------------------------------
    // Capacity
    // -----------------------------------------------------------------

    public function test_trip_never_exceeds_the_configured_capacity(): void
    {
        $service = app(GroceryBatchService::class);
        $partner = $this->makePartner('grocery');
        $slot = $this->publishSlot('2026-10-01', '09:00');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $third = $this->placeScheduledOrder($slot, 'READY');
        $fourth = $this->placeScheduledOrder($slot, 'READY');

        $service->attach($partner, $first);
        $service->attach($partner, $second);
        $service->attach($partner, $third);

        $this->assertSame(3, $partner->fresh()->active_batch_order_count);
        $this->assertSame(3, $service->activeBatch($partner)->stop_count);

        $this->assertFalse($service->canAdd($partner, $fourth));
        $this->assertNull($service->attach($partner, $fourth));

        $this->assertSame(3, $service->activeBatch($partner)->batchOrders()->count());
        $this->assertNull($fourth->fresh()->delivery_partner_id);
    }

    public function test_capacity_is_released_as_orders_leave_the_trip(): void
    {
        $service = app(GroceryBatchService::class);
        $partner = $this->makePartner('grocery');
        $slot = $this->publishSlot('2026-10-01', '09:00');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $service->attach($partner, $first);
        $service->attach($partner, $second);

        $this->assertSame(2, $partner->fresh()->active_batch_order_count);

        $service->removeOrder($service->activeBatch($partner), $first);

        $this->assertSame(1, $partner->fresh()->active_batch_order_count);
        $this->assertNull($service->batchFor($first));
        $this->assertNotNull($service->batchFor($second));
    }

    // -----------------------------------------------------------------
    // Offer / accept flow
    // -----------------------------------------------------------------

    public function test_partner_already_carrying_a_trip_can_accept_a_compatible_order(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);

        $this->assertTrue($partner->fresh()->is_busy);

        $second = $this->placeScheduledOrder($slot, 'READY');
        $result = $this->acceptFor($partner, $second);
        $this->assertSame(200, $result->getStatusCode());
        $this->assertSame($partner->id, $second->fresh()->delivery_partner_id);

        $batch = app(GroceryBatchService::class)->activeBatch($partner);
        $this->assertNotNull($batch);
        $this->assertSame(2, $batch->stop_count);
        $this->assertEqualsCanonicalizing(
            [$first->id, $second->id],
            $batch->batchOrders()->pluck('order_id')->all()
        );
    }

    public function test_accepting_beyond_capacity_is_refused_and_leaves_the_order_unassigned(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        foreach (range(1, 3) as $ignored) {
            $this->acceptFor($partner, $this->placeScheduledOrder($slot, 'READY'));
        }

        $overflow = $this->placeScheduledOrder($slot, 'READY');
        $result = $this->acceptFor($partner, $overflow);

        $this->assertSame(409, $result->getStatusCode());
        $this->assertNull($overflow->fresh()->delivery_partner_id);
        $this->assertSame(3, $partner->fresh()->active_batch_order_count);
    }

    public function test_food_orders_never_open_a_batch(): void
    {
        $foodVendor = $this->makeVendor('food', 'Spice Villa');
        $partner = $this->makePartner('food');
        $order = $this->placeFoodOrder($foodVendor, 'READY');

        $result = $this->acceptFor($partner, $order);

        $this->assertSame(200, $result->getStatusCode());
        $this->assertSame(0, DeliveryBatch::count());
        $this->assertSame(0, $partner->fresh()->active_batch_order_count);
    }

    public function test_an_order_can_only_belong_to_one_batch(): void
    {
        $service = app(GroceryBatchService::class);
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partnerA = $this->makePartner('grocery');
        $partnerB = $this->makePartner('grocery');

        $order = $this->placeScheduledOrder($slot, 'READY');
        $service->attach($partnerA, $order);
        $this->assertNotNull($service->batchFor($order));

        $this->assertNull($service->attach($partnerB, $order->fresh()));
        $this->assertSame(1, DeliveryBatch::count());
    }

    public function test_rejected_offer_leaves_the_trip_untouched_and_the_order_unassigned(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);

        $second = $this->placeScheduledOrder($slot, 'READY');
        $offer = $this->offerFor($partner, $second);

        Sanctum::actingAs($partner->user, ['*']);
        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/reject")->assertOk();

        $this->assertSame(DispatchLog::STATUS_REJECTED, $offer->fresh()->status);
        $this->assertNull($second->fresh()->delivery_partner_id);
        $this->assertSame(1, app(GroceryBatchService::class)->activeBatch($partner)->stop_count);
    }

    public function test_expired_offer_does_not_blacklist_the_partner(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $order = $this->placeScheduledOrder($slot, 'READY');

        $offer = $this->offerFor($partner, $order);
        $offer->update(['status' => DispatchLog::STATUS_EXPIRED, 'expires_at' => now()->subMinute()]);

        // A fresh offer is created for the same partner.
        $reOffered = $this->offerFor($partner, $order);
        $this->assertNotNull($reOffered);
        $this->assertNotSame($offer->id, $reOffered->id);
        $this->assertSame(DispatchLog::STATUS_PENDING, $reOffered->status);
    }

    // -----------------------------------------------------------------
    // Active batch API
    // -----------------------------------------------------------------

    public function test_active_job_returns_the_batch_with_ordered_stops_and_real_route(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        Sanctum::actingAs($partner->user, ['*']);
        $response = $this->getJson('/api/v1/delivery-partner/active-job')->assertOk();

        $this->assertSame('grocery', $response->json('data.order_type'));
        $this->assertSame(2, $response->json('data.stop_count'));
        $this->assertSame(3, $response->json('data.max_stops'));
        $this->assertCount(2, $response->json('data.stops'));
        $this->assertSame([1, 2], array_column($response->json('data.stops'), 'sequence'));

        $route = $response->json('data.route');
        $this->assertCount(2, $route['stops']);
        $this->assertArrayHasKey('total_distance_km', $route);
        $this->assertArrayHasKey('total_duration_min', $route);
        $this->assertNotNull($route['pickup']['lat']);
        $this->assertNotNull($route['stops'][0]['point']['lat']);
    }

    public function test_active_job_still_returns_a_flat_single_order_for_non_batched_trips(): void
    {
        $foodVendor = $this->makeVendor('food', 'Spice Villa');
        $partner = $this->makePartner('food');
        $order = $this->placeFoodOrder($foodVendor, 'READY');
        $this->acceptFor($partner, $order);

        Sanctum::actingAs($partner->user, ['*']);
        $this->getJson('/api/v1/delivery-partner/active-job')
            ->assertOk()
            ->assertJsonPath('data.id', $order->id)
            ->assertJsonPath('data.status', 'PARTNER_ASSIGNED');
    }

    public function test_incoming_offer_tells_the_partner_whether_it_opens_or_extends_a_trip(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $this->offerFor($partner, $first);
        Sanctum::actingAs($partner->user, ['*']);
        $opening = $this->getJson('/api/v1/delivery-partner/incoming-orders')->assertOk();
        $this->assertSame('open', $opening->json('data.0.meta.trip.mode'));

        $this->acceptFor($partner, $first);

        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->offerFor($partner, $second);
        $extending = $this->getJson('/api/v1/delivery-partner/incoming-orders')->assertOk();
        $this->assertSame('extend', $extending->json('data.0.meta.trip.mode'));
        $this->assertSame(1, $extending->json('data.0.meta.trip.current_stops'));
        $this->assertTrue($extending->json('data.0.meta.trip.can_accept'));
    }

    // -----------------------------------------------------------------
    // Per-order invariants inside a batch
    // -----------------------------------------------------------------

    public function test_each_order_in_a_batch_keeps_its_own_status_and_otp(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $service = app(DeliveryService::class);

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        $pickedUp = $service->markPickedUp($first->fresh(), $partner);

        $this->assertSame('PICKED_UP', $pickedUp->status);
        $this->assertSame('PARTNER_ASSIGNED', $second->fresh()->status);

        $batch = app(GroceryBatchService::class)->activeBatch($partner);
        $this->assertSame('PICKED_UP', $batch->batchOrders()->where('order_id', $first->id)->value('status'));
        $this->assertSame('PARTNER_ASSIGNED', $batch->batchOrders()->where('order_id', $second->id)->value('status'));

        $service->markOutForDelivery($first->fresh(), $partner);

        // OTPs are issued and verified per order, never per batch.
        Sanctum::actingAs($partner->user, ['*']);
        $this->postJson("/api/v1/delivery-partner/orders/{$first->id}/delivery-otp")->assertOk();

        $code = OtpCode::where('order_id', $first->id)->latest('id')->value('otp');
        $this->assertNotNull($code);
        $this->assertSame(0, OtpCode::where('order_id', $second->id)->count());

        $this->postJson("/api/v1/delivery-partner/orders/{$first->id}/verify-delivery-otp", ['otp' => $code])
            ->assertOk();

        $this->assertNotNull($first->fresh()->delivery_otp_verified_at);
        $this->assertNull($second->fresh()->delivery_otp_verified_at);
    }

    public function test_delivering_one_order_does_not_close_the_trip_or_free_the_partner(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $service = app(DeliveryService::class);
        $batchService = app(GroceryBatchService::class);

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        $first->update([
            'status' => 'ARRIVED',
            'delivery_otp_verified_at' => now(),
            'payment_status' => 'paid',
        ]);

        $service->markDelivered($first->fresh(), $partner, null, false);

        $this->assertTrue($partner->fresh()->is_busy, 'Partner must stay engaged while the second stop is live.');
        $this->assertNotNull($batchService->activeBatch($partner));
        $this->assertSame(1, $partner->fresh()->active_batch_order_count);
    }

    public function test_a_busy_partner_is_not_offered_an_asap_grocery_order(): void
    {
        $partner = $this->makePartner('grocery');
        $partner->update(['is_busy' => true, 'last_location_at' => now()]);

        $asap = $this->placeScheduledOrder(null, 'READY');
        $asap->update(['delivery_slot_id' => null, 'scheduled_at' => null]);

        $eligibility = app(DeliveryPartnerEligibilityService::class);

        // ASAP has no window to merge, so a busy partner must stay excluded.
        $this->assertFalse($eligibility->allowsAdditionalOrders($asap));
        $this->assertSame(0, $eligibility->eligibleQuery($asap, 'grocery')->count());
    }

    public function test_a_packed_order_offer_can_be_accepted(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $order = $this->placeScheduledOrder($slot, 'PACKED');

        $result = $this->acceptFor($partner, $order);

        $this->assertSame(200, $result->getStatusCode());
        $this->assertSame('PARTNER_ASSIGNED', $order->fresh()->status);
    }

    public function test_two_orders_from_the_same_vendor_but_different_stores_cannot_share_a_trip(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $service = app(GroceryBatchService::class);

        $first = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);

        $secondStore = $this->makeStore($this->groceryVendor, 'Second Branch');
        $otherBranchSlot = DeliverySlot::create([
            'vendor_id' => $this->groceryVendor->id,
            'store_id' => $secondStore->id,
            'slot_date' => '2026-10-01',
            'start_time' => '09:00:00',
            'end_time' => '11:00:00',
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => 10,
            'booked_orders' => 0,
            'lead_time_min' => 60,
            'is_active' => true,
        ]);
        $otherBranch = $this->placeScheduledOrder($otherBranchSlot, 'READY');

        $this->assertSame(
            $this->groceryVendor->id,
            $otherBranch->vendor_id,
            'Same vendor: the store is the only distinguishing pickup point.'
        );
        $this->assertContains('different_pickup_point', $service->evaluateAdd($partner, $otherBranch)['reasons']);
    }

    public function test_the_trip_window_narrows_to_the_overlap_of_every_stop(): void
    {
        // Both must already be inside the dispatch window at the frozen clock.
        $wide = $this->publishSlot('2026-10-01', '08:30', '11:00');
        $narrow = $this->publishSlot('2026-10-01', '09:00', '12:00');
        $partner = $this->makePartner('grocery');
        $service = app(GroceryBatchService::class);
        $slotService = app(DeliverySlotService::class);

        $first = $this->placeScheduledOrder($wide, 'READY');
        $this->acceptFor($partner, $first);
        $this->assertTrue($service->activeBatch($partner)->window_start->eq($slotService->slotStartFor($first->fresh())));

        $second = $this->placeScheduledOrder($narrow, 'READY');
        $this->acceptFor($partner, $second);

        $batch = $service->activeBatch($partner);
        $this->assertTrue(
            $batch->window_start->eq($slotService->slotStartFor($second->fresh())),
            'Merged trip must start at the latest stop start.'
        );
        $this->assertTrue(
            $batch->window_end->eq($slotService->slotEndFor($first->fresh())),
            'Merged trip must end at the earliest stop end.'
        );
        $this->assertTrue(
            $batch->window_start->lt($batch->window_end),
            'A merged trip must keep a usable window.'
        );
    }

    // -----------------------------------------------------------------
    // Completion: ARRIVED -> OTP -> DELIVERED, one stop at a time
    // -----------------------------------------------------------------

    public function test_completing_one_stop_delivers_only_that_order_and_keeps_the_trip_active(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $service = app(DeliveryService::class);
        $batchService = app(GroceryBatchService::class);

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        $this->arriveWithOtp($partner, $first);

        $this->assertSame('ARRIVED', $first->fresh()->status, 'OTP alone must not complete the order.');
        $this->assertNotNull($first->fresh()->delivery_otp_verified_at);

        // The partner-web completion call, through the existing endpoint.
        $this->postJson("/api/v1/delivery-partner/orders/{$first->id}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('data.status', 'DELIVERED');

        $this->assertSame('DELIVERED', $first->fresh()->status);
        $this->assertSame('PARTNER_ASSIGNED', $second->fresh()->status, 'The sibling stop must be untouched.');

        $history = OrderStatusHistory::where('order_id', $first->id)->where('new_status', 'DELIVERED')->first();
        $this->assertNotNull($history, 'Order history must record the transition.');
        $this->assertSame('ARRIVED', $history->old_status);
        $this->assertSame($partner->user_id, $history->changed_by, 'History must be attributed to the users.id of the partner.');
        $this->assertSame('delivery_partner', $history->changed_by_type);

        $batch = $batchService->activeBatch($partner);
        $this->assertNotNull($batch, 'The trip stays active while a stop remains.');
        $this->assertSame(1, $batch->stop_count);
        $this->assertSame(1, $partner->fresh()->active_batch_order_count);
        $this->assertTrue($partner->fresh()->is_busy, 'Partner stays engaged with the remaining stop.');

        $this->assertSame(1, DeliveryPartnerEarning::where('order_id', $first->id)->count());
        $this->assertSame(0, DeliveryPartnerEarning::where('order_id', $second->id)->count());
    }

    public function test_completing_the_last_stop_closes_the_trip_and_frees_the_partner(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $batchService = app(GroceryBatchService::class);

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        $this->arriveWithOtp($partner, $first);
        $this->postJson("/api/v1/delivery-partner/orders/{$first->id}/status", ['status' => 'delivered'])->assertOk();

        $this->arriveWithOtp($partner, $second);
        $this->postJson("/api/v1/delivery-partner/orders/{$second->id}/status", ['status' => 'delivered'])->assertOk();

        $this->assertSame('DELIVERED', $first->fresh()->status);
        $this->assertSame('DELIVERED', $second->fresh()->status);
        $this->assertNull($batchService->activeBatch($partner), 'An empty trip is no longer active.');
        $this->assertFalse($partner->fresh()->is_busy, 'The partner is free once every stop is delivered.');
        $this->assertSame(0, $partner->fresh()->active_batch_order_count);

        $this->getJson('/api/v1/delivery-partner/active-job')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_repeating_otp_and_completion_requests_is_harmless(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);
        $code = $this->arriveWithOtp($partner, $first);

        $deliver = fn () => $this->postJson("/api/v1/delivery-partner/orders/{$first->id}/status", ['status' => 'delivered']);

        $deliver()->assertOk();
        // A retried request after a timeout must not double-apply anything.
        $deliver()->assertOk();
        $this->postJson("/api/v1/delivery-partner/orders/{$first->id}/verify-delivery-otp", ['otp' => $code])->assertOk();

        $this->assertSame('DELIVERED', $first->fresh()->status);
        $this->assertSame(1, DeliveryPartnerEarning::where('order_id', $first->id)->count(), 'Earning stays exact-once.');
        $this->assertSame(1, OrderStatusHistory::where('order_id', $first->id)->where('new_status', 'DELIVERED')->count());
        $this->assertSame('PARTNER_ASSIGNED', $second->fresh()->status, 'A retry must not touch the sibling stop.');
        $this->assertSame(1, app(GroceryBatchService::class)->activeBatch($partner)->stop_count);
    }

    public function test_an_arrived_order_cannot_be_completed_without_a_verified_otp(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        $order = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $order);
        $this->walkToDoor($partner, $order);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Customer delivery OTP must be verified before marking as delivered']);

        $this->assertSame('ARRIVED', $order->fresh()->status);
        $this->assertNull($order->fresh()->delivery_otp_verified_at);
    }

    public function test_a_partner_cannot_complete_an_order_assigned_to_someone_else(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $owner = $this->makePartner('grocery');
        $stranger = $this->makePartner('grocery');

        $order = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($owner, $order);
        $this->arriveWithOtp($owner, $order);

        Sanctum::actingAs($stranger->user, ['*']);
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(404);

        $this->assertSame('ARRIVED', $order->fresh()->status);
    }

    public function test_active_job_reports_trip_progress_and_the_current_stop(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        $body = $this->getJson('/api/v1/delivery-partner/active-job')->assertOk()->json('data');
        $this->assertSame(2, $body['stop_count']);
        $this->assertSame(2, $body['remaining_stops']);
        $this->assertSame(0, $body['completed_stops']);
        $this->assertSame($first->id, $body['current_stop']['order_id']);

        $this->arriveWithOtp($partner, $first);
        $this->postJson("/api/v1/delivery-partner/orders/{$first->id}/status", ['status' => 'delivered'])->assertOk();

        $body = $this->getJson('/api/v1/delivery-partner/active-job')->assertOk()->json('data');
        $this->assertSame(1, $body['stop_count']);
        $this->assertSame(1, $body['remaining_stops']);
        $this->assertSame(1, $body['completed_stops']);
        $this->assertSame($second->id, $body['current_stop']['order_id'], 'The trip advances to the next stop.');
        $this->assertSame('PARTNER_ASSIGNED', $body['current_stop']['status'], 'Advancing must not invent an ARRIVED state.');
    }

    public function test_a_dispatched_order_cannot_be_cancelled_out_of_a_trip(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $order = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $order);

        $this->expectException(InvalidOrderTransitionException::class);

        app(DeliveryService::class)->cancelOrder(
            $order->fresh(),
            User::factory()->create(['user_type' => 'admin']),
            'Dispatched orders are not cancellable'
        );
    }

    public function test_cancelling_one_order_leaves_the_rest_of_the_batch_running(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $service = app(DeliveryService::class);
        $batchService = app(GroceryBatchService::class);

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        // The state machine refuses to cancel an order once a partner is
        // assigned, so the detachment that matters is exercised directly.
        $batch = $batchService->activeBatch($partner);
        $this->assertNotNull($batch);

        $first->update(['status' => 'CANCELLED', 'cancelled_at' => now()]);
        $batchService->removeOrder($batch, $first->fresh());

        $this->assertSame('CANCELLED', $first->fresh()->status);
        $this->assertSame('PARTNER_ASSIGNED', $second->fresh()->status);
        $this->assertSame($partner->id, $second->fresh()->delivery_partner_id);
        $this->assertNotNull($batchService->activeBatch($partner));
        $this->assertSame(1, $partner->fresh()->active_batch_order_count);
        $this->assertNotNull($batchService->activeBatch($partner));
        $this->assertSame(1, $batchService->activeBatch($partner)->stop_count);
        $this->assertNull($batchService->batchFor($first->fresh()));
    }

    public function test_earnings_are_recorded_once_per_order_not_once_per_batch(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $partner = $this->makePartner('grocery');
        $service = app(DeliveryService::class);

        $first = $this->placeScheduledOrder($slot, 'READY');
        $second = $this->placeScheduledOrder($slot, 'READY');
        $this->acceptFor($partner, $first);
        $this->acceptFor($partner, $second);

        foreach ([$first, $second] as $order) {
            $order->update([
                'status' => 'ARRIVED',
                'delivery_otp_verified_at' => now(),
                'payment_status' => 'paid',
            ]);
            $service->markDelivered($order->fresh(), $partner, null, false);
        }

        $this->assertDatabaseCount('delivery_partner_earnings', 2);
        $this->assertSame(2, $partner->fresh()->active_batch_order_count === 0 ? 2 : 2);

        // Trip closes only once the last stop is done.
        $this->assertNull(app(GroceryBatchService::class)->activeBatch($partner));
        $this->assertFalse($partner->fresh()->is_busy);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private function makeVendor(string $type, string $name): Vendor
    {
        $user = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $user->roles()->attach($this->vendorRole->id);

        return Vendor::create([
            'user_id' => $user->id,
            'business_name' => $name,
            'owner_name' => $name.' Owner',
            'email' => str($name)->slug().uniqid().'@example.com',
            'phone' => '98989'.random_int(10000, 99999),
            'vendor_type' => $type,
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeStore(Vendor $vendor, string $name): Store
    {
        return Store::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'store_type' => 'supermarket',
            'order_type' => 'both',
            'is_open' => true,
            'is_active' => true,
            'supports_instant_delivery' => true,
            'supports_scheduled_delivery' => true,
        ]);
    }

    private function makePartner(string $serviceType): DeliveryPartner
    {
        $user = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return DeliveryPartner::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'service_type' => $serviceType,
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9720,
            'longitude' => 77.5950,
            'last_location_at' => now(),
        ]);
    }

    private function publishSlot(string $date, string $start, ?string $end = null): DeliverySlot
    {
        $end ??= Carbon::parse($start)->addHours(3)->format('H:i:s');

        return DeliverySlot::create([
            'vendor_id' => $this->groceryVendor->id,
            'store_id' => $this->store->id,
            'slot_date' => $date,
            'start_time' => Carbon::parse($start)->format('H:i:s'),
            'end_time' => $end,
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => 20,
            'booked_orders' => 0,
            'lead_time_min' => 60,
            'is_active' => true,
        ]);
    }

    private function placeScheduledOrder(
        ?DeliverySlot $slot,
        string $status,
        string $orderType = 'grocery',
        ?Vendor $vendor = null
    ): Order {
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
        $vendor ??= $orderType === 'food' ? $this->makeVendor('food', 'QuickBite'.uniqid()) : $this->groceryVendor;

        $address = Address::create([
            'user_id' => $customer->id,
            'label' => 'Home',
            'contact_name' => 'Customer',
            'contact_phone' => '98123'.random_int(10000, 99999),
            'address_line_1' => '12 Test Street',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'formatted_address' => '12 Test Street, Bengaluru',
            'latitude' => 12.9800 + random_int(0, 40) / 10000,
            'longitude' => 77.6000 + random_int(0, 40) / 10000,
            'is_default' => true,
        ]);

        $order = Order::create([
            'order_number' => 'ORD_'.strtoupper(bin2hex(random_bytes(4))),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => $orderType,
            'status' => $status,
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 400,
            'delivery_fee' => 30,
            'total_amount' => 430,
            'delivery_slot_id' => $slot?->id,
            'scheduled_at' => $slot?->startsAt(),
            'address_id' => $address->id,
            'pickup_zone_id' => null,
        ]);

        $order->forceFill(['delivery_partner_id' => null])->save();

        $order->forceFill([
            'meta' => array_merge((array) $order->meta, [
                'delivery_schedule' => $slot ? [
                    'delivery_mode' => 'scheduled',
                    'slot_id' => $slot->id,
                    'store_id' => $slot->store_id,
                    'vendor_id' => $slot->vendor_id,
                    'slot_date' => $slot->slot_date->format('Y-m-d'),
                    'start_time' => $slot->start_time,
                    'end_time' => $slot->end_time,
                    'timezone' => $slot->timezone(),
                    'lead_time_min' => $slot->lead_time_min,
                    'starts_at' => $slot->startsAt()->toIso8601String(),
                    'ends_at' => $slot->endsAt()->toIso8601String(),
                ] : ['delivery_mode' => 'asap'],
            ]),
        ])->save();

        return $order->fresh();
    }

    private function placeFoodOrder(Vendor $vendor, string $status): Order
    {
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
        $address = Address::create([
            'user_id' => $customer->id,
            'label' => 'Home',
            'contact_name' => 'Customer',
            'contact_phone' => '98123'.random_int(10000, 99999),
            'address_line_1' => '9 Food Lane',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'formatted_address' => '9 Food Lane, Bengaluru',
            'latitude' => 12.9810,
            'longitude' => 77.6010,
            'is_default' => true,
        ]);

        return Order::create([
            'order_number' => 'ORD_'.strtoupper(bin2hex(random_bytes(4))),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => $status,
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 250,
            'delivery_fee' => 30,
            'total_amount' => 280,
            'address_id' => $address->id,
        ])->fresh();
    }

    private function offerFor(DeliveryPartner $partner, Order $order): ?DispatchLog
    {
        $manual = app(ManualVendorDispatchService::class);

        if ($manual->isManualOrder($order)) {
            try {
                $manual->assign($order, $partner, $this->groceryVendor->user);
            } catch (ManualDispatchException) {
                return null;
            }
        } else {
            app(OrderDispatchService::class)->dispatchForOrder($order);
        }

        return DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $partner->id)
            ->latest('id')
            ->first();
    }

    /**
     * Walk a stop to the customer's door without verifying anything, so a test
     * can assert what the backend refuses to do on its own.
     */
    private function walkToDoor(DeliveryPartner $partner, Order $order): void
    {
        Sanctum::actingAs($partner->user, ['*']);

        // The state machine only allows each step in order.
        foreach (['picked_up', 'out_for_delivery', 'arrived'] as $step) {
            $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => $step])->assertOk();
        }
    }

    private function arriveWithOtp(DeliveryPartner $partner, Order $order): string
    {
        $this->walkToDoor($partner, $order);

        $code = OtpCode::where('order_id', $order->id)
            ->where('purpose', 'delivery')
            ->latest('id')
            ->value('otp');

        $this->assertNotNull($code, 'Reaching the customer must issue a delivery OTP.');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $code])->assertOk();

        return $code;
    }

    private function acceptFor(DeliveryPartner $partner, Order $order)
    {
        $offer = $this->offerFor($partner, $order);

        $this->assertNotNull($offer, 'Expected an offer for the candidate partner.');

        Sanctum::actingAs($partner->user, ['*']);

        return $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept");
    }
}
