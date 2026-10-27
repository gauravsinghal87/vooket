<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FinanceResetCommand extends Command
{
    protected $signature = 'finance:reset
        {--force : Skip the confirmation prompt}';

    protected $description = 'Delete all order/ride/finance data and zero all wallet balances so the system can be tested from a clean slate';

    /**
     * Tables to truncate, ordered child-first to satisfy foreign keys.
     *
     * @var list<string>
     */
    private array $tables = [
        // Finance
        'journal_lines',
        'journal_entries',
        'ledger_entries',
        'wallet_transactions',
        'settlement_items',
        'settlements',
        'commissions',
        'payouts',
        'driver_earnings',
        'delivery_partner_earnings',
        'incentives',
        'financial_adjustments',
        'payment_transactions',
        'payment_webhook_events',
        'refunds',
        'payments',
        'wallets',

        // Orders
        'order_ratings',
        'order_status_histories',
        'order_items',
        'orders',
        'cart_items',
        'carts',
        'coupon_usages',

        // Rides
        'ride_ratings',
        'ride_requests',
        'ride_status_histories',
        'rides',

        // Delivery operations
        'delivery_batch_orders',
        'delivery_batches',
        'dispatch_logs',
        'inventory_reservations',
        'inventory_transactions',

        // Loyalty points accrued from spending
        'loyalty_transactions',
        'loyalty_accounts',

        // Support
        'support_messages',
        'support_tickets',
    ];

    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm('This permanently deletes all order/ride/finance data and zeroes every wallet. Continue?', false)) {
            $this->warn('Aborted.');

            return self::FAILURE;
        }

        $driver = DB::connection()->getDriverName();
        $this->info("Resetting finance data on connection [{$driver}] database [".DB::connection()->getDatabaseName().']');

        Schema::disableForeignKeyConstraints();

        foreach ($this->tables as $table) {
            if (! Schema::hasTable($table)) {
                $this->line("  - skip {$table} (missing)");

                continue;
            }

            DB::table($table)->truncate();
            $this->line("  - truncated {$table}");
        }

        Schema::enableForeignKeyConstraints();

        $this->resetCounters();

        $this->info('Finance reset complete. All wallets are 0 and order/ride/finance tables are empty.');

        return self::SUCCESS;
    }

    private function resetCounters(): void
    {
        if (Schema::hasTable('delivery_partners')) {
            DB::table('delivery_partners')->update([
                'total_earnings' => 0,
                'total_deliveries' => 0,
                'accepted_orders' => 0,
                'rejected_orders' => 0,
            ]);
            $this->line('  - reset delivery_partners counters');
        }

        if (Schema::hasTable('drivers')) {
            DB::table('drivers')->update([
                'total_trips' => 0,
                'accepted_rides' => 0,
                'rejected_rides' => 0,
            ]);
            $this->line('  - reset drivers counters');
        }

        if (Schema::hasTable('coupons')) {
            DB::table('coupons')->update(['total_uses' => 0]);
            $this->line('  - reset coupons total_uses');
        }
    }
}
