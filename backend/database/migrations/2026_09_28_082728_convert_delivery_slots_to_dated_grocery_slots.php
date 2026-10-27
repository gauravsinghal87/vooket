<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Converts the unused weekly-recurring `delivery_slots` stub into dated
 * grocery slots.
 *
 * The table has never been written to, so the legacy `day_of_week` column is
 * replaced by `slot_date`. Slot start/end stay local wall-clock values and are
 * converted to UTC in `DeliverySlotService` using `slot_timezone`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_slots', function (Blueprint $table) {
            $table->date('slot_date')->nullable()->after('vendor_id');
            $table->string('slot_timezone', 64)->default('Asia/Kolkata')->after('end_time');
        });

        Schema::table('delivery_slots', function (Blueprint $table) {
            $table->dropColumn('day_of_week');
        });

        Schema::table('delivery_slots', function (Blueprint $table) {
            $table->index(['vendor_id', 'slot_date'], 'delivery_slots_vendor_date_index');
            $table->index(['store_id', 'slot_date'], 'delivery_slots_store_date_index');
            $table->unique(['vendor_id', 'store_id', 'slot_date', 'start_time'], 'delivery_slots_vendor_store_date_start_unique');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_slots', function (Blueprint $table) {
            $table->dropUnique('delivery_slots_vendor_store_date_start_unique');
            $table->dropIndex('delivery_slots_store_date_index');
            $table->dropIndex('delivery_slots_vendor_date_index');
        });

        Schema::table('delivery_slots', function (Blueprint $table) {
            $table->dropColumn(['slot_date', 'slot_timezone']);
            $table->string('day_of_week', 10)->default('all')->after('vendor_id');
        });
    }
};
