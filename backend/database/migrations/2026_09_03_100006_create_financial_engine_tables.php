<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('service', 20); // food|grocery|ride
            $table->string('applicable_to', 20); // vendor|driver|delivery_partner|platform
            $table->enum('type', ['percentage', 'fixed', 'hybrid']);
            $table->decimal('percentage_rate', 5, 2)->nullable();
            $table->decimal('fixed_amount', 10, 2)->nullable();
            $table->decimal('min_amount', 10, 2)->nullable();
            $table->decimal('max_amount', 10, 2)->nullable();
            $table->unsignedBigInteger('vendor_id')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('city_id')->nullable();
            $table->unsignedBigInteger('zone_id')->nullable();
            $table->unsignedBigInteger('vehicle_type_id')->nullable();
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['service', 'applicable_to', 'is_active']);
        });

        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->string('commission_number')->unique();
            $table->string('service', 20); // food|grocery|ride
            $table->string('party_type', 20); // vendor|driver|delivery_partner
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('delivery_partner_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source_type');
            $table->unsignedBigInteger('source_id'); // order_id / ride_id
            $table->decimal('gross_amount', 12, 2);
            $table->decimal('commission_amount', 12, 2);
            $table->decimal('commission_rate', 5, 2);
            $table->string('commission_type', 20);
            $table->decimal('net_amount', 12, 2);
            $table->string('status', 20)->default('calculated'); // calculated|approved|settled
            $table->json('breakdown')->nullable();
            $table->timestamps();
            $table->index(['party_type', 'source_type', 'source_id']);
        });

        Schema::create('settlements', function (Blueprint $table) {
            $table->id();
            $table->string('settlement_number')->unique();
            $table->string('party_type', 20); // vendor|driver|delivery_partner
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('delivery_partner_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('gross_earnings', 12, 2);
            $table->decimal('total_commission', 12, 2);
            $table->decimal('total_incentives', 12, 2)->default(0);
            $table->decimal('total_bonuses', 12, 2)->default(0);
            $table->decimal('total_adjustments', 12, 2)->default(0);
            $table->decimal('total_refunds', 12, 2)->default(0);
            $table->decimal('net_payable', 12, 2);
            $table->string('status', 20)->default('PENDING'); // PENDING|APPROVED|PROCESSING|PAID|FAILED|REVERSED
            $table->date('period_start');
            $table->date('period_end');
            $table->string('period_type', 20)->default('weekly'); // daily|weekly|custom
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('payout_id')->nullable();
            $table->json('breakdown')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['party_type', 'status']);
            $table->index(['vendor_id', 'period_start', 'period_end']);
            $table->index(['driver_id', 'period_start', 'period_end']);
            $table->index(['delivery_partner_id', 'period_start', 'period_end']);
        });

        Schema::create('settlement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('settlement_id')->constrained()->cascadeOnDelete();
            $table->string('source_type'); // order|ride|commission|incentive|bonus|adjustment|refund
            $table->unsignedBigInteger('source_id');
            $table->decimal('amount', 12, 2);
            $table->string('direction', 10); // credit|debit
            $table->text('description')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->string('payout_number')->unique();
            $table->string('party_type', 20); // vendor|driver|delivery_partner
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('delivery_partner_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('bank_account_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('bank_ifsc')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('gateway', 30)->nullable();
            $table->string('provider_reference')->nullable();
            $table->string('status', 20)->default('PENDING'); // PENDING|PROCESSING|SUCCESS|FAILED|REVERSED
            $table->string('mode', 30)->default('bank_transfer');
            $table->json('gateway_response')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->text('failure_reason')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['party_type', 'status']);
            $table->index('provider_reference');
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('type', ['percentage', 'fixed', 'shipping']);
            $table->decimal('value', 10, 2);
            $table->decimal('max_discount', 10, 2)->nullable();
            $table->decimal('min_order_amount', 10, 2)->default(0);
            $table->string('service', 20)->nullable(); // food|grocery|ride|all
            $table->unsignedBigInteger('vendor_id')->nullable();
            $table->string('category_ids', 255)->nullable();
            $table->string('product_ids', 255)->nullable();
            $table->string('city_ids', 255)->nullable();
            $table->string('zone_ids', 255)->nullable();
            $table->enum('user_eligibility', ['all', 'new', 'existing'])->default('all');
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('per_user_limit')->default(1);
            $table->enum('payment_methods', ['all', 'wallet', 'online', 'cod'])->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('time_start', 8)->nullable();
            $table->string('time_end', 8)->nullable();
            $table->enum('day_of_week', ['all', '0', '1', '2', '3', '4', '5', '6'])->default('all');
            $table->boolean('first_order_only')->default(false);
            $table->boolean('is_active')->default(true);
            $table->string('status', 20)->default('active'); // active|paused|expired|deleted
            $table->integer('total_uses')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['service', 'status', 'expires_at']);
            $table->index('code');
        });

        Schema::create('coupon_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('ride_id')->nullable();
            $table->decimal('discount_amount', 10, 2);
            $table->string('status', 20)->default('used'); // used|reversed
            $table->timestamps();
            $table->unique(['coupon_id', 'order_id', 'ride_id']);
        });

        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('referee_id')->constrained('users')->cascadeOnDelete();
            $table->string('referral_code');
            $table->string('status', 20)->default('pending'); // pending|rewarded|expired
            $table->decimal('award_amount', 10, 2)->nullable();
            $table->string('award_type', 20)->default('wallet'); // wallet|points|coupon
            $table->timestamp('rewarded_at')->nullable();
            $table->timestamps();
            $table->unique(['referrer_id', 'referee_id']);
            $table->index('referral_code');
        });

        Schema::create('referral_rules', function (Blueprint $table) {
            $table->id();
            $table->string('user_type', 20)->default('customer'); // customer|driver|delivery_partner|vendor
            $table->decimal('referrer_reward', 10, 2);
            $table->decimal('referee_reward', 10, 2);
            $table->enum('reward_type', ['wallet', 'points', 'coupon'])->default('wallet');
            $table->unsignedInteger('min_orders_for_reward')->default(1);
            $table->decimal('min_order_amount_threshold', 10, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('loyalty_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->integer('points_balance')->default(0);
            $table->integer('lifetime_points')->default(0);
            $table->string('tier', 20)->default('bronze'); // bronze|silver|gold|platinum
            $table->decimal('tier_multiplier', 4, 2)->default(1.00);
            $table->timestamps();
        });

        Schema::create('loyalty_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loyalty_account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['EARN', 'REDEEM', 'EXPIRE', 'REVERSE']);
            $table->integer('points');
            $table->integer('balance_before');
            $table->integer('balance_after');
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'type']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('loyalty_rules', function (Blueprint $table) {
            $table->id();
            $table->string('service', 20); // food|grocery|ride
            $table->string('rule_type', 20); // points_per_amount|points_per_order|tier_upgrade
            $table->decimal('points_per_currency', 8, 2)->default(0);
            $table->unsignedInteger('points_per_order')->default(0);
            $table->unsignedInteger('tier_upgrade_threshold')->nullable();
            $table->string('tier')->nullable();
            $table->decimal('tier_multiplier', 4, 2)->default(1.00);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_rules');
        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('loyalty_accounts');
        Schema::dropIfExists('referral_rules');
        Schema::dropIfExists('referrals');
        Schema::dropIfExists('coupon_usages');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('payouts');
        Schema::dropIfExists('settlement_items');
        Schema::dropIfExists('settlements');
        Schema::dropIfExists('commissions');
        Schema::dropIfExists('commission_rules');
    }
};
