<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Services\Maps\ZoneService;
use App\Services\WalletService;
use Database\Seeders\Concerns\SeedsWithImages;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds demo restaurants and grocery stores distributed across the three
 * Jaipur service zones (Central / North / South), with menus, grocery
 * products and stock so each zone has bookable supply.
 *
 * Every record uses updateOrCreate and is safe to re-run.
 */
class JaipurVendorSeeder extends Seeder
{
    use SeedsWithImages;

    /**
     * Demo supply keyed by zone code. Coordinates sit safely inside the
     * matching Jaipur zone polygon.
     */
    private const DEMO = [
        'JAI-CENTRAL' => [
            'restaurants' => [
                ['Handi Restaurant', 'Rakesh Sharma', 'C-Scheme, Ashok Marg, Jaipur', 26.9124, 75.7873, 'Rajasthani, North Indian', false, 4.5],
                ['Laxmi Mishthan Bhandar', 'Anil Gupta', 'Johari Bazaar, Jaipur', 26.9180, 75.8260, 'Rajasthani Sweets, Vegetarian', true, 4.7],
            ],
            'stores' => [
                ['Jaipur Grocers', 'Sunita Agarwal', 'Ashok Nagar, Jaipur', 26.9080, 75.8000, 'supermarket'],
                ['Pink City Supermart', 'Vikram Singh', 'MI Road, Jaipur', 26.9150, 75.7800, 'supermarket'],
            ],
        ],
        'JAI-NORTH' => [
            'restaurants' => [
                ['Vidhyadhar Dhaba', 'Mohan Lal', 'Vidhyadhar Nagar, Jaipur', 26.9600, 75.7900, 'North Indian, Dhaba', false, 4.3],
                ['Jhotwara Kitchen', 'Deepak Meena', 'Jhotwara, Jaipur', 26.9450, 75.7450, 'Rajasthani, Chinese', false, 4.2],
            ],
            'stores' => [
                ['North Mart', 'Kavita Jain', 'Mansarovar, Jaipur', 26.9550, 75.7700, 'supermarket'],
                ['Sodala Daily Needs', 'Rajesh Kumar', 'Sodala, Jaipur', 26.9350, 75.7600, 'convenience'],
            ],
        ],
        'JAI-SOUTH' => [
            'restaurants' => [
                ['Jagatpura Spice Court', 'Pankaj Yadav', 'Jagatpura, Jaipur', 26.8457, 75.8048, 'North Indian, Mughlai', false, 4.4],
                ['Sitapura Biryani House', 'Imran Khan', 'Sitapura, Jaipur', 26.8300, 75.7500, 'Hyderabadi, Biryani', false, 4.6],
            ],
            'stores' => [
                ['South Super Bazaar', 'Neha Choudhary', 'Sitapura, Jaipur', 26.8400, 75.7600, 'supermarket'],
                ['Malviya Fresh Mart', 'Suresh Saini', 'Malviya Nagar, Jaipur', 26.8550, 75.8100, 'supermarket'],
            ],
        ],
    ];

    public function run(): void
    {
        $wallet = app(WalletService::class);
        $zoneService = app(ZoneService::class);

        $foodCats = $this->categoryIds('food');
        $groceryCats = $this->categoryIds('grocery');

        foreach (self::DEMO as $zoneCode => $supply) {
            $zone = Zone::where('code', $zoneCode)->first();

            if (! $zone) {
                $this->command->warn("Zone {$zoneCode} not found — run ZoneSeeder first.");

                continue;
            }

            foreach ($supply['restaurants'] as [$name, $owner, $address, $lat, $lng, $cuisine, $isVeg, $rating]) {
                $this->seedRestaurant($wallet, $zoneService, $zone, $foodCats, $name, $owner, $address, $lat, $lng, $cuisine, $isVeg, $rating);
            }

            foreach ($supply['stores'] as [$name, $owner, $address, $lat, $lng, $storeType]) {
                $this->seedStore($wallet, $zoneService, $zone, $groceryCats, $name, $owner, $address, $lat, $lng, $storeType);
            }
        }

        $this->command->info('Jaipur zone vendors seeded: 6 restaurants + 6 grocery stores across Central/North/South.');
    }

