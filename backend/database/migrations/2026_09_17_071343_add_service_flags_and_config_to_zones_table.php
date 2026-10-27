<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Extend the zones table with service-type toggles, geographic attributes,
     * search radii and cross-zone policy used by the Google Maps zone engine
     * (Super Admin → Zones + serviceability resolution).
     */
    public function up(): void
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->string('code')->nullable()->after('name')->unique();
            $table->text('description')->nullable()->after('code');
            $table->string('country', 2)->default('IN')->after('description');
            $table->string('state')->nullable()->after('country');
            $table->string('city')->nullable()->after('state');
            $table->boolean('food_enabled')->default(true)->after('type');
            $table->boolean('grocery_enabled')->default(true)->after('food_enabled');
            $table->boolean('ride_enabled')->default(true)->after('grocery_enabled');
            $table->integer('priority')->default(0)->after('ride_enabled');
            $table->decimal('food_partner_search_radius_km', 8, 2)->nullable()->after('radius_km');
            $table->decimal('grocery_partner_search_radius_km', 8, 2)->nullable()->after('food_partner_search_radius_km');
            $table->decimal('ride_driver_search_radius_km', 8, 2)->nullable()->after('grocery_partner_search_radius_km');
            $table->boolean('allow_cross_zone_food_delivery')->default(false)->after('ride_driver_search_radius_km');
            $table->boolean('allow_cross_zone_grocery_delivery')->default(false)->after('allow_cross_zone_food_delivery');
            $table->boolean('allow_ride_drop_outside_zone')->default(true)->after('allow_cross_zone_grocery_delivery');
            $table->unsignedBigInteger('created_by')->nullable()->after('is_active');
            $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');
        });
    }

    public function down(): void
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->dropColumn([
                'code',
                'description',
                'country',
                'state',
                'city',
                'food_enabled',
                'grocery_enabled',
                'ride_enabled',
                'priority',
                'food_partner_search_radius_km',
                'grocery_partner_search_radius_km',
                'ride_driver_search_radius_km',
                'allow_cross_zone_food_delivery',
                'allow_cross_zone_grocery_delivery',
                'allow_ride_drop_outside_zone',
                'created_by',
                'updated_by',
            ]);
        });
    }
};
