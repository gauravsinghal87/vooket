<?php

namespace App\Http\Controllers\API;

use App\Models\Zone;
use App\Services\Maps\ZoneService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ServiceabilityController extends BaseController
{
    public function __construct(protected ZoneService $zoneService) {}

    /**
     * Authoritative serviceability check for a coordinate + service pair.
     * Used by the customer address map picker to gate booking UX.
     */
    public function check(Request $request)
    {
        $validator = Validator::make($request->all() + $request->query(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'service' => 'required|in:food,grocery,ride',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $result = $this->zoneService->isServiceable(
            (float) $request->latitude,
            (float) $request->longitude,
            (string) $request->service
        );

        return $this->success($result);
    }

    /**
     * Public list of enabled services so clients can build their service
     * switcher without hard-coding which verticals are live.
     */
    public function services()
    {
        $serviceable = Zone::query()
            ->where('is_active', true)
            ->selectRaw('
                sum(case when food_enabled then 1 else 0 end) as food,
                sum(case when grocery_enabled then 1 else 0 end) as grocery,
                sum(case when ride_enabled then 1 else 0 end) as ride
            ')
            ->first();

        return $this->success([
            'services' => $this->zoneService->services(),
            'enabled' => [
                'food' => (int) ($serviceable?->food ?? 0) > 0,
                'grocery' => (int) ($serviceable?->grocery ?? 0) > 0,
                'ride' => (int) ($serviceable?->ride ?? 0) > 0,
            ],
        ]);
    }
}