    /**
     * @param  array<string, int>  $foodCats
     */
    private function seedRestaurant(
        WalletService $wallet,
        ZoneService $zoneService,
        Zone $zone,
        array $foodCats,
        string $name,
        string $owner,
        string $address,
        float $lat,
        float $lng,
        string $cuisine,
        bool $isVeg,
        float $rating,
    ): void {
        $slug = $this->slug($name);
        [$user, $vendor] = $this->vendor($wallet, 'restaurant', $slug, $name, $owner, $address, $lat, $lng, 'food', 15, $zoneService);

        $restaurant = Restaurant::updateOrCreate(
            ['vendor_id' => $vendor->id, 'name' => $name],
            [
                'slug' => $slug,
                'description' => $cuisine.' specialities served fresh in Jaipur',
                'cuisine_type' => $cuisine,
                'latitude' => $lat,
                'longitude' => $lng,
                'address' => $address,
                'phone' => $vendor->phone,
                'is_open' => true,
                'is_featured' => true,
                'is_veg' => $isVeg,
                'opens_at' => '10:00:00',
                'closes_at' => '23:00:00',
                'avg_prep_time_min' => 25,
                'avg_delivery_time_min' => 35,
                'min_order_amount' => 100,
                'delivery_fee' => 30,
                'free_delivery_above' => 499,
                'rating' => $rating,
                'rating_count' => random_int(80, 400),
            ]
        );

        $menu = [
            ['Paneer Tikka', 'paneer-tikka', 'starters', 249, true, 'Cottage cheese marinated in spices and grilled'],
            ['Dal Baati Churma', 'dal-baati-churma', 'main-course', 299, true, 'Baked baatis with dal and sweet churma'],
            ['Laal Maas', 'laal-maas', 'main-course', 399, false, 'Fiery Rajasthani mutton curry'],
            ['Butter Naan', 'butter-naan', 'breads', 49, true, 'Tandoor-baked flatbread with butter'],
            ['Gulab Jamun', 'gulab-jamun', 'desserts', 99, true, 'Milk dumplings in sugar syrup'],
            ['Masala Chai', 'masala-chai', 'beverages', 69, true, 'Indian spiced tea'],
        ];

        foreach ($menu as [$item, $itemSlug, $categorySlug, $price, $itemVeg, $description]) {
            Product::updateOrCreate(
                ['vendor_id' => $vendor->id, 'slug' => $itemSlug],
                [
                    'name' => $item,
                    'restaurant_id' => $restaurant->id,
                    'category_id' => $foodCats[$categorySlug],
                    'type' => 'food',
                    'description' => $description,
                    'image' => $this->placeholderImage($slug.'-'.$itemSlug, 600, 400),
                    'price' => $price,
                    'is_veg' => $itemVeg,
                    'is_active' => true,
                    'is_available' => true,
                    'unit_type' => 'item',
                    'tax_rate' => 5,
                    'preparation_time_min' => 15,
                ]
            );
        }
    }

