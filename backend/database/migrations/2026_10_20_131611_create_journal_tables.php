<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->string('entry_number')->unique();
            $table->string('source_type'); // Payment|Refund|Order|Ride|Settlement|Payout|WalletTransaction|Commission
            $table->unsignedBigInteger('source_id');
            $table->string('entry_type', 60); // payment_captured|wallet_credit|wallet_debit|commission_accrued|refund_issued|payout_paid|cash_collected|...
            $table->string('transaction_id')->nullable(); // wallet transaction id, when the entry mirrors one
            $table->string('description')->nullable();
            $table->string('currency', 10)->default('INR');
            $table->decimal('total_debit', 14, 2);
            $table->decimal('total_credit', 14, 2);
            $table->string('idempotency_key')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('posted_at')->useCurrent();
            $table->timestamps();

            $table->index(['source_type', 'source_id']);
            $table->index('entry_type');
            $table->index('transaction_id');
        });

        Schema::create('journal_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained('journal_entries')->cascadeOnDelete();
            $table->string('account', 60); // chart-of-accounts code
            $table->string('party_type', 30)->nullable(); // customer|vendor|driver|delivery_partner|platform
            $table->unsignedBigInteger('party_id')->nullable();
            $table->string('direction', 10); // debit|credit
            $table->decimal('amount', 14, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('memo')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index('account');
            $table->index('journal_entry_id');
            $table->index(['direction', 'account']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
    }
};
