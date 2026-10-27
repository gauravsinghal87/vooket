<?php

namespace App\Http\Controllers\API;

use App\Services\ImpersonationService;
use Illuminate\Http\Request;

/**
 * Public code-exchange endpoint for admin -> vendor impersonation.
 *
 * This is intentionally unauthenticated: the single-use exchange code *is* the
 * credential. It is short-lived, single-use, stored server-side only as a
 * SHA-256 digest, and redeemed for a short-lived vendor-scoped token.
 *
 * Because it is unauthenticated it is rate limited hard, and every failure -
 * unknown, already redeemed, expired, or revoked - returns the same generic
 * 401 so the endpoint cannot be used to discover valid codes.
 */
class ImpersonationExchangeController extends BaseController
{
    public function __construct(protected ImpersonationService $impersonation) {}

    public function exchange(Request $request)
    {
        $code = $request->input('code');

        if (! is_string($code) || trim($code) === '') {
            return $this->error('This impersonation link is invalid or has expired.', null, 401);
        }

        try {
            $result = $this->impersonation->exchange($code);
        } catch (\RuntimeException) {
            return $this->error('This impersonation link is invalid or has expired.', null, 401);
        }

        return $this->success($result, 'Vendor session started');
    }
}
