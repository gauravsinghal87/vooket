<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Backfill safe defaults for food restaurants created before preparation
 * time and operating hours were captured at registration.
 *
 * The `restaurants` table only ever holds food outlets (grocery vendors use
 * `stores`), so no grocery or ride data is touched, and non-NULL values are
 * never overwritten — only rows with no saved value receive the defaults
 * (20 minute preparation time, 09:00–22:00 operating window).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('restaurants')) {
            return;
        }

        if (Schema::hasColumn('restaurants', 'avg_prep_time_min')) {
            DB::table('restaurants')
                ->whereNull('avg_prep_time_min')
                ->update(['avg_prep_time_min' => 20]);
        }

        if (Schema::hasColumn('restaurants', 'opens_at')) {
            DB::table('restaurants')
                ->whereNull('opens_at')
                ->update(['opens_at' => '09:00:00']);
        }

        if (Schema::hasColumn('restaurants', 'closes_at')) {
            DB::table('restaurants')
                ->whereNull('closes_at')
                ->update(['closes_at' => '22:00:00']);
        }
    }

    public function down(): void
    {
        // Data backfill — intentionally irreversible: a defaulted value is
        // indistinguishable from one a vendor genuinely saved as the default.
    }
};
