<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = [
            [
                'group' => 'partner_delivery',
                'key' => 'food_partner_base_fee',
                'label' => 'Food Partner Base Fee',
                'value' => '30',
                'type' => 'number',
                'is_public' => false,
                'sort_order' => 1,
            ],
            [
                'group' => 'partner_delivery',
                'key' => 'food_delivery_partner_fee_per_km',
                'label' => 'Food Partner Fee per KM',
                'value' => '5',
                'type' => 'number',
                'is_public' => false,
                'sort_order' => 2,
            ],
        ];

        foreach ($rows as $row) {
            DB::table('app_settings')->insertOrIgnore($row);
        }
    }

    public function down(): void
    {
        DB::table('app_settings')
            ->whereIn('key', ['food_partner_base_fee', 'food_delivery_partner_fee_per_km'])
            ->delete();
    }
};
