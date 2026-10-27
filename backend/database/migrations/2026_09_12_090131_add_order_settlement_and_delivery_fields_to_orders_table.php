<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('original_subtotal', 10, 2)->nullable();
            $table->decimal('original_delivery_fee', 10, 2)->nullable();
            $table->decimal('original_total', 10, 2)->nullable();

            $table->decimal('commission_fee', 10, 2)->nullable();
            $table->decimal('net_vendor_payout', 10, 2)->nullable();
            $table->enum('vendor_payout_status', ['pending', 'completed', 'failed'])->nullable();
            $table->timestamp('vendor_payout_at')->nullable();

            $table->decimal('partner_payout', 10, 2)->nullable();
            $table->enum('partner_payout_status', ['pending', 'completed', 'failed'])->nullable();
            $table->timestamp('partner_payout_at')->nullable();

            $table->decimal('refund_amount', 10, 2)->nullable();
            $table->enum('refund_status', ['pending', 'completed', 'failed'])->nullable();
            $table->timestamp('refunded_at')->nullable();

            $table->enum('delivered_via', ['NONE', 'PENDING', 'PARTNER_ONLY', 'PAYMENT_LINK', 'DELIVERY_FEE_ONLY'])->default('NONE');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'original_subtotal',
                'original_delivery_fee',
                'original_total',
                'commission_fee',
                'net_vendor_payout',
                'vendor_payout_status',
                'vendor_payout_at',
                'partner_payout',
                'partner_payout_status',
                'partner_payout_at',
                'refund_amount',
                'refund_status',
                'refunded_at',
                'delivered_via',
            ]);
        });
    }
};
