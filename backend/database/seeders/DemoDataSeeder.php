<?php

namespace Database\Seeders;

use App\Models\Addon;
use App\Models\AddonOption;
use App\Models\Brand;
use App\Models\Category;
use App\Models\DeliveryFeeRule;
use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Vendor;
use App\Services\WalletService;
use Database\Seeders\Concerns\SeedsWithImages;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    use SeedsWithImages;

    public function run(): void
    {
        $walletService = app(WalletService::class);

        // ============ TEST CUSTOMER ============
        $customer = User::updateOrCreate(
            ['phone' => '9876543210'],
            [
                'name' => 'Test Customer',
                'email' => 'customer@superapp.com',
                'phone' => '9876543210',
                'country_code' => '+91',
                'password' => Hash::make('password'),
                'user_type' => 'customer',
                'is_active' => true,
                'is_verified' => true,
                'phone_verified_at' => now(),
                'email_verified_at' => now(),
                'referral_code' => 'CUST99',
            ]
        );
        $customer->roles()->sync([Role::where('slug', 'customer')->first()->id]);
        $walletService->ensureWallet($customer, 'customer');
        $walletService->credit($customer, 'customer', 1000, 'BONUS', null, null, 'Welcome bonus', 'welcome_bonus_test');

        // ============ RESTAURANT VENDOR ============
        $restaurantVendor = User::updateOrCreate(
            ['email' => 'restaurant@superapp.com'],
            [
                'name' => 'Spice Villa Restaurant',
                'email' => 'restaurant@superapp.com',
                'phone' => '9812345678',
                'password' => Hash::make('password'),
                'user_type' => 'vendor',
                'is_active' => true,
                'is_verified' => true,
            ]
        );
        $restaurantVendor->roles()->sync([Role::where('slug', 'vendor')->first()->id]);

        $vendor1 = Vendor::updateOrCreate(
            ['user_id' => $restaurantVendor->id],
            [
                'business_name' => 'Spice Villa Restaurant Pvt Ltd',
                'vendor_type' => 'restaurant',
                'owner_name' => 'Rajesh Kumar',
                'phone' => '9812345678',
                'email' => 'restaurant@superapp.com',
                'gst_number' => '07ABCDE1234F1Z5',
                'pan_number' => 'ABCDE1234F',
                'status' => 'approved',
                'approved_at' => now(),
                'commission_rate' => 15,
                'is_active' => true,
            ]
        );
        $walletService->ensureWallet($restaurantVendor, 'vendor');

        $restaurant = Restaurant::updateOrCreate(
            ['vendor_id' => $vendor1->id, 'name' => 'Spice Villa'],
            [
                'slug' => 'spice-villa',
                'description' => 'Authentic North Indian cuisine with modern twists',
                'cuisine_type' => 'North Indian, Mughlai',
                'latitude' => 28.6139,
                'longitude' => 77.2090,
                'address' => 'Connaught Place, New Delhi',
                'phone' => '9812345678',
                'is_open' => true,
                'is_featured' => true,
                'is_veg' => false,
                'opens_at' => '10:00:00',
                'closes_at' => '23:00:00',
                'avg_prep_time_min' => 20,
                'min_order_amount' => 100,
                'delivery_fee' => 30,
                'free_delivery_above' => 500,
                'rating' => 4.5,
                'rating_count' => 250,
            ]
        );

        // ============ GROCERY STORE VENDOR ============
        $groceryVendor = User::updateOrCreate(
            ['email' => 'grocery@superapp.com'],
            [
                'name' => 'FreshMart Grocery',
                'email' => 'grocery@superapp.com',
                'phone' => '9823456789',
                'password' => Hash::make('password'),
                'user_type' => 'vendor',
                'is_active' => true,
            ]
        );
        $groceryVendor->roles()->sync([Role::where('slug', 'vendor')->first()->id]);

        $vendor2 = Vendor::updateOrCreate(
            ['user_id' => $groceryVendor->id],
            [
                'business_name' => 'FreshMart Grocery Stores',
                'vendor_type' => 'grocery',
                'owner_name' => 'Priya Sharma',
                'phone' => '9823456789',
                'gst_number' => '08XYZDE5678G1Z6',
                'pan_number' => 'XYZDE5678G',
                'status' => 'approved',
                'approved_at' => now(),
                'commission_rate' => 10,
                'is_active' => true,
            ]
        );
        $walletService->ensureWallet($groceryVendor, 'vendor');

        $store = Store::updateOrCreate(
            ['vendor_id' => $vendor2->id, 'name' => 'FreshMart Supermarket'],
            [
                'slug' => 'freshmart-supermarket',
                'store_type' => 'supermarket',
                'description' => 'Everything you need for your weekly groceries',
                'latitude' => 28.6315,
                'longitude' => 77.2167,
                'address' => 'Janpath, New Delhi',
                'phone' => '9823456789',
                'is_open' => true,
                'is_featured' => true,
                'opens_at' => '08:00:00',
                'closes_at' => '22:00:00',
                'min_order_amount' => 200,
                'delivery_fee' => 40,
                'rating' => 4.3,
                'rating_count' => 180,
            ]
        );

        // ============ CATEGORIES ============
        $foodCategories = [
            ['name' => 'Starters', 'slug' => 'starters', 'type' => 'food', 'sort_order' => 1],
            ['name' => 'Main Course', 'slug' => 'main-course', 'type' => 'food', 'sort_order' => 2],
            ['name' => 'Biryani', 'slug' => 'biryani', 'type' => 'food', 'sort_order' => 3],
            ['name' => 'Breads', 'slug' => 'breads', 'type' => 'food', 'sort_order' => 4],
            ['name' => 'Desserts', 'slug' => 'desserts', 'type' => 'food', 'sort_order' => 5],
            ['name' => 'Beverages', 'slug' => 'beverages', 'type' => 'food', 'sort_order' => 6],
        ];

        $groceryCategories = [
            ['name' => 'Fruits & Vegetables', 'slug' => 'fruits-vegetables', 'type' => 'grocery', 'sort_order' => 1],
            ['name' => 'Dairy & Eggs', 'slug' => 'dairy-eggs', 'type' => 'grocery', 'sort_order' => 2],
            ['name' => 'Bakery', 'slug' => 'bakery', 'type' => 'grocery', 'sort_order' => 3],
            ['name' => 'Grains & Staples', 'slug' => 'grains-staples', 'type' => 'grocery', 'sort_order' => 4],
            ['name' => 'Snacks', 'slug' => 'snacks', 'type' => 'grocery', 'sort_order' => 5],
            ['name' => 'Beverages', 'slug' => 'grocery-beverages', 'type' => 'grocery', 'sort_order' => 6],
            ['name' => 'Home & Cleaning', 'slug' => 'home-cleaning', 'type' => 'grocery', 'sort_order' => 7],
            ['name' => 'Personal Care', 'slug' => 'personal-care', 'type' => 'grocery', 'sort_order' => 8],
        ];

        $foodCatIds = [];
        foreach ($foodCategories as $cat) {
            $foodCatIds[$cat['slug']] = Category::updateOrCreate(['slug' => $cat['slug']], $cat)->id;
        }

        $groceryCatIds = [];
        foreach ($groceryCategories as $cat) {
            $groceryCatIds[$cat['slug']] = Category::updateOrCreate(['slug' => $cat['slug']], $cat)->id;
        }

        // ============ BRANDS ============
        $brands = [
            'Amul' => 'amul',
            'Nestle' => 'nestle',
            'Tata' => 'tata',
            'Hindustan Unilever' => 'hindustan-unilever',
            'Britannia' => 'britannia',
            'Fortune' => 'fortune',
            'Aashirvaad' => 'aashirvaad',
            'Surf Excel' => 'surf-excel',
            'Colgate' => 'colgate',
        ];

        $brandIds = [];
        foreach ($brands as $name => $slug) {
            $brandIds[$slug] = Brand::updateOrCreate(['name' => $name], ['is_active' => true])->id;
        }

        // ============ FOOD PRODUCTS ============
        $foodProducts = [
            ['Paneer Tikka', 'paneer-tikka', $foodCatIds['starters'], 249, true, 'Cottage cheese marinated in spices, grilled in clay oven', 1],
            ['Chicken Tikka', 'chicken-tikka', $foodCatIds['starters'], 299, false, 'Chicken marinated in yogurt and spices, grilled', 1],
            ['Veg Biryani', 'veg-biryani', $foodCatIds['biryani'], 279, true, 'Fragrant basmati rice with vegetables and spices', 1],
            ['Chicken Biryani', 'chicken-biryani', $foodCatIds['biryani'], 329, false, 'Chicken pieces with fragrant basmati rice', 1],
            ['Paneer Butter Masala', 'paneer-butter-masala', $foodCatIds['main-course'], 299, true, 'Cottage cheese in rich creamy tomato gravy', 1],
            ['Dal Makhani', 'dal-makhani', $foodCatIds['main-course'], 249, true, 'Black lentils slow-cooked with butter and cream', 1],
            ['Butter Naan', 'butter-naan', $foodCatIds['breads'], 49, true, 'Tandoor-baked flatbread with butter', 1],
            ['Garlic Naan', 'garlic-naan', $foodCatIds['breads'], 59, true, 'Flatbread topped with garlic and coriander', 1],
            ['Gulab Jamun', 'gulab-jamun', $foodCatIds['desserts'], 99, true, 'Deep-fried milk dumplings in sugar syrup', 1],
            ['Chocolate Brownie', 'chocolate-brownie', $foodCatIds['desserts'], 149, true, 'Warm chocolate brownie with fudge', 1],
            ['Masala Chai', 'masala-chai', $foodCatIds['beverages'], 69, true, 'Indian spiced tea', 1],
            ['Fresh Lime Soda', 'fresh-lime-soda', $foodCatIds['beverages'], 79, true, 'Fizzy lime and mint refreshment', 1],
        ];

        $productIds = [];
        foreach ($foodProducts as $idx => $fp) {
            $product = Product::updateOrCreate(
                ['vendor_id' => $vendor1->id, 'slug' => $fp[1]],
                [
                    'name' => $fp[0],
                    'restaurant_id' => $restaurant->id,
                    'category_id' => $fp[2],
                    'type' => 'food',
                    'description' => $fp[5],
                    'image' => $this->placeholderImage('prod-'.$fp[1], 600, 400),
                    'price' => $fp[3],
                    'is_veg' => $fp[4],
                    'is_active' => true,
                    'is_available' => true,
                    'unit_type' => 'item',
                    'tax_rate' => 5,
                    'preparation_time_min' => 15,
                ]
            );
            $productIds[] = $product->id;
        }

        // Addons for food
        $addon = Addon::create(['name' => 'Extra Add-ons', 'type' => 'multiple', 'vendor_id' => $vendor1->id]);
        $addonOptions = [
            ['Extra Cheese', 40], ['Extra Butter', 30], ['Spicy', 0], ['Extra Spice', 20],
        ];
        foreach ($addonOptions as $i => $ao) {
            AddonOption::create(['addon_id' => $addon->id, 'name' => $ao[0], 'price' => $ao[1], 'sort_order' => $i]);
        }

        foreach ($productIds as $pid) {
            DB::table('product_addons')->updateOrInsert(
                ['product_id' => $pid, 'addon_id' => $addon->id]
            );
        }

        // ============ GROCERY PRODUCTS ============
        $groceryProducts = [
            ['Amul Taaza Milk 500ml', 'amul-taaza-milk-500ml', $groceryCatIds['dairy-eggs'], 27, $brandIds['amul'], 'item', 1, 'Fresh toned milk', false, 100, 0.5, '500 ml'],
            ['Amul Butter 100g', 'amul-butter-100g', $groceryCatIds['dairy-eggs'], 58, $brandIds['amul'], 'piece', 1, 'Creamy butter', false, 80, 0.1, '100 g'],
            ['Farm Eggs (6 pack)', 'farm-eggs-6', $groceryCatIds['dairy-eggs'], 78, null, 'pack', 6, 'Fresh farm eggs', true, 150, 6, '6 pieces'],
            ['Banana (1 kg)', 'banana-1kg', $groceryCatIds['fruits-vegetables'], 60, null, 'kg', 1, 'Fresh bananas', true, 300, 1, '1 kg'],
            ['Tomato (1 kg)', 'tomato-1kg', $groceryCatIds['fruits-vegetables'], 40, null, 'kg', 1, 'Fresh tomatoes', false, 200, 1, '1 kg'],
            ['Onion (1 kg)', 'onion-1kg', $groceryCatIds['fruits-vegetables'], 35, null, 'kg', 1, 'Fresh onions', false, 250, 1, '1 kg'],
            ['White Bread', 'white-bread', $groceryCatIds['bakery'], 45, $brandIds['britannia'], 'pack', 1, 'Soft white bread', true, 60, 0.4, '400 g'],
            ['Fortune Sunflower Oil 1L', 'fortune-sunflower-oil-1l', $groceryCatIds['grains-staples'], 155, $brandIds['fortune'], 'l', 1, 'Pure sunflower oil', false, 80, 1, '1 L'],
            ['Aashirvaad Atta 5kg', 'aashirvaad-atta-5kg', $groceryCatIds['grains-staples'], 265, $brandIds['aashirvaad'], 'kg', 5, 'Whole wheat flour', false, 120, 5, '5 kg'],
            ['Basmati Rice 5kg', 'basmati-rice-5kg', $groceryCatIds['grains-staples'], 450, $brandIds['tata'], 'kg', 5, 'Premium basmati rice', false, 50, 5, '5 kg'],
            ['Surf Excel 1kg', 'surf-excel-1kg', $groceryCatIds['home-cleaning'], 175, $brandIds['surf-excel'], 'kg', 1, 'Laundry detergent powder', false, 40, 1, '1 kg'],
            ['Colgate 150g', 'colgate-150g', $groceryCatIds['personal-care'], 45, $brandIds['colgate'], 'piece', 1, 'Toothpaste', false, 30, 0.15, '150 g'],
            ['Lays Classic Chips', 'lays-classic-chips', $groceryCatIds['snacks'], 20, null, 'pack', 1, 'Potato chips', false, 100, 0.05, '52 g'],
            ['Maggi Noodles 2-min', 'maggi-noodles', $groceryCatIds['snacks'], 14, $brandIds['nestle'], 'pack', 1, 'Instant noodles', false, 100, 0.07, '70 g'],
            ['Coca-Cola 750ml', 'coca-cola-750ml', $groceryCatIds['grocery-beverages'], 40, null, 'l', 1, 'Soft drink', false, 80, 0.75, '750 ml'],
        ];

        foreach ($groceryProducts as $gp) {
            $product = Product::updateOrCreate(
                ['vendor_id' => $vendor2->id, 'slug' => $gp[1]],
                [
                    'name' => $gp[0],
                    'store_id' => $store->id,
                    'category_id' => $gp[2],
                    'brand_id' => $gp[4],
                    'type' => 'grocery',
                    'description' => $gp[7],
                    'image' => $this->placeholderImage('prod-'.$gp[1], 600, 400),
                    'price' => $gp[3],
                    'unit_type' => $gp[5],
                    'unit_value' => $gp[9],
                    'unit_label' => $gp[10],
                    'is_veg' => $gp[8],
                    'is_active' => true,
                    'is_available' => true,
                    'tax_rate' => 5,
                    'min_order_qty' => 1,
                ]
            );

            Inventory::updateOrCreate(
                ['vendor_id' => $vendor2->id, 'product_id' => $product->id, 'product_variant_id' => null],
                [
                    'quantity' => $gp[6] * 5,
                    'reserved_quantity' => 0,
                    'low_stock_threshold' => 20,
                    'track_inventory' => true,
                ]
            );
        }

        // Delivery Fee Rules
        DeliveryFeeRule::updateOrCreate(
            ['service' => 'food', 'name' => 'Default Food Delivery Fee'],
            [
                'base_fee' => 30,
                'per_km' => 5,
                'peak_fee' => 10,
                'surge_multiplier' => 1.00,
                'weather_surcharge' => 0,
                'small_order_fee' => 0,
                'min_order_for_free_delivery' => 500,
                'platform_fee' => 5,
                'is_active' => true,
            ]
        );

        DeliveryFeeRule::updateOrCreate(
            ['service' => 'grocery', 'name' => 'Default Grocery Delivery Fee'],
            [
                'base_fee' => 40,
                'per_km' => 5,
                'peak_fee' => 10,
                'surge_multiplier' => 1.00,
                'weather_surcharge' => 0,
                'small_order_fee' => 10,
                'min_order_for_free_delivery' => 800,
                'platform_fee' => 5,
                'is_active' => true,
            ]
        );

        // Test driver
        $driverUser = User::updateOrCreate(
            ['phone' => '9765432100'],
            [
                'name' => 'Test Driver',
                'email' => 'driver@superapp.com',
                'phone' => '9765432100',
                'password' => Hash::make('password'),
                'user_type' => 'driver',
                'is_active' => true,
                'is_verified' => true,
            ]
        );
        $driverUser->roles()->sync([Role::where('slug', 'driver')->first()->id]);
        $walletService->ensureWallet($driverUser, 'driver');

        $driver = Driver::updateOrCreate(
            ['user_id' => $driverUser->id],
            [
                'vehicle_type_id' => VehicleType::where('code', 'cab_mini')->first()->id,
                'status' => 'online',
                'vehicle_number' => 'DL-01-AB-1234',
                'vehicle_model' => 'Maruti Swift',
                'vehicle_color' => 'White',
                'license_number' => 'DL-1234567890',
                'is_online' => true,
                'latitude' => 28.6139,
                'longitude' => 77.2090,
                'last_location_at' => now(),
                'rating' => 4.8,
                'rating_count' => 120,
            ]
        );

        // Test delivery partner
        $dpUser = User::updateOrCreate(
            ['phone' => '9754321000'],
            [
                'name' => 'Test Delivery Partner',
                'email' => 'partner@superapp.com',
                'phone' => '9754321000',
                'password' => Hash::make('password'),
                'user_type' => 'delivery_partner',
                'is_active' => true,
                'is_verified' => true,
            ]
        );
        $dpUser->roles()->sync([Role::where('slug', 'delivery_partner')->first()->id]);
        $walletService->ensureWallet($dpUser, 'delivery_partner');

        DeliveryPartner::updateOrCreate(
            ['user_id' => $dpUser->id],
            [
                'status' => 'online',
                'vehicle_type' => 'bike',
                'vehicle_number' => 'DL-02-CD-5678',
                'is_online' => true,
                'latitude' => 28.6200,
                'longitude' => 77.2100,
                'last_location_at' => now(),
                'rating' => 4.6,
                'rating_count' => 90,
            ]
        );

        $this->command->info('Demo data seeded successfully!');
    }
}
