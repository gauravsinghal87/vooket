<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->string('service', 30)->nullable()->after('type')->index('wallet_transactions_service_index');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE wallet_transactions MODIFY type ENUM('EARNING','CREDIT','DEBIT','REFUND','COMMISSION','PAYOUT','SETTLEMENT','BONUS','INCENTIVE','CASH_COLLECTION','ADJUSTMENT','REVERSAL','TOP_UP','PURCHASE','WITHDRAWAL') NOT NULL");
        } else {
            Schema::table('wallet_transactions', function (Blueprint $table) {
                $table->string('type', 30)->default('CREDIT')->change();
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE wallet_transactions MODIFY type ENUM('CREDIT','DEBIT','REFUND','COMMISSION','PAYOUT','SETTLEMENT','BONUS','INCENTIVE','CASH_COLLECTION','ADJUSTMENT','REVERSAL','TOP_UP','PURCHASE','WITHDRAWAL') NOT NULL");
        }

        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropIndex('wallet_transactions_service_index');
            $table->dropColumn('service');
        });
    }
};
