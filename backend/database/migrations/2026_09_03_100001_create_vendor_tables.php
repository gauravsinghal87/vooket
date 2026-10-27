<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('business_name');
            $table->string('vendor_type', 20); // restaurant|grocery
            $table->string('owner_name');
            $table->string('email')->nullable();
            $table->string('phone', 20);
            $table->string('gst_number')->nullable();
            $table->string('pan_number')->nullable();
            $table->string('fssai_number')->nullable();
            $table->string('bank_account_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('bank_ifsc')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('logo')->nullable();
            $table->string('cover_image')->nullable();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected|suspended
            $table->string('rejection_reason')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->decimal('commission_rate', 5, 2)->default(15);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('address')->nullable();
            $table->json('documents')->nullable();
            $table->json('kyc_data')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['vendor_type', 'status']);
            $table->index(['latitude', 'longitude']);
        });

        Schema::create('vendor_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30); // gst|pan|fssai|bank_proof|license|other
            $table->string('file_path');
            $table->string('filename');
            $table->string('status', 20)->default('pending'); // pending|approved|rejected
            $table->text('rejection_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('restaurants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('cuisine_type')->nullable();
            $table->string('address')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('logo')->nullable();
            $table->string('cover_image')->nullable();
            $table->time('opens_at')->nullable();
            $table->time('closes_at')->nullable();
            $table->boolean('is_open')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->boolean('dine_in')->default(false);
            $table->boolean('is_veg')->default(false);
            $table->boolean('is_halal')->default(false);
            $table->decimal('avg_prep_time_min', 5, 1)->default(20);
            $table->decimal('avg_delivery_time_min', 5, 1)->default(30);
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->decimal('min_order_amount', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('free_delivery_above', 10, 2)->nullable();
            $table->json('opening_hours')->nullable();
            $table->json('holidays')->nullable();
            $table->enum('order_type', ['delivery', 'pickup', 'both'])->default('both');
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['latitude', 'longitude', 'is_open']);
            $table->index('is_featured');
            $table->index('cuisine_type');
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('store_type', 20)->default('supermarket'); // supermarket|local|convenience|specialty
            $table->text('description')->nullable();
            $table->string('address')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('logo')->nullable();
            $table->string('cover_image')->nullable();
            $table->time('opens_at')->nullable();
            $table->time('closes_at')->nullable();
            $table->boolean('is_open')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->decimal('min_order_amount', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->json('opening_hours')->nullable();
            $table->json('holidays')->nullable();
            $table->enum('order_type', ['delivery', 'pickup', 'both'])->default('both');
            $table->boolean('supports_instant_delivery')->default(true);
            $table->boolean('supports_scheduled_delivery')->default(true);
            $table->string('substitution_policy', 20)->default('contact'); // contact|auto|none
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['latitude', 'longitude', 'is_open']);
            $table->index('store_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stores');
        Schema::dropIfExists('restaurants');
        Schema::dropIfExists('vendor_documents');
        Schema::dropIfExists('vendors');
    }
};
