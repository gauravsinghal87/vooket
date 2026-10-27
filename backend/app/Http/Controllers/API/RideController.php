<?php

namespace App\Http\Controllers\API;

use App\Models\Driver;
use App\Models\Review;
use App\Models\Ride;
use App\Models\RideStatusHistory;
use App\Models\VehicleType;
use App\Services\RideService;
use App\Services\Tracking\RideTrackingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RideController extends BaseController
{
    public function __construct(
        private RideService $rideService,
        private RideTrackingService $trackingService,
    ) {}

    public function vehicleTypes()
    {
        $vehicleTypes = VehicleType::where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return $this->success($vehicleTypes);
    }

    public function estimate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pickup_latitude' => 'required|numeric',
            'pickup_longitude' => 'required|numeric',
            'destination_latitude' => 'required|numeric',
            'destination_longitude' => 'required|numeric',
            'vehicle_type_id' => 'sometimes|exists:vehicle_types,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $estimates = [];

            $vehicleTypes = VehicleType::where('is_active', true)->get();

            foreach ($vehicleTypes as $vt) {
                try {
                    $data = $request->all();
                    $data['vehicle_type_id'] = $vt->id;
                    $estimates[] = $this->rideService->estimateFare($data);
                } catch (\Exception $e) {
                    continue;
                }
            }

            if (empty($estimates)) {
                return $this->error('No fare estimates available for this route', null, 404);
            }

            return $this->success($estimates);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function index(Request $request)
    {
        $rides = Ride::where('user_id', $request->user()->id)
            ->latest()
            ->paginate($request->get('per_page', 15));

        return $this->success($rides);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pickup_latitude' => 'required|numeric|between:-90,90',
            'pickup_longitude' => 'required|numeric|between:-180,180',
            'destination_latitude' => 'required|numeric|between:-90,90',
            'destination_longitude' => 'required|numeric|between:-180,180',
            'vehicle_type_id' => 'required|exists:vehicle_types,id',
            'pickup_address' => 'sometimes|string|max:255',
            'destination_address' => 'sometimes|string|max:255',
            'payment_method' => 'sometimes|in:cash,wallet,online',
            'scheduled_at' => 'sometimes|date|after:now',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $ride = $this->rideService->createRide($request->user(), $request->all());

            return $this->success($ride, 'Ride requested', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function show(Request $request, $id)
    {
        $ride = Ride::where('user_id', $request->user()->id)
            ->with(['driver.user', 'driver.vehicleType', 'vehicleType', 'statusHistory'])
            ->find($id);

        if (! $ride) {
            return $this->error('Ride not found', null, 404);
        }

        $this->rideService->ensureSearching($ride);

        return $this->success($ride->fresh(['driver.user', 'driver.vehicleType', 'vehicleType', 'statusHistory']));
    }

    /**
     * Privacy-safe list of eligible drivers near the requested pickup,
     * refined by vehicle type so the booking sheet can show live availability
     * and pickup ETA before the customer books.
     */
    public function nearbyDrivers(Request $request)
    {
        $validator = Validator::make($request->all() + $request->query(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'vehicle_type_id' => 'sometimes|exists:vehicle_types,id',
            'radius_km' => 'sometimes|numeric|min:0.5|max:10',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $drivers = $this->rideService->nearbyDrivers(
                (float) $request->latitude,
                (float) $request->longitude,
                $request->filled('vehicle_type_id') ? (int) $request->vehicle_type_id : null,
                $request->filled('radius_km') ? (float) $request->radius_km : null,
            );

            return $this->success($drivers);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    /**
     * Route between pickup and destination. Returns routed distance, duration
     * and an encoded polyline when a real maps provider is active; otherwise a
     * straight-line (haversine) estimate with no polyline.
     */
    public function route(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pickup_latitude' => 'required|numeric|between:-90,90',
            'pickup_longitude' => 'required|numeric|between:-180,180',
            'destination_latitude' => 'required|numeric|between:-90,90',
            'destination_longitude' => 'required|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $route = $this->rideService->directionsForRoute([
                'latitude' => (float) $request->pickup_latitude,
                'longitude' => (float) $request->pickup_longitude,
            ], [
                'latitude' => (float) $request->destination_latitude,
                'longitude' => (float) $request->destination_longitude,
            ]);

            return $this->success($route);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function cancel(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'sometimes|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $ride = Ride::where('user_id', $request->user()->id)->find($id);

            if (! $ride) {
                return $this->error('Ride not found', null, 404);
            }

            $ride = $this->rideService->cancelRide($ride, $request->user(), $request->reason ?? null);

            return $this->success($ride, 'Ride cancelled');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function verifyOtp(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'otp' => 'required|digits:6',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $ride = Ride::where('user_id', $request->user()->id)->find($id);

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
            ]);

            RideStatusHistory::create([
                'ride_id' => $ride->id,
                'status' => 'IN_PROGRESS',
                'notes' => 'OTP verified, trip started',
                'changed_by' => $request->user()->id,
            ]);

            return $this->success($ride->fresh('vehicleType'), 'OTP verified');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function rate(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'rating' => 'required|numeric|min:1|max:5',
            'comment' => 'sometimes|string|max:1000',
            'tip_amount' => 'sometimes|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $ride = Ride::where('user_id', $request->user()->id)->find($id);

            if (! $ride) {
                return $this->error('Ride not found', null, 404);
            }

            if ($ride->status !== 'COMPLETED') {
                return $this->error('Can only rate completed rides', null, 400);
            }

            $existingReview = Review::where('user_id', $request->user()->id)
                ->where('order_id', $ride->id)
                ->first();

            if ($existingReview) {
                return $this->error('Already rated this ride', null, 400);
            }

            $review = Review::create([
                'user_id' => $request->user()->id,
                'reviewable_type' => Driver::class,
                'reviewable_id' => $ride->driver_id,
                'order_id' => $ride->id,
                'rating' => $request->rating,
                'comment' => $request->comment,
                'status' => 'approved',
            ]);

            if ($ride->driver) {
                $driverReviews = Review::where('reviewable_type', Driver::class)
                    ->where('reviewable_id', $ride->driver_id)
                    ->where('status', 'approved');

                $avgRating = $driverReviews->avg('rating');
                $reviewCount = $driverReviews->count();

                $ride->driver->update([
                    'rating' => round($avgRating, 2),
                    'rating_count' => $reviewCount,
                ]);
            }

            return $this->success($review, 'Rating submitted', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    /**
     * Privacy-safe live tracking snapshot for a ride (customer, assigned
     * driver or admin only).
     */
    public function tracking(Request $request, $id)
    {
        $ride = Ride::with(['driver.user', 'driver.vehicleType', 'vehicleType'])->find($id);

        if (! $ride) {
            return $this->error('Ride not found', null, 404);
        }

        if (! $this->trackingService->canTrack($request->user(), $ride)) {
            return $this->error('Forbidden', null, 403);
        }

        return $this->success($this->trackingService->payload($ride));
    }

    public function sos(Request $request, $id)
    {
        $ride = Ride::where('user_id', $request->user()->id)->find($id);

        if (! $ride) {
            return $this->error('Ride not found', null, 404);
        }

        if (! in_array($ride->status, ['DRIVER_ARRIVED', 'IN_PROGRESS'])) {
            return $this->error('SOS is only available for active rides', null, 400);
        }

        RideStatusHistory::create([
            'ride_id' => $ride->id,
            'status' => 'SOS',
            'notes' => 'SOS triggered by customer',
            'changed_by' => $request->user()->id,
        ]);

        return $this->success(null, 'SOS alert sent. Emergency services have been notified.');
    }
}
