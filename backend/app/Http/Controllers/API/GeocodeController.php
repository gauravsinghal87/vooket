<?php

namespace App\Http\Controllers\API;

use App\Services\GeocodingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class GeocodeController extends BaseController
{
    public function __construct(protected GeocodingService $geocoding) {}

    public function search(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'q' => 'required|string|max:200',
            'country' => 'sometimes|nullable|string|max:2',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        return $this->success(
            $this->geocoding->autocompletePayload($request->query('q', ''), $request->query('country')),
            'Addresses found',
        );
    }

    public function details(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'place_id' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $details = $this->geocoding->details($request->query('place_id', ''));

        if (! $details) {
            return $this->error('Could not resolve that place', null, 422);
        }

        return $this->success($details, 'Place resolved');
    }

    public function reverse(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $address = $this->geocoding->reverse((float) $request->query('lat'), (float) $request->query('lng'));

        if (! $address) {
            return $this->error('Could not resolve that location', null, 422);
        }

        return $this->success($address, 'Location resolved');
    }
}
