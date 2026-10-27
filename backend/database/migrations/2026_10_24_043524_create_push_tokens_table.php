<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token', 512)->unique();
            $table->string('platform', 30); // android|ios|web
            $table->string('app_id', 50); // customer_web|customer_app|vendor_web|partner_web|admin_web
            $table->string('device_id', 191)->nullable();
            $table->string('device_type', 50)->nullable();
            $table->string('language', 10)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('disabled_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'app_id']);
            $table->index(['platform', 'app_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_tokens');
    }
};
