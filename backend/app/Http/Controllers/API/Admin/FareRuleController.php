<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\FareRule;
use App\Models\VehicleType;
use App\Services\AuditService;
use App\Services\FareCalculationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class FareRuleController extends BaseController
{
    public function __construct(
        private AuditService $audit,
        private FareCalculationService $fareCalculation,
    ) {}

    public function index(Request $request)
    {
        $query = FareRule::with('vehicleType');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('vehicleType', fn ($vt) => $vt->where('name', 'like', "%{$search}%"))
                    ->orWhere('city', 'like', "%{$search}%");
            });
        }

        return $this->success($query->latest()->get());
    }

    public function show(int $id)
    {
        $rule = FareRule::with('vehicleType')->find($id);

        if (! $rule) {
            return $this->error('Fare rule not found', null, 404);
        }

        return $this->success($rule);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), $this->rules(true));

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $this->normalizedData($validator->validated());

        if ($this->activeConflict($data, null)) {
            return $this->error('An active fare rule already exists for this vehicle/zone combination.', null, 422);
        }

        $rule = FareRule::create($data);

        FareRule::flushCaches((int) $rule->vehicle_type_id, $rule->zone_id);
        $this->audit->created($rule, $rule->toArray());

        return $this->success($rule->fresh('vehicleType'), 'Fare rule created', 201);
    }

    public function update(Request $request, int $id)
    {
        $rule = FareRule::find($id);

        if (! $rule) {
            return $this->error('Fare rule not found', null, 404);
        }

        $validator = Validator::make($request->all(), $this->rules());

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $this->normalizedData($validator->validated());
        $data['vehicle_type_id'] = (int) ($data['vehicle_type_id'] ?? $rule->vehicle_type_id);
        $zoneId = array_key_exists('zone_id', $data) ? $data['zone_id'] : $rule->zone_id;

        $turningActive = isset($data['is_active'])
            ? filter_var($data['is_active'], FILTER_VALIDATE_BOOL)
            : (bool) $rule->is_active;

        if ($turningActive && $this->activeConflictForId((int) $data['vehicle_type_id'], $zoneId, $rule->id)) {
            return $this->error('An active fare rule already exists for this vehicle/zone combination.', null, 422);
        }

        $oldValues = $rule->getOriginal();
        $rule->update($data);

        FareRule::flushCaches((int) $rule->vehicle_type_id, $rule->zone_id);
        $this->audit->updated($rule, $oldValues, $rule->getChanges());

        return $this->success($rule->fresh('vehicleType'), 'Fare rule updated');
    }

    public function toggle(Request $request, int $id)
    {
        $rule = FareRule::find($id);

        if (! $rule) {
            return $this->error('Fare rule not found', null, 404);
        }

        $next = ! $rule->is_active;

        if ($next && $this->activeConflictForId((int) $rule->vehicle_type_id, $rule->zone_id, $rule->id)) {
            return $this->error('An active fare rule already exists for this vehicle/zone combination.', null, 422);
        }

        $oldActive = (bool) $rule->is_active;
        $rule->update(['is_active' => $next]);

        FareRule::flushCaches((int) $rule->vehicle_type_id, $rule->zone_id);
        $this->audit->log('fare_rule_toggled', FareRule::class, $rule->id, ['is_active' => $oldActive], ['is_active' => $next], 'Fare rule toggled');

        return $this->success($rule->fresh('vehicleType'), 'Fare rule updated');
    }

    public function destroy(int $id)
    {
        $rule = FareRule::find($id);

        if (! $rule) {
            return $this->error('Fare rule not found', null, 404);
        }

        $this->audit->deleted($rule);
        $rule->delete();

        FareRule::flushCaches((int) $rule->vehicle_type_id, $rule->zone_id);

        return $this->success(null, 'Fare rule deleted');
    }

    /**
     * Server-side fare preview for the admin form. Uses the exact same
     * formula as the customer estimate flow so the admin never re-implements it.
     */
    public function preview(Request $request)
    {
        $validator = Validator::make($request->all(), array_merge($this->rules(true), [
            'distance_km' => 'required|numeric|min:0|max:500',
            'duration_min' => 'required|integer|min:1|max:1440',
        ]));

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $rule = $this->normalizedData($validator->validated());

        $result = $this->fareCalculation->calculate(
            $rule,
            (float) $request->distance_km,
            (int) $request->duration_min,
        );

        $vehicleType = $request->filled('vehicle_type_id')
            ? VehicleType::find((int) $request->vehicle_type_id)
            : null;

        return $this->success([
            'distance_km' => (float) $request->distance_km,
            'duration_min' => (int) $request->duration_min,
            'vehicle_type' => $vehicleType,
            'currency' => config('ride.currency', 'INR'),
            ...$result,
        ]);
    }

    protected function rules(bool $store = false): array
    {
        $requires = $store ? 'required' : 'sometimes';

        return [
            'vehicle_type_id' => "{$requires}|integer|exists:vehicle_types,id",
            'zone_id' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:191',
            'base_fare' => "{$requires}|numeric|min:0",
            'per_km' => "{$requires}|numeric|min:0",
            'per_minute' => "{$requires}|numeric|min:0",
            'minimum_fare' => "{$requires}|numeric|min:0",
            'booking_fee' => 'nullable|numeric|min:0',
            'platform_fee' => 'nullable|numeric|min:0',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'surge_multiplier_max' => 'nullable|numeric|min:1',
            'waiting_charge_per_min' => 'nullable|numeric|min:0',
            'waiting_fee_per_minute' => 'nullable|numeric|min:0',
            'cancellation_fee' => 'nullable|numeric|min:0',
            'driver_earn_percentage' => 'nullable|numeric|min:0|max:100',
            'driver_commission_percent' => 'nullable|numeric|min:0|max:100',
            'is_active' => 'nullable|boolean',
            'meta' => 'nullable|array',
        ];
    }

    /**
     * Map the admin-facing field names onto the existing fare_rules schema.
     * "driver_commission_percent" is the platform commission (100 - driver share).
     */
    protected function normalizedData(array $data): array
    {
        if (array_key_exists('waiting_fee_per_minute', $data) && ! array_key_exists('waiting_charge_per_min', $data)) {
            $data['waiting_charge_per_min'] = $data['waiting_fee_per_minute'];
        }

        if (array_key_exists('driver_commission_percent', $data) && ! array_key_exists('driver_earn_percentage', $data)) {
            $data['driver_earn_percentage'] = round(100 - (float) $data['driver_commission_percent'], 2);
        }

        unset($data['waiting_fee_per_minute'], $data['driver_commission_percent']);

        return $data;
    }

    protected function activeConflict(array $data, ?int $excludeId = null): bool
    {
        $vehicleTypeId = (int) $data['vehicle_type_id'];
        $zoneId = array_key_exists('zone_id', $data) ? $data['zone_id'] : null;

        return $this->activeConflictForId($vehicleTypeId, $zoneId, $excludeId);
    }

    protected function activeConflictForId(int $vehicleTypeId, ?string $zoneId, ?int $excludeId = null): bool
    {
        $query = FareRule::where('vehicle_type_id', $vehicleTypeId)->where('is_active', true);

        if ($zoneId !== null && $zoneId !== '') {
            $query->where('zone_id', $zoneId);
        } else {
            $query->whereNull('zone_id');
        }

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }
}
