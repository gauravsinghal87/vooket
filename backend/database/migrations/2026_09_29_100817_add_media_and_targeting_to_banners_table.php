<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('service', 20)->nullable()->after('position');
            $table->string('placement', 40)->default('home_hero')->after('service');
            $table->string('media_type', 10)->default('image')->after('image');
            $table->string('video')->nullable()->after('media_type');
            $table->string('poster_image')->nullable()->after('video');
            $table->string('cta_text', 60)->nullable()->after('subtitle');

            $table->index(['service', 'placement', 'is_active', 'sort_order'], 'banners_targeting_idx');
        });

        // Backfill the legacy `position` targeting into the new `service` column.
        foreach (['food', 'grocery', 'rides'] as $service) {
            DB::table('banners')
                ->whereNull('service')
                ->where('position', $service)
                ->update(['service' => $service]);
        }

        DB::table('banners')
            ->whereNull('service')
            ->whereIn('position', ['home', 'promo'])
            ->update(['service' => 'all']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->dropIndex('banners_targeting_idx');

            $table->dropColumn(['service', 'placement', 'media_type', 'video', 'poster_image', 'cta_text']);
        });
    }
};
