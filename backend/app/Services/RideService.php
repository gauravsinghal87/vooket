<?php

namespace App\Services;

use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Models\AppSetting;
use App\Models\Commission;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\FareRule;
use App\Models\Ride;
use App\Models\RideRequest;
use App\Models\RideStatusHistory;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Zone;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\IntegrationManager;
use App\Services\Integration\WebhookNotifier;
use App\Services\Maps\ZoneService;
use App\Services\Ride\RideDispatchService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class RideService
{
    public function __construct(
        private WebhookNotifier $webhookNotifier,
        private RideDispatchService $dispatch,
        private IntegrationManager $integrationManager,
        private IntegrationConfigResolver $resolver,
        private WalletService $walletService,
        private PaymentService $paymentService,
        private FareCalculationService $fareCalculation,
        private ZoneService $zoneService,
        private JournalService $journalService,
    ) {}

    public function estimateFare(array $data): array
    {
        $pickupLat = (float) $data['pickup_latitude'];
        $pickupLng = (float) $data['pickup_longitude'];
        $destLat = (float) $data['destination_latitude'];
        $destLng = (float) $data['destination_longitude'];
        $vehicleTypeId = $data['vehicle_type_id'] ?? null;

        $trip = $this->distanceBetween($pickupLat, $pickupLng, $destLat, $destLng);
        $distanceKm = $trip['distance_km'];
        $durationMin = $trip['duration_min'];

        $fareRuleQuery = FareRule::where('is_active', true);

        if ($vehicleTypeId) {
            $fareRuleQuery->where('vehicle_type_id', $vehicleTypeId);
        }

        $fareRule = $fareRuleQuery->first();

        if (! $fareRule) {
            throw new \InvalidArgumentException('No fare rule available for this route');
        }

        $vehicleType = $fareRule->vehicleType;

        return array_merge(
            $this->fareCalculation->calculate($fareRule->toArray(), $distanceKm, $durationMin),
            [
                'vehicle_type' => $vehicleType,
                'distance_km' => round($distanceKm, 2),
                'distance_source' => $trip['source'],
                'duration_min' => $durationMin,
                'currency' => config('ride.currency', 'INR'),
                'fare_rule_id' => $fareRule->id,
            ]
        );
    }

    public function createRide(User $user, array $data): Ride
    {
        return DB::transaction(function () use ($user, $data) {
            $idempotencyKey = $data['idempotency_key'] ?? null;
            $fingerprint = $idempotencyKey ? $this->fingerprint($data) : null;

            if ($idempotencyKey) {
                $existing = Ride::where('user_id', $user->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();

                if ($existing) {
                    $this->assertFingerprintMatches($existing, $fingerprint);

                    return $existing->fresh('vehicleType');
                }
            }

            [$pickupZone, $destinationZone] = $this->assertRideServiceable($data);

            $estimate = $this->estimateFare($data);

            $fareRule = FareRule::find($estimate['fare_rule_id']);

            $ride = Ride::create([
                'ride_number' => $this->generateRideNumber(),
                'idempotency_key' => $idempotencyKey,
                'idempotency_fingerprint' => $fingerprint,
                'user_id' => $user->id,
                'vehicle_type_id' => $data['vehicle_type_id'] ?? $estimate['vehicle_type']->id,
                'status' => Ride::STATUS_REQUESTING,
                'pickup_address' => $data['pickup_address'] ?? null,
                'pickup_latitude' => $data['pickup_latitude'],
                'pickup_longitude' => $data['pickup_longitude'],
                'destination_address' => $data['destination_address'] ?? null,
                'destination_latitude' => $data['destination_latitude'],
                'destination_longitude' => $data['destination_longitude'],
                'pickup_zone_id' => $pickupZone?->id,
                'destination_zone_id' => $destinationZone?->id,
                'distance_km' => $estimate['distance_km'],
                'duration_min' => $estimate['duration_min'],
                'base_fare' => $estimate['base_fare'],
                'distance_charge' => $estimate['distance_charge'],
                'time_charge' => $estimate['time_charge'],
                'booking_fee' => $estimate['booking_fee'],
                'platform_fee' => $estimate['platform_fee'],
                'surge_multiplier' => 1.00,
                'surge_amount' => 0,
                'estimated_fare' => $estimate['estimated_fare'],
                'payment_method' => $data['payment_method'] ?? 'cash',
                'is_scheduled' => ! empty($data['scheduled_at']),
                'scheduled_at' => $data['scheduled_at'] ?? null,
                'otp' => (string) random_int(100000, 999999),
                'meta' => [
                    'distance_source' => $estimate['distance_source'],
                    'dispatch' => ['status' => 'creating'],
                ],
            ]);

            RideStatusHistory::create([
                'ride_id' => $ride->id,
                'status' => Ride::STATUS_REQUESTING,
                'notes' => 'Ride requested',
                'changed_by' => $user->id,
            ]);

            $this->dispatch->dispatchForRide($ride);

            $this->webhookNotifier->rideRequested($ride);

            return $ride->fresh('vehicleType');
        });
    }

    /**
     * Resolve pickup/destination zones and enforce ride serviceability.
     * Returns null zones in bootstrap mode (no active zones defined).
     *
     * @param  array<string, mixed>  $data
     * @return array{0: Zone|null, 1: Zone|null}
     *
     * @throws \InvalidArgumentException when the pickup or drop is outside the ride service area
     */
    protected function assertRideServiceable(array $data): array
    {
        $pickup = $this->zoneService->isServiceable(
            (float) $data['pickup_latitude'],
            (float) $data['pickup_longitude'],
            ZoneService::SERVICE_RIDE
        );

        if (! $pickup['serviceable'] && $pickup['reason'] !== ZoneService::REASON_NO_ZONE) {
            throw new \InvalidArgumentException('Rides are not available at this pickup location');
        }

        $pickupZone = $pickup['zone'] ? Zone::find($pickup['zone']['id']) : null;

        $destination = $this->zoneService->isServiceable(
            (float) $data['destination_latitude'],
            (float) $data['destination_longitude'],
            ZoneService::SERVICE_RIDE
        );

        $destinationZone = $destination['zone'] ? Zone::find($destination['zone']['id']) : null;

        if ($pickupZone !== null && $destinationZone === null && ! $pickupZone->allow_ride_drop_outside_zone) {
            throw new \InvalidArgumentException('This destination is outside the ride service area');
        }

        return [$pickupZone, $destinationZone];
    }

    public function cancelRide(Ride $ride, User $user, ?string $reason = null): Ride
    {
        return DB::transaction(function () use ($ride, $user, $reason) {
            $ride = Ride::query()->lockForUpdate()->find($ride->id);

            if (! $ride) {
                throw new \InvalidArgumentException('Ride not found');
            }

            if (in_array($ride->status, [Ride::STATUS_COMPLETED, Ride::STATUS_CANCELLED], true)) {
                throw new \InvalidArgumentException('Ride cannot be cancelled');
            }

            $assigned = $ride->driver_id !== null;
            $fee = $assigned && in_array($ride->status, [
                Ride::STATUS_DRIVER_ASSIGNED,
                Ride::STATUS_DRIVER_ARRIVING,
                Ride::STATUS_DRIVER_ARRIVED,
            ], true) ? $this->cancellationFee($ride) : 0.0;

            $meta = $ride->meta ?? [];
            $meta['cancellation'] = [
                'fee' => round($fee, 2),
                'applied' => $fee > 0,
                'phase' => $assigned ? 'driver_assigned' : 'searching',
            ];

            RideRequest::where('ride_id', $ride->id)
                ->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT])
                ->update(['status' => RideRequest::STATUS_CANCELLED]);

            if ($ride->driver) {
                $ride->driver->update(['is_busy' => false]);
            }

            $ride->update([
                'status' => Ride::STATUS_CANCELLED,
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'cancelled_by_type' => 'customer',
                'cancelled_by' => $user->id,
                'meta' => $meta,
            ]);

            if ($fee > 0) {
                $meta['cancellation'] = $this->chargeCancellationFee($ride, $fee);
                $ride->update(['meta' => $meta]);
            }

            RideStatusHistory::create([
                'ride_id' => $ride->id,
                'status' => Ride::STATUS_CANCELLED,
                'notes' => $reason ?? 'Cancelled by customer',
                'changed_by' => $user->id,
            ]);

            return $ride->fresh('vehicleType');
        });
    }

    /**
     * Charge a configured cancellation fee against the customer.
     *
     * Only money the platform actually holds may be captured, so the fee is
     * debited from the customer wallet when the ride is wallet-paid. For any
     * other method (cash, online) no money is held at cancellation time, so
     * the fee is recorded as a deferred, uncollected charge instead of
     * inventing a receivable. A short wallet is treated the same way.
     *
     * @return array{fee: float, applied: bool, phase: string, collected: bool, deferred: bool, method: string|null}
     */
    private function chargeCancellationFee(Ride $ride, float $fee): array
    {
        $state = [
            'fee' => round($fee, 2),
            'applied' => true,
            'phase' => 'driver_assigned',
            'collected' => false,
            'deferred' => true,
            'method' => $ride->payment_method,
        ];

        if ($ride->payment_method !== Ride::PAYMENT_METHOD_WALLET || ! $ride->user) {
            return $state;
        }

        $amount = Money::fromMajor($fee);

        try {
            $this->walletService->debit(
                $ride->user,
                'customer',
                $amount->major(),
                'DEBIT',
                Ride::class,
                $ride->id,
                "Ride cancellation fee ({$ride->ride_number})",
                'ride-cancellation-fee:'.$ride->ride_number,
                ['service' => 'ride', 'ride_number' => $ride->ride_number, 'kind' => 'cancellation_fee']
            );
        } catch (RuntimeException) {
            return $state;
        }

        $this->journalService->post(
            sourceType: Ride::class,
            sourceId: $ride->id,
            entryType: 'ride_cancellation_fee',
            lines: [
                ['account' => 'ride_revenue_clearing', 'direction' => 'debit', 'amount' => $amount, 'memo' => 'Cancellation fee for ride #'.$ride->ride_number],
                ['account' => 'platform_revenue', 'direction' => 'credit', 'amount' => $amount, 'party_type' => 'platform', 'memo' => 'Cancellation fee for ride #'.$ride->ride_number],
            ],
            idempotencyKey: 'ride:cancellation-fee:'.$ride->ride_number,
            description: 'Cancellation fee for ride #'.$ride->ride_number,
            meta: ['fee' => round($fee, 2), 'method' => 'wallet']
        );

        $state['collected'] = true;
        $state['deferred'] = false;

        return $state;
    }

    /**
     * Release an assigned ride back into the search pool (driver cancelled
     * before pickup). The ride is re-dispatched to the remaining candidates.
     */
    public function releaseAssignment(Ride $ride, Driver $driver, ?string $reason = null): Ride
    {
        return DB::transaction(function () use ($ride, $driver, $reason) {
            $ride = Ride::query()->lockForUpdate()->find($ride->id);

            if (! $ride) {
                throw new \InvalidArgumentException('Ride not found');
            }

            if (in_array($ride->status, [Ride::STATUS_IN_PROGRESS, Ride::STATUS_COMPLETED, Ride::STATUS_CANCELLED], true)) {
                throw new \InvalidArgumentException('Ride can no longer be released');
            }

            if ((int) $ride->driver_id !== (int) $driver->id) {
                throw new \InvalidArgumentException('Ride is not assigned to this driver');
            }

            $driver->update(['is_busy' => false]);
            $driver->increment('rejected_rides');

            RideRequest::where('ride_id', $ride->id)
                ->where('driver_id', $driver->id)
                ->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT])
                ->update(['status' => RideRequest::STATUS_CANCELLED, 'responded_at' => now()]);

            $ride->update([
                'driver_id' => null,
                'status' => Ride::STATUS_REQUESTING,
                'driver_assigned_at' => null,
                'cancel_reason' => $reason,
                'cancelled_by_type' => 'driver',
                'cancelled_by' => $driver->user_id,
            ]);

            RideStatusHistory::create([
                'ride_id' => $ride->id,
                'status' => Ride::STATUS_REQUESTING,
                'notes' => 'Driver released assignment. Searching for a new driver.'.($reason ? " Reason: {$reason}" : ''),
                'changed_by' => $driver->user_id,
            ]);

            $this->dispatch->dispatchForRide($ride->fresh());

            return $ride->fresh('vehicleType');
        });
    }

    /**
     * Finalize a completed trip: final fare, payment settlement, driver
     * earnings. Idempotent — completing an already-completed ride returns the
     * stored result without double-charging or double-crediting.
     */
    public function completeRide(Ride $ride): Ride
    {
        return DB::transaction(function () use ($ride) {
            $ride = Ride::query()->lockForUpdate()->find($ride->id);

            if (! $ride) {
                throw new \InvalidArgumentException('Ride not found');
            }

            if ($ride->status === Ride::STATUS_COMPLETED) {
                return $ride->fresh(['vehicleType', 'driver.vehicleType']);
            }

            if ($ride->status !== Ride::STATUS_IN_PROGRESS) {
                throw new \InvalidArgumentException('Ride is not in progress');
            }

            if (! $ride->driver_id) {
                throw new \InvalidArgumentException('No driver assigned to this ride');
            }

            if (! $ride->otp_verified) {
                throw new \InvalidArgumentException('Ride start OTP must be verified before the ride can be completed.');
            }

            $route = $ride->route ?? [];
            $source = $route['source'] ?? null;
            $finalFare = round((float) ($ride->final_fare ?? $ride->estimated_fare), 2);

            if ($source === 'live') {
                $finalFare = $this->finalFareFromLiveRoute($ride, $route, $finalFare);
            }

            $updates = [
                'status' => Ride::STATUS_COMPLETED,
                'trip_completed_at' => $ride->trip_completed_at ?? now(),
                'final_fare' => $finalFare,
            ];

            if ($ride->payment_method === Ride::PAYMENT_METHOD_WALLET) {
                try {
                    $this->walletService->debit(
                        $ride->user,
                        'customer',
                        $finalFare,
                        'DEBIT',
                        Ride::class,
                        $ride->id,
                        "Ride fare ({$ride->ride_number})",
                        "ride:{$ride->id}",
                        ['ride_number' => $ride->ride_number]
                    );
                    $updates['payment_status'] = Ride::PAYMENT_STATUS_PAID;
                } catch (RuntimeException) {
                    $updates['payment_status'] = Ride::PAYMENT_STATUS_FAILED;
                }
            }

            // The trip may only reach COMPLETED once the customer's payment is
            // satisfied: a verified online capture, collected cash settled
            // against the driver wallet, or a successful wallet debit. Cash and
            // online rides paid by the customer before completion are already
            // reconciled here; an unpaid ride is rejected with a clear message.
            $ride->fill($updates);

            if (! $ride->isPaymentSettled()) {
                throw new RuntimeException('Ride payment must be completed before the ride can be marked as completed.');
            }

            $updates['payment_status'] = Ride::PAYMENT_STATUS_PAID;
            $ride->update($updates);

            if (! RideStatusHistory::where('ride_id', $ride->id)->where('status', Ride::STATUS_COMPLETED)->exists()) {
                RideStatusHistory::create([
                    'ride_id' => $ride->id,
                    'status' => Ride::STATUS_COMPLETED,
                    'notes' => 'Trip completed',
                    'changed_by' => $ride->driver?->user_id,
                ]);
            }

            $paid = Money::fromMajor($finalFare);
            $commissionRate = $this->rideCommissionPercentage();
            $commission = $commissionRate > 0 ? $paid->percent((string) $commissionRate) : Money::zero();
            $earning = $paid->sub($commission);

            $earned = DriverEarning::updateOrCreate(
                ['ride_id' => $ride->id],
                [
                    'driver_id' => $ride->driver_id,
                    'trip_fare' => $finalFare,
                    'driver_percentage' => round(100 - $commissionRate, 2),
                    'commission_percentage' => round($commissionRate, 2),
                    'commission_amount' => $commission->major(),
                    'earning_amount' => $earning->major(),
                    'currency' => 'INR',
                    'status' => DriverEarning::STATUS_PENDING,
                    'meta' => [
                        'payment_method' => $ride->payment_method,
                        'payment_status' => $ride->payment_status,
                        'commission_source' => 'app_settings',
                        'commission_key' => 'ride_commission',
                    ],
                ]
            );

            $this->walletService->creditEarning(
                user: $ride->driver->user,
                walletType: 'driver',
                amount: Money::fromMajor($earning),
                service: 'ride',
                referenceType: DriverEarning::class,
                referenceId: $earned->id,
                description: "Ride earning for ride #{$ride->ride_number}",
                meta: [
                    'ride_number' => $ride->ride_number,
                    'earning_id' => $earned->id,
                ],
            );

            if ($commission->paise() > 0) {
                Commission::firstOrCreate(
                    [
                        'party_type' => 'driver',
                        'source_type' => 'ride',
                        'source_id' => $ride->id,
                    ],
                    [
                        'commission_number' => 'CMM_'.date('YmdHis').'_'.strtoupper(substr(md5(microtime(true)), 0, 6)),
                        'service' => 'ride',
                        'party_type' => 'driver',
                        'driver_id' => $ride->driver_id,
                        'source_type' => 'ride',
                        'source_id' => $ride->id,
                        'gross_amount' => $paid->major(),
                        'commission_amount' => $commission->major(),
                        'commission_rate' => round($commissionRate, 2),
                        'commission_type' => 'percentage',
                        'net_amount' => $earning->major(),
                        'status' => 'calculated',
                        'breakdown' => [
                            'ride_number' => $ride->ride_number,
                            'payment_method' => $ride->payment_method,
                            'commission_source' => 'app_settings',
                            'commission_key' => 'ride_commission',
                            'earning_id' => $earned->id,
                        ],
                    ]
                );

                $this->journalService->post(
                    sourceType: Ride::class,
                    sourceId: $ride->id,
                    entryType: 'ride_commission_accrued',
                    lines: [
                        ['account' => 'ride_revenue_clearing', 'direction' => 'debit', 'amount' => $commission, 'memo' => 'Commission for ride #'.$ride->ride_number],
                        ['account' => 'platform_revenue', 'direction' => 'credit', 'amount' => $commission, 'party_type' => 'platform', 'memo' => 'Commission for ride #'.$ride->ride_number],
                    ],
                    idempotencyKey: 'commission:accrued:ride:'.$ride->id,
                    description: 'Platform commission for ride #'.$ride->ride_number,
                    meta: ['rate' => round($commissionRate, 2), 'service' => 'ride']
                );
            }

            if ($ride->driver) {
                $ride->driver->update(['is_busy' => false]);
                $ride->driver->increment('total_trips');
                $ride->driver->increment('accepted_rides');
            }

            $this->webhookNotifier->rideCompleted($ride);

            return $ride->fresh(['vehicleType', 'driver.vehicleType']);
        });
    }

    /**
     * Record a driver-side cash collection for a ride at the door.
     *
     * Confirmation is deliberately wallet-neutral: the collected cash is the
     * customer's money remitted to the platform, NOT a driver earning, so it
     * is NEVER credited to the spendable driver wallet. It is recorded on the
     * ride (cash_collected / cash_collected_amount / payment_status=paid) as
     * the auditable cash-collection ledger. The driver accounts for the
     * collected amount through the separate, explicit settle step.
     *
     * Idempotent: replaying an already-recorded collection returns the current
     * ride and settlement state without any additional effect.
     *
     * @return array{ride: Ride, payment: array}
     */
    public function confirmCashCollection(Ride $ride, Driver $driver): array
    {
        return DB::transaction(function () use ($ride, $driver) {
            $locked = Ride::query()->lockForUpdate()->find($ride->id);

            if (! $locked) {
                throw new RuntimeException('Ride not found');
            }

            if ((int) $locked->driver_id !== (int) $driver->id) {
                throw new RuntimeException('Ride is not assigned to this driver');
            }

            if (! in_array($locked->status, [Ride::STATUS_DRIVER_ARRIVED, Ride::STATUS_IN_PROGRESS], true)) {
                throw new RuntimeException('Cash can only be collected while the ride is in progress');
            }

            $remaining = Money::fromMajor($locked->payableAmount())->sub($this->paymentService->paidForPayable($locked));

            if ($remaining->paise() <= 0) {
                throw new RuntimeException('No cash to collect for this ride');
            }

            if (! $locked->cash_collected) {
                $locked->update([
                    'cash_collected' => true,
                    'cash_collected_amount' => $remaining->major(),
                    'cash_collected_at' => now(),
                    'cash_collected_via' => 'cash',
                    'payment_method' => Ride::PAYMENT_METHOD_CASH,
                    'payment_status' => Ride::PAYMENT_STATUS_PAID,
                ]);
            }

            $this->journalService->post(
                sourceType: Ride::class,
                sourceId: $locked->id,
                entryType: 'cash_collected',
                lines: [
                    ['account' => 'driver_cash_receivable', 'direction' => 'debit', 'amount' => $remaining, 'memo' => 'Cash collected for ride #'.$locked->ride_number],
                    ['account' => 'ride_revenue_clearing', 'direction' => 'credit', 'amount' => $remaining, 'memo' => 'Cash collected for ride #'.$locked->ride_number],
                ],
                idempotencyKey: 'ride:cash-collection:'.$locked->ride_number,
                description: 'Cash collected for ride #'.$locked->ride_number,
                meta: ['method' => 'cash', 'role' => 'driver']
            );

            return [
                'ride' => $locked->fresh(),
                'payment' => $this->paymentState($locked->fresh(), $remaining),
            ];
        });
    }

    /**
     * Settle the collected cash for a ride against the driver wallet.
     *
     * The driver funds the equal SETTLEMENT debit from their OWN wallet
     * balance (their earnings and top-ups). The customer's collected cash is
     * never parked as a spendable credit, so there is exactly one financial
     * effect per ride cash settlement: a single SETTLEMENT debit. When the
     * balance cannot cover the amount, settlement stays pending with the
     * shortfall surfaced to the UI so the driver can top up through the
     * existing Razorpay flow.
     *
     * Idempotent: already-settled rides return the current state without a
     * second debit, and the SETTLEMENT wallet transaction is keyed by
     * ride-cash-settlement:{ride_number}, so even concurrent duplicate
     * requests can only produce one debit.
     *
     * @return array{ride: Ride, payment: array, settled: bool}
     */
    public function settleCashCollection(Ride $ride, Driver $driver): array
    {
        return DB::transaction(function () use ($ride, $driver) {
            $locked = Ride::query()->lockForUpdate()->find($ride->id);

            if (! $locked) {
                throw new RuntimeException('Ride not found');
            }

            if ((int) $locked->driver_id !== (int) $driver->id) {
                throw new RuntimeException('Ride is not assigned to this driver');
            }

            if (! in_array($locked->status, [Ride::STATUS_DRIVER_ARRIVED, Ride::STATUS_IN_PROGRESS], true)) {
                throw new RuntimeException('Cash can only be settled while the ride is in progress');
            }

            if (! $locked->cash_collected) {
                throw new RuntimeException('Cash must be collected before it can be settled');
            }

            if ($locked->cash_settled) {
                return [
                    'ride' => $locked->fresh(),
                    'payment' => $this->paymentState($locked->fresh(), Money::fromMajor($locked->cash_collected_amount ?? 0)),
                    'settled' => true,
                ];
            }

            $amount = Money::fromMajor($locked->cash_collected_amount ?? $locked->payableAmount());

            if ($amount->paise() <= 0) {
                throw new RuntimeException('Nothing to settle for this ride');
            }

            $wallet = $this->walletService->ensureWallet($driver->user, 'driver');
            $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first() ?? $wallet;

            $ownFunds = Money::fromMajor($wallet->balance);

            if ($ownFunds->compareTo($amount) < 0) {
                return [
                    'ride' => $locked->fresh(),
                    'payment' => $this->paymentState($locked->fresh(), $amount, false, $ownFunds),
                    'settled' => false,
                ];
            }

            $this->walletService->debit(
                $driver->user,
                'driver',
                $amount->major(),
                'SETTLEMENT',
                Ride::class,
                $locked->id,
                "Cash settlement for ride #{$locked->ride_number}",
                'ride-cash-settlement:'.$locked->ride_number,
                ['service' => 'ride', 'ride_number' => $locked->ride_number, 'method' => 'cash']
            );

            $locked->update([
                'cash_settled' => true,
                'cash_settled_at' => now(),
            ]);

            return [
                'ride' => $locked->refresh(),
                'payment' => $this->paymentState($locked->refresh(), $amount, true),
                'settled' => true,
            ];
        });
    }

    /**
     * Driver-facing payment state for a ride, mirroring the food/grocery
     * cash settlement payload so the partner UI can reuse the same wallet
     * shortfall/top-up treatment.
     *
     * @return array{amount: float, collected_at: string|null, settlement: string, settled_at: string|null, required: float, available: float, shortfall: float, wallet_balance: float, payment_method: string|null, payment_status: string|null}
     */
    public function paymentState(Ride $ride, ?Money $amount = null, ?bool $settled = null, ?Money $available = null): array
    {
        $balance = 0.0;

        if ($ride->driver?->user) {
            $wallet = $this->walletService->ensureWallet($ride->driver->user, 'driver');
            $balance = (float) $wallet->balance;
        }

        $required = $amount ?? Money::fromMajor($ride->cash_collected_amount ?? $ride->payableAmount());
        $isSettled = $settled ?? (bool) $ride->cash_settled;
        $availableAmount = (float) ($available?->major() ?? $balance);
        $shortfall = $isSettled ? 0.0 : (float) max(0, round($required->major() - $availableAmount, 2));

        return [
            'amount' => (float) $required->major(),
            'collected_at' => $ride->cash_collected_at?->toISOString(),
            'settlement' => $isSettled ? 'settled' : 'pending',
            'settled_at' => $ride->cash_settled_at?->toISOString(),
            'required' => (float) $required->major(),
            'available' => $availableAmount,
            'shortfall' => $shortfall,
            'wallet_balance' => $balance,
            'payment_method' => $ride->payment_method,
            'payment_status' => $ride->payment_status,
        ];
    }

    /**
     * Directions for the requested route. Uses the routed provider when a
     * real Google provider is active; otherwise the client receives an OK
     * straight-line (haversine) estimate with no polyline.
     *
     * @param  array{latitude: float, longitude: float}  $pickup
     * @param  array{latitude: float, longitude: float}  $destination
     * @return array{distance_km: float, duration_min: int, polyline: string|null, source: string, status: string}
     */
    public function directionsForRoute(array $pickup, array $destination): array
    {
        if ($this->resolver->provider('maps') === 'google') {
            try {
                $result = $this->maps()->directions(
                    $this->latLng($pickup),
                    $this->latLng($destination),
                    ['mode' => 'driving']
                );

                $route = $result['routes'][0] ?? null;

                if ($route) {
                    $leg = $route['legs'][0] ?? null;

                    return [
                        'distance_km' => round(($leg['distance']['value'] ?? 0) / 1000, 2),
                        'duration_min' => (int) round(($leg['duration']['value'] ?? 0) / 60),
                        'polyline' => $route['overview_polyline']['points'] ?? null,
                        'source' => 'google',
                        'status' => $result['status'] ?? 'OK',
                    ];
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $trip = $this->distanceBetween(
            (float) $pickup['latitude'],
            (float) $pickup['longitude'],
            (float) $destination['latitude'],
            (float) $destination['longitude']
        );

        return [
            'distance_km' => $trip['distance_km'],
            'duration_min' => $trip['duration_min'],
            'polyline' => null,
            'source' => $trip['source'],
            'status' => 'OK',
        ];
    }

    /**
     * Privacy-safe list of nearby eligible drivers for the customer UI.
     * Coordinates are rounded so exact driver positions are never exposed.
     *
     * @return array<int, array{id: int, vehicle_type_id: int, vehicle_type_name: string|null, latitude: float, longitude: float, distance_km: float, eta_min: int, rating: float}>
     */
    public function nearbyDrivers(float $latitude, float $longitude, ?int $vehicleTypeId = null, ?float $radiusKm = null): array
    {
        $radiusKm = $radiusKm ?? (float) config('ride.initial_radius_km', 4);
        $maxRadius = (float) config('ride.max_radius_km', 10);
        $radiusKm = min($radiusKm, $maxRadius);

        $query = Driver::query()
            ->with('vehicleType')
            ->whereNotIn('status', ['pending', 'rejected', 'suspended'])
            ->where('is_online', true)
            ->where('is_busy', false)
            ->where('is_verified', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude');

        if ($vehicleTypeId) {
            $query->where('vehicle_type_id', $vehicleTypeId);
        }

        $freshnessMinutes = config('ride.location_freshness_minutes');

        if ($freshnessMinutes !== null) {
            $query->where('last_location_at', '>=', now()->subMinutes((int) $freshnessMinutes));
        }

        return $query->get()
            ->map(function (Driver $driver) use ($latitude, $longitude) {
                return [
                    'driver' => $driver,
                    'distance_km' => $this->haversineKm($latitude, $longitude, (float) $driver->latitude, (float) $driver->longitude),
                ];
            })
            ->reject(fn (array $candidate) => $candidate['distance_km'] > $radiusKm)
            ->sortBy('distance_km')
            ->take(20)
            ->values()
            ->map(fn (array $candidate) => $this->privacySafeDriver($candidate['driver'], $candidate['distance_km']))
            ->all();
    }

    /**
     * Lazily advance a ride's offer chain when nothing is active — called on
     * customer polling of an unassigned ride.
     */
    public function ensureSearching(Ride $ride): void
    {
        $fresh = $ride->fresh();

        if (! $fresh || $fresh->driver_id) {
            return;
        }

        if (! in_array($fresh->status, [Ride::STATUS_REQUESTING, Ride::STATUS_NO_DRIVER_FOUND], true)) {
            return;
        }

        $this->dispatch->promoteNextIfNeeded($fresh);
    }

    public function cancellationFee(Ride $ride): float
    {
        $fareRule = FareRule::where('vehicle_type_id', $ride->vehicle_type_id)->where('is_active', true)->first();

        return (float) ($fareRule?->cancellation_fee ?? 0);
    }

    /**
     * Recompute the final fare from the live routed distance recorded on the
     * ride (only possible when a real maps provider was active).
     */
    private function finalFareFromLiveRoute(Ride $ride, array $route, float $fallback): float
    {
        $fareRule = FareRule::where('vehicle_type_id', $ride->vehicle_type_id)->where('is_active', true)->first();

        if (! $fareRule) {
            return $fallback;
        }

        $distanceKm = (float) ($route['distance_km'] ?? (float) $ride->distance_km);
        $durationMin = max(1, (int) ($route['duration_min'] ?? max(1, round($distanceKm / 30 * 60))));

        $baseFare = (float) $fareRule->base_fare;
        $distanceCharge = round($distanceKm * (float) $fareRule->per_km, 2);
        $timeCharge = round($durationMin * (float) $fareRule->per_minute, 2);
        $bookingFee = (float) $fareRule->booking_fee;
        $platformFee = (float) $fareRule->platform_fee;
        $waiting = (float) $ride->waiting_charge;
        $tip = (float) $ride->tip_amount;
        $discount = (float) $ride->discount_amount;

        $subtotal = $baseFare + $distanceCharge + $timeCharge + $bookingFee + $platformFee + $waiting + $tip - $discount;
        $tax = round($subtotal * (float) $fareRule->tax_rate / 100, 2);

        return round(max($subtotal + $tax, (float) $fareRule->minimum_fare), 2);
    }

    /**
     * @return array{source: string, distance_km: float, duration_min: int}
     */
    private function distanceBetween(float $lat1, float $lng1, float $lat2, float $lng2): array
    {
        $distanceKm = $this->haversineKm($lat1, $lng1, $lat2, $lng2);
        $durationMin = max(1, (int) round($distanceKm / 30 * 60));

        if ($this->resolver->provider('maps') === 'google') {
            try {
                $routed = $this->maps()->calculateDistanceAndTime(
                    ['latitude' => $lat1, 'longitude' => $lng1],
                    ['latitude' => $lat2, 'longitude' => $lng2],
                );

                if (($routed['distance_km'] ?? 0) > 0) {
                    return [
                        'source' => 'routed',
                        'distance_km' => round((float) $routed['distance_km'], 2),
                        'duration_min' => max(1, (int) ($routed['duration_min'] ?? $durationMin)),
                    ];
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return [
            'source' => 'haversine',
            'distance_km' => round($distanceKm, 2),
            'duration_min' => $durationMin,
        ];
    }

    private function maps(): MapProviderInterface
    {
        return $this->integrationManager->maps();
    }

    /**
     * @return array{latitude: float, longitude: float}
     */
    private function latLng(array $point): array
    {
        return [
            'latitude' => (float) $point['latitude'],
            'longitude' => (float) $point['longitude'],
        ];
    }

    /**
     * @return array{id: int, vehicle_type_id: int, vehicle_type_name: string|null, latitude: float, longitude: float, distance_km: float, eta_min: int, rating: float}
     */
    private function privacySafeDriver(Driver $driver, float $distanceKm): array
    {
        return [
            'id' => (int) $driver->id,
            'vehicle_type_id' => (int) $driver->vehicle_type_id,
            'vehicle_type_name' => $driver->vehicleType?->name,
            'latitude' => round((float) $driver->latitude, 4),
            'longitude' => round((float) $driver->longitude, 4),
            'distance_km' => round($distanceKm, 2),
            'eta_min' => max(2, (int) round($distanceKm / 30 * 60)),
            'rating' => (float) $driver->rating,
        ];
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }

    private function generateRideNumber(): string
    {
        return 'RIDE_'.date('Ymd').'_'.strtoupper(Str::random(8));
    }

    /**
     * Stable hash of the booking-defining fields. Two requests carrying the same
     * idempotency key but a different ride must be rejected rather than silently
     * returning the first ride.
     *
     * @param  array<string, mixed>  $data
     */
    private function fingerprint(array $data): string
    {
        $canonical = [
            'pickup_latitude' => $data['pickup_latitude'] ?? null,
            'pickup_longitude' => $data['pickup_longitude'] ?? null,
            'destination_latitude' => $data['destination_latitude'] ?? null,
            'destination_longitude' => $data['destination_longitude'] ?? null,
            'vehicle_type_id' => $data['vehicle_type_id'] ?? null,
            'payment_method' => $data['payment_method'] ?? null,
            'scheduled_at' => isset($data['scheduled_at']) ? (string) $data['scheduled_at'] : null,
        ];
        ksort($canonical);

        return hash('sha256', json_encode($canonical));
    }

    private function assertFingerprintMatches(Ride $existing, ?string $fingerprint): void
    {
        if ($fingerprint !== null && $existing->idempotency_fingerprint !== null
            && $existing->idempotency_fingerprint !== $fingerprint) {
            throw new \Exception('Idempotency key already used with a different payload');
        }
    }

    /**
     * The admin-configured ride commission percentage for a ride.
     *
     * Source of truth is the `app_settings` row (group "commission", key
     * "ride_commission"), read live so an Admin change applies to the next
     * ride immediately and completed rides keep their persisted snapshot.
     * A missing/unconfigured setting resolves to 0 (no commission), never a
     * hardcoded fallback.
     */
    private function rideCommissionPercentage(): float
    {
        $settingValue = AppSetting::where('group', 'commission')
            ->where('key', 'ride_commission')
            ->value('value');

        if ($settingValue === null) {
            return 0.0;
        }

        return max(0.0, min(100.0, (float) $settingValue));
    }
}
