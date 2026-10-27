<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Store the delivery quote a cart is currently showing.
 *
 * Order creation re-resolves the destination zone and the zone/global delivery
 * configuration authoritatively. Comparing that result with this quote lets the
 * API refuse a silent repricing when an administrator changed a zone
 * configuration (or the cart went stale) between the cart preview and checkout.
 *
 * The column is nullable: carts created before this migration, and carts that
 * have never been priced, simply skip the comparison and are priced once at
 * order creation exactly as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            if (! Schema::hasColumn('carts', 'pricing_quote')) {
                $table->json('pricing_quote')->nullable()->after('handling_fee');
            }
        });
    }

    public function down(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            if (Schema::hasColumn('carts', 'pricing_quote')) {
                $table->dropColumn('pricing_quote');
            }
        });
    }
};
