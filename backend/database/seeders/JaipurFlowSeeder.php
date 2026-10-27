<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\Category;
use App\Models\DeliveryPartner;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\WalletService;
use Database\Seeders\Concerns\SeedsWithImages;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds everything needed to exercise the full food-delivery flow in Jaipur
 * in isolation from the Delhi demo data:
 *
 *  - one customer with a Jaipur delivery address,
 *  - one approved restaurant vendor with a Jaipur menu (with images),
 *  - five food delivery partners online around Jaipur.
 *
 * Every record uses updateOrCreate and is safe to re-run.
 */
class JaipurFlowSeeder extends Seeder
{
    use SeedsWithImages;

    private const CITY = [
        'latitude' => 26.9124,
        'longitude' => 75.7873,
        'address' => 'C-Scheme, Ashok Marg, Jaipur, Rajasthan 302001',
    ];

    public function run(): void
    {
        $walletService = app(WalletService::class);

        // ============ JAIPUR CUSTOMER ============
        $customer = User::updateOrCreate(
            ['email' => 'customer.jaipur@superapp.com'],
            [
                'name' => 'Jaipur Customer',
                'phone' => '9876511111',
                'country_code' => '+91',
                'password' => Hash::make('password'),
                'user_type' => 'customer',
                'is_active' => true,
                'is_verified' => true,
                'phone_verified_at' => now(),
                'email_verified_at' => now(),
                'referral_code' => 'JAICUST',
            ]
        );
        $customer->roles()->sync([Role::where('slug', 'customer')->first()->id]);
        $walletService->ensureWallet($customer, 'customer');
        $walletService->credit($customer, 'customer', 500, 'BONUS', null, null, 'Jaipur test welcome bonus', 'welcome_bonus_jaipur');

        Address::updateOrCreate(
            ['user_id' => $customer->id, 'label' => 'Home Jaipur'],
            [
                'contact_name' => 'Jaipur Customer',
                'contact_phone' => '9876511111',
                'address_line_1' => '54, Sector 5, Malviya Nagar',
                'landmark' => 'Near Jain Mandir',
                'city' => 'Jaipur',
                'state' => 'Rajasthan',
                'postal_code' => '302017',
                'country' => 'India',
                'latitude' => 26.8555,
                'longitude' => 75.8100,
                'type' => 'delivery',
                'is_default' => true,
            ]
        );

        // ============ JAIPUR RESTAURANT VENDOR ============
        $vendorUser = User::updateOrCreate(
            ['email' => 'vendor.jaipur@superapp.com'],
            [
                'name' => 'Rajasthani Rasoi',
                'phone' => '9812367000',
                'password' => Hash::make('password'),
                'user_type' => 'vendor',
                'is_active' => true,
                'is_verified' => true,
            ]
        );
        $vendorUser->roles()->sync([Role::where('slug', 'vendor')->first()->id]);

        $vendor = Vendor::updateOrCreate(
            ['user_id' => $vendorUser->id],
            [
                'business_name' => 'Rajasthani Rasoi Jaipur',
                'vendor_type' => 'restaurant',
                'owner_name' => 'Mahendra Singh',
                'phone' => '9812367000',
                'email' => 'vendor.jaipur@superapp.com',
                'gst_number' => '08JAIPUR1234F1Z8',
                'pan_number' => 'JAIPUR1234F',
                'status' => 'approved',
                'approved_at' => now(),
                'commission_rate' => 15,
                'is_active' => true,
            ]
        );
        $walletService->ensureWallet($vendorUser, 'vendor');

        $restaurant = Restaurant::updateOrCreate(
            ['vendor_id' => $vendor->id, 'name' => 'Rajasthani Rasoi'],
            [
                'slug' => 'rajasthani-rasoi-jaipur',
                'description' => 'Authentic Rajasthani thalis, baati-churma and fiery Laal Maas',
                'cuisine_type' => 'Rajasthani, North Indian',
                'latitude' => self::CITY['latitude'],
                'longitude' => self::CITY['longitude'],
                'address' => self::CITY['address'],
                'phone' => '9812367000',
                'is_open' => true,
                'is_featured' => true,
                'is_veg' => false,
                'opens_at' => '10:00:00',
                'closes_at' => '23:00:00',
                'avg_prep_time_min' => 25,
                'avg_delivery_time_min' => 35,
                'min_order_amount' => 100,
                'delivery_fee' => 30,
                'free_delivery_above' => 499,
                'rating' => 4.6,
                'rating_count' => 320,
            ]
        );

        // ============ MENU ============
        $menu = [
            ['Mirchi Vada', 'mirchi-vada', 'starters', 59, true, 'Fried green chilli fritters stuffed with spiced potatoes'],
            ['Pyaaz Kachori', 'pyaaz-kachori', 'starters', 49, true, 'Flaky pastry stuffed with onion masala'],
            ['Dal Baati Churma', 'dal-baati-churma', 'main-course', 329, true, 'Baked wheat baatis with dal and sweet churma'],
            ['Gatte ki Sabzi', 'gatte-ki-sabzi', 'main-course', 269, true, 'Gram-flour dumplings in tangy yogurt gravy'],
            ['Laal Maas', 'laal-maas', 'main-course', 399, false, 'Fiery Rajasthani mutton curry in red chilli gravy'],
            ['Ker Sangri', 'ker-sangri', 'main-course', 249, true, 'Classic desert beans and berries sabzi'],
            ['Rajasthani Thali', 'rajasthani-thali', 'main-course', 449, true, 'Full thali: dal, baati, gatte, ker sangri, roti, rice, dessert'],
            ['Bajra Roti (2 pcs)', 'bajra-roti', 'breads', 59, true, 'Pearl millet flatbread with ghee'],
            ['Ghewar (2 pcs)', 'ghewar', 'desserts', 149, true, 'Jaipur-style honey-soaked disc dessert'],
            ['Kesar Kulfi', 'kesar-kulfi', 'desserts', 99, true, 'Saffron kulfi with pistachio'],
            ['Masala Chaas', 'masala-chaas', 'beverages', 49, true, 'Spiced buttermilk with roasted cumin'],
            ['Imli Papdi Chaat', 'imli-papdi-chaat', 'starters', 99, true, 'Crisp papdis with tamarind chutney and yogurt'],
        ];

        foreach ($menu as [$name, $slug, $categorySlug, $price, $isVeg, $description]) {
            Product::updateOrCreate(
                ['vendor_id' => $vendor->id, 'slug' => $slug],
                [
                    'name' => $name,
                    'restaurant_id' => $restaurant->id,
                    'category_id' => $this->foodCategoryId($categorySlug),
                    'type' => 'food',
                    'description' => $description,
                    'image' => $this->placeholderImage('raj-'.$slug, 600, 400),
                    'price' => $price,
                    'is_veg' => $isVeg,
                    'is_active' => true,
                    'is_available' => true,
                    'unit_type' => 'item',
                    'tax_rate' => 5,
                    'preparation_time_min' => 15,
                ]
            );
        }

        // ============ JAIPUR DELIVERY PARTNERS ============
        $partners = [
            ['Jaipur Partner 1', 'partner.jaipur1@superapp.com', '9754311001', 26.9124, 75.7873, 'RJ-27-AB-1001', 'bike', 4.7],
            ['Jaipur Partner 2', 'partner.jaipur2@superapp.com', '9754311002', 26.9205, 75.7957, 'RJ-27-CD-1002', 'scooter', 4.6],
            ['Jaipur Partner 3', 'partner.jaipur3@superapp.com', '9754311003', 26.9045, 75.7768, 'RJ-27-EF-1003', 'bike', 4.5],
            ['Jaipur Partner 4', 'partner.jaipur4@superapp.com', '9754311004', 26.9170, 75.7720, 'RJ-27-GH-1004', 'scooter', 4.8],
            ['Jaipur Partner 5', 'partner.jaipur5@superapp.com', '9754311005', 26.8990, 75.8005, 'RJ-27-IJ-1005', 'bike', 4.4],
        ];

        foreach ($partners as [$name, $email, $phone, $latitude, $longitude, $vehicleNumber, $vehicleType, $rating]) {
            $partnerUser = User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'phone' => $phone,
                    'country_code' => '+91',
                    'password' => Hash::make('password'),
                    'user_type' => 'delivery_partner',
                    'is_active' => true,
                    'is_verified' => true,
                ]
            );
            $partnerUser->roles()->sync([Role::where('slug', 'delivery_partner')->first()->id]);
            $walletService->ensureWallet($partnerUser, 'delivery_partner');

            DeliveryPartner::updateOrCreate(
                ['user_id' => $partnerUser->id],
                [
                    'status' => 'online',
                    'service_type' => 'food',
                    'vehicle_type' => $vehicleType,
                    'vehicle_number' => $vehicleNumber,
                    'is_online' => true,
                    'is_busy' => false,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'last_location_at' => now(),
                    'rating' => $rating,
                    'rating_count' => 60,
                ]
            );
        }

        $this->command->info('Jaipur flow data seeded: 1 customer + address, 1 restaurant vendor + menu, 5 delivery partners.');
    }

    private function foodCategoryId(string $slug): int
    {
        return Category::updateOrCreate(
            ['slug' => $slug],
            ['name' => ucwords(str_replace('-', ' ', $slug)), 'type' => 'food', 'sort_order' => 0]
        )->id;
    }
}
