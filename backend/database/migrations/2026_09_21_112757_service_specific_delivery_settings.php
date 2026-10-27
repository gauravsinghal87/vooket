<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $generic = DB::table('app_settings')
            ->whereIn('key', [
                'base_delivery_fee',
                'delivery_fee_per_km',
                'free_delivery_above',
                'delivery_gst_percent',
            ])
            ->pluck('value', 'key');

        foreach (['food', 'grocery'] as $service) {
            DB::table('app_settings')->insertOrIgnore([
                $this->row($service.'_delivery', $service.'_base_delivery_fee', 'Base Delivery Fee', $generic['base_delivery_fee'] ?? '30', 1, $now),
                $this->row($service.'_delivery', $service.'_delivery_fee_per_km', 'Delivery Fee per KM', $generic['delivery_fee_per_km'] ?? '5', 2, $now),
                $this->row($service.'_delivery', $service.'_free_delivery_above', 'Free Delivery Above', $generic['free_delivery_above'] ?? '500', 3, $now),
                $this->row($service.'_delivery', $service.'_delivery_gst_percent', 'Delivery GST %', $generic['delivery_gst_percent'] ?? '18', 4, $now),
            ]);
        }

        DB::table('app_settings')
            ->whereIn('key', [
                'base_delivery_fee',
                'delivery_fee_per_km',
                'free_delivery_above',
                'delivery_gst_percent',
            ])
            ->delete();
    }

    public function down(): void
    {
        $now = now();

        $food = DB::table('app_settings')->where('key', 'like', 'food_%')->pluck('value', 'key');

        DB::table('app_settings')->insertOrIgnore([
            ['group' => 'delivery', 'key' => 'base_delivery_fee', 'label' => 'Base Delivery Fee', 'value' => $food['food_base_delivery_fee'] ?? '30', 'type' => 'number', 'is_public' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['group' => 'delivery', 'key' => 'delivery_fee_per_km', 'label' => 'Delivery Fee per KM', 'value' => $food['food_delivery_fee_per_km'] ?? '5', 'type' => 'number', 'is_public' => true, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['group' => 'delivery', 'key' => 'free_delivery_above', 'label' => 'Free Delivery Above', 'value' => $food['food_free_delivery_above'] ?? '500', 'type' => 'number', 'is_public' => true, 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
            ['group' => 'delivery', 'key' => 'delivery_gst_percent', 'label' => 'Delivery GST %', 'value' => $food['food_delivery_gst_percent'] ?? '18', 'type' => 'number', 'is_public' => true, 'sort_order' => 4, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('app_settings')->whereIn('key', [
            'food_base_delivery_fee',
            'food_delivery_fee_per_km',
            'food_free_delivery_above',
            'food_delivery_gst_percent',
            'grocery_base_delivery_fee',
            'grocery_delivery_fee_per_km',
            'grocery_free_delivery_above',
            'grocery_delivery_gst_percent',
        ])->delete();
    }

    private function row(string $group, string $key, string $label, string $value, int $sortOrder, Carbon $now): array
    {
        return [
            'group' => $group,
            'key' => $key,
            'label' => $label,
            'value' => $value,
            'type' => 'number',
            'is_public' => true,
            'sort_order' => $sortOrder,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
};
