<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_slots', function (Blueprint $table) {
            $table->string('shift', 20)->nullable()->after('end_time');
            $table->index(['store_id', 'slot_date', 'shift'], 'delivery_slots_store_date_shift_index');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_slots', function (Blueprint $table) {
            $table->dropIndex('delivery_slots_store_date_shift_index');
            $table->dropColumn('shift');
        });
    }
};
