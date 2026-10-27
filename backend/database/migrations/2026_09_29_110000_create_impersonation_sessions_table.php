<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Backend-controlled admin -> vendor impersonation sessions.
 *
 * The admin never receives a vendor credential. Instead an impersonation
 * session row is created and a short-lived, single-use exchange code is handed
 * to the admin panel, which forwards it to the vendor panel. The vendor panel
 * exchanges the code for a short-lived Sanctum token minted against the
 * vendor's own user row, so every existing `role:vendor` route and every
 * `$request->user()->vendor` data scope keeps working unchanged.
 *
 * code_hash stores a SHA-256 digest, never the raw code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('impersonation_sessions', function (Blueprint $table) {
            $table->id();

            // The real administrator who started the session. Never replaced or
            // mutated - the authenticated identity is always the admin here.
            $table->foreignId('impersonator_user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // The vendor account actually being impersonated.
            $table->foreignId('impersonated_user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->foreignId('impersonated_vendor_id')
                ->constrained('vendors')
                ->cascadeOnDelete();

            // SHA-256 digest of the single-use exchange code. The raw code is
            // only ever returned once, to the initiating admin request.
            $table->string('code_hash', 64)->unique();
            $table->timestamp('code_expires_at');

            // personal_access_tokens.id, recorded once the code is exchanged so
            // the session can be resolved (and revoked) from a bearer token.
            $table->unsignedBigInteger('access_token_id')->nullable()->unique();

            $table->timestamp('started_at');
            $table->timestamp('exchanged_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('ended_at')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();

            // Why the admin impersonated, plus the target snapshot.
            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index(['impersonator_user_id', 'ended_at']);
            $table->index(['impersonated_user_id', 'ended_at']);
            $table->index('ended_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('impersonation_sessions');
    }
};
