<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_partners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected|suspended|offline|online
            $table->string('vehicle_type', 30)->default('bike');
            $table->string('vehicle_number')->nullable();
            $table->string('vehicle_model')->nullable();
            $table->string('vehicle_color')->nullable();
            $table->string('license_number')->nullable();
            $table->date('license_expiry')->nullable();
            $table->string('aadhar_number')->nullable();
            $table->string('bank_account_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('bank_ifsc')->nullable();
            $table->string('bank_name')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamp('last_location_at')->nullable();
            $table->boolean('is_online')->default(false);
            $table->boolean('is_busy')->default(false);
            $table->json('documents')->nullable();
            $table->json('kyc_data')->nullable();
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('total_deliveries')->default(0);
            $table->decimal('total_earnings', 10, 2)->default(0);
            $table->unsignedInteger('accepted_orders')->default(0);
            $table->unsignedInteger('rejected_orders')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'is_online']);
            $table->index(['latitude', 'longitude']);
        });

        Schema::create('drivers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_type_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected|suspended|offline|online
            $table->string('vehicle_number')->nullable();
            $table->string('vehicle_model')->nullable();
            $table->string('vehicle_color')->nullable();
            $table->string('license_number')->nullable();
            $table->date('license_expiry')->nullable();
            $table->string('aadhar_number')->nullable();
            $table->string('pan_number')->nullable();
            $table->string('bank_account_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('bank_ifsc')->nullable();
            $table->string('bank_name')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamp('last_location_at')->nullable();
            $table->boolean('is_online')->default(false);
            $table->boolean('is_busy')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->json('documents')->nullable();
            $table->json('kyc_data')->nullable();
            $table->json('biometric_data')->nullable();
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('total_trips')->default(0);
            $table->unsignedInteger('accepted_rides')->default(0);
            $table->unsignedInteger('rejected_rides')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'is_online']);
            $table->index(['latitude', 'longitude']);
        });

        Schema::create('carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('session_id')->nullable();
            $table->string('cart_type', 20)->default('food'); // food|grocery
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('tax', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->string('coupon_code')->nullable();
            $table->tinyInteger('items_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'cart_type']);
        });

        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('unit_price', 10, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('line_total', 10, 2);
            $table->json('selected_options')->nullable();
            $table->json('selected_addons')->nullable();
            $table->text('special_instructions')->nullable();
            $table->timestamps();
            $table->index(['cart_id', 'product_id']);
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->string('idempotency_key')->nullable()->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('restaurant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $table->string('order_type', 20)->default('food'); // food|grocery
            $table->string('status', 30)->default('PLACED');
            $table->string('payment_status', 20)->default('PENDING'); // PENDING|PAID|FAILED|REFUNDED|PARTIALLY_REFUNDED
            $table->string('payment_method', 20)->nullable(); // wallet|online|cash_on_delivery|upi|card
            $table->foreignId('address_id')->nullable()->constrained()->nullOnDelete();
            $table->json('delivery_address_snapshot')->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('packaging_fee', 10, 2)->default(0);
            $table->decimal('platform_fee', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->decimal('wallet_used', 10, 2)->default(0);
            $table->decimal('coupon_discount', 10, 2)->default(0);
            $table->string('coupon_code')->nullable();
            $table->decimal('tip_amount', 10, 2)->default(0);
            $table->decimal('round_off', 10, 2)->default(0);
            $table->foreignId('delivery_partner_id')->nullable()->constrained('delivery_partners')->nullOnDelete();
            $table->string('preparation_time_min')->nullable();
            $table->enum('timing_type', ['instant', 'scheduled'])->default('instant');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('preparing_at')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('partner_assigned_at')->nullable();
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamp('out_for_delivery_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason')->nullable();
            $table->string('cancelled_by_type', 20)->nullable(); // customer|vendor|admin|system
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('customer_note')->nullable();
            $table->string('substitution_preference', 20)->default('contact'); // contact|auto|none
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'status']);
            $table->index(['vendor_id', 'status']);
            $table->index(['order_type', 'status', 'created_at']);
            $table->index('order_number');
            $table->index('delivery_partner_id');
            $table->index('scheduled_at');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('product_image')->nullable();
            $table->string('sku')->nullable();
            $table->decimal('unit_price', 10, 2);
            $table->decimal('price_snapshot', 10, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('line_total', 10, 2);
            $table->json('selected_options')->nullable();
            $table->json('selected_addons')->nullable();
            $table->text('special_instructions')->nullable();
            $table->string('status', 20)->default('active'); // active|refunded|returned
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('status');
            $table->string('notes')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('changed_by_type', 20)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['order_id', 'status']);
        });

        Schema::create('order_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('rating', 2, 1)->default(5);
            $table->text('comment')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'user_id']);
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_type_id')->constrained();
            $table->string('make');
            $table->string('model');
            $table->string('color');
            $table->string('year', 4)->nullable();
            $table->string('registration_number')->unique();
            $table->string('image')->nullable();
            $table->json('documents')->nullable();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('vehicle_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30); // registration|insurance|permit|fitness|pollution
            $table->string('file_path');
            $table->string('filename');
            $table->date('expiry_date')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_documents');
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('order_ratings');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('carts');
        Schema::dropIfExists('drivers');
        Schema::dropIfExists('delivery_partners');
    }
};
