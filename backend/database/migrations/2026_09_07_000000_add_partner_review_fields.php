<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable()->after('verified_at');
            $table->timestamp('reviewed_at')->nullable()->after('rejection_reason');
        });

        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable()->after('is_busy');
            $table->timestamp('reviewed_at')->nullable()->after('rejection_reason');
        });
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn(['rejection_reason', 'reviewed_at']);
        });

        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->dropColumn(['rejection_reason', 'reviewed_at']);
        });
    }
};
