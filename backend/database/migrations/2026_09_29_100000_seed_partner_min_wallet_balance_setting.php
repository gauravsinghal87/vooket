<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed the admin-controlled partner/rider wallet-balance floor.
     *
     * Deliberately separate from `vendor_min_wallet_balance`: that one governs
     * Food/Grocery vendor wallets at a different default, and the two settings
     * must stay independently tunable.
     *
     * `insertOrIgnore` is used on purpose: the row must appear on every existing
     * database, but a value an admin has already tuned must survive re-running
     * migrations. The equivalent `ConfigurationSeeder` entry uses
     * `firstOrCreate` for the same reason.
     *
     * No schema change: `app_settings.help_text` already exists from the earlier
     * vendor settings migration, which always runs first.
     */
    public function up(): void
    {
        $now = now();

        DB::table('app_settings')->insertOrIgnore([
            [
                'group' => 'partner_payout',
                'key' => 'partner_min_wallet_balance',
                'label' => 'Minimum Partner Wallet Balance',
                'help_text' => 'Minimum amount that must remain in a delivery partner or rider wallet after payout.',
                'value' => '200',
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
        DB::table('app_settings')->where('key', 'partner_min_wallet_balance')->delete();
    }
};
