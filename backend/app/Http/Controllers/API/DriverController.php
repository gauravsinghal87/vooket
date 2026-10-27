<?php

namespace App\Http\Controllers\API;

use App\Exceptions\PartnerWalletBalanceException;
use App\Models\DispatchLog;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\Ride;
use App\Models\RideRequest;
use App\Models\RideStatusHistory;
use App\Models\VehicleDocument;
use App\Models\WalletTransaction;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Maps\ZoneService;
use App\Services\PaymentService;
use App\Services\Ride\RideDispatchService;
use App\Services\RideService;
use App\Services\WalletService;
use App\Services\WithdrawalService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class DriverController extends BaseController
{
    public function __construct(
        private RideService $rideService,
        private RideDispatchService $dispatch,
        private ZoneService $zoneService,
    ) {}

    public function profile(Request $request)
    {
        $driver = Driver::where('user_id', $request->user()->id)
            ->with(['vehicleType', 'vehicles'])
            ->first();

        if (! $driver) {
            return $this->error('Driver profile not found', null, 404);
        }

        return $this->success($driver);
    }

    public function updateProfile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vehicle_type_id' => 'sometimes|exists:vehicle_types,id',
            'vehicle_number' => 'sometimes|string|max:20',
            'vehicle_model' => 'sometimes|string|max:100',
            'vehicle_color' => 'sometimes|string|max:50',
            'license_number' => 'sometimes|string|max:50',
            'license_expiry' => 'sometimes|date|after:today',
            'aadhar_number' => 'sometimes|string|max:20',
            'pan_number' => 'sometimes|string|max:20',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $driver->update($validator->validated());

            return $this->success($driver->fresh('vehicleType'), 'Profile updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function uploadDocuments(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'documents' => 'required|array|min:1',
            'documents.*.type' => 'required|string|in:license,insurance,rc,profile_photo,aadhar',
            'documents.*.file' => 'required|file|max:5120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $uploadedDocs = [];

            foreach ($request->documents as $doc) {
                $path = $doc['file']->store('driver-documents', 'public');
                $docRecord = VehicleDocument::create([
                    'vehicle_id' => $driver->vehicles()->first()?->id,
                    'type' => $doc['type'],
                    'file_path' => $path,
                    'filename' => $doc['file']->getClientOriginalName(),
                    'status' => 'pending',
                ]);
                $uploadedDocs[] = $docRecord;
            }

            return $this->success($uploadedDocs, 'Documents uploaded', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function updateBank(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'bank_account_name' => 'required|string|max:255',
            'bank_account_number' => 'required|string|max:30',
            'bank_ifsc' => 'required|string|max:20',
            'bank_name' => 'sometimes|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $driver->update($validator->validated());

            return $this->success($driver->fresh(), 'Bank details updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function toggleAvailability(Request $request)
    {
        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            if (in_array($driver->status, ['pending', 'rejected', 'suspended'])) {
                return $this->error(
                    'Your application is '.$driver->status.'. You can go online only after it is approved.',
                    null,
                    422
                );
            }

            $driver->update([
                'is_online' => ! $driver->is_online,
            ]);

            return $this->success([
                'is_online' => $driver->fresh()->is_online,
            ], 'Availability updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function updateLocation(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'heading' => 'sometimes|numeric|between:0,360',
            'speed' => 'sometimes|numeric|between:0,180',
            'accuracy' => 'sometimes|numeric|between:0,5000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $driver->update([
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'heading' => $request->filled('heading') ? (float) $request->heading : null,
                'speed' => $request->filled('speed') ? (float) $request->speed : null,
                'accuracy' => $request->filled('accuracy') ? (float) $request->accuracy : null,
                'current_zone_id' => $this->zoneService->resolve(
                    (float) $request->latitude,
                    (float) $request->longitude,
                    'ride'
                )?->id,
                'last_location_at' => now(),
            ]);

            return $this->success(null, 'Location updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function incomingRequests(Request $request)
    {
        $driver = Driver::where('user_id', $request->user()->id)->first();

        if (! $driver) {
            return $this->error('Driver profile not found', null, 404);
        }

        $this->dispatch->refreshOffersForDriver($driver);

        $requests = RideRequest::where('driver_id', $driver->id)
            ->where('status', RideRequest::STATUS_PENDING)
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->with(['ride' => fn ($q) => $q->with('vehicleType')])
            ->latest()
            ->get();

        return $this->success($requests);
    }

    public function acceptRequest(Request $request, $rideRequestId)
    {
        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $rideRequest = RideRequest::where('id', $rideRequestId)
                ->where('driver_id', $driver->id)
                ->where('status', RideRequest::STATUS_PENDING)
                ->first();

            if (! $rideRequest) {
                return $this->error('Request not found or expired', null, 404);
            }

            if ($this->dispatch->isOfferExpired($rideRequest)) {
                $rideRequest->update([
                    'status' => RideRequest::STATUS_EXPIRED,
                    'responded_at' => now(),
                ]);

                return $this->error('Request expired', null, 410);
            }

            $ride = DB::transaction(function () use ($rideRequest, $driver, $request) {
                $rideRequest = RideRequest::query()->lockForUpdate()->find($rideRequest->id);
                $ride = Ride::query()->lockForUpdate()->find($rideRequest->ride_id);

                if (! $rideRequest || $rideRequest->status !== RideRequest::STATUS_PENDING || ! $ride) {
                    return null;
                }

                if ($this->dispatch->isOfferExpired($rideRequest)) {
                    $rideRequest->update([
                        'status' => RideRequest::STATUS_EXPIRED,
                        'responded_at' => now(),
                    ]);

                    return null;
                }

                if ($ride->driver_id || ! in_array($ride->status, [Ride::STATUS_REQUESTING, Ride::STATUS_NO_DRIVER_FOUND], true)) {
                    RideRequest::where('ride_id', $ride->id)
                        ->where('id', '!=', $rideRequest->id)
                        ->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT])
                        ->update(['status' => RideRequest::STATUS_EXPIRED]);

                    return null;
                }

                $rideRequest->update([
                    'status' => RideRequest::STATUS_ACCEPTED,
                    'responded_at' => now(),
                ]);

                RideRequest::where('ride_id', $ride->id)
                    ->where('id', '!=', $rideRequest->id)
                    ->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT])
                    ->update(['status' => RideRequest::STATUS_EXPIRED]);

                $ride->update([
                    'driver_id' => $driver->id,
                    'status' => Ride::STATUS_DRIVER_ASSIGNED,
                    'driver_assigned_at' => now(),
                ]);

                RideStatusHistory::firstOrCreate(
                    ['ride_id' => $ride->id, 'status' => Ride::STATUS_DRIVER_ASSIGNED],
                    [
                        'status' => Ride::STATUS_DRIVER_ASSIGNED,
                        'notes' => 'Driver accepted request',
                        'changed_by' => $request->user()->id,
                    ]
                );

                DispatchLog::create([
                    'dispatch_type' => 'ride',
                    'ride_id' => $ride->id,
                    'candidate_id' => $driver->id,
                    'candidate_type' => 'driver',
                    'distance_km' => $rideRequest->distance_km,
                    'status' => 'assigned',
                    'meta' => ['accepted_at' => now()->toISOString()],
                ]);

                $driver->update(['is_busy' => true]);

                return $ride;
            });

            if (! $ride) {
                return $this->error('Ride is no longer available. Another driver may have accepted it.', null, 409);
            }

            return $this->success($ride->fresh(['driver', 'vehicleType']), 'Request accepted');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function rejectRequest(Request $request, $rideRequestId)
    {
        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $rideRequest = RideRequest::where('id', $rideRequestId)
                ->where('driver_id', $driver->id)
                ->where('status', 'pending')
                ->first();

            if (! $rideRequest) {
                return $this->error('Request not found', null, 404);
            }

            $rideRequest->update([
                'status' => 'rejected',
                'responded_at' => now(),
            ]);

            $driver->increment('rejected_rides');

            return $this->success(null, 'Request rejected');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function activeTrip(Request $request)
    {
        $driver = Driver::where('user_id', $request->user()->id)->first();

        if (! $driver) {
            return $this->error('Driver profile not found', null, 404);
        }

        $ride = Ride::with('user', 'vehicleType')
            ->where('driver_id', $driver->id)
            ->whereNotIn('status', [Ride::STATUS_COMPLETED, Ride::STATUS_CANCELLED])
            ->latest()
            ->first();

        if ($ride) {
            $ride->setAttribute('payment', $this->rideService->paymentState($ride));
        }

        return $this->success($ride, $ride ? 'Active trip' : 'No active trip');
    }

    public function updateTripStatus(Request $request, $rideId)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:arriving,arrived,in_progress,completed,cancelled',
            'reason' => 'required_if:status,cancelled|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $ride = Ride::where('id', $rideId)
                ->where('driver_id', $driver->id)
                ->first();

            if (! $ride) {
                return $this->error('Ride not found', null, 404);
            }

            if ($request->status === 'cancelled') {
                $ride = $this->rideService->releaseAssignment($ride, $driver, $request->reason);

                return $this->success($ride, 'Assignment released. Searching for a new driver.');
            }

            if ($request->status === 'completed') {
                $ride = $this->rideService->completeRide($ride);

                return $this->success($ride->fresh('vehicleType'), 'Ride completed');
            }

            $statusMap = [
                'arriving' => [Ride::STATUS_DRIVER_ARRIVING, 'driver_arriving_at'],
                'arrived' => [Ride::STATUS_DRIVER_ARRIVED, 'driver_arrived_at'],
                'in_progress' => [Ride::STATUS_IN_PROGRESS, 'trip_started_at'],
            ];

            [$status, $timestampField] = $statusMap[$request->status];

            $allowed = ['arriving' => Ride::STATUS_DRIVER_ASSIGNED, 'arrived' => Ride::STATUS_DRIVER_ARRIVING, 'in_progress' => Ride::STATUS_DRIVER_ARRIVED];

            if ($ride->status !== $allowed[$request->status]) {
                return $this->error("Cannot move to {$request->status} from current status {$ride->status}", null, 422);
            }

            if ($request->status === 'in_progress' && ! $ride->otp_verified) {
                return $this->error('Ride start OTP must be verified before starting the trip', null, 422);
            }

            DB::transaction(function () use ($ride, $request, $status, $timestampField) {
                $ride->update([
                    'status' => $status,
                    $timestampField => now(),
                ]);

                RideStatusHistory::create([
                    'ride_id' => $ride->id,
                    'status' => $status,
                    'notes' => "Status updated to {$request->status}",
                    'changed_by' => $request->user()->id,
                ]);
            });

            return $this->success($ride->fresh('vehicleType'), 'Status updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function verifyCustomerOtp(Request $request, $rideId)
    {
        $validator = Validator::make($request->all(), [
            'otp' => 'required|digits:6',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $ride = Ride::where('id', $rideId)
                ->where('driver_id', $driver->id)
                ->first();

            if (! $ride) {
                return $this->error('Ride not found', null, 404);
            }

            if ($ride->otp !== $request->otp) {
                return $this->error('Invalid OTP', null, 400);
            }

            $ride->update([
                'otp_verified' => true,
                'otp_verified_at' => now(),
                'status' => 'IN_PROGRESS',
                'trip_started_at' => now(),
            ]);

            RideStatusHistory::create([
                'ride_id' => $ride->id,
                'status' => 'IN_PROGRESS',
                'notes' => 'Customer OTP verified',
                'changed_by' => $request->user()->id,
            ]);

            return $this->success($ride->fresh(), 'OTP verified');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function earnings(Request $request)
    {
        $driver = Driver::where('user_id', $request->user()->id)->first();

        if (! $driver) {
            return $this->error('Driver profile not found', null, 404);
        }

        $earnings = DriverEarning::where('driver_id', $driver->id);

        $todayEarnings = (clone $earnings)
            ->whereDate('created_at', today())
            ->sum('earning_amount');

        $weekEarnings = (clone $earnings)
            ->where('created_at', '>=', now()->startOfWeek())
            ->sum('earning_amount');

        $monthEarnings = (clone $earnings)
            ->where('created_at', '>=', now()->startOfMonth())
            ->sum('earning_amount');

        $totalEarnings = (clone $earnings)->sum('earning_amount');

        return $this->success([
            'today' => round($todayEarnings, 2),
            'this_week' => round($weekEarnings, 2),
            'this_month' => round($monthEarnings, 2),
            'total' => round($totalEarnings, 2),
            'total_trips' => $driver->total_trips,
            'payout' => $this->payoutOverview($request, 'driver'),
        ]);
    }

    /**
     * Wallet figures for the payout panel.
     *
     * Read through the withdrawal service so the ceiling shown to the rider is the
     * exact one `requestDriverWithdrawal` enforces, floor included. Nothing here
     * is trusted by the payout path; it exists so the UI never offers an amount
     * the server will refuse.
     *
     * @return array{wallet_balance: float, minimum_wallet_balance: float, available_withdrawable_amount: float}
     */
    private function payoutOverview(Request $request, string $walletType): array
    {
        $withdrawalService = app(WithdrawalService::class);

        return [
            'wallet_balance' => (float) app(WalletService::class)->available($request->user(), $walletType)->major(),
            'minimum_wallet_balance' => (float) $withdrawalService->partnerMinimumWalletBalance()->major(),
            'available_withdrawable_amount' => (float) $withdrawalService->partnerMaximumPayout($request->user(), $walletType)->major(),
        ];
    }

    public function withdrawals(Request $request)
    {
        $driver = Driver::where('user_id', $request->user()->id)->first();

        if (! $driver) {
            return $this->error('Driver profile not found', null, 404);
        }

        $withdrawals = Payout::where('driver_id', $driver->id)
            ->latest()
            ->paginate($request->get('per_page', 15));

        return $this->success($withdrawals);
    }

    public function wallet(Request $request)
    {
        $driver = Driver::where('user_id', $request->user()->id)->first();

        if (! $driver) {
            return $this->error('Driver profile not found', null, 404);
        }

        $walletService = app(WalletService::class);
        $walletService->reconcileFinalizedEarnings($request->user());

        $wallet = $walletService->ensureWallet($request->user(), 'driver');

        return $this->success([
            'wallet_type' => $wallet->wallet_type,
            'currency' => $wallet->currency,
            'balance' => (float) $wallet->balance,
            'pending_balance' => (float) $wallet->pending_balance,
            'available_balance' => (float) $walletService->available($request->user(), 'driver')->major(),
            'total_earned' => (float) $walletService->totalEarned($request->user(), 'driver')->major(),
            'total_credited' => (float) $wallet->total_credited,
            'total_debited' => (float) $wallet->total_debited,
            'status' => $wallet->status,
        ]);
    }

    public function walletTransactions(Request $request)
    {
        $driver = Driver::where('user_id', $request->user()->id)->first();

        if (! $driver) {
            return $this->error('Driver profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'service' => 'sometimes|string|max:30',
            'direction' => 'sometimes|in:credit,debit',
            'type' => 'sometimes|string|max:30',
            'from' => 'sometimes|date',
            'to' => 'sometimes|date',
            'per_page' => 'sometimes|integer|min:1|max:50',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $walletService = app(WalletService::class);
        $walletService->reconcileFinalizedEarnings($request->user());

        $transactions = $walletService->getTransactions(
            $request->user(),
            'driver',
            $validator->validated(),
            $request->integer('per_page', 15)
        );

        return $this->success($transactions->through(fn (WalletTransaction $transaction) => $this->walletTransactionEntry($transaction)));
    }

    private function walletTransactionEntry(WalletTransaction $transaction): array
    {
        return [
            'transaction_id' => $transaction->transaction_id,
            'type' => $transaction->type,
            'service' => $transaction->service,
            'direction' => $transaction->direction,
            'amount' => (float) $transaction->amount,
            'balance_before' => (float) $transaction->balance_before,
            'balance_after' => (float) $transaction->balance_after,
            'currency' => $transaction->currency,
            'status' => $transaction->status,
            'reference' => $transaction->reference_type ? $transaction->reference_id : null,
            'description' => $transaction->description,
            'created_at' => $transaction->created_at?->toISOString(),
        ];
    }

    public function confirmCashCollection(Request $request, $rideId)
    {
        $validator = Validator::make($request->all(), [
            'method' => 'required|in:cash',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $ride = Ride::where('driver_id', $driver->id)->find($rideId);

            if (! $ride) {
                return $this->error('Ride not found', null, 404);
            }

            $result = $this->rideService->confirmCashCollection($ride, $driver);

            return $this->success([
                'ride' => $result['ride'],
                'payment' => $result['payment'],
            ], 'Cash collected — settle the amount in your wallet');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function settleCash(Request $request, $rideId)
    {
        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $ride = Ride::where('driver_id', $driver->id)->find($rideId);

            if (! $ride) {
                return $this->error('Ride not found', null, 404);
            }

            $result = $this->rideService->settleCashCollection($ride, $driver);

            return $this->success([
                'ride' => $result['ride'],
                'payment' => $result['payment'],
                'settled' => $result['settled'],
            ], $result['settled'] ? 'Cash settlement complete' : 'Wallet balance is short of the settlement amount');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function walletTopup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|gt:0',
            'payment_method' => 'required|in:upi,card,net_banking,wallet',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            $payment = app(PaymentService::class)->initiateWalletTopup(
                $request->user(),
                Money::fromMajor($request->input('amount')),
                $request->input('payment_method'),
                $request->input('idempotency_key')
            );

            return $this->success($this->walletCheckoutPayload($payment), 'Top-up initiated', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function verifyWalletTopup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payment_number' => 'required|string',
            'provider_payment_id' => 'required|string',
            'provider_order_id' => 'required|string',
            'signature' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = app(PaymentService::class)->verifyPayment(
                $request->user(),
                $request->input('payment_number'),
                $request->input('provider_order_id'),
                $request->input('provider_payment_id'),
                $request->input('signature'),
                $request->ip(),
                $request->userAgent()
            );

            $walletService = app(WalletService::class);
            $wallet = $walletService->ensureWallet($request->user(), 'driver');

            return $this->success([
                'status' => $result['status'],
                'already_processed' => $result['already_processed'] ?? false,
                'payment_number' => $result['payment']->payment_number,
                'wallet' => [
                    'wallet_type' => $wallet->wallet_type,
                    'currency' => $wallet->currency,
                    'balance' => (float) $wallet->balance,
                    'pending_balance' => (float) $wallet->pending_balance,
                    'available_balance' => (float) $walletService->available($request->user(), 'driver')->major(),
                    'total_earned' => (float) $walletService->totalEarned($request->user(), 'driver')->major(),
                    'total_credited' => (float) $wallet->total_credited,
                    'total_debited' => (float) $wallet->total_debited,
                    'status' => $wallet->status,
                ],
            ], 'Wallet credited');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    private function walletCheckoutPayload(Payment $payment): array
    {
        $gateway = app(PaymentService::class)->gateway();
        $isMock = str_contains(get_class($gateway), 'MockPaymentProvider');

        return [
            'payment_number' => $payment->payment_number,
            'provider_order_id' => $payment->provider_order_id,
            'amount_paise' => (int) $payment->amount_paise,
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency ?: 'INR',
            'method' => $payment->method,
            'key_id' => $isMock ? 'mock' : (app(IntegrationConfigResolver::class)->credentials('payments')['key_id'] ?? null),
            'mock' => $isMock,
        ];
    }

    public function requestWithdrawal(Request $request)
    {
        $validator = Validator::make($request->all(), [
            // Positivity only. Any real threshold is the configured
            // `partner_min_wallet_balance` floor, enforced server-side, so a
            // small payout is still allowed when the balance stays above it.
            'amount' => 'required|numeric|min:0.01',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $driver = Driver::where('user_id', $request->user()->id)->first();

            if (! $driver) {
                return $this->error('Driver profile not found', null, 404);
            }

            if (! $driver->bank_account_number || ! $driver->bank_ifsc) {
                return $this->error('Please add bank details first', null, 400);
            }

            $payout = app(WithdrawalService::class)->requestDriverWithdrawal(
                $request->user(),
                Money::fromMajor($request->input('amount')),
                $request->input('idempotency_key')
            );

            return $this->success($payout, 'Withdrawal request submitted', 201);
        } catch (PartnerWalletBalanceException $e) {
            // Surface the field so the client can attach the message to the
            // amount input rather than showing a bare toast.
            return $this->error($e->getMessage(), ['amount' => [$e->getMessage()]], 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }
}
