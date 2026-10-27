<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('product_type', 10)->default('simple')->after('type');
        });

        Schema::table('variation_options', function (Blueprint $table) {
            $table->unsignedInteger('min_select')->default(0)->after('is_multi_select');
            $table->boolean('is_active')->default(true)->after('min_select');
        });

        Schema::table('cart_items', function (Blueprint $table) {
            $table->string('line_signature', 64)->nullable()->after('special_instructions');
            $table->index(['cart_id', 'product_id', 'product_variant_id', 'line_signature'], 'cart_line_identity');
        });
    }

    public function down(): void
    {
        Schema::table('cart_items', function (Blueprint $table) {
            $table->dropIndex('cart_line_identity');
            $table->dropColumn('line_signature');
        });

        Schema::table('variation_options', function (Blueprint $table) {
            $table->dropColumn(['min_select', 'is_active']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('product_type');
        });
    }
};
