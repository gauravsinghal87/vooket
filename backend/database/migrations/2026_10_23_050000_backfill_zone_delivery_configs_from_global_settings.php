<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Explicit rollout backfill: copy current global Food/Grocery values into
     * every zone that is missing a configuration row.
     *
     * Existing rows (including incomplete ones) are NEVER overwritten. The
     * administrator can review and adjust values in the Zone Delivery
     * Configuration module after rollout.
     */
    public function up(): void
    {
        if (! Schema::hasTable('zones') || ! Schema::hasTable('zone_delivery_configs') || ! Schema::hasTable('app_settings')) {
            return;
        }

        $settings = DB::table('app_settings')->pluck('value', 'key')->all();
        $get = function (string $key, $default) use ($settings) {
            $value = $settings[$key] ?? null;
            if ($value === null || $value === '') {
                return $default;
            }

            if (is_numeric($value)) {
                return is_int($value + 0) && strpos((string) $value, '.') === false
                    ? (int) $value
                    : (float) $value;
            }

            return $value;
        };
        $num = function (string $key, float $default) use ($get): float {
            $value = $get($key, $default);
            if (is_numeric($value)) {
                return (float) $value;
            }

            return $default;
        };
        $nullableNum = function (string $key) use ($get): ?float {
            $value = $get($key, null);
            if ($value === null || $value === '') {
                return null;
            }
            if (is_numeric($value)) {
                return (float) $value;
            }

            return null;
        };

        $globalType = strtolower(trim((string) ($settings['grocery_scheduled_delivery_type'] ?? 'chargeable')));
        $globalType = $globalType === 'free' ? 'free' : 'chargeable';

        $now = Carbon::now();

        $zones = DB::table('zones')->get();

        foreach ($zones as $zone) {
            // Food / Standard
            if (! DB::table('zone_delivery_configs')->where('zone_id', $zone->id)->where('module', 'food')->where('delivery_mode', 'standard')->exists()) {
                DB::table('zone_delivery_configs')->insert([
                    'zone_id' => $zone->id,
                    'module' => 'food',
                    'delivery_mode' => 'standard',
                    'delivery_type' => null,
                    'delivery_fee_per_km' => $num('food_delivery_fee_per_km', 5),
                    'delivery_fee_paid_by_admin_per_km' => $num('food_delivery_fee_paid_by_admin_per_km', 5),
                    'free_delivery_above' => $nullableNum('food_free_delivery_above'),
                    'free_delivery_km' => $nullableNum('food_free_delivery_km'),
                    'delivery_gst_percent' => $num('food_delivery_gst_percent', 18),
                    'partner_free_distance_earning' => $num('food_partner_free_distance_earning', 20),
                    'packaging_charge' => $num('food_delivery_packaging_charge', 0),
                    'handling_fee' => $num('food_delivery_handling_fee', 0),
                    'admin_fee_per_parcel' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // Grocery / Instant
            if (! DB::table('zone_delivery_configs')->where('zone_id', $zone->id)->where('module', 'grocery')->where('delivery_mode', 'instant')->exists()) {
                DB::table('zone_delivery_configs')->insert([
                    'zone_id' => $zone->id,
                    'module' => 'grocery',
                    'delivery_mode' => 'instant',
                    'delivery_type' => null,
                    'delivery_fee_per_km' => $num('grocery_delivery_fee_per_km', 5),
                    'delivery_fee_paid_by_admin_per_km' => $num('grocery_delivery_fee_paid_by_admin_per_km', 5),
                    'free_delivery_above' => $nullableNum('grocery_free_delivery_above'),
                    'free_delivery_km' => $nullableNum('grocery_free_delivery_km'),
                    'delivery_gst_percent' => $num('grocery_delivery_gst_percent', 18),
                    'partner_free_distance_earning' => $num('grocery_partner_free_distance_earning', 20),
                    'packaging_charge' => 0,
                    'handling_fee' => 0,
                    'admin_fee_per_parcel' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // Grocery / Scheduled
            if (! DB::table('zone_delivery_configs')->where('zone_id', $zone->id)->where('module', 'grocery')->where('delivery_mode', 'scheduled')->exists()) {
                if ($globalType === 'free') {
                    DB::table('zone_delivery_configs')->insert([
                        'zone_id' => $zone->id,
                        'module' => 'grocery',
                        'delivery_mode' => 'scheduled',
                        'delivery_type' => 'free',
                        'delivery_fee_per_km' => 0,
                        'delivery_fee_paid_by_admin_per_km' => 0,
                        'free_delivery_above' => null,
                        'free_delivery_km' => null,
                        'delivery_gst_percent' => 0,
                        'partner_free_distance_earning' => $num('grocery_partner_free_distance_earning', 20),
                        'packaging_charge' => $num('grocery_scheduled_free_delivery_packaging_charge', 0),
                        'handling_fee' => $num('grocery_scheduled_free_delivery_handling_fee', 0),
                        'admin_fee_per_parcel' => $num('grocery_scheduled_free_delivery_admin_fee_per_parcel', 0),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                } else {
                    DB::table('zone_delivery_configs')->insert([
                        'zone_id' => $zone->id,
                        'module' => 'grocery',
                        'delivery_mode' => 'scheduled',
                        'delivery_type' => 'chargeable',
                        'delivery_fee_per_km' => $num('grocery_scheduled_delivery_fee_per_km', 5),
                        'delivery_fee_paid_by_admin_per_km' => $num('grocery_scheduled_delivery_fee_paid_by_admin_per_km', 5),
                        'free_delivery_above' => $nullableNum('grocery_scheduled_free_delivery_above'),
                        'free_delivery_km' => $nullableNum('grocery_scheduled_free_delivery_km'),
                        'delivery_gst_percent' => $num('grocery_scheduled_delivery_gst_percent', 18),
                        'partner_free_distance_earning' => $num('grocery_partner_free_distance_earning', 20),
                        'packaging_charge' => $num('grocery_scheduled_packaging_charge', 0),
                        'handling_fee' => $num('grocery_scheduled_handling_fee', 0),
                        'admin_fee_per_parcel' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // Data backfill is not safely reversible without tracking what was created
        // by this migration; existing rows remain untouched.
    }
};
