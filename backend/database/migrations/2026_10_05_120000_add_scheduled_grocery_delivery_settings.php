<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Splits Grocery delivery configuration into Instant and Scheduled.
 *
 * The existing `grocery_*` rows stay the source of truth for Instant Delivery
 * and are never modified. Scheduled Delivery gets its own independent rows in a
 * separate `grocery_scheduled_delivery` settings group, so changing one mode can
 * never move the other.
 *
 * The scheduled chargeable rows are seeded as copies of the current instant
 * values: a scheduled order is charged on the same model today, so seeding the
 * copy keeps every existing scheduled order's behaviour identical while making
 * the two configurations editable independently from then on.
 *
 * Idempotent: `insertOrIgnore` on a unique key means re-running this migration
 * or the seeder never duplicates a setting.
 */
return new class extends Migration
{
    public const GROUP = 'grocery_scheduled_delivery';

    public const TYPE_KEY = 'grocery_scheduled_delivery_type';

    public const TYPE_FREE = 'free';

    public const TYPE_CHARGEABLE = 'chargeable';

    public function up(): void
    {
        $now = now();

        $instant = DB::table('app_settings')
            ->where('group', 'grocery_delivery')
            ->pluck('value', 'key');

        Schema::table('carts', function (Blueprint $table) {
            if (! Schema::hasColumn('carts', 'delivery_mode')) {
                $table->string('delivery_mode', 20)->default('instant')->after('cart_type');
                $table->decimal('packaging_fee', 10, 2)->default(0)->after('delivery_gst_amount');
                $table->decimal('handling_fee', 10, 2)->default(0)->after('packaging_fee');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'handling_fee')) {
                $table->decimal('handling_fee', 10, 2)->default(0)->after('packaging_fee');
            }
        });

        DB::table('app_settings')->insertOrIgnore([
            $this->row(self::TYPE_KEY, 'Delivery Type', self::TYPE_CHARGEABLE, 'select', 1, $now, [self::TYPE_FREE, self::TYPE_CHARGEABLE], 'Controls how a Scheduled Grocery order is charged. Free Delivery makes the customer delivery charge ₹0 and funds delivery per parcel. Chargeable Delivery charges the customer per KM using the Scheduled Delivery configuration.'),

            $this->row('grocery_scheduled_free_delivery_admin_fee_per_parcel', 'Delivery Fee Paid by Admin per Parcel', '0', 'number', 2, $now),
            $this->row('grocery_scheduled_free_delivery_packaging_charge', 'Packaging Charge', '0', 'number', 3, $now),
            $this->row('grocery_scheduled_free_delivery_handling_fee', 'Handling Fee', '0', 'number', 4, $now),

            $this->row('grocery_scheduled_delivery_fee_per_km', 'Delivery Fee per KM', $instant['grocery_delivery_fee_per_km'] ?? '5', 'number', 5, $now),
            $this->row('grocery_scheduled_delivery_fee_paid_by_admin_per_km', 'Delivery Fee Paid by Admin per KM', $instant['grocery_delivery_fee_paid_by_admin_per_km'] ?? '5', 'number', 6, $now),
            $this->row('grocery_scheduled_free_delivery_above', 'Free Delivery Above', $instant['grocery_free_delivery_above'] ?? '500', 'number', 7, $now),
            $this->row('grocery_scheduled_delivery_gst_percent', 'Delivery GST %', $instant['grocery_delivery_gst_percent'] ?? '18', 'number', 8, $now),
            $this->row('grocery_scheduled_free_delivery_km', 'Free Delivery Within (KM)', $instant['grocery_free_delivery_km'] ?? '2', 'number', 9, $now),
            $this->row('grocery_scheduled_packaging_charge', 'Packaging Charge', '0', 'number', 10, $now),
            $this->row('grocery_scheduled_handling_fee', 'Handling Fee', '0', 'number', 11, $now),
        ]);
    }

    public function down(): void
    {
        DB::table('app_settings')->where('group', self::GROUP)->delete();

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'handling_fee')) {
                $table->dropColumn('handling_fee');
            }
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->dropColumn(['delivery_mode', 'packaging_fee', 'handling_fee']);
        });
    }

    /**
     * @param  array<int, string>|null  $options
     */
    private function row(string $key, string $label, string $value, string $type, int $sortOrder, Carbon $now, ?array $options = null, ?string $helpText = null): array
    {
        return [
            'group' => self::GROUP,
            'key' => $key,
            'label' => $label,
            'help_text' => $helpText,
            'value' => $value,
            'type' => $type,
            'is_public' => false,
            'options' => $options === null ? null : json_encode($options),
            'sort_order' => $sortOrder,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
};
