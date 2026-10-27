<?php

namespace App\Services;

use App\Models\ImpersonationSession;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Backend-controlled admin -> vendor impersonation.
 *
 * Design constraints that this service exists to satisfy:
 *
 *  - No vendor password is ever read, written, reset, or returned. Not even
 *    hashed. The vendor's own credentials are untouched by the whole flow.
 *  - The admin's Sanctum token is never replaced or revoked. Ending a session
 *    deletes exactly one token row: the impersonation token.
 *  - The impersonation token is minted against the vendor's own `users` row,
 *    so every existing `role:vendor` route and every
 *    `$request->user()->vendor` data scope keeps working with zero changes.
 *  - The handoff between the two separately-deployed SPAs is a single-use,
 *    short-lived code exchanged over a normal authenticated request. The raw
 *    code is only ever returned once, to the initiating admin request, and is
 *    stored as a SHA-256 digest.
 */
class ImpersonationService
{
    public function __construct(protected AuditService $audit) {}

    /**
     * Start a session: authorise the target vendor and mint a one-time code.
     *
     * @return array{handoff_url:string,expires_at:string,vendor:array,reason:?string}
     *
     * @throws \RuntimeException vendor is not eligible for impersonation
     */
    public function start(User $actor, Vendor $vendor, ?string $reason = null): array
    {
        if (! config('impersonation.enabled')) {
            throw new \RuntimeException('Vendor impersonation is disabled.');
        }

        // Re-validate the target on every start. The admin list view may be
        // stale, and the vendor's own user could have been blocked or deleted
        // since the page was rendered.
        $vendor->loadMissing('user');
        $target = $vendor->user;

        if (! $target) {
            throw new \RuntimeException('This vendor has no linked login account.');
        }

        // Soft-deleted users are excluded by the SoftDeletes global scope; this
        // explicit check documents the intent and survives a scope change.
        if ($target->trashed()) {
            throw new \RuntimeException('This vendor account has been deleted.');
        }

        if (! $target->isActive()) {
            throw new \RuntimeException('This vendor account is blocked or inactive.');
        }

        // A vendor panel login requires the vendor role. Never treat an
        // arbitrary user id as a vendor.
        if (! $target->hasRole('vendor')) {
            throw new \RuntimeException('This account does not have vendor access.');
        }

        if ($target->id === $actor->id) {
            throw new \RuntimeException('You cannot impersonate your own account.');
        }

        $ttl = (int) config('impersonation.code_ttl_seconds', 120);

        // 64 chars of URL-safe randomness. The raw value leaves the server
        // exactly once; only its digest is persisted.
        $code = Str::random(64);

        $session = ImpersonationSession::create([
            'impersonator_user_id' => $actor->id,
            'impersonated_user_id' => $target->id,
            'impersonated_vendor_id' => $vendor->id,
            'code_hash' => hash('sha256', $code),
            'code_expires_at' => now()->addSeconds($ttl),
            'started_at' => now(),
            'expires_at' => now()->addMinutes((int) config('impersonation.token_ttl_minutes', 30)),
            'ip_address' => request()->ip(),
            'user_agent' => Str::limit((string) request()->userAgent(), 500, ''),
            'meta' => [
                'reason' => $reason ?: null,
                'vendor_type' => $vendor->vendor_type,
                'vendor_status' => $vendor->status,
                'admin_email' => $actor->email,
            ],
        ]);

        $this->audit->log(
            'ADMIN_VENDOR_IMPERSONATION_STARTED',
            Vendor::class,
            $vendor->id,
            description: "Admin {$actor->email} started vendor impersonation for {$vendor->business_name}",
            level: 'warning',
            meta: [
                'impersonation_session_id' => $session->id,
                'impersonated_by_admin_id' => $actor->id,
                'impersonated_admin_email' => $actor->email,
                'impersonated_vendor_id' => $vendor->id,
                'impersonated_vendor_user_id' => $target->id,
                'vendor_type' => $vendor->vendor_type,
                'vendor_status' => $vendor->status,
                'reason' => $reason ?: null,
                'code_expires_at' => $session->code_expires_at->toIso8601String(),
            ],
            actor: $actor,
        );

        return [
            // Built server-side from config so the redirect target origin is
            // never taken from the client.
            'handoff_url' => config('frontend.vendor_web_url').'/?impersonation_code='.urlencode($code),
            'expires_at' => $session->code_expires_at->toIso8601String(),
            'reason' => $reason ?: null,
            'vendor' => [
                'id' => $vendor->id,
                'business_name' => $vendor->business_name,
                'vendor_type' => $vendor->vendor_type,
                'status' => $vendor->status,
            ],
        ];
    }

