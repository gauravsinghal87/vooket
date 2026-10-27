<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The customer delivery fee is now purely distance-based: the base component
 * is removed and food gains the same free-delivery radius grocery already has.
 *
 * Partner earnings are NOT affected: DeliveryFeeService::partnerRate() reads
 * the separate `*_partner_base_fee` / `*_delivery_partner_fee_per_km` keys,
 * and orders store numeric snapshotted fees rather than references to these
 * setting keys, so historical orders are untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        // Give food the free-delivery radius grocery already has. insertOrIgnore
        // keeps any operator-configured value and avoids duplicate keys.
        DB::table('app_settings')->insertOrIgnore([
            [
                'group' => 'food_delivery',
                'key' => 'food_free_delivery_km',
                'label' => 'Free Delivery Within (KM)',
                'value' => '2',
                'type' => 'number',
                'is_public' => true,
                'sort_order' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        // Ensure grocery's radius exists too, without overwriting an
        // operator-configured value.
        DB::table('app_settings')->insertOrIgnore([
            [
                'group' => 'grocery_delivery',
                'key' => 'grocery_free_delivery_km',
                'label' => 'Free Delivery Within (KM)',
                'value' => '2',
                'type' => 'number',
                'is_public' => true,
                'sort_order' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        // The generic (pre-service-split) base fee is no longer used by any
        // calculation path either.
        DB::table('app_settings')->whereIn('key', [
            'food_base_delivery_fee',
            'grocery_base_delivery_fee',
            'base_delivery_fee',
        ])->delete();
    }

    public function down(): void
    {
        $now = now();

        DB::table('app_settings')->insertOrIgnore([
            [
                'group' => 'food_delivery',
                'key' => 'food_base_delivery_fee',
                'label' => 'Base Delivery Fee',
                'value' => '30',
                'type' => 'number',
                'is_public' => true,
                'sort_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'group' => 'grocery_delivery',
                'key' => 'grocery_base_delivery_fee',
                'label' => 'Base Delivery Fee',
                'value' => '30',
                'type' => 'number',
                'is_public' => true,
                'sort_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('app_settings')->whereIn('key', [
            'food_free_delivery_km',
            'grocery_free_delivery_km',
        ])->delete();
    }
};
