<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-zone delivery pricing configuration.
 *
 * Each row is one zone-wide combination of module and delivery mode:
 *
 *  - Food                    -> module=food,    delivery_mode=standard
 *  - Grocery Instant         -> module=grocery, delivery_mode=instant
 *  - Grocery Scheduled       -> module=grocery, delivery_mode=scheduled
 *
 * A Scheduled row also carries `delivery_type` (free|chargeable), which selects
 * the subset of values applied to a scheduled order. All three combinations are
 * independent: editing one can never move another.
 *
 * A missing row means the zone has not been configured. Once the deployment has
 * active service zones, pricing for that zone fails with an actionable error;
 * it never silently falls back to the global `app_settings` values. Existing
 * zones are not mutated by this migration and keep their current prices until
 * an administrator saves a zone configuration (or runs the explicit backfill).
 * The status is surfaced in the Super Admin UI.
 *
 * The unique index is the single guarantee against duplicate/conflicting rows
 * for the same zone, module and mode. Rollback only drops this new table; no
 * existing order, payment, earning or settings row is touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zone_delivery_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained('zones')->cascadeOnDelete();
            $table->string('module', 20);
            $table->string('delivery_mode', 20);

            // Only Grocery Scheduled uses a delivery type. Null for Food and
            // Grocery Instant, whose calculation model has no free/chargeable switch.
            $table->string('delivery_type', 20)->nullable();

            $table->decimal('delivery_fee_per_km', 12, 2)->default(0);
            $table->decimal('delivery_fee_paid_by_admin_per_km', 12, 2)->default(0);
            $table->decimal('free_delivery_above', 12, 2)->nullable();
            $table->decimal('free_delivery_km', 8, 2)->nullable();
            $table->decimal('delivery_gst_percent', 5, 2)->default(0);
            $table->decimal('partner_free_distance_earning', 12, 2)->default(0);
            $table->decimal('packaging_charge', 12, 2)->default(0);
            $table->decimal('handling_fee', 12, 2)->default(0);

            // Scheduled Free Delivery funds the partner a flat amount per parcel.
            $table->decimal('admin_fee_per_parcel', 12, 2)->nullable();

            $table->timestamps();

            $table->unique(
                ['zone_id', 'module', 'delivery_mode'],
                'zone_delivery_configs_zone_module_mode_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zone_delivery_configs');
    }
};
