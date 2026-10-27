<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rides', function (Blueprint $table) {
            $table->id();
            $table->string('ride_number')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_type_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 30)->default('REQUESTED'); // REQUESTED|SEARCHING_DRIVER|DRIVER_ASSIGNED|DRIVER_ARRIVING|DRIVER_ARRIVED|TRIP_STARTED|TRIP_IN_PROGRESS|TRIP_COMPLETED|CANCELLED|NO_DRIVER_FOUND
            $table->string('pickup_address')->nullable();
            $table->decimal('pickup_latitude', 10, 7);
            $table->decimal('pickup_longitude', 10, 7);
            $table->string('destination_address')->nullable();
            $table->decimal('destination_latitude', 10, 7);
            $table->decimal('destination_longitude', 10, 7);
            $table->decimal('pickup_latitude_actual', 10, 7)->nullable();
            $table->decimal('pickup_longitude_actual', 10, 7)->nullable();
            $table->decimal('destination_latitude_actual', 10, 7)->nullable();
            $table->decimal('destination_longitude_actual', 10, 7)->nullable();
            $table->decimal('distance_km', 8, 2)->nullable();
            $table->unsignedInteger('duration_min')->nullable();
            $table->decimal('base_fare', 10, 2)->default(0);
            $table->decimal('distance_charge', 10, 2)->default(0);
            $table->decimal('time_charge', 10, 2)->default(0);
            $table->decimal('booking_fee', 10, 2)->default(0);
            $table->decimal('platform_fee', 10, 2)->default(0);
            $table->decimal('surge_multiplier', 4, 2)->default(1.00);
            $table->decimal('surge_amount', 10, 2)->default(0);
            $table->decimal('waiting_charge', 10, 2)->default(0);
            $table->decimal('tip_amount', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('estimated_fare', 10, 2)->default(0);
            $table->decimal('final_fare', 10, 2)->nullable();
            $table->string('coupon_code')->nullable();
            $table->decimal('wallet_used', 10, 2)->default(0);
            $table->string('payment_method', 20)->nullable();
            $table->string('payment_status', 20)->default('PENDING');
            $table->string('otp', 6)->nullable();
            $table->boolean('otp_verified')->default(false);
            $table->timestamp('otp_verified_at')->nullable();
            $table->boolean('is_scheduled')->default(false);
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('driver_assigned_at')->nullable();
            $table->timestamp('driver_arriving_at')->nullable();
            $table->timestamp('driver_arrived_at')->nullable();
            $table->timestamp('trip_started_at')->nullable();
            $table->timestamp('trip_completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason')->nullable();
            $table->string('cancelled_by_type', 20)->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('route')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index(['driver_id', 'status']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('ride_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->string('status');
            $table->string('notes')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['ride_id', 'status']);
        });

        Schema::create('fare_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_type_id')->constrained()->cascadeOnDelete();
            $table->string('zone_id')->nullable();
            $table->string('city')->nullable();
            $table->decimal('base_fare', 10, 2);
            $table->decimal('per_km', 10, 2);
            $table->decimal('per_minute', 10, 2);
            $table->decimal('minimum_fare', 10, 2);
            $table->decimal('booking_fee', 10, 2)->default(0);
            $table->decimal('platform_fee', 10, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('surge_multiplier_max', 4, 2)->default(2.00);
            $table->decimal('waiting_charge_per_min', 10, 2)->default(1);
            $table->decimal('cancellation_fee', 10, 2)->default(0);
            $table->decimal('driver_earn_percentage', 5, 2)->default(80);
            $table->boolean('is_active')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('ride_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('pending'); // pending|accepted|rejected|expired|cancelled
            $table->decimal('distance_km', 8, 2)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->integer('attempt')->default(1);
            $table->timestamps();
            $table->index(['ride_id', 'status']);
        });

        Schema::create('ride_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('rating', 2, 1)->default(5);
            $table->text('comment')->nullable();
            $table->timestamps();
            $table->unique(['ride_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ride_ratings');
        Schema::dropIfExists('ride_requests');
        Schema::dropIfExists('fare_rules');
        Schema::dropIfExists('ride_status_histories');
        Schema::dropIfExists('rides');
    }
};
