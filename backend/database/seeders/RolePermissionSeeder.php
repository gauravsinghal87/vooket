<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Super Admin', 'slug' => 'super_admin', 'is_system' => true],
            ['name' => 'Admin', 'slug' => 'admin', 'is_system' => true],
            ['name' => 'Operations Admin', 'slug' => 'operations_admin', 'is_system' => true],
            ['name' => 'Finance Admin', 'slug' => 'finance_admin', 'is_system' => true],
            ['name' => 'Support Admin', 'slug' => 'support_admin', 'is_system' => true],
            ['name' => 'Marketing Admin', 'slug' => 'marketing_admin', 'is_system' => true],
            ['name' => 'Vendor', 'slug' => 'vendor', 'is_system' => true],
            ['name' => 'Vendor Manager', 'slug' => 'vendor_manager', 'is_system' => true],
            ['name' => 'Delivery Partner', 'slug' => 'delivery_partner', 'is_system' => true],
            ['name' => 'Driver', 'slug' => 'driver', 'is_system' => true],
            ['name' => 'Customer', 'slug' => 'customer', 'is_system' => true],
            ['name' => 'Customer Support', 'slug' => 'customer_support', 'is_system' => true],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['slug' => $role['slug']], $role);
        }

        // Permissions
        $modules = ['dashboard', 'users', 'vendors', 'restaurants', 'stores', 'products', 'categories', 'vendor_categories', 'orders', 'rides', 'drivers', 'delivery_partners', 'wallet', 'transactions', 'commissions', 'settlements', 'payouts', 'coupons', 'promotions', 'campaigns', 'loyalty', 'referrals', 'reviews', 'support', 'notifications', 'cms', 'banners', 'settings', 'integrations', 'zones', 'vehicles', 'documents', 'kyc', 'reports', 'analytics', 'audit_logs', 'roles', 'permissions', 'feature_flags', 'incentives', 'pricing', 'surge_pricing', 'taxes', 'delivery_config', 'ride_config', 'payment_config', 'maps_config', 'languages', 'currencies', 'countries', 'cities'];

        $actions = ['view', 'create', 'update', 'delete', 'approve', 'cancel', 'refund', 'adjust', 'export'];

        $permissions = [];
        foreach ($modules as $module) {
            foreach ($actions as $action) {
                $permissions[] = [
                    'name' => ucfirst($module).' '.ucfirst($action),
                    'slug' => "{$module}.{$action}",
                    'module' => $module,
                ];
            }
        }

        $extraPermissions = [
            ['name' => 'Categories Restore', 'slug' => 'categories.restore', 'module' => 'categories'],
            ['name' => 'Categories Reorder', 'slug' => 'categories.reorder', 'module' => 'categories'],
            ['name' => 'Categories Feature', 'slug' => 'categories.feature', 'module' => 'categories'],
            ['name' => 'Vendor Categories Restore', 'slug' => 'vendor_categories.restore', 'module' => 'vendor_categories'],
            ['name' => 'Vendor Categories Reorder', 'slug' => 'vendor_categories.reorder', 'module' => 'vendor_categories'],
        ];

        $permissions = array_merge($permissions, $extraPermissions);

        foreach ($permissions as $perm) {
            Permission::updateOrCreate(['slug' => $perm['slug']], $perm);
        }

        $superAdmin = Role::where('slug', 'super_admin')->first();
        $superAdmin->permissions()->sync(Permission::all()->pluck('id'));

        $operationsAdmin = Role::where('slug', 'operations_admin')->first();
        $marketingAdmin = Role::where('slug', 'marketing_admin')->first();
        $adminRole = Role::where('slug', 'admin')->first();
        $vendorRole = Role::where('slug', 'vendor')->first();
        $vendorManagerRole = Role::where('slug', 'vendor_manager')->first();

        if ($operationsAdmin) {
            $slugPatterns = ['categories.view', 'categories.create', 'categories.update', 'categories.delete', 'categories.restore', 'categories.reorder', 'categories.feature', 'categories.export'];
            $operationsAdmin->permissions()->syncWithoutDetaching(
                Permission::whereIn('slug', $slugPatterns)->pluck('id')
            );
        }

        if ($adminRole) {
            $adminRole->permissions()->syncWithoutDetaching(
                Permission::where('module', 'categories')->pluck('id')
            );
        }

        if ($marketingAdmin) {
            $marketingAdmin->permissions()->syncWithoutDetaching(
                Permission::whereIn('slug', ['categories.view', 'categories.feature'])->pluck('id')
            );
        }

        $vendorCatSlugs = Permission::where('module', 'vendor_categories')->pluck('slug')->toArray();
        if ($vendorRole) {
            $vendorRole->permissions()->syncWithoutDetaching(
                Permission::whereIn('slug', array_merge(['categories.view', 'categories.update'], $vendorCatSlugs))->pluck('id')
            );
        }

        if ($vendorManagerRole) {
            $vendorManagerRole->permissions()->syncWithoutDetaching(
                Permission::where(function ($q) {
                    $q->where('module', 'vendor_categories')
                        ->orWhereIn('slug', ['categories.view', 'categories.update', 'categories.feature']);
                })->pluck('id')
            );
        }

        // Create super admin user
        $adminUser = User::updateOrCreate(
            ['email' => 'admin@superapp.com'],
            [
                'name' => 'Super Admin',
                'phone' => '9999999999',
                'email' => 'admin@superapp.com',
                'password' => Hash::make('password'),
                'user_type' => 'admin',
                'is_active' => true,
                'is_verified' => true,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
                'referral_code' => 'ADMIN01',
            ]
        );

        $adminUser->roles()->sync([$superAdmin->id]);
    }
}
