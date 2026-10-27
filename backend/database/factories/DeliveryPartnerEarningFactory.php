<?php

namespace Database\Factories;

use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class DeliveryPartnerEarningFactory extends Factory
{
    protected $model = DeliveryPartnerEarning::class;

    public function definition(): array
    {
        return [
            'delivery_partner_id' => DeliveryPartner::factory(),
            'order_id' => Order::factory(),
            'earning_number' => 'EARN_'.Str::upper(Str::random(12)),
            'amount' => $this->faker->randomFloat(2, 10, 500),
            'currency' => 'INR',
            'type' => 'delivery',
            'status' => 'earned',
        ];
    }
}
