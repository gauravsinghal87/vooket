<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Immutable zone snapshots on orders and rides so historical transactions
     * remain correct when a vendor/customer later edits an address.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('pickup_zone_id')->nullable()->after('address_id')
                ->constrained('zones')->nullOnDelete();
            $table->foreignId('drop_zone_id')->nullable()->after('pickup_zone_id')
                ->constrained('zones')->nullOnDelete();
        });

        Schema::table('rides', function (Blueprint $table) {
            $table->foreignId('pickup_zone_id')->nullable()->after('destination_latitude')
                ->constrained('zones')->nullOnDelete();
            $table->foreignId('destination_zone_id')->nullable()->after('pickup_zone_id')
                ->constrained('zones')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pickup_zone_id');
            $table->dropConstrainedForeignId('drop_zone_id');
        });

        Schema::table('rides', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pickup_zone_id');
            $table->dropConstrainedForeignId('destination_zone_id');
        });
    }
};
