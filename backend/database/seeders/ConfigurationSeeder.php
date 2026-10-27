<?php

namespace Database\Seeders;

use App\Models\AppSetting;
use App\Models\FeatureFlag;
use App\Models\LoyaltyRule;
use App\Models\ReferralRule;
use App\Models\TaxRule;
use App\Services\Pricing\GroceryDeliveryConfigService;
use Illuminate\Database\Seeder;

class ConfigurationSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['group' => 'general', 'key' => 'platform_name', 'label' => 'Platform Name', 'value' => 'SuperApp', 'type' => 'string', 'is_public' => true, 'sort_order' => 1],
            ['group' => 'general', 'key' => 'currency', 'label' => 'Currency', 'value' => 'INR', 'type' => 'string', 'is_public' => true, 'sort_order' => 3],
            ['group' => 'general', 'key' => 'support_phone', 'label' => 'Support Phone', 'value' => '+91 98765 43210', 'type' => 'string', 'is_public' => true, 'sort_order' => 4],
            ['group' => 'general', 'key' => 'support_email', 'label' => 'Support Email', 'value' => 'support@superapp.com', 'type' => 'string', 'is_public' => true, 'sort_order' => 5],

            ['group' => 'wallet', 'key' => 'min_topup_amount', 'label' => 'Min Topup Amount', 'value' => '100', 'type' => 'number', 'is_public' => false, 'sort_order' => 1],
            ['group' => 'wallet', 'key' => 'max_topup_amount', 'label' => 'Max Topup Amount', 'value' => '10000', 'type' => 'number', 'is_public' => false, 'sort_order' => 2],

            ['group' => 'commission', 'key' => 'food_commission', 'label' => 'Food Commission %', 'value' => '15', 'type' => 'number', 'is_public' => false, 'sort_order' => 1],
            ['group' => 'commission', 'key' => 'grocery_commission', 'label' => 'Grocery Commission %', 'value' => '10', 'type' => 'number', 'is_public' => false, 'sort_order' => 2],
            ['group' => 'commission', 'key' => 'ride_commission', 'label' => 'Ride Commission %', 'value' => '20', 'type' => 'number', 'is_public' => false, 'sort_order' => 3],

            ['group' => 'payment', 'key' => 'cash_on_delivery_enabled', 'label' => 'Cash on Delivery', 'value' => 'true', 'type' => 'boolean', 'is_public' => true, 'sort_order' => 1],
            ['group' => 'payment', 'key' => 'wallet_payments_enabled', 'label' => 'Wallet Payments', 'value' => 'true', 'type' => 'boolean', 'is_public' => true, 'sort_order' => 2],
            ['group' => 'payment', 'key' => 'online_payments_enabled', 'label' => 'Online Payments', 'value' => 'true', 'type' => 'boolean', 'is_public' => true, 'sort_order' => 3],

            ['group' => 'food_delivery', 'key' => 'food_delivery_fee_per_km', 'label' => 'Delivery Fee per KM', 'value' => '5', 'type' => 'number', 'is_public' => true, 'sort_order' => 1],
            ['group' => 'food_delivery', 'key' => 'food_delivery_fee_paid_by_admin_per_km', 'label' => 'Delivery Fee Paid by Admin per KM', 'value' => '5', 'type' => 'number', 'is_public' => true, 'sort_order' => 2],
            ['group' => 'food_delivery', 'key' => 'food_free_delivery_above', 'label' => 'Free Delivery Above', 'value' => '500', 'type' => 'number', 'is_public' => true, 'sort_order' => 3],
            ['group' => 'food_delivery', 'key' => 'food_delivery_gst_percent', 'label' => 'Delivery GST %', 'value' => '18', 'type' => 'number', 'is_public' => true, 'sort_order' => 4],
            ['group' => 'food_delivery', 'key' => 'food_free_delivery_km', 'label' => 'Free Delivery Within (KM)', 'value' => '2', 'type' => 'number', 'is_public' => true, 'sort_order' => 5],
            ['group' => 'food_delivery', 'key' => 'food_partner_free_distance_earning', 'label' => 'Partner Earning for Free Delivery Distance', 'value' => '20', 'type' => 'number', 'is_public' => true, 'sort_order' => 6],
            ['group' => 'food_delivery', 'key' => 'food_delivery_packaging_charge', 'label' => 'Packaging Charge', 'value' => '0', 'type' => 'number', 'is_public' => true, 'sort_order' => 7],
            ['group' => 'food_delivery', 'key' => 'food_delivery_handling_fee', 'label' => 'Handling Fee', 'value' => '0', 'type' => 'number', 'is_public' => true, 'sort_order' => 8],
            ['group' => 'grocery_delivery', 'key' => 'grocery_delivery_fee_per_km', 'label' => 'Delivery Fee per KM', 'value' => '5', 'type' => 'number', 'is_public' => true, 'sort_order' => 1],
            ['group' => 'grocery_delivery', 'key' => 'grocery_delivery_fee_paid_by_admin_per_km', 'label' => 'Delivery Fee Paid by Admin per KM', 'value' => '5', 'type' => 'number', 'is_public' => true, 'sort_order' => 2],
            ['group' => 'grocery_delivery', 'key' => 'grocery_free_delivery_above', 'label' => 'Free Delivery Above', 'value' => '500', 'type' => 'number', 'is_public' => true, 'sort_order' => 3],
            ['group' => 'grocery_delivery', 'key' => 'grocery_delivery_gst_percent', 'label' => 'Delivery GST %', 'value' => '18', 'type' => 'number', 'is_public' => true, 'sort_order' => 4],
            ['group' => 'grocery_delivery', 'key' => 'grocery_free_delivery_km', 'label' => 'Free Delivery Within (KM)', 'value' => '2', 'type' => 'number', 'is_public' => true, 'sort_order' => 5],
            ['group' => 'grocery_delivery', 'key' => 'grocery_partner_free_distance_earning', 'label' => 'Partner Earning for Free Delivery Distance', 'value' => '20', 'type' => 'number', 'is_public' => true, 'sort_order' => 6],

            ['group' => 'partner_delivery', 'key' => 'food_partner_base_fee', 'label' => 'Food Partner Base Fee (legacy - not used in earning)', 'value' => '30', 'type' => 'number', 'is_public' => false, 'sort_order' => 1],
            ['group' => 'partner_delivery', 'key' => 'food_delivery_partner_fee_per_km', 'label' => 'Food Partner Fee per KM', 'value' => '5', 'type' => 'number', 'is_public' => false, 'sort_order' => 2],

            ['group' => 'ride', 'key' => 'surge_pricing_enabled', 'label' => 'Surge Pricing', 'value' => 'false', 'type' => 'boolean', 'is_public' => true, 'sort_order' => 1],
            ['group' => 'ride', 'key' => 'driver_search_timeout_sec', 'label' => 'Driver Search Timeout (sec)', 'value' => '30', 'type' => 'number', 'is_public' => false, 'sort_order' => 2],

            ['group' => 'loyalty', 'key' => 'points_per_rupee', 'label' => 'Loyalty Points per Rupee', 'value' => '1', 'type' => 'number', 'is_public' => false, 'sort_order' => 1],
            ['group' => 'loyalty', 'key' => 'points_redeem_rate', 'label' => 'Points Redeem Rate (1 point = ₹)', 'value' => '0.05', 'type' => 'number', 'is_public' => false, 'sort_order' => 2],
        ];

        // Scheduled Grocery Delivery is a configuration of its own, separate from
        // Instant. firstOrCreate (not updateOrCreate) so re-seeding can never
        // overwrite a value an Admin already set in the Scheduled Delivery tab.
        foreach ($this->scheduledGrocerySettings() as $setting) {
            AppSetting::firstOrCreate(['key' => $setting['key']], $setting);
        }

        foreach ($settings as $setting) {
            AppSetting::updateOrCreate(['key' => $setting['key']], $setting);
        }

        // The platform logo is never part of the updateOrCreate list above:
        // re-seeding must not wipe an uploaded logo an admin already configured.
        // `firstOrCreate` keeps the stored value (a public storage URL) intact.
        AppSetting::firstOrCreate(
            ['key' => 'platform_logo'],
            [
                'group' => 'general',
                'label' => 'Platform Logo',
                'help_text' => 'Square PNG, JPG or WebP logo (max 2MB). Shown across the customer apps.',
                'value' => null,
                'type' => 'string',
                'is_public' => true,
                'sort_order' => 2,
            ]
        );

        // The wallet-balance floors are operator-tunable, so they are only created
        // when absent. The `updateOrCreate` loop above would overwrite the value an
        // admin has already chosen with the seeded default on every `db:seed`.
        // Vendors and partners are governed by independent settings.
        AppSetting::firstOrCreate(
            ['key' => 'vendor_min_wallet_balance'],
            [
                'group' => 'vendor_payout',
                'label' => 'Minimum Vendor Wallet Balance',
                'help_text' => 'Minimum amount that must remain in a Food/Grocery vendor wallet after payout.',
                'value' => '500',
                'type' => 'number',
                'is_public' => false,
                'sort_order' => 1,
            ]
        );

        AppSetting::firstOrCreate(
            ['key' => 'partner_min_wallet_balance'],
            [
                'group' => 'partner_payout',
                'label' => 'Minimum Partner Wallet Balance',
                'help_text' => 'Minimum amount that must remain in a delivery partner or rider wallet after payout.',
                'value' => '200',
                'type' => 'number',
                'is_public' => false,
                'sort_order' => 1,
            ]
        );

        $flags = [
            ['key' => 'food_enabled', 'name' => 'Food Delivery', 'enabled' => true, 'description' => 'Enable/disable food delivery service'],
            ['key' => 'grocery_enabled', 'name' => 'Grocery Delivery', 'enabled' => true, 'description' => 'Enable/disable grocery delivery service'],
            ['key' => 'rides_enabled', 'name' => 'Ride Hailing', 'enabled' => true, 'description' => 'Enable/disable ride hailing service'],
            ['key' => 'wallet_enabled', 'name' => 'Wallet', 'enabled' => true, 'description' => 'Enable/disable wallet system'],
            ['key' => 'cash_on_delivery_enabled', 'name' => 'Cash on Delivery', 'enabled' => true, 'description' => 'Enable/disable COD'],
            ['key' => 'ai_recommendations_enabled', 'name' => 'AI Recommendations', 'enabled' => true, 'description' => 'Enable AI-powered recommendations'],
            ['key' => 'scheduled_delivery_enabled', 'name' => 'Scheduled Delivery', 'enabled' => true, 'description' => 'Enable scheduled delivery'],
            ['key' => 'ride_surge_enabled', 'name' => 'Ride Surge Pricing', 'enabled' => false, 'description' => 'Enable surge pricing for rides'],
            ['key' => 'referrals_enabled', 'name' => 'Referrals', 'enabled' => true, 'description' => 'Enable referral system'],
            ['key' => 'loyalty_enabled', 'name' => 'Loyalty Program', 'enabled' => true, 'description' => 'Enable loyalty points'],
            ['key' => 'ai_grocery_prediction_enabled', 'name' => 'AI Grocery Prediction', 'enabled' => true, 'description' => 'Enable grocery replenishment predictions'],
        ];

        foreach ($flags as $flag) {
            FeatureFlag::updateOrCreate(['key' => $flag['key']], $flag);
        }

        // Referral rules
        ReferralRule::updateOrCreate(
            ['user_type' => 'customer'],
            [
                'referrer_reward' => 100,
                'referee_reward' => 50,
                'reward_type' => 'wallet',
                'min_orders_for_reward' => 1,
                'min_order_amount_threshold' => 100,
                'is_active' => true,
            ]
        );

        // Loyalty rules
        LoyaltyRule::create([
            'service' => 'food',
            'rule_type' => 'points_per_amount',
            'points_per_currency' => 1,
            'points_per_order' => 10,
            'is_active' => true,
        ]);

        LoyaltyRule::create([
            'service' => 'grocery',
            'rule_type' => 'points_per_amount',
            'points_per_currency' => 1,
            'points_per_order' => 10,
            'is_active' => true,
        ]);

        LoyaltyRule::create([
            'service' => 'ride',
            'rule_type' => 'points_per_amount',
            'points_per_currency' => 1,
            'points_per_order' => 5,
            'is_active' => true,
        ]);

        // Tax rules
        TaxRule::create([
            'name' => 'Food GST 5%',
            'service' => 'food',
            'type' => 'percentage',
            'rate' => 5,
            'country_code' => 'IN',
            'is_active' => true,
        ]);

        TaxRule::create([
            'name' => 'Grocery GST 5%',
            'service' => 'grocery',
            'type' => 'percentage',
            'rate' => 5,
            'country_code' => 'IN',
            'is_active' => true,
        ]);

        TaxRule::create([
            'name' => 'Ride GST 5%',
            'service' => 'ride',
            'type' => 'percentage',
            'rate' => 5,
            'country_code' => 'IN',
            'is_active' => true,
        ]);
    }

    /**
     * Default Scheduled Grocery Delivery settings for a fresh install.
     *
     * The chargeable values mirror the Instant defaults because a scheduled order
     * is charged the same way today; they are then editable independently. The
     * admin-funded per-parcel, packaging, and handling amounts start at zero so a
     * new install charges nothing that was not explicitly configured.
     *
     * @return array<int, array<string, mixed>>
     */
    private function scheduledGrocerySettings(): array
    {
        $group = GroceryDeliveryConfigService::GROUP;

        return [
            [
                'group' => $group,
                'key' => GroceryDeliveryConfigService::TYPE_KEY,
                'label' => 'Delivery Type',
                'help_text' => 'Controls how a Scheduled Grocery order is charged. Free Delivery makes the customer delivery charge ₹0 and funds delivery per parcel. Chargeable Delivery charges the customer per KM using the Scheduled Delivery configuration.',
                'value' => GroceryDeliveryConfigService::TYPE_CHARGEABLE,
                'type' => 'select',
                'is_public' => false,
                'options' => json_encode([GroceryDeliveryConfigService::TYPE_FREE, GroceryDeliveryConfigService::TYPE_CHARGEABLE]),
                'sort_order' => 1,
            ],
            ['group' => $group, 'key' => 'grocery_scheduled_free_delivery_admin_fee_per_parcel', 'label' => 'Delivery Fee Paid by Admin per Parcel', 'value' => '0', 'type' => 'number', 'is_public' => false, 'sort_order' => 2],
            ['group' => $group, 'key' => 'grocery_scheduled_free_delivery_packaging_charge', 'label' => 'Packaging Charge', 'value' => '0', 'type' => 'number', 'is_public' => false, 'sort_order' => 3],
            ['group' => $group, 'key' => 'grocery_scheduled_free_delivery_handling_fee', 'label' => 'Handling Fee', 'value' => '0', 'type' => 'number', 'is_public' => false, 'sort_order' => 4],
            ['group' => $group, 'key' => 'grocery_scheduled_delivery_fee_per_km', 'label' => 'Delivery Fee per KM', 'value' => '5', 'type' => 'number', 'is_public' => false, 'sort_order' => 5],
            ['group' => $group, 'key' => 'grocery_scheduled_delivery_fee_paid_by_admin_per_km', 'label' => 'Delivery Fee Paid by Admin per KM', 'value' => '5', 'type' => 'number', 'is_public' => false, 'sort_order' => 6],
            ['group' => $group, 'key' => 'grocery_scheduled_free_delivery_above', 'label' => 'Free Delivery Above', 'value' => '500', 'type' => 'number', 'is_public' => false, 'sort_order' => 7],
            ['group' => $group, 'key' => 'grocery_scheduled_delivery_gst_percent', 'label' => 'Delivery GST %', 'value' => '18', 'type' => 'number', 'is_public' => false, 'sort_order' => 8],
            ['group' => $group, 'key' => 'grocery_scheduled_free_delivery_km', 'label' => 'Free Delivery Within (KM)', 'value' => '2', 'type' => 'number', 'is_public' => false, 'sort_order' => 9],
            ['group' => $group, 'key' => 'grocery_scheduled_packaging_charge', 'label' => 'Packaging Charge', 'value' => '0', 'type' => 'number', 'is_public' => false, 'sort_order' => 10],
            ['group' => $group, 'key' => 'grocery_scheduled_handling_fee', 'label' => 'Handling Fee', 'value' => '0', 'type' => 'number', 'is_public' => false, 'sort_order' => 11],
        ];
    }
}
