<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Delivery payment collection + customer delivery OTP support:
     * - otp_codes.order_id ties an (already hashed, single-use) delivery OTP
     *   to a specific order so verification resolution is order-scoped and
     *   completely separate from the login OTP flow.
     * - orders gains the partner-facing collection + OTP verification state
     *   used by the delivery-completion gate for food orders.
     */
    public function up(): void
    {
        Schema::table('otp_codes', function (Blueprint $table) {
            $table->unsignedBigInteger('order_id')->nullable()->after('id');
            $table->index(['order_id', 'purpose']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('delivery_payment_collected_at')->nullable()->after('delivered_at');
            $table->string('delivery_payment_collected_via', 20)->nullable()->after('delivery_payment_collected_at');
            $table->timestamp('delivery_otp_verified_at')->nullable()->after('delivery_payment_collected_via');
            $table->unsignedInteger('delivery_otp_resend_count')->default(0)->after('delivery_otp_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_payment_collected_at',
                'delivery_payment_collected_via',
                'delivery_otp_verified_at',
                'delivery_otp_resend_count',
            ]);
        });

        Schema::table('otp_codes', function (Blueprint $table) {
            $table->dropIndex(['order_id', 'purpose']);
            $table->dropColumn('order_id');
        });
    }
};
