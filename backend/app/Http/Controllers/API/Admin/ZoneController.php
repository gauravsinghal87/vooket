<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\Vendor;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;
use App\Services\Maps\ZoneService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ZoneController extends BaseController
{
    public function __construct(protected ZoneService $zoneService) {}

    /**
     * Zone list with live operational counters for the admin grid.
     */
    public function index(Request $request)
    {
        $query = Zone::query()->withCount([
            'deliveryConfigs as food_delivery_configs_count' => fn ($q) => $q
                ->where('module', ZoneDeliveryConfig::MODULE_FOOD)
                ->where('delivery_mode', ZoneDeliveryConfig::MODE_STANDARD),
            'deliveryConfigs as grocery_instant_delivery_configs_count' => fn ($q) => $q
                ->where('module', ZoneDeliveryConfig::MODULE_GROCERY)
                ->where('delivery_mode', ZoneDeliveryConfig::MODE_INSTANT),
            'deliveryConfigs as grocery_scheduled_delivery_configs_count' => fn ($q) => $q
                ->where('module', ZoneDeliveryConfig::MODULE_GROCERY)
                ->where('delivery_mode', ZoneDeliveryConfig::MODE_SCHEDULED)
                ->whereIn('delivery_type', [
                    ZoneDeliveryConfig::TYPE_FREE,
                    ZoneDeliveryConfig::TYPE_CHARGEABLE,
                ])
                ->where(function ($inner) {
                    $inner->where('delivery_type', ZoneDeliveryConfig::TYPE_CHARGEABLE)
                        ->orWhereNotNull('admin_fee_per_parcel');
                }),
        ]);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $zones = $query->orderByDesc('priority')->latest()->paginate($request->integer('per_page', 50));

        $zoneIds = collect($zones->items())->pluck('id');

        $restaurantCounts = $this->countsByZone(Vendor::query()->where('vendor_type', 'restaurant'), $zoneIds);
        $storeCounts = $this->countsByZone(Vendor::query()->where('vendor_type', 'grocery'), $zoneIds);
        $onlineFoodPartners = $this->countsByZone(DeliveryPartner::query()->where('service_type', 'food')->where('is_online', true), $zoneIds, 'current_zone_id');
        $onlineGroceryPartners = $this->countsByZone(DeliveryPartner::query()->where('service_type', 'grocery')->where('is_online', true), $zoneIds, 'current_zone_id');
        $onlineDrivers = $this->countsByZone(Driver::query()->where('is_online', true), $zoneIds, 'current_zone_id');

        foreach ($zones as $zone) {
            $zone->setAttribute('restaurant_count', $restaurantCounts[$zone->id] ?? 0);
            $zone->setAttribute('store_count', $storeCounts[$zone->id] ?? 0);
            $zone->setAttribute('online_food_partners', $onlineFoodPartners[$zone->id] ?? 0);
            $zone->setAttribute('online_grocery_partners', $onlineGroceryPartners[$zone->id] ?? 0);
            $zone->setAttribute('online_drivers', $onlineDrivers[$zone->id] ?? 0);

            // The zone list badge must count COMPLETE configurations, not just
            // rows, so an incomplete Scheduled Free row is still "setup required".
            $zone->setAttribute('delivery_configs_count',
                (int) $zone->food_delivery_configs_count
                + (int) $zone->grocery_instant_delivery_configs_count
                + (int) $zone->grocery_scheduled_delivery_configs_count
            );
        }

        return $this->success($zones);
    }

    /**
     * Public, active-only zone list for the partner registration dropdown
     * (food/grocery delivery partners must pick an assigned service zone).
     */
    public function publicActive()
    {
        $zones = Zone::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'city', 'food_enabled', 'grocery_enabled']);

        return $this->success($zones);
    }

    public function show(int $id)
    {
        $zone = Zone::with(['creator:id,name', 'updater:id,name'])->find($id);

        if (! $zone) {
            return $this->error('Zone not found', null, 404);
        }

        return $this->success($zone);
    }

    public function store(Request $request)
    {
        $validator = $this->validator($request);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        if ($request->filled('polygon')) {
            $polygonCheck = $this->zoneService->validatePolygon($request->input('polygon'));

            if (! $polygonCheck['valid']) {
                return $this->error('Invalid zone boundary', ['polygon' => $polygonCheck['errors']], 422);
            }
        }

        $data = $this->normalize($validator->validated());
        $data['created_by'] = $request->user()?->id;

        $zone = Zone::create($data);

        $this->zoneService->bumpConfigurationVersion();

        return $this->success($zone->fresh(), 'Zone created', 201);
    }

    public function update(Request $request, int $id)
    {
        $zone = Zone::find($id);

        if (! $zone) {
            return $this->error('Zone not found', null, 404);
        }

        $validator = $this->validator($request, $id);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        if ($request->filled('polygon')) {
            $polygonCheck = $this->zoneService->validatePolygon($request->input('polygon'));

            if (! $polygonCheck['valid']) {
                return $this->error('Invalid zone boundary', ['polygon' => $polygonCheck['errors']], 422);
            }
        }

        $data = $this->normalize($validator->validated());
        $data['updated_by'] = $request->user()?->id;

        $zone->update($data);

        $this->zoneService->bumpConfigurationVersion();

        return $this->success($zone->fresh(), 'Zone updated');
    }

    public function destroy(Request $request, int $id)
    {
        $zone = Zone::find($id);

        if (! $zone) {
            return $this->error('Zone not found', null, 404);
        }

        // Safe-guard: zones referenced by partners/drivers/orders are detached
        // via nullOnDelete; the zone itself is soft-purged only when unassigned.
        $zone->forceDelete();

        $this->zoneService->bumpConfigurationVersion();

        return $this->success(null, 'Zone deleted');
    }

    public function toggleStatus(Request $request, int $id)
    {
        $zone = Zone::find($id);

        if (! $zone) {
            return $this->error('Zone not found', null, 404);
        }

        $zone->update([
            'is_active' => ! $zone->is_active,
            'updated_by' => $request->user()?->id,
        ]);

        $this->zoneService->bumpConfigurationVersion();

        return $this->success($zone->fresh(), $zone->fresh()->is_active ? 'Zone enabled' : 'Zone disabled');
    }

    /**
     * Validate a polygon payload without persisting (used by the admin map
     * editor before save).
     */
    public function validate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'polygon' => 'required|array|min:3',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $result = $this->zoneService->validatePolygon($request->input('polygon'));

        if (! $result['valid']) {
            return $this->error('Invalid zone boundary', ['polygon' => $result['errors']], 422);
        }

        return $this->success(['valid' => true], 'Zone boundary is valid');
    }

    protected function validator(Request $request, ?int $ignoreId = null): \Illuminate\Validation\Validator
    {
        $uniqueRule = $ignoreId ? "unique:zones,code,{$ignoreId}" : 'unique:zones,code';

        return Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => "nullable|string|max:50|{$uniqueRule}",
            'description' => 'sometimes|nullable|string|max:1000',
            'country' => 'sometimes|string|size:2',
            'state' => 'sometimes|nullable|string|max:255',
            'city' => 'sometimes|nullable|string|max:255',
            'type' => 'sometimes|string|in:delivery,ride,service_area,multi',
            'food_enabled' => 'sometimes|boolean',
            'grocery_enabled' => 'sometimes|boolean',
            'ride_enabled' => 'sometimes|boolean',
            'priority' => 'sometimes|integer|min:0',
            'center_latitude' => 'sometimes|nullable|numeric|between:-90,90',
            'center_longitude' => 'sometimes|nullable|numeric|between:-180,180',
            'radius_km' => 'sometimes|nullable|numeric|min:0|max:200',
            'food_partner_search_radius_km' => 'sometimes|nullable|numeric|min:0.5|max:100',
            'grocery_partner_search_radius_km' => 'sometimes|nullable|numeric|min:0.5|max:100',
            'ride_driver_search_radius_km' => 'sometimes|nullable|numeric|min:0.5|max:100',
            'polygon' => 'sometimes|array|min:3',
            'allow_cross_zone_food_delivery' => 'sometimes|boolean',
            'allow_cross_zone_grocery_delivery' => 'sometimes|boolean',
            'allow_ride_drop_outside_zone' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'meta' => 'sometimes|array',
        ]);
    }

    /**
     * Shape validated input for persistence (booleans cast, polygon kept as
     * of source order for the editor to re-use).
     */
    protected function normalize(array $data): array
    {
        foreach ([
            'food_enabled',
            'grocery_enabled',
            'ride_enabled',
            'allow_cross_zone_food_delivery',
            'allow_cross_zone_grocery_delivery',
            'allow_ride_drop_outside_zone',
            'is_active',
        ] as $boolean) {
            if (array_key_exists($boolean, $data)) {
                $data[$boolean] = filter_var($data[$boolean], FILTER_VALIDATE_BOOL);
            }
        }

        if (array_key_exists('polygon', $data) && $data['polygon'] !== null) {
            $data['polygon'] = $this->zoneService->normalizePolygon($data['polygon']);
        }

        if (array_key_exists('meta', $data) && ! is_array($data['meta'])) {
            $data['meta'] = json_decode((string) $data['meta'], true) ?: null;
        }

        return $data;
    }

    protected function countsByZone($query, $zoneIds, string $column = 'zone_id'): array
    {
        return $query->whereIn($column, $zoneIds)
            ->selectRaw("{$column}, count(*) as total")
            ->groupBy($column)
            ->pluck('total', $column)
            ->all();
    }
}
