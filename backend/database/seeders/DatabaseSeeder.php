<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            ConfigurationSeeder::class,
            ZoneSeeder::class,
            CategorySeeder::class,
            DemoDataSeeder::class,
            JaipurFlowSeeder::class,
            JaipurVendorSeeder::class,
            JaipurFleetSeeder::class,
            VendorCategorySeeder::class,
        ]);
    }
}