    /**
     * @param  array<string, int>  $groceryCats
     */
    private function seedStore(
        WalletService $wallet,
        ZoneService $zoneService,
        Zone $zone,
        array $groceryCats,
        string $name,
        string $owner,
        string $address,
        float $lat,
        float $lng,
        string $storeType,
    ): void {
        $slug = $this->slug($name);
        [$user, $vendor] = $this->vendor($wallet, 'grocery', $slug, $name, $owner, $address, $lat, $lng, 'grocery', 10, $zoneService);

        $store = Store::updateOrCreate(
            ['vendor_id' => $vendor->id, 'name' => $name],
            [
                'slug' => $slug,
                'store_type' => $storeType,
                'description' => 'Daily groceries and essentials delivered across '.$zone->name,
                'latitude' => $lat,
                'longitude' => $lng,
                'address' => $address,
                'phone' => $vendor->phone,
                'is_open' => true,
                'is_featured' => true,
                'opens_at' => '08:00:00',
                'closes_at' => '22:00:00',
                'min_order_amount' => 200,
                'delivery_fee' => 40,
                'rating' => round(random_int(40, 49) / 10, 1),
                'rating_count' => random_int(60, 300),
            ]
        );

        $catalogue = [
            ['Amul Taaza Milk 500ml', 'amul-taaza-milk-500ml', 'dairy-eggs', 27, 'item', 0.5, '500 ml', true],
            ['Farm Eggs (6 pack)', 'farm-eggs-6', 'dairy-eggs', 78, 'pack', 6, '6 pieces', true],
            ['Banana (1 kg)', 'banana-1kg', 'fruits-vegetables', 60, 'kg', 1, '1 kg', true],
            ['Tomato (1 kg)', 'tomato-1kg', 'fruits-vegetables', 40, 'kg', 1, '1 kg', true],
            ['White Bread', 'white-bread', 'bakery', 45, 'pack', 0.4, '400 g', true],
            ['Aashirvaad Atta 5kg', 'aashirvaad-atta-5kg', 'grains-staples', 265, 'kg', 5, '5 kg', true],
            ['Lays Classic Chips', 'lays-classic-chips', 'snacks', 20, 'pack', 0.052, '52 g', true],
            ['Coca-Cola 750ml', 'coca-cola-750ml', 'grocery-beverages', 40, 'l', 0.75, '750 ml', true],
        ];

        foreach ($catalogue as [$item, $itemSlug, $categorySlug, $price, $unit, $unitValue, $unitLabel, $itemVeg]) {
            $product = Product::updateOrCreate(
                ['vendor_id' => $vendor->id, 'slug' => $itemSlug],
                [
                    'name' => $item,
                    'store_id' => $store->id,
                    'category_id' => $groceryCats[$categorySlug],
                    'type' => 'grocery',
                    'description' => $item.' — everyday essential',
                    'image' => $this->placeholderImage($slug.'-'.$itemSlug, 600, 400),
                    'price' => $price,
                    'unit_type' => $unit,
                    'unit_value' => $unitValue,
                    'unit_label' => $unitLabel,
                    'is_veg' => $itemVeg,
                    'is_active' => true,
                    'is_available' => true,
                    'tax_rate' => 5,
                    'min_order_qty' => 1,
                ]
            );

            Inventory::updateOrCreate(
                ['vendor_id' => $vendor->id, 'product_id' => $product->id, 'product_variant_id' => null],
                [
                    'quantity' => 60,
                    'reserved_quantity' => 0,
                    'low_stock_threshold' => 10,
                    'track_inventory' => true,
                ]
            );
        }
    }

    /**
     * Create (or update) a vendor login + approved vendor profile, tagging it
     * with the Jaipur zone resolved from its coordinates.
     *
     * @return array{0: User, 1: Vendor}
     */
    private function vendor(
        WalletService $wallet,
        string $type,
        string $slug,
        string $name,
        string $owner,
        string $address,
        float $lat,
        float $lng,
        string $service,
        float $commission,
        ZoneService $zoneService,
    ): array {
        $email = 'vendor.jaipur.'.$slug.'@superapp.com';
        $digits = (string) (9812370000 + (crc32($slug) % 9999));

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'phone' => $digits,
                'country_code' => '+91',
                'password' => Hash::make('password'),
                'user_type' => 'vendor',
                'is_active' => true,
                'is_verified' => true,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
            ]
        );
        $user->roles()->sync([Role::where('slug', 'vendor')->first()->id]);

        $zone = $zoneService->resolve($lat, $lng, $service);

        $vendor = Vendor::updateOrCreate(
            ['user_id' => $user->id],
            [
                'business_name' => $name,
                'vendor_type' => $type,
                'owner_name' => $owner,
                'phone' => $digits,
                'email' => $email,
                'address' => $address,
                'latitude' => $lat,
                'longitude' => $lng,
                'zone_id' => $zone?->id,
                'gst_number' => '08'.strtoupper(substr(md5($slug), 0, 10)).'1Z'.substr(md5($slug), 10, 1),
                'pan_number' => strtoupper(substr(md5($slug), 0, 10)),
                'status' => 'approved',
                'approved_at' => now(),
                'commission_rate' => $commission,
                'is_active' => true,
            ]
        );

        $wallet->ensureWallet($user, 'vendor');

        return [$user, $vendor];
    }

    /**
     * @return array<string, int>
     */
    private function categoryIds(string $type): array
    {
        $categories = $type === 'food'
            ? ['starters', 'main-course', 'breads', 'desserts', 'beverages']
            : ['dairy-eggs', 'fruits-vegetables', 'bakery', 'grains-staples', 'snacks', 'grocery-beverages', 'home-cleaning', 'personal-care'];

        $ids = [];

        foreach ($categories as $slug) {
            $ids[$slug] = Category::updateOrCreate(
                ['slug' => $slug],
                ['name' => ucwords(str_replace('-', ' ', $slug)), 'type' => $type, 'sort_order' => 0]
            )->id;
        }

        return $ids;
    }

    private function slug(string $name): string
    {
        return strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $name), '-'));
    }
}
