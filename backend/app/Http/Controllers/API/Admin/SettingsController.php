<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\AppSetting;
use App\Models\DeliveryFeeRule;
use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\FeatureFlag;
use App\Models\VehicleDocument;
use App\Models\VehicleType;
use App\Models\Zone;
use App\Services\Pricing\GroceryDeliveryConfigService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class SettingsController extends BaseController
{
    // ============ APP SETTINGS ============

    public function appSettings(Request $request)
    {
        $query = AppSetting::editable()->orderBy('group')->orderBy('sort_order');

        if ($group = $request->query('group')) {
            $query->where('group', $group);
        }

        $settings = $query->get();

        return $this->success($settings);
    }

    public function appSettingGroups()
    {
        $groups = AppSetting::select('group')->distinct()->orderBy('group')->pluck('group');

        return $this->success($groups);
    }

    public function updateAppSetting(Request $request, int $id)
    {
        $setting = AppSetting::find($id);
        if (! $setting) {
            return $this->error('Setting not found', null, 404);
        }

        if (in_array($setting->key, AppSetting::RETIRED_KEYS, true)) {
            return $this->error('This setting is no longer configurable', null, 410);
        }

        // The Scheduled Delivery keys are declared as a constant list next to the
        // resolver that reads them, so a new scheduled field cannot be added
        // without also getting validation. The GST percentage is excluded because
        // it is a percentage and is capped below.
        $scheduledNumericKeys = array_values(array_diff(
            array_merge(
                GroceryDeliveryConfigService::CHARGEABLE_KEYS,
                GroceryDeliveryConfigService::CHARGEABLE_ADMIN_KEYS,
                GroceryDeliveryConfigService::CHARGEABLE_EXTRA_KEYS,
                GroceryDeliveryConfigService::FREE_KEYS,
            ),
            ['grocery_scheduled_delivery_gst_percent']
        ));

        $valueRules = match (true) {
            $setting->key === GroceryDeliveryConfigService::TYPE_KEY => 'present|in:free,chargeable',
            in_array($setting->key, $scheduledNumericKeys, true) => 'present|nullable|numeric|min:0',
            default => match ($setting->key) {
                'delivery_gst_percent',
                'food_delivery_gst_percent',
                'grocery_delivery_gst_percent',
                'grocery_scheduled_delivery_gst_percent' => 'present|nullable|numeric|min:0|max:100',
                'delivery_fee_per_km',
                'free_delivery_above',
                'food_delivery_fee_per_km',
                'food_delivery_fee_paid_by_admin_per_km',
                'food_free_delivery_above',
                'food_free_delivery_km',
                'food_partner_free_distance_earning',
                'food_delivery_packaging_charge',
                'food_delivery_handling_fee',
                'grocery_delivery_fee_per_km',
                'grocery_delivery_fee_paid_by_admin_per_km',
                'grocery_free_delivery_above',
                'grocery_free_delivery_km',
                'grocery_partner_free_distance_earning',
                'food_partner_base_fee',
                'food_delivery_partner_fee_per_km' => 'present|nullable|numeric|min:0',
                'vendor_min_wallet_balance' => 'present|nullable|numeric|min:0|max:'.config('vendor_payout.max_min_wallet_balance', 1000000),
                'partner_min_wallet_balance' => 'present|nullable|numeric|min:0|max:'.config('partner_payout.max_min_wallet_balance', 1000000),
                default => 'present|nullable',
            },
        };

        $validator = Validator::make($request->all(), [
            'value' => $valueRules,
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $setting->update(['value' => $this->normalizeValue($request->input('value'), $setting->type)]);

        return $this->success($setting->fresh(), 'Setting updated');
    }

    protected function normalizeValue($value, string $type)
    {
        return match ($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOL) ? '1' : '0',
            'json' => is_string($value) ? $value : json_encode($value),
            'array' => is_string($value) ? $value : json_encode($value),
            'number' => (string) $value,
            default => (string) $value,
        };
    }

    // ============ PLATFORM LOGO ============

    /**
     * Upload a new platform logo and persist it to the `platform_logo` app
     * setting in one authenticated call. The previous stored file is deleted
     * only after the new file has been saved, so a failed upload can never lose
     * an existing logo. SVG is intentionally rejected — it can carry scripted
     * content and is not safely supported.
     */
    public function uploadLogo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'logo' => 'required|image|mimes:png,jpg,jpeg,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $setting = AppSetting::firstOrCreate(
            ['key' => 'platform_logo'],
            [
                'group' => 'general',
                'label' => 'Platform Logo',
                'help_text' => 'Square PNG, JPG or WebP logo (max 2MB). Shown across the customer apps.',
                'value' => null,
                'type' => 'string',
                'is_public' => true,
                'sort_order' => 2,
            ]
        );

        try {
            $path = $request->file('logo')->store('branding', 'public');
            $url = $this->publicStorageUrl($path);

            // Keep the old file pinned until the new logo is safely on disk.
            $this->deleteStoredLogo($setting->value);

            $setting->update(['value' => $url]);

            return $this->success($setting->fresh(), 'Logo uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    /**
     * Remove the platform logo: delete the stored file and clear the setting.
     */
    public function removeLogo()
    {
        $setting = AppSetting::firstOrCreate(
            ['key' => 'platform_logo'],
            [
                'group' => 'general',
                'label' => 'Platform Logo',
                'help_text' => 'Square PNG, JPG or WebP logo (max 2MB). Shown across the customer apps.',
                'value' => null,
                'type' => 'string',
                'is_public' => true,
                'sort_order' => 2,
            ]
        );

        $this->deleteStoredLogo($setting->value);
        $setting->update(['value' => null]);

        return $this->success($setting->fresh(), 'Logo removed');
    }

    /**
     * Resolve a public-disk storage path into an absolute, publicly reachable URL.
     */
    public function publicStorageUrl(string $path): string
    {
        return rtrim(config('app.url'), '/').'/storage/'.$path;
    }

    /**
     * Delete the file backing a stored logo value (a public storage URL or a
     * bare `branding/...` path) if it still exists, swallowing the missing case.
     */
    protected function deleteStoredLogo(?string $value): void
    {
        if (blank($value)) {
            return;
        }

        $prefix = rtrim(config('app.url'), '/').'/storage/';

        if (str_starts_with($value, $prefix)) {
            $path = substr($value, strlen($prefix));
        } elseif (str_starts_with($value, 'storage/')) {
            $path = substr($value, strlen('storage/'));
        } elseif (str_starts_with($value, 'branding/')) {
            $path = $value;
        } else {
            return;
        }

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    // ============ FEATURE FLAGS ============

    public function featureFlags(Request $request)
    {
        return $this->success(FeatureFlag::orderBy('name')->get());
    }

    public function toggleFeatureFlag(Request $request, int $id)
    {
        $flag = FeatureFlag::find($id);
        if (! $flag) {
            return $this->error('Feature flag not found', null, 404);
        }

        $flag->update(['enabled' => ! $flag->enabled]);

        return $this->success($flag->fresh(), 'Feature flag updated');
    }

    // ============ MARKETPLACE CONFIG ============

    public function zones(Request $request)
    {
        $query = Zone::query();

        if ($search = $request->query('search')) {
            $query->where('name', 'like', "%{$search}%");
        }

        return $this->success($query->latest()->paginate($request->integer('per_page', 50)));
    }

    public function vehicleTypes(Request $request)
    {
        return $this->success(VehicleType::orderBy('sort_order')->get());
    }

    public function deliveryFeeRules(Request $request)
    {
        return $this->success(DeliveryFeeRule::orderBy('service')->get());
    }

    public function toggleDeliveryFeeRule(Request $request, int $id)
    {
        $rule = DeliveryFeeRule::find($id);
        if (! $rule) {
            return $this->error('Rule not found', null, 404);
        }

        $rule->update(['is_active' => ! $rule->is_active]);

        return $this->success($rule->fresh(), 'Rule updated');
    }

    // ============ DRIVERS ============

    public function drivers(Request $request)
    {
        $query = Driver::with('user:id,name,email,phone');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('vehicle_number', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
            });
        }

        return $this->success($query->latest()->paginate($request->integer('per_page', 20)));
    }

    public function driverDetail(int $id)
    {
        $driver = Driver::with([
            'user:id,name,email,phone,country_code,created_at,is_verified',
            'vehicleType:id,name,code',
            'vehicles:id,driver_id,vehicle_type_id,make,model,color,year,registration_number,status',
        ])->find($id);

        if (! $driver) {
            return $this->error('Driver not found', null, 404);
        }

        $documents = VehicleDocument::whereIn('vehicle_id', $driver->vehicles->pluck('id'))->get();
        $driver->setAttribute('documents', $documents);

        return $this->success($driver);
    }

    public function updateDriver(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:online,offline,on_trip,approved,pending,rejected,suspended',
            'is_verified' => 'sometimes|boolean',
            'rejection_reason' => 'required_if:status,rejected|nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $driver = Driver::find($id);
        if (! $driver) {
            return $this->error('Driver not found', null, 404);
        }

        $data = $validator->validated();
        $status = $data['status'];

        if (in_array($status, ['approved', 'online', 'offline', 'on_trip'])) {
            $data['rejection_reason'] = null;
            $data['reviewed_at'] = now();
        }

        if ($status === 'approved') {
            $data['is_verified'] = true;
            $data['verified_at'] = $driver->verified_at ?? now();
        }

        $driver->update($data);

        return $this->success($driver->fresh('user:id,name,email,phone'), 'Driver updated');
    }

    // ============ DELIVERY PARTNERS ============

    public function deliveryPartners(Request $request)
    {
        $query = DeliveryPartner::with('user:id,name,email,phone');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($service = $request->query('service_type')) {
            $query->where('service_type', $service);
        }
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('vehicle_number', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
            });
        }

        return $this->success($query->latest()->paginate($request->integer('per_page', 20)));
    }

    public function deliveryPartnerDetail(int $id)
    {
        $partner = DeliveryPartner::with([
            'user:id,name,email,phone,country_code,created_at',
        ])->find($id);

        if (! $partner) {
            return $this->error('Delivery partner not found', null, 404);
        }

        return $this->success($partner);
    }

    public function updateDeliveryPartner(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:online,offline,on_delivery,approved,pending,rejected,suspended',
            'service_type' => 'sometimes|in:food,grocery',
            'rejection_reason' => 'required_if:status,rejected|nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $partner = DeliveryPartner::find($id);
        if (! $partner) {
            return $this->error('Delivery partner not found', null, 404);
        }

        $data = $validator->validated();
        $status = $data['status'];

        if (in_array($status, ['approved', 'online', 'offline', 'on_delivery'])) {
            $data['rejection_reason'] = null;
            $data['reviewed_at'] = now();
        }

        $partner->update($data);

        return $this->success($partner->fresh('user:id,name,email,phone'), 'Delivery partner updated');
    }
}
