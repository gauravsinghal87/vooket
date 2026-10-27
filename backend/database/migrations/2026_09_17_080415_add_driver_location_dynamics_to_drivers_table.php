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
        Schema::table('drivers', function (Blueprint $table) {
            $table->decimal('heading', 5, 2)->nullable()->after('longitude');
            $table->decimal('speed', 6, 2)->nullable()->after('heading');
            $table->decimal('accuracy', 6, 2)->nullable()->after('speed');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn(['heading', 'speed', 'accuracy']);
        });
    }
};
