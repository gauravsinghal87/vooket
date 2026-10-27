<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Vendor;
use App\Services\ImpersonationService;
use Illuminate\Http\Request;

/**
 * Super Admin -> vendor impersonation entry point.
 *
 * Mounted inside the existing admin route group, which already enforces
 * `auth:sanctum` + `role:super_admin`. A vendor-management permission is
 * additionally required so a future non-super-admin admin role cannot start a
 * session merely by holding the panel role.
 *
 * The admin's identity is taken exclusively from the authenticated request.
 * Nothing about the target vendor - existence, role, status - is trusted from
 * the client.
 */
class VendorImpersonationController extends BaseController
{
    public function __construct(protected ImpersonationService $impersonation) {}

    public function start(Request $request, $id)
    {
        $actor = $request->user();

        if (! $actor->hasPermission('vendors.view')) {
            return $this->error('You do not have permission to impersonate vendors.', null, 403);
        }

        // Route-model bound by vendors.id, so a bad id is a 404 before any
        // impersonation logic runs.
        $vendor = $request->route('vendor') instanceof Vendor
            ? $request->route('vendor')
            : Vendor::find($id);

        if (! $vendor) {
            return $this->error('Vendor not found.', null, 404);
        }

        try {
            $result = $this->impersonation->start(
                $actor,
                $vendor,
                $this->reason($request),
            );
        } catch (\RuntimeException $e) {
            // Business-rule refusals (blocked, deleted, no vendor role, feature
            // disabled) are safe to surface verbatim.
            return $this->error($e->getMessage(), null, 422);
        }

        return $this->success($result, 'Impersonation session started');
    }

    private function reason(Request $request): ?string
    {
        $reason = $request->input('reason');

        if (! is_string($reason)) {
            return null;
        }

        $reason = trim($reason);

        return $reason === '' ? null : mb_substr($reason, 0, 500);
    }
}
