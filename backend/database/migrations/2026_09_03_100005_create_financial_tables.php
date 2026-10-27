<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('wallet_type', 20); // customer|driver|delivery_partner|vendor|platform
            $table->decimal('balance', 12, 2)->default(0);
            $table->decimal('pending_balance', 12, 2)->default(0);
            $table->decimal('total_credited', 15, 2)->default(0);
            $table->decimal('total_debited', 15, 2)->default(0);
            $table->string('currency', 10)->default('INR');
            $table->string('status', 20)->default('active'); // active|frozen|closed
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'wallet_type']);
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_id')->unique();
            $table->foreignId('wallet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['CREDIT', 'DEBIT', 'REFUND', 'COMMISSION', 'PAYOUT', 'SETTLEMENT', 'BONUS', 'INCENTIVE', 'CASH_COLLECTION', 'ADJUSTMENT', 'REVERSAL', 'TOP_UP', 'PURCHASE', 'WITHDRAWAL']);
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_before', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('direction', 10); // credit|debit
            $table->string('status', 20)->default('completed'); // pending|completed|failed|reversed
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('description')->nullable();
            $table->json('meta')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->timestamp('reversed_at')->nullable();
            $table->timestamps();
            $table->index(['wallet_id', 'created_at']);
            $table->index(['user_id', 'type']);
            $table->index('reference_type');
            $table->index('reference_id');
            $table->index('idempotency_key');
        });

        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->string('entry_id')->unique();
            $table->string('transaction_id');
            $table->string('account_type'); // debit|credit (account side)
            $table->string('account_name'); // e.g. customer_wallet, platform_revenue, vendor_payable
            $table->foreignId('wallet_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reference_type');
            $table->unsignedBigInteger('reference_id');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->default('INR');
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['account_name', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
            $table->index('transaction_id');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('payment_number')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('payable_type')->nullable();
            $table->unsignedBigInteger('payable_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('method', 30)->nullable(); // card|upi|netbanking|wallet|cash|saved_card
            $table->string('gateway', 30)->nullable(); // razorpay|cashfree|phonepe|wallet|cash
            $table->string('provider_reference')->nullable();
            $table->string('status', 20)->default('INITIATED'); // INITIATED|PENDING|SUCCESS|FAILED|CANCELLED|REFUNDED|PARTIALLY_REFUNDED
            $table->json('gateway_response')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('failure_reason')->nullable();
            $table->timestamps();
            $table->index(['payable_type', 'payable_id']);
            $table->index(['user_id', 'status']);
            $table->index('provider_reference');
            $table->index('idempotency_key');
        });

        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->string('status'); // INITIATED|PENDING|SUCCESS|FAILED|CANCELLED
            $table->string('event_name')->nullable();
            $table->json('payload')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
            $table->index(['payment_id', 'status']);
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->string('refund_number')->unique();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('refundable_type')->nullable();
            $table->unsignedBigInteger('refundable_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('reason', 30)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('REQUESTED'); // REQUESTED|APPROVED|PROCESSING|COMPLETED|FAILED|REJECTED
            $table->string('provider_reference')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['refundable_type', 'refundable_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payment_transactions');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
    }
};
