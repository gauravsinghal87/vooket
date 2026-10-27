<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links a grocery order to the slot it booked and records the moment the slot
 * capacity was handed back, so a cancellation can only ever release once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('delivery_slot_id')
                ->nullable()
                ->after('scheduled_at')
                ->constrained('delivery_slots')
                ->nullOnDelete();
            $table->timestamp('slot_released_at')->nullable()->after('delivery_slot_id');
            $table->index(['status', 'scheduled_at'], 'orders_status_scheduled_index');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_status_scheduled_index');
            $table->dropConstrainedForeignId('delivery_slot_id');
            $table->dropColumn('slot_released_at');
        });
    }
};
