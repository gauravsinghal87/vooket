<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Adds the two flat Food delivery charges to the existing `food_delivery` group.
 *
 * Packaging and handling are additional customer-facing line items on top of the
 * unchanged distance delivery fee. They default to 0 so every Food order priced
 * before this migration keeps exactly the total it already had, until an Admin
 * configures a charge.
 *
 * Grocery and Ride settings are untouched: Grocery keeps its own per-mode
 * packaging/handling configuration.
 *
 * Idempotent: `insertOrIgnore` on a unique key means re-running this migration
 * or the seeder never duplicates a setting.
 */
return new class extends Migration
{
    public const GROUP = 'food_delivery';

    public const PACKAGING_CHARGE_KEY = 'food_delivery_packaging_charge';

    public const HANDLING_FEE_KEY = 'food_delivery_handling_fee';

    public function up(): void
    {
        $now = now();

        $existing = DB::table('app_settings')
            ->whereIn('key', [self::PACKAGING_CHARGE_KEY, self::HANDLING_FEE_KEY])
            ->pluck('key');

        $rows = [
            $this->row(self::PACKAGING_CHARGE_KEY, 'Packaging Charge', 6, $now),
            $this->row(self::HANDLING_FEE_KEY, 'Handling Fee', 7, $now),
        ];

        DB::table('app_settings')->insertOrIgnore(array_values(array_filter(
            $rows,
            fn (array $row): bool => ! $existing->contains($row['key'])
        )));
    }

    public function down(): void
    {
        DB::table('app_settings')
            ->whereIn('key', [self::PACKAGING_CHARGE_KEY, self::HANDLING_FEE_KEY])
            ->delete();
    }

    private function row(string $key, string $label, int $sortOrder, Carbon $now): array
    {
        return [
            'group' => self::GROUP,
            'key' => $key,
            'label' => $label,
            'help_text' => 'A flat amount charged on top of the Food delivery fee. 0 means no charge.',
            'value' => '0',
            'type' => 'number',
            'is_public' => true,
            'options' => null,
            'sort_order' => $sortOrder,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
};
