<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Track the driver-side cash payment lifecycle for a ride. Cash is a
     * ride payment method alongside online and wallet: the driver collects
     * the payable fare from the customer (cash_collected) before the ride
     * may be completed, and then settles that collected amount against their
     * own wallet (cash_settled). The completion guard requires settlement for
     * cash rides before the trip can be marked COMPLETED.
     */
    public function up(): void
    {
        Schema::table('rides', function (Blueprint $table) {
            $table->boolean('cash_collected')->default(false);
            $table->decimal('cash_collected_amount', 10, 2)->nullable();
            $table->timestamp('cash_collected_at')->nullable();
            $table->string('cash_collected_via', 20)->nullable();
            $table->boolean('cash_settled')->default(false);
            $table->timestamp('cash_settled_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rides', function (Blueprint $table) {
            $table->dropColumn([
                'cash_collected',
                'cash_collected_amount',
                'cash_collected_at',
                'cash_collected_via',
                'cash_settled',
                'cash_settled_at',
            ]);
        });
    }
};
