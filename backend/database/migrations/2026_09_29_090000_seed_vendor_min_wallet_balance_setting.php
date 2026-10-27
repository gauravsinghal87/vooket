<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Seed the admin-controlled vendor wallet-balance floor.
     *
     * `insertOrIgnore` is used on purpose: the row must appear on every existing
     * database, but a value an admin has already tuned must survive re-running
     * migrations. The equivalent `ConfigurationSeeder` entry uses
     * `firstOrCreate` for the same reason.
     */
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->text('help_text')->nullable()->after('label');
        });

        $now = now();

        DB::table('app_settings')->insertOrIgnore([
            [
                'group' => 'vendor_payout',
                'key' => 'vendor_min_wallet_balance',
                'label' => 'Minimum Vendor Wallet Balance',
                'help_text' => 'Minimum amount that must remain in a Food/Grocery vendor wallet after payout.',
                'value' => '500',
                'type' => 'number',
                'is_public' => false,
                'sort_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('app_settings')->where('key', 'vendor_min_wallet_balance')->delete();

        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropColumn('help_text');
        });
    }
};
