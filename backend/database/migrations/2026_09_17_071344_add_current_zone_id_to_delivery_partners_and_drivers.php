<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Track the current service zone for delivery partners and ride drivers so
     * dispatch can enforce "candidate current zone == job pickup zone".
     */
    public function up(): void
    {
        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->foreignId('current_zone_id')->nullable()->after('longitude')
                ->constrained('zones')->nullOnDelete();
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->foreignId('current_zone_id')->nullable()->after('longitude')
                ->constrained('zones')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_zone_id');
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_zone_id');
        });
    }
};
