<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Store;
use App\Models\Vendor;
use App\Models\VendorCategory;
use Database\Seeders\Concerns\SeedsWithImages;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class VendorCategorySeeder extends Seeder
{
    use SeedsWithImages;

    public function run(): void
    {
        $spiceVillaVendor = Vendor::whereHas('user', fn ($q) => $q->where('email', 'restaurant@superapp.com'))->first();
        $freshMartVendor = Vendor::whereHas('user', fn ($q) => $q->where('email', 'grocery@superapp.com'))->first();

        if ($spiceVillaVendor) {
            $restaurant = Restaurant::where('vendor_id', $spiceVillaVendor->id)->where('slug', 'spice-villa')->first();
            $this->seedMenuTree(
                $spiceVillaVendor,
                $restaurant ? ['restaurant_id' => $restaurant->id] : [],
                [
                    ['name' => 'Starters', 'children' => [['name' => 'Paneer Starters'], ['name' => 'Chicken Starters']]],
                    ['name' => 'Main Course', 'children' => [['name' => 'Veg Curries'], ['name' => 'Rice & Dal']]],
                    ['name' => 'Biryani', 'children' => [['name' => 'Veg Biryani'], ['name' => 'Chicken Biryani']]],
                    ['name' => 'Breads'],
                    ['name' => 'Desserts'],
                    ['name' => 'Beverages', 'children' => [['name' => 'Hot Beverages'], ['name' => 'Cold Beverages']]],
                ]
            );
            $this->assignProductsToVendorCategories($spiceVillaVendor->id);
        }

        if ($freshMartVendor) {
            $store = Store::where('vendor_id', $freshMartVendor->id)->where('slug', 'freshmart-supermarket')->first();
            $this->seedMenuTree(
                $freshMartVendor,
                $store ? ['store_id' => $store->id] : [],
                [
                    ['name' => 'Fresh Fruits'],
                    ['name' => 'Vegetables'],
                    ['name' => 'Dairy', 'children' => [['name' => 'Milk'], ['name' => 'Cheese & Butter'], ['name' => 'Yogurt & Curd']]],
                    ['name' => 'Bakery', 'children' => [['name' => 'Breads'], ['name' => 'Buns & Rolls']]],
                    ['name' => 'Grains & Staples'],
                    ['name' => 'Snacks'],
                    ['name' => 'Beverages'],
                    ['name' => 'Home Care'],
                    ['name' => 'Personal Care'],
                ]
            );
            $this->assignProductsToVendorCategories($freshMartVendor->id);
        }

        $this->platformAssignments();
    }

    private function seedMenuTree(Vendor $vendor, array $outlet, array $tree, ?int $parentId = null, int &$order = 0): void
    {
        $order = $order + 1;
        foreach ($tree as $node) {
            $category = VendorCategory::updateOrCreate(
                ['vendor_id' => $vendor->id, 'slug' => Str::slug($node['name'])],
                array_merge(
                    [
                        'name' => $node['name'],
                        'parent_id' => $parentId,
                        'sort_order' => $order,
                        'is_active' => true,
                        'image' => $this->placeholderImage('vc-'.$vendor->id.'-'.$node['name'], 400, 300),
                    ],
                    $outlet
                )
            );
            $order = $order + 1;
            if (isset($node['children']) && count($node['children'])) {
                $this->seedMenuTree($vendor, $outlet, $node['children'], $category->id, $order);
            }
        }
    }

    private function assignProductsToVendorCategories(int $vendorId): void
    {
        $categories = VendorCategory::forVendor($vendorId)->get();
        $byName = collect();
        foreach ($categories as $category) {
            $byName[strtolower($category->name)] = $category;
        }

        $products = Product::where('vendor_id', $vendorId)->with('category:id,name')->get();
        foreach ($products as $product) {
            $vendorCategory = $byName->get(strtolower($product->category?->name ?? ''));
            if ($vendorCategory) {
                $product->vendor_category_id = $vendorCategory->id;
                $product->save();
            }
        }
    }

    private function platformAssignments(): void
    {
        $this->assignPlatform(Restaurant::where('slug', 'spice-villa')->first(), ['starters', 'main-course', 'biryani', 'breads', 'desserts', 'beverages']);
        $this->assignPlatform(Store::where('slug', 'freshmart-supermarket')->first(), ['fruits-vegetables', 'dairy-eggs', 'bakery', 'grains-staples', 'snacks', 'grocery-beverages', 'home-cleaning', 'personal-care']);
    }

    private function assignPlatform($outlet, array $slugs): void
    {
        if (! $outlet) {
            return;
        }

        $ids = Category::whereIn('slug', $slugs)->pluck('id');
        $outlet->categories()->sync($ids);
    }
}
