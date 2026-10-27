<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->decimal('trip_fare', 10, 2);
            $table->decimal('driver_percentage', 5, 2)->default(0);
            $table->decimal('commission_percentage', 5, 2)->default(0);
            $table->decimal('commission_amount', 10, 2)->default(0);
            $table->decimal('earning_amount', 10, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('status', 20)->default('pending'); // pending|paid
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->unique('ride_id');
            $table->index(['driver_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_earnings');
    }
};
