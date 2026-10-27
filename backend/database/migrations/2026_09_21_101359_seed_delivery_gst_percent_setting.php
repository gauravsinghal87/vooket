<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('app_settings')->insertOrIgnore([
            'group' => 'delivery',
            'key' => 'delivery_gst_percent',
            'label' => 'Delivery GST %',
            'value' => '18',
            'type' => 'number',
            'is_public' => true,
            'sort_order' => 4,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('app_settings')->where('key', 'delivery_gst_percent')->where('value', '18')->delete();
    }
};
