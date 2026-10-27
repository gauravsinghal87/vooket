<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('app_settings')->insertOrIgnore([
            'group' => 'grocery_delivery',
            'key' => 'grocery_free_delivery_km',
            'label' => 'Free Delivery Within (KM)',
            'value' => '2',
            'type' => 'number',
            'is_public' => true,
            'sort_order' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('app_settings')->where('key', 'grocery_free_delivery_km')->delete();
    }
};
