<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RefreshAuthGuards
{
    /**
     * Rebuild the auth guards when a bearer token is present so the request
     * is resolved against its own token. In long-running processes (and PHPUnit
     * tests, where the container survives across requests) the sanctum guard
     * caches the first resolved user; forgetting the guards forces a fresh
     * token resolution. Requests without a bearer token keep the current
     * guard state (e.g. Sanctum::actingAs in tests).
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->bearerToken()) {
            Auth::forgetGuards();
        }

        return $next($request);
    }
}
