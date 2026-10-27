<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Identity hardening constraints:
     * - otp_codes.otp stores bcrypt hashes (60 chars), not the plaintext
     *   OTP. The old varchar(10) column silently broke/truncated inserts
     *   under strict SQL modes and made the index useless.
     * - A user must never own more than one driver / delivery partner /
     *   vendor profile. These unique indexes are the database backstop for
     *   the registration takeover fixes (the application now refuses to
     *   reuse existing accounts entirely).
     */
    public function up(): void
    {
        Schema::table('otp_codes', function (Blueprint $table) {
            $table->dropIndex(['otp']);
            $table->string('otp', 255)->change();
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->unique('user_id');
        });

        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->unique('user_id');
        });

        Schema::table('vendors', function (Blueprint $table) {
            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });

        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });

        Schema::table('otp_codes', function (Blueprint $table) {
            $table->string('otp', 10)->change();
            $table->index('otp');
        });
    }
};
