<?php

namespace Database\Seeders;

use App\Models\Category;
use Database\Seeders\Concerns\SeedsWithImages;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    use SeedsWithImages;

    public function run(): void
    {
        $food = $this->food();
        $grocery = $this->grocery();
        $rides = $this->rides();

        foreach ($food as $root) {
            $this->createTree($root, null, 'food');
        }
        foreach ($grocery as $root) {
            $this->createTree($root, null, 'grocery');
        }
        foreach ($rides as $root) {
            $this->createTree($root, null, 'rides');
        }

        $this->featured();
    }

    private function food(): array
    {
        return [
            [
                'name' => 'Starters', 'slug' => 'starters', 'sort_order' => 1,
                'children' => [
                    ['name' => 'Paneer Starters', 'slug' => 'food-paneer-starters', 'sort_order' => 1],
                    ['name' => 'Chicken Starters', 'slug' => 'food-chicken-starters', 'sort_order' => 2],
                    ['name' => 'Soups & Salads', 'slug' => 'food-soups-salads', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Main Course', 'slug' => 'main-course', 'sort_order' => 2,
                'children' => [
                    ['name' => 'Veg Curries', 'slug' => 'food-veg-curries', 'sort_order' => 1],
                    ['name' => 'Non-Veg Curries', 'slug' => 'food-non-veg-curries', 'sort_order' => 2],
                    ['name' => 'Rice & Dal', 'slug' => 'food-rice-dal', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Biryani', 'slug' => 'biryani', 'sort_order' => 3,
                'children' => [
                    ['name' => 'Veg Biryani', 'slug' => 'food-veg-biryani', 'sort_order' => 1],
                    ['name' => 'Chicken Biryani', 'slug' => 'food-chicken-biryani', 'sort_order' => 2],
                    ['name' => 'Mutton Biryani', 'slug' => 'food-mutton-biryani', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Breads', 'slug' => 'breads', 'sort_order' => 4,
                'children' => [
                    ['name' => 'Naan & Roti', 'slug' => 'food-naan-roti', 'sort_order' => 1],
                    ['name' => 'Paratha', 'slug' => 'food-paratha', 'sort_order' => 2],
                ],
            ],
            [
                'name' => 'Desserts', 'slug' => 'desserts', 'sort_order' => 5,
                'children' => [
                    ['name' => 'Ice Cream', 'slug' => 'food-ice-cream', 'sort_order' => 1],
                    ['name' => 'Cakes & Pastries', 'slug' => 'food-cakes-pastries', 'sort_order' => 2],
                    ['name' => 'Traditional Sweets', 'slug' => 'food-traditional-sweets', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Beverages', 'slug' => 'beverages', 'sort_order' => 6,
                'children' => [
                    ['name' => 'Hot Beverages', 'slug' => 'food-hot-beverages', 'sort_order' => 1],
                    ['name' => 'Cold Beverages', 'slug' => 'food-cold-beverages', 'sort_order' => 2],
                    ['name' => 'Shakes & Juices', 'slug' => 'food-shakes-juices', 'sort_order' => 3],
                ],
            ],
            ['name' => 'Pizza', 'slug' => 'food-pizza', 'sort_order' => 7],
            ['name' => 'Burgers & Sandwiches', 'slug' => 'food-burgers-sandwiches', 'sort_order' => 8],
            ['name' => 'South Indian', 'slug' => 'food-south-indian', 'sort_order' => 9],
            ['name' => 'Chinese', 'slug' => 'food-chinese', 'sort_order' => 10],
        ];
    }

    private function grocery(): array
    {
        return [
            [
                'name' => 'Fruits & Vegetables', 'slug' => 'fruits-vegetables', 'sort_order' => 1,
                'children' => [
                    ['name' => 'Fresh Fruits', 'slug' => 'grocery-fresh-fruits', 'sort_order' => 1],
                    ['name' => 'Vegetables', 'slug' => 'grocery-vegetables', 'sort_order' => 2],
                    ['name' => 'Herbs & Greens', 'slug' => 'grocery-herbs-greens', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Dairy & Eggs', 'slug' => 'dairy-eggs', 'sort_order' => 2,
                'children' => [
                    ['name' => 'Milk', 'slug' => 'grocery-milk', 'sort_order' => 1],
                    ['name' => 'Cheese & Butter', 'slug' => 'grocery-cheese-butter', 'sort_order' => 2],
                    ['name' => 'Yogurt & Curd', 'slug' => 'grocery-yogurt-curd', 'sort_order' => 3],
                    ['name' => 'Eggs', 'slug' => 'grocery-eggs', 'sort_order' => 4],
                ],
            ],
            [
                'name' => 'Bakery', 'slug' => 'bakery', 'sort_order' => 3,
                'children' => [
                    ['name' => 'Breads', 'slug' => 'grocery-breads', 'sort_order' => 1],
                    ['name' => 'Buns & Rolls', 'slug' => 'grocery-buns-rolls', 'sort_order' => 2],
                    ['name' => 'Cakes', 'slug' => 'grocery-cakes', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Grains & Staples', 'slug' => 'grains-staples', 'sort_order' => 4,
                'children' => [
                    ['name' => 'Rice', 'slug' => 'grocery-rice', 'sort_order' => 1],
                    ['name' => 'Atta & Flours', 'slug' => 'grocery-atta-flours', 'sort_order' => 2],
                    ['name' => 'Pulses & Dal', 'slug' => 'grocery-pulses-dal', 'sort_order' => 3],
                    ['name' => 'Spices', 'slug' => 'grocery-spices', 'sort_order' => 4],
                    ['name' => 'Oils & Ghee', 'slug' => 'grocery-oils-ghee', 'sort_order' => 5],
                ],
            ],
            [
                'name' => 'Snacks', 'slug' => 'snacks', 'sort_order' => 5,
                'children' => [
                    ['name' => 'Chips & Namkeen', 'slug' => 'grocery-chips-namkeen', 'sort_order' => 1],
                    ['name' => 'Biscuits & Cookies', 'slug' => 'grocery-biscuits-cookies', 'sort_order' => 2],
                    ['name' => 'Chocolates', 'slug' => 'grocery-chocolates', 'sort_order' => 3],
                    ['name' => 'Nuts & Dry Fruits', 'slug' => 'grocery-nuts-dry-fruits', 'sort_order' => 4],
                ],
            ],
            [
                'name' => 'Beverages', 'slug' => 'grocery-beverages', 'sort_order' => 6,
                'children' => [
                    ['name' => 'Tea & Coffee', 'slug' => 'grocery-tea-coffee', 'sort_order' => 1],
                    ['name' => 'Soft Drinks', 'slug' => 'grocery-soft-drinks', 'sort_order' => 2],
                    ['name' => 'Packaged Water', 'slug' => 'grocery-packaged-water', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Home & Cleaning', 'slug' => 'home-cleaning', 'sort_order' => 7,
                'children' => [
                    ['name' => 'Detergents', 'slug' => 'grocery-detergents', 'sort_order' => 1],
                    ['name' => 'Cleaning Supplies', 'slug' => 'grocery-cleaning-supplies', 'sort_order' => 2],
                    ['name' => 'Disposables', 'slug' => 'grocery-disposables', 'sort_order' => 3],
                ],
            ],
            [
                'name' => 'Personal Care', 'slug' => 'personal-care', 'sort_order' => 8,
                'children' => [
                    ['name' => 'Bath & Body', 'slug' => 'grocery-bath-body', 'sort_order' => 1],
                    ['name' => 'Hair Care', 'slug' => 'grocery-hair-care', 'sort_order' => 2],
                    ['name' => 'Oral Care', 'slug' => 'grocery-oral-care', 'sort_order' => 3],
                    ['name' => 'Skincare', 'slug' => 'grocery-skincare', 'sort_order' => 4],
                ],
            ],
            ['name' => 'Frozen Food', 'slug' => 'grocery-frozen-food', 'sort_order' => 9],
            ['name' => 'Ready to Eat', 'slug' => 'grocery-ready-to-eat', 'sort_order' => 10],
            ['name' => 'Baby Care', 'slug' => 'grocery-baby-care', 'sort_order' => 11],
        ];
    }

    private function rides(): array
    {
        return [
            ['name' => 'Car', 'slug' => 'rides-car', 'sort_order' => 1],
            ['name' => 'Bike', 'slug' => 'rides-bike', 'sort_order' => 2],
            ['name' => 'Auto', 'slug' => 'rides-auto', 'sort_order' => 3],
        ];
    }

    private function createTree(array $node, ?int $parentId, string $type): void
    {
        $category = Category::updateOrCreate(
            ['slug' => $node['slug']],
            [
                'name' => $node['name'],
                'parent_id' => $parentId,
                'type' => $type,
                'description' => $node['description'] ?? null,
                'icon' => $node['icon'] ?? null,
                'image' => $node['image'] ?? $this->placeholderImage('cat-'.$node['slug'], 400, 300),
                'sort_order' => $node['sort_order'] ?? 0,
                'is_active' => true,
                'meta_title' => $node['meta_title'] ?? ucwords($node['name']).' - Order Online',
                'meta_description' => $node['meta_description'] ?? 'Browse and order from '.$node['name'].' near you.',
            ]
        );

        foreach ($node['children'] ?? [] as $child) {
            $this->createTree($child, $category->id, $type);
        }
    }

    private function featured(): void
    {
        $featured = ['biryani', 'beverages', 'fruits-vegetables', 'dairy-eggs'];
        Category::whereIn('slug', $featured)->update(['is_featured' => true]);
    }
}
