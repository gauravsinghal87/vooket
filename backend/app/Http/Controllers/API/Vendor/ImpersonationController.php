<?php

namespace App\Http\Controllers\API\Vendor;

use App\Http\Controllers\API\BaseController;
use App\Services\ImpersonationService;
use Illuminate\Http\Request;

/**
 * Vendor-panel side of an admin impersonation session.
 *
 * `context` lets the vendor panel render an honest, server-supplied banner.
 * `end` revokes the impersonation token and nothing else, so the administrator
 * who started the session remains signed in to the admin panel.
 *
 * Both sit behind the normal vendor middleware stack. There is no bypass: an
 * impersonated session is a real vendor session and is subject to every vendor
 * permission and data scope exactly as a genuine login is.
 */
class ImpersonationController extends BaseController
{
    public function __construct(protected ImpersonationService $impersonation) {}

    /**
     * Describe the current session, or report that it is a normal login.
     *
     * Resolved from the bearer token id, so a client cannot fake an
     * impersonation context, and a normal vendor login simply gets null.
     */
    public function context(Request $request)
    {
        $session = $this->impersonation->currentSession($request->user());

        if (! $session || $session->isEnded()) {
            return $this->success(null, 'Not an impersonation session');
        }

        return $this->success($this->impersonation->contextPayload($session));
    }

    public function end(Request $request)
    {
        $session = $this->impersonation->currentSession($request->user());

        // Nothing to end: a normal vendor login calling this is a no-op, and
        // must not error or delete the user's real token.
        if (! $session) {
            return $this->success(null, 'No impersonation session to end');
        }

        $this->impersonation->end($session);

        return $this->success(null, 'Impersonation session ended');
    }
}
