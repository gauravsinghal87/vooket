<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->decimal('delivery_gst_percent', 5, 2)->default(0)->after('delivery_fee');
            $table->decimal('delivery_gst_amount', 10, 2)->default(0)->after('delivery_gst_percent');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('delivery_gst_percent', 5, 2)->default(0)->after('delivery_fee');
            $table->decimal('delivery_gst_amount', 10, 2)->default(0)->after('delivery_gst_percent');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_gst_percent', 'delivery_gst_amount']);
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->dropColumn(['delivery_gst_percent', 'delivery_gst_amount']);
        });
    }
};
