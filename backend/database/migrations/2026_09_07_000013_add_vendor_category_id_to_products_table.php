<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'vendor_category_id')) {
                $table->foreignId('vendor_category_id')->nullable()->after('category_id')->constrained('vendor_categories')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'vendor_category_id')) {
                $table->dropConstrainedForeignId('vendor_category_id');
            }
        });
    }
};