    /**
     * Redeem a one-time code for a short-lived vendor token.
     *
     * @return array{token:string,user:User,impersonation:array}
     *
     * @throws \RuntimeException code is invalid, spent, expired, or ended
     */
    public function exchange(string $code): array
    {
        if (! config('impersonation.enabled')) {
            throw new \RuntimeException('Vendor impersonation is disabled.');
        }

        $code = trim($code);
        if ($code === '') {
            throw new \RuntimeException('Invalid impersonation code.');
        }

        $session = ImpersonationSession::with(['impersonator', 'impersonatedVendor'])
            ->where('code_hash', hash('sha256', $code))
            ->first();

        // A missing row, a spent code and a revoked code are reported
        // identically so the endpoint cannot be used to probe for valid codes.
        if (! $session || ! $session->isCodeRedeemable()) {
            throw new \RuntimeException('This impersonation link is invalid or has expired.');
        }

        $target = $session->impersonatedUser()->first();

        if (! $target || $target->trashed() || ! $target->isActive()) {
            // The vendor was blocked between start and exchange.
            $this->end($session, null);

            throw new \RuntimeException('This vendor account is no longer active.');
        }

        return DB::transaction(function () use ($session, $target) {
            $ability = (string) config('impersonation.ability', 'impersonate');

            // Minted against the vendor's own user row. This is what makes the
            // whole existing vendor panel work unchanged: role:vendor passes
            // and every controller scopes from $request->user()->vendor.
            $newToken = $target->createToken(
                'impersonation:'.$session->id,
                [$ability],
                now()->addMinutes((int) config('impersonation.token_ttl_minutes', 30)),
            );

            // Bind the session to the token so it can be resolved from a bearer
            // token and revoked on exit.
            $session->forceFill([
                'access_token_id' => $newToken->accessToken->id,
                'exchanged_at' => now(),
            ])->save();

            $this->audit->log(
                'ADMIN_VENDOR_IMPERSONATION_REDEEMED',
                Vendor::class,
                $session->impersonated_vendor_id,
                description: 'Vendor impersonation code redeemed',
                level: 'warning',
                meta: [
                    'impersonation_session_id' => $session->id,
                    'impersonated_by_admin_id' => $session->impersonator_user_id,
                    'impersonated_vendor_id' => $session->impersonated_vendor_id,
                    'impersonated_vendor_user_id' => $target->id,
                    'impersonation_token_id' => $newToken->accessToken->id,
                ],
                actor: $session->impersonator,
            );

            return [
                'token' => $newToken->plainTextToken,
                'user' => $target->load(['roles', 'vendor']),
                'impersonation' => $this->contextPayload($session),
            ];
        });
    }

    /**
     * Resolve the active impersonation session for the current bearer token.
     *
     * Resolution is driven entirely by the token id, so a client cannot
     * declare itself an impersonation session.
     */
    public function currentSession(?User $user): ?ImpersonationSession
    {
        $token = $user?->currentAccessToken();
        if (! $token || ! isset($token->id)) {
            return null;
        }

        return ImpersonationSession::with(['impersonator', 'impersonatedVendor'])
            ->where('access_token_id', $token->id)
            ->where('impersonated_user_id', $user->id)
            ->first();
    }

    /**
     * The payload the vendor panel needs to render its banner. Contains no
     * credential material.
     */
    public function contextPayload(ImpersonationSession $session): array
    {
        $vendor = $session->impersonatedVendor;

        return [
            'session_id' => $session->id,
            'impersonated_by_admin_id' => $session->impersonator_user_id,
            'impersonated_admin_name' => $session->impersonator?->name,
            'impersonated_admin_email' => $session->impersonator?->email,
            'impersonated_vendor_id' => $session->impersonated_vendor_id,
            'impersonated_vendor_user_id' => $session->impersonated_user_id,
            'vendor_business_name' => $vendor?->business_name,
            'vendor_type' => $vendor?->vendor_type,
            'vendor_status' => $vendor?->status,
            'started_at' => $session->started_at?->toIso8601String(),
            'expires_at' => $session->expires_at?->toIso8601String(),
            'reason' => $session->meta['reason'] ?? null,
            'return_url' => config('frontend.admin_web_url').config('impersonation.return_path', '/vendors'),
        ];
    }

    /**
     * End a session: revoke exactly the impersonation token, never any other.
     *
     * The admin's own token is a different row and is never touched, so the
     * administrator stays signed in to the admin panel.
     */
    public function end(ImpersonationSession $session, ?User $endingActor = null): void
    {
        if ($session->isEnded()) {
            return;
        }

        $tokenId = $session->access_token_id;

        if ($tokenId) {
            // Scoped by id. Cannot reach the admin's token.
            DB::table('personal_access_tokens')->where('id', $tokenId)->delete();
        }

        $session->forceFill(['ended_at' => now()])->save();

        // Attribute the action to the administrator, who is not the
        // authenticated user at this point (the vendor token was). Resolved
        // through the relation so it works loaded or lazy.
        $actor = $endingActor ?? $session->impersonator()->first();

        $this->audit->log(
            'ADMIN_VENDOR_IMPERSONATION_ENDED',
            Vendor::class,
            $session->impersonated_vendor_id,
            description: 'Vendor impersonation session ended',
            level: 'warning',
            meta: [
                'impersonation_session_id' => $session->id,
                'impersonated_by_admin_id' => $session->impersonator_user_id,
                'impersonated_vendor_id' => $session->impersonated_vendor_id,
                'impersonated_vendor_user_id' => $session->impersonated_user_id,
                'impersonation_token_id' => $tokenId,
                'ended_early' => ! $session->expires_at->isPast(),
            ],
            actor: $actor,
        );
    }
}
