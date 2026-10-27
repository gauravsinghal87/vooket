<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_fee_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('service', 20)->default('food'); // food|grocery
            $table->decimal('base_fee', 10, 2)->default(0);
            $table->decimal('per_km', 10, 2)->default(0);
            $table->decimal('peak_fee', 10, 2)->default(0);
            $table->decimal('surge_multiplier', 4, 2)->default(1.00);
            $table->decimal('weather_surcharge', 10, 2)->default(0);
            $table->decimal('small_order_fee', 10, 2)->default(0);
            $table->decimal('min_order_for_free_delivery', 10, 2)->nullable();
            $table->decimal('platform_fee', 10, 2)->default(0);
            $table->string('zone_id')->nullable();
            $table->string('city')->nullable();
            $table->enum('peak_hour_start', ['none', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'])->default('none');
            $table->enum('peak_hour_end', ['none', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'])->default('none');
            $table->enum('peak_days', ['all', 'weekdays', 'weekends'])->default('all');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('delivery_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->string('day_of_week', 10)->default('all'); // all|0-6
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedInteger('max_orders')->default(10);
            $table->unsignedInteger('booked_orders')->default(0);
            $table->integer('lead_time_min')->default(60);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('peak_periods', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('zone_id')->nullable();
            $table->enum('day_of_week', ['all', '0', '1', '2', '3', '4', '5', '6'])->default('all');
            $table->time('start_time');
            $table->time('end_time');
            $table->decimal('surge_multiplier', 4, 2)->default(1.50);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('incentives', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('apply_to', 20); // driver|delivery_partner
            $table->string('type', 20); // per_trip|per_day|per_week|target|streak|bonus
            $table->decimal('amount', 10, 2);
            $table->string('amount_type', 20)->default('fixed'); // fixed|per_trip|percentage
            $table->unsignedInteger('min_trips')->nullable();
            $table->decimal('min_amount', 10, 2)->nullable();
            $table->string('city_id')->nullable();
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->string('time_start', 8)->nullable();
            $table->string('time_end', 8)->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type', 30); // push|email|sms|in_app|coupon|referral|banner
            $table->json('target_audience')->nullable();
            $table->json('content')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->string('status', 20)->default('draft'); // draft|scheduled|sending|sent|completed|cancelled
            $table->json('stats')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('saved_places', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('address');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('icon')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'label']);
        });

        Schema::create('user_search_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('query');
            $table->string('type', 20)->default('all'); // food|grocery|rides|all
            $table->json('results')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('feature_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('feature');
            $table->string('action');
            $table->json('data')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
            $table->index(['user_id', 'feature', 'created_at']);
            $table->index(['feature', 'created_at']);
        });

        Schema::create('risk_score_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->integer('risk_score')->default(0);
            $table->string('level', 20)->default('low'); // low|medium|high|critical
            $table->json('factors')->nullable();
            $table->string('action', 30)->nullable(); // watch|throttle|block|review
            $table->boolean('review_pending')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
            $table->index('risk_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_score_logs');
        Schema::dropIfExists('feature_usage_logs');
        Schema::dropIfExists('user_search_history');
        Schema::dropIfExists('saved_places');
        Schema::dropIfExists('campaigns');
        Schema::dropIfExists('incentives');
        Schema::dropIfExists('peak_periods');
        Schema::dropIfExists('delivery_slots');
        Schema::dropIfExists('delivery_fee_rules');
    }
};
