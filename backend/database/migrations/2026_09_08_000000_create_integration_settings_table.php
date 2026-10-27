<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_settings', function (Blueprint $table) {
            $table->id();
            $table->string('service', 50)->unique();          // maps|payments|settlements|otp|push|email|ai|media|captcha|analytics|identity|face|realtime
            $table->string('provider', 50)->default('mock');   // effective provider name
            $table->string('environment', 20)->default('test'); // mock|test|live
            $table->boolean('is_enabled')->default(true);
            $table->text('credentials')->nullable();           // ENCRYPTED JSON (Laravel encrypted:array cast)
            $table->json('settings')->nullable();              // non-secret runtime options
            $table->timestamp('last_tested_at')->nullable();
            $table->string('last_test_status', 20)->nullable(); // success|failed|pending
            $table->text('last_test_message')->nullable();
            $table->timestamps();
            $table->index('is_enabled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integration_settings');
    }
};
