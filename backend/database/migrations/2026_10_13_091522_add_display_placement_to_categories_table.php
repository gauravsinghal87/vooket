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
        Schema::table('categories', function (Blueprint $table) {
            if (! Schema::hasColumn('categories', 'display_placement')) {
                $table->string('display_placement', 20)->default('both')->after('navigation_icon');
                $table->index(['type', 'display_placement']);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'display_placement')) {
                $table->dropIndex(['type', 'display_placement']);
                $table->dropColumn('display_placement');
            }
        });
    }
};
