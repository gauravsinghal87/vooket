<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds the guaranteed partner earning for the customer's free-delivery distance.
 *
 * A customer delivery inside the configured "Free Delivery Within" allowance is
 * charged nothing, but the partner is still compensated with a fixed amount for
 * that first portion of the trip. The amount is per service so Food and Grocery
 * stay independently configurable.
 *
 * The customer free-delivery distance (<prefix>free_delivery_km) and the
 * Admin-funded per-km rate (<prefix>delivery_fee_paid_by_admin_per_km) are
 * untouched: the new amount only replaces the near-zero result a short,
 * free-to-the-customer delivery used to produce.
 *
 * Idempotent: rows are inserted only when absent, so re-running this migration or
 * the seeder never duplicates a setting or overwrites an Admin's saved value.
 */
return new class extends Migration
{
    /** @var array<int, array{group: string, key: string, label: string, sort_order: int}> */
    private const SETTINGS = [
        [
            'group' => 'food_delivery',
            'key' => 'food_partner_free_distance_earning',
            'label' => 'Partner Earning for Free Delivery Distance',
            'sort_order' => 6,
        ],
        [
            'group' => 'grocery_delivery',
            'key' => 'grocery_partner_free_distance_earning',
            'label' => 'Partner Earning for Free Delivery Distance',
            'sort_order' => 6,
        ],
    ];

    /**
     * Sort order changes so the new field sits directly under "Free Delivery
     * Within (KM)" in each card. Food already carries the packaging and handling
     * charges at 6 and 7, so those move down one slot.
     *
     * @var array<string, int>
     */
    private const RESORTED = [
        'food_delivery_packaging_charge' => 7,
        'food_delivery_handling_fee' => 8,
    ];

    public function up(): void
    {
        $now = now();

        $rows = array_map(fn (array $setting): array => [
            'group' => $setting['group'],
            'key' => $setting['key'],
            'label' => $setting['label'],
            'help_text' => 'Minimum partner earning for the configured free-delivery distance.',
            'value' => '20',
            'type' => 'number',
            'is_public' => true,
            'options' => null,
            'sort_order' => $setting['sort_order'],
            'created_at' => $now,
            'updated_at' => $now,
        ], self::SETTINGS);

        $present = DB::table('app_settings')
            ->whereIn('key', array_column(self::SETTINGS, 'key'))
            ->pluck('key');

        DB::table('app_settings')->insertOrIgnore(array_values(array_filter(
            $rows,
            fn (array $row): bool => ! $present->contains($row['key'])
        )));

        foreach (self::RESORTED as $key => $sortOrder) {
            DB::table('app_settings')->where('key', $key)->update([
                'sort_order' => $sortOrder,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('app_settings')
            ->whereIn('key', array_column(self::SETTINGS, 'key'))
            ->delete();

        $now = now();

        DB::table('app_settings')->where('key', 'food_delivery_packaging_charge')
            ->update(['sort_order' => 6, 'updated_at' => $now]);

        DB::table('app_settings')->where('key', 'food_delivery_handling_fee')
            ->update(['sort_order' => 7, 'updated_at' => $now]);
    }
};
