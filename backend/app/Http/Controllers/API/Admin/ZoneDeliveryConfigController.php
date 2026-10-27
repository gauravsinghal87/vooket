<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;
use App\Services\Pricing\ZoneDeliveryConfigService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ZoneDeliveryConfigController extends BaseController
{
    public function __construct(private ZoneDeliveryConfigService $zoneConfigs) {}

    public function globalValues(): JsonResponse
    {
        return $this->success([
            'food' => $this->zoneConfigs->globalValues(
                ZoneDeliveryConfig::MODULE_FOOD,
                ZoneDeliveryConfig::MODE_STANDARD
            ),
            'grocery_instant' => $this->zoneConfigs->globalValues(
                ZoneDeliveryConfig::MODULE_GROCERY,
                ZoneDeliveryConfig::MODE_INSTANT
            ),
            'grocery_scheduled_free' => $this->zoneConfigs->globalValues(
                ZoneDeliveryConfig::MODULE_GROCERY,
                ZoneDeliveryConfig::MODE_SCHEDULED,
                ZoneDeliveryConfig::TYPE_FREE
            ),
            'grocery_scheduled_chargeable' => $this->zoneConfigs->globalValues(
                ZoneDeliveryConfig::MODULE_GROCERY,
                ZoneDeliveryConfig::MODE_SCHEDULED,
                ZoneDeliveryConfig::TYPE_CHARGEABLE
            ),
        ]);
    }

    public function show(Zone $zone): JsonResponse
    {
        $zone->load('deliveryConfigs');

        return $this->success([
            'zone' => $zone,
            'configs' => $this->zoneConfigs->adminSnapshot($zone),
        ]);
    }

    /**
     * Rollout overview: every zone and whether each required combination has a
     * complete saved configuration. This is what lets the admin module mark
     * setup-required zones before a customer is blocked at checkout.
     */
    public function status(): JsonResponse
    {
        $zones = Zone::query()->orderBy('name')->get();

        $rows = $zones->map(function (Zone $zone): array {
            $food = $this->zoneConfigs->isComplete(
                $zone,
                ZoneDeliveryConfig::MODULE_FOOD,
                ZoneDeliveryConfig::MODE_STANDARD
            );
            $instant = $this->zoneConfigs->isComplete(
                $zone,
                ZoneDeliveryConfig::MODULE_GROCERY,
                ZoneDeliveryConfig::MODE_INSTANT
            );
            $scheduled = $this->zoneConfigs->isComplete(
                $zone,
                ZoneDeliveryConfig::MODULE_GROCERY,
                ZoneDeliveryConfig::MODE_SCHEDULED
            );

            $missing = array_keys(array_filter([
                'food' => ! $food,
                'grocery_instant' => ! $instant,
                'grocery_scheduled' => ! $scheduled,
            ]));

            return [
                'id' => $zone->id,
                'name' => $zone->name,
                'code' => $zone->code,
                'city' => $zone->city,
                'is_active' => (bool) $zone->is_active,
                'food_enabled' => (bool) $zone->food_enabled,
                'grocery_enabled' => (bool) $zone->grocery_enabled,
                'configured' => [
                    'food' => $food,
                    'grocery_instant' => $instant,
                    'grocery_scheduled' => $scheduled,
                ],
                'missing' => $missing,
            ];
        });

        return $this->success([
            'zones' => $rows,
            'missing_count' => $rows->filter(fn (array $row): bool => $row['missing'] !== [])->count(),
        ]);
    }

    /**
     * Explicit, repeatable rollout: copy current global values into missing zone
     * rows only. Existing (including incomplete) rows are never overwritten.
     */
    public function backfill(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dry_run' => ['sometimes', 'boolean'],
        ]);

        return $this->success(
            $this->zoneConfigs->backfillMissingFromGlobal((bool) ($validated['dry_run'] ?? false)),
            'Zone delivery configurations initialized from global values'
        );
    }

    public function upsert(Request $request, Zone $zone): JsonResponse
    {
        $validated = $request->validate([
            'module' => ['required', Rule::in([ZoneDeliveryConfig::MODULE_FOOD, ZoneDeliveryConfig::MODULE_GROCERY])],
            'delivery_mode' => ['required', Rule::in([
                ZoneDeliveryConfig::MODE_STANDARD,
                ZoneDeliveryConfig::MODE_INSTANT,
                ZoneDeliveryConfig::MODE_SCHEDULED,
            ])],
            'delivery_type' => ['nullable', Rule::in([ZoneDeliveryConfig::TYPE_FREE, ZoneDeliveryConfig::TYPE_CHARGEABLE])],
            'delivery_fee_per_km' => ['sometimes', 'numeric', 'min:0'],
            'delivery_fee_paid_by_admin_per_km' => ['sometimes', 'numeric', 'min:0'],
            'free_delivery_above' => ['nullable', 'numeric', 'min:0'],
            'free_delivery_km' => ['nullable', 'numeric', 'min:0', 'max:200'],
            'delivery_gst_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'partner_free_distance_earning' => ['sometimes', 'numeric', 'min:0'],
            'packaging_charge' => ['sometimes', 'numeric', 'min:0'],
            'handling_fee' => ['sometimes', 'numeric', 'min:0'],
            'admin_fee_per_parcel' => ['nullable', 'numeric', 'min:0'],
        ]);

        $module = $validated['module'];
        $mode = $validated['delivery_mode'];

        if ($module === ZoneDeliveryConfig::MODULE_FOOD && $mode !== ZoneDeliveryConfig::MODE_STANDARD) {
            return $this->error('Food deliveries only support the standard delivery mode', null, 422);
        }

        if ($module === ZoneDeliveryConfig::MODULE_GROCERY && $mode === ZoneDeliveryConfig::MODE_STANDARD) {
            return $this->error('Grocery deliveries must be instant or scheduled', null, 422);
        }

        $existing = $this->zoneConfigs->model($zone, $module, $mode);

        if ($mode === ZoneDeliveryConfig::MODE_SCHEDULED) {
            // Partial updates may omit the type and keep the saved one. An
            // explicit null is not a valid Scheduled type.
            $type = array_key_exists('delivery_type', $validated)
                ? $validated['delivery_type']
                : $existing?->delivery_type;

            if (! in_array($type, [
                ZoneDeliveryConfig::TYPE_FREE,
                ZoneDeliveryConfig::TYPE_CHARGEABLE,
            ], true)) {
                return $this->error('A Scheduled Grocery configuration requires a delivery type', ['delivery_type' => ['Select Free Delivery or Chargeable Delivery']], 422);
            }

            $validated['delivery_type'] = $type;

            if ($type === ZoneDeliveryConfig::TYPE_FREE) {
                $adminFee = array_key_exists('admin_fee_per_parcel', $validated)
                    ? $validated['admin_fee_per_parcel']
                    : $existing?->admin_fee_per_parcel;

                if ($adminFee === null || $adminFee === '') {
                    return $this->error('Free Scheduled Delivery requires the Admin fee per parcel', ['admin_fee_per_parcel' => ['This field is required for Free Delivery']], 422);
                }
            }
        } else {
            $validated['delivery_type'] = null;
        }

        $config = DB::transaction(function () use ($zone, $module, $mode, $validated) {
            return $this->zoneConfigs->upsert($zone, $module, $mode, $validated);
        });

        $saved = $this->zoneConfigs->find($zone, $module, $mode);

        return $this->success([
            'config' => $config,
            'values' => $saved === null ? null : $this->zoneConfigs->adminValues($saved),
        ]);
    }

    public function destroy(Request $request, Zone $zone): JsonResponse
    {
        $validated = $request->validate([
            'module' => ['required', Rule::in([ZoneDeliveryConfig::MODULE_FOOD, ZoneDeliveryConfig::MODULE_GROCERY])],
            'delivery_mode' => ['required', Rule::in([
                ZoneDeliveryConfig::MODE_STANDARD,
                ZoneDeliveryConfig::MODE_INSTANT,
                ZoneDeliveryConfig::MODE_SCHEDULED,
            ])],
        ]);

        $this->zoneConfigs->remove($zone, $validated['module'], $validated['delivery_mode']);

        return $this->success(['reset' => true]);
    }
}
