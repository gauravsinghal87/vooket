<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rides', function (Blueprint $table) {
            $table->string('idempotency_key', 120)->nullable()->after('ride_number');
            $table->char('idempotency_fingerprint', 64)->nullable()->after('idempotency_key');
            $table->unique(['user_id', 'idempotency_key'], 'rides_user_id_idempotency_key_unique');
            $table->index('idempotency_fingerprint', 'rides_idempotency_fingerprint_index');
        });
    }

    public function down(): void
    {
        Schema::table('rides', function (Blueprint $table) {
            $table->dropUnique('rides_user_id_idempotency_key_unique');
            $table->dropIndex('rides_idempotency_fingerprint_index');
            $table->dropColumn(['idempotency_key', 'idempotency_fingerprint']);
        });
    }
};
