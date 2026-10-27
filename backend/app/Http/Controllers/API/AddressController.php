<?php

namespace App\Http\Controllers\API;

use App\Models\Address;
use App\Services\GeocodingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AddressController extends BaseController
{
    public function __construct(protected GeocodingService $geocoding) {}

    public function index(Request $request)
    {
        $addresses = Address::where('user_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->get();

        return $this->success($addresses);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'label' => 'sometimes|string|max:50',
            'contact_name' => 'sometimes|nullable|string|max:255',
            'contact_phone' => 'sometimes|nullable|string|max:20',
            'address_line_1' => 'required|string|max:255',
            'address_line_2' => 'sometimes|nullable|string|max:255',
            'landmark' => 'sometimes|nullable|string|max:255',
            'city' => 'required|string|max:100',
            'state' => 'sometimes|nullable|string|max:100',
            'postal_code' => 'sometimes|nullable|string|max:20',
            'country' => 'sometimes|nullable|string|max:50',
            'place_id' => 'sometimes|nullable|string|max:255',
            'formatted_address' => 'sometimes|nullable|string|max:500',
            'latitude' => 'sometimes|nullable|numeric|between:-90,90',
            'longitude' => 'sometimes|nullable|numeric|between:-180,180',
            'type' => 'sometimes|in:delivery,pickup,billing,home,work,other',
            'is_default' => 'sometimes|boolean',
            'meta' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $data = $validator->validated();

            if (blank($data['latitude'] ?? null) || blank($data['longitude'] ?? null)) {
                $resolved = config('services.geocoding.enabled')
                    ? $this->geocoding->geocode($this->geocoding->queryFor($data))
                    : null;
                $data['latitude'] = $resolved['latitude'] ?? ($data['latitude'] ?? null);
                $data['longitude'] = $resolved['longitude'] ?? ($data['longitude'] ?? null);
            }

            $isDefault = filter_var($data['is_default'] ?? false, FILTER_VALIDATE_BOOL);
            if ($isDefault) {
                $request->user()->addresses()->where('is_default', true)->update(['is_default' => false]);
            }

            $address = Address::create(array_merge($data, ['user_id' => $request->user()->id]));

            if (! $request->user()->addresses()->where('is_default', true)->exists()) {
                $address->update(['is_default' => true]);
            }

            return $this->success($address->fresh(), 'Address created', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function show(Request $request, $id)
    {
        $address = Address::where('user_id', $request->user()->id)->find($id);

        if (! $address) {
            return $this->error('Address not found', null, 404);
        }

        return $this->success($address);
    }

    public function update(Request $request, $id)
    {
        $address = Address::where('user_id', $request->user()->id)->find($id);

        if (! $address) {
            return $this->error('Address not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'label' => 'sometimes|string|max:50',
            'contact_name' => 'sometimes|nullable|string|max:255',
            'contact_phone' => 'sometimes|nullable|string|max:20',
            'address_line_1' => 'sometimes|string|max:255',
            'address_line_2' => 'sometimes|nullable|string|max:255',
            'landmark' => 'sometimes|nullable|string|max:255',
            'city' => 'sometimes|string|max:100',
            'state' => 'sometimes|nullable|string|max:100',
            'postal_code' => 'sometimes|nullable|string|max:20',
            'country' => 'sometimes|nullable|string|max:50',
            'place_id' => 'sometimes|nullable|string|max:255',
            'formatted_address' => 'sometimes|nullable|string|max:500',
            'latitude' => 'sometimes|nullable|numeric|between:-90,90',
            'longitude' => 'sometimes|nullable|numeric|between:-180,180',
            'type' => 'sometimes|in:delivery,pickup,billing,home,work,other',
            'is_default' => 'sometimes|boolean',
            'meta' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $data = $validator->validated();

            if (! array_key_exists('latitude', $data) && ! array_key_exists('longitude', $data)
                && blank($address->latitude) && blank($address->longitude)
                && config('services.geocoding.enabled')) {
                $resolved = $this->geocoding->geocode($this->geocoding->queryFor(array_merge($address->toArray(), $data)));
                if ($resolved) {
                    $data['latitude'] = $resolved['latitude'];
                    $data['longitude'] = $resolved['longitude'];
                }
            }

            $isDefault = filter_var($data['is_default'] ?? false, FILTER_VALIDATE_BOOL);
            if ($isDefault && ! $address->is_default) {
                $request->user()->addresses()->where('is_default', true)->update(['is_default' => false]);
            }

            $address->update($data);

            return $this->success($address->fresh(), 'Address updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $address = Address::where('user_id', $request->user()->id)->find($id);

        if (! $address) {
            return $this->error('Address not found', null, 404);
        }

        try {
            $wasDefault = $address->is_default;
            $address->delete();

            if ($wasDefault) {
                $first = $request->user()->addresses()->first();
                if ($first) {
                    $first->update(['is_default' => true]);
                }
            }

            return $this->success(null, 'Address deleted');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function setDefault(Request $request, $id)
    {
        $address = Address::where('user_id', $request->user()->id)->find($id);

        if (! $address) {
            return $this->error('Address not found', null, 404);
        }

        try {
            $request->user()->addresses()->where('is_default', true)->update(['is_default' => false]);
            $address->update(['is_default' => true]);

            return $this->success($address->fresh(), 'Default address set');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }
}
