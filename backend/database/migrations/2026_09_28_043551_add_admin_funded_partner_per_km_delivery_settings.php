<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds the Admin-funded partner per-km delivery rate for food and grocery.
 *
 * This is a NEW, admin-funded partner rate and is deliberately distinct from
 * the customer-facing `<service>_delivery_fee_per_km`. It becomes the
 * authoritative per-km component of the partner earning
 * (base + admin-funded per-km x distance) and is never reduced by the
 * customer's free-delivery allowance or free-delivery-above threshold.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        // Open a sort_order slot at 3 FIRST so the admin-funded rate renders
        // directly beneath the customer-facing per-km rate. Shifting before the
        // insert avoids the new row being shifted along with the existing one.
        // Done high-to-low so no two rows briefly share a sort_order.
        foreach (['food_delivery', 'grocery_delivery'] as $group) {
            foreach ([5, 4, 3] as $from) {
                DB::table('app_settings')
                    ->where('group', $group)
                    ->where('sort_order', $from)
                    ->update(['sort_order' => $from + 1, 'updated_at' => $now]);
            }
        }

        foreach (['food', 'grocery'] as $service) {
            DB::table('app_settings')->insertOrIgnore([
                [
                    'group' => $service.'_delivery',
                    'key' => $service.'_delivery_fee_paid_by_admin_per_km',
                    'label' => 'Delivery Fee Paid by Admin per KM',
                    'value' => '5',
                    'type' => 'number',
                    'is_public' => true,
                    'sort_order' => 3,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ]);
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->whereIn('key', [
            'food_delivery_fee_paid_by_admin_per_km',
            'grocery_delivery_fee_paid_by_admin_per_km',
        ])->delete();

        foreach (['food_delivery', 'grocery_delivery'] as $group) {
            foreach ([3, 4, 5] as $from) {
                DB::table('app_settings')
                    ->where('group', $group)
                    ->where('sort_order', $from)
                    ->update(['sort_order' => $from - 1, 'updated_at' => $now]);
            }
        }
    }
};
