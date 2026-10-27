<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Assign every vendor to its resolved service zone so restaurants only
     * operate inside FOOD zones and grocery stores inside GROCERY zones.
     */
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->foreignId('zone_id')->nullable()->after('longitude')
                ->constrained('zones')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropConstrainedForeignId('zone_id');
        });
    }
};
