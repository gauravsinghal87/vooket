<?php

use App\Support\Money;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedBigInteger('amount_paise')->nullable()->after('amount');
            $table->string('provider_order_id')->nullable()->after('provider_reference');
            $table->string('provider_payment_id')->nullable()->after('provider_order_id');
            $table->string('provider_signature')->nullable()->after('provider_payment_id');
            $table->timestamp('verified_at')->nullable()->after('provider_signature');
        });

        $this->dedupe('payments', 'idempotency_key');
        $this->dedupe('wallet_transactions', 'idempotency_key');
        $this->dedupe('refunds', 'idempotency_key');
        $this->dedupe('refunds', 'provider_reference');
        $this->dedupe('payouts', 'idempotency_key');
        $this->dedupe('payouts', 'provider_reference');

        $this->backfillPaymentPaise();

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['idempotency_key']);
            $table->unique('idempotency_key');
            $table->unique('provider_order_id');
            $table->unique('provider_payment_id');
        });

        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropIndex(['idempotency_key']);
            $table->unique('idempotency_key');
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->unique('idempotency_key');
            $table->unique('provider_reference');
        });

        Schema::table('payouts', function (Blueprint $table) {
            $table->unique('idempotency_key');
            $table->unique('provider_reference');
        });

        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 30);
            $table->string('event_id');
            $table->string('event_type', 60)->nullable();
            $table->json('payload')->nullable();
            $table->string('status', 20)->default('received'); // received|processing|processed|ignored|failed
            $table->text('error')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'event_id']);
        });

        Schema::create('financial_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('wallet_id')->nullable()->constrained()->nullOnDelete();
            $table->string('wallet_type', 20)->nullable();
            $table->decimal('amount', 12, 2);
            $table->enum('direction', ['credit', 'debit']);
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->foreignId('adjusted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_adjustments');
        Schema::dropIfExists('payment_webhook_events');

        Schema::table('payouts', function (Blueprint $table) {
            $table->dropIndex('payouts_idempotency_key_unique');
            $table->dropIndex('payouts_provider_reference_unique');
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->dropIndex('refunds_idempotency_key_unique');
            $table->dropIndex('refunds_provider_reference_unique');
        });

        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropIndex('wallet_transactions_idempotency_key_unique');
            $table->index('idempotency_key');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_provider_order_id_unique');
            $table->dropIndex('payments_provider_payment_id_unique');
            $table->dropIndex('payments_idempotency_key_unique');
            $table->dropColumn([
                'verified_at',
                'provider_signature',
                'provider_payment_id',
                'provider_order_id',
                'amount_paise',
            ]);
            $table->index('idempotency_key');
        });
    }

    private function dedupe(string $table, string $column): void
    {
        $duplicateValues = DB::table($table)
            ->select($column)
            ->whereNotNull($column)
            ->groupBy($column)
            ->havingRaw('COUNT(*) > 1')
            ->pluck($column);

        foreach ($duplicateValues as $value) {
            $keep = DB::table($table)->where($column, $value)->orderBy('id')->value('id');
            DB::table($table)->where($column, $value)->where('id', '!=', $keep)->delete();
        }
    }

    private function backfillPaymentPaise(): void
    {
        DB::table('payments')
            ->select(['id', 'amount'])
            ->orderBy('id')
            ->chunkById(500, function ($payments) {
                foreach ($payments as $payment) {
                    if ($payment->amount === null) {
                        continue;
                    }
                    DB::table('payments')
                        ->where('id', $payment->id)
                        ->update(['amount_paise' => Money::fromMajor((string) $payment->amount)->paise()]);
                }
            });
    }
};
