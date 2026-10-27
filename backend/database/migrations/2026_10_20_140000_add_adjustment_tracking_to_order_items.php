<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Item-level grocery adjustments need to know, per order line, how many
     * units have already been refunded/adjusted so the same unit can never be
     * refunded twice. The monetary side stays on `refunds` and
     * `financial_adjustments`; this column only tracks the quantity ledger.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedInteger('adjusted_quantity')->default(0)->after('quantity');
            $table->decimal('refunded_amount', 10, 2)->default(0)->after('adjusted_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['adjusted_quantity', 'refunded_amount']);
        });
    }
};
