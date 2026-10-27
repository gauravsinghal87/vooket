<?php

namespace Database\Seeders;

use App\Models\DeliverySlot;
use Illuminate\Database\Seeder;

class DeliverySlotSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            ['start_time' => '09:00', 'end_time' => '12:00', 'max_orders' => 20],
            ['start_time' => '12:00', 'end_time' => '15:00', 'max_orders' => 20],
            ['start_time' => '15:00', 'end_time' => '18:00', 'max_orders' => 20],
            ['start_time' => '18:00', 'end_time' => '21:00', 'max_orders' => 20],
        ] as $slot) {
            DeliverySlot::updateOrCreate(
                ['day_of_week' => 'all', 'start_time' => $slot['start_time']],
                [
                    'end_time' => $slot['end_time'],
                    'max_orders' => $slot['max_orders'],
                    'booked_orders' => 0,
                    'lead_time_min' => 45,
                    'is_active' => true,
                ]
            );
        }
    }
}
