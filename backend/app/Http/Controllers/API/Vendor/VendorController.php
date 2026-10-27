<?php

namespace App\Http\Controllers\API\Vendor;

use App\Http\Controllers\API\BaseController;
use App\Models\Vendor;
use App\Services\Maps\ZoneService;
use App\Services\RestaurantOperatingHoursService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class VendorController extends BaseController
{
    public function __construct(protected ZoneService $zoneService) {}

    public function me(Request $request)
    {
        $user = $request->user()->load(['roles', 'vendor']);

        $vendor = $user->vendor;
        if ($vendor) {
            $user->setAttribute('vendor', $vendor);
            $user->vendor->setAttribute('wallet', $user->wallet);
        }

        return $this->success($user);
    }

    public function updateProfile(Request $request)
    {
        $vendor = $request->user()->vendor;

        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), array_merge([
            'business_name' => 'sometimes|string|max:255',
            'owner_name' => 'sometimes|string|max:255',
            'address' => 'sometimes|string|max:500',
            'latitude' => 'sometimes|nullable|numeric|between:-90,90',
            'longitude' => 'sometimes|nullable|numeric|between:-180,180',
            'gst_number' => 'sometimes|string|max:50',
            'pan_number' => 'sometimes|string|max:50',
            'fssai_number' => 'sometimes|string|max:50',
            'bank_account_name' => 'sometimes|string|max:255',
            'bank_account_number' => 'sometimes|string|max:50',
            'bank_ifsc' => 'sometimes|string|max:20',
            'bank_name' => 'sometimes|string|max:120',
            'logo' => 'sometimes|nullable|string|max:500',
            'cover_image' => 'sometimes|nullable|string|max:500',
        ], RestaurantOperatingHoursService::rules(false)));

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        // Restaurant schedule fields live on the outlet, not the vendor row.
        $schedule = array_intersect_key($data, array_flip(RestaurantOperatingHoursService::fieldKeys()));
        $data = array_diff_key($data, $schedule);

        if ($schedule !== [] && $vendor->vendor_type === 'restaurant') {
            if ($error = $this->scheduleConflictError($vendor, $schedule)) {
                return $error;
            }

            $vendor->ensureOutlet()?->update($schedule);
        }

        foreach (['logo', 'cover_image'] as $field) {
            if (! array_key_exists($field, $data)) {
                continue;
            }
            $old = $vendor->{$field};
            if (empty($data[$field]) || $data[$field] !== $old) {
                $this->deleteStoredImage($old);
            }
        }

        $vendor->update($data);

        $this->syncOutletLocation($vendor, $data);

        return $this->success($vendor->fresh(), 'Profile updated');
    }

    /**
     * A single-sided schedule update (only opens_at or only closes_at) skips
     * the validator's `different:opens_at` rule, so compare it against the
     * value already stored on the outlet before accepting it.
     *
     * @param  array<string, mixed>  $schedule
     */
    protected function scheduleConflictError(Vendor $vendor, array $schedule): ?JsonResponse
    {
        if (isset($schedule['opens_at']) === isset($schedule['closes_at'])) {
            return null;
        }

        $outlet = $vendor->restaurants()->first();

        if (! $outlet) {
            return null;
        }

        $effectiveOpensAt = RestaurantOperatingHoursService::normalize($schedule['opens_at'] ?? $outlet->opens_at);
        $effectiveClosesAt = RestaurantOperatingHoursService::normalize($schedule['closes_at'] ?? $outlet->closes_at);

        if ($effectiveOpensAt === null || $effectiveClosesAt === null || $effectiveOpensAt !== $effectiveClosesAt) {
            return null;
        }

        return $this->error('Validation failed', [
            'opens_at' => ['Opening and closing times must be different.'],
            'closes_at' => ['Opening and closing times must be different.'],
        ], 422);
    }

    /**
     * Keep outlet (restaurant/store) pickup coordinates in sync with the
     * vendor's saved map location so dispatch ranking always has a pickup
     * point to rank partners against.
     *
     * @param  array<string, mixed>  $data
     */
    protected function syncOutletLocation(Vendor $vendor, array $data): void
    {
        if (! array_key_exists('latitude', $data) && ! array_key_exists('longitude', $data)) {
            return;
        }

        $latitude = $data['latitude'] ?? $vendor->latitude;
        $longitude = $data['longitude'] ?? $vendor->longitude;

        $vendor->restaurants()->update(['latitude' => $latitude, 'longitude' => $longitude]);
        $vendor->stores()->update(['latitude' => $latitude, 'longitude' => $longitude]);

        if ($latitude === null || $longitude === null) {
            return;
        }

        $service = $vendor->vendor_type === 'grocery' ? ZoneService::SERVICE_GROCERY : ZoneService::SERVICE_FOOD;

        $vendor->update([
            'zone_id' => $this->zoneService->resolve((float) $latitude, (float) $longitude, $service)?->id,
        ]);
    }

    public function uploadImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,webp,gif|max:4096',
            'type' => 'required|in:logo,cover_image',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $path = $request->file('image')->store('vendor-images', 'public');
            $type = $validator->validated()['type'];

            return $this->success([$type => $this->imageUrl($path)], 'Image uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    private function imageUrl(string $path): string
    {
        $url = rtrim(config('app.url'), '/').'/storage/';

        return $url.$path;
    }

    private function deleteStoredImage(?string $image): void
    {
        if (! $image) {
            return;
        }

        $base = rtrim(config('app.url'), '/').'/storage/';

        if (! Str::startsWith($image, $base)) {
            return;
        }

        $path = Str::after($image, $base);

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
