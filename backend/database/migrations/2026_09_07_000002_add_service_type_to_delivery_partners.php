<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->string('service_type', 20)->default('food')->after('vehicle_type'); // food|grocery
            $table->index(['service_type', 'status', 'is_online']);
        });
    }

    public function down(): void
    {
        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->dropIndex(['service_type', 'status', 'is_online']);
            $table->dropColumn('service_type');
        });
    }
};
