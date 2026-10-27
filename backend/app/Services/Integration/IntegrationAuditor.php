<?php

namespace App\Services\Integration;

use App\Models\AuditLog;

class IntegrationAuditor
{
    /**
     * Record an integration configuration audit entry. Never logs secret VALUES,
     * only the field names that changed.
     */
    public function log(
        string $service,
        string $action,
        ?string $description = null,
        array $changedFields = [],
        array $meta = []
    ): AuditLog {
        $user = auth('sanctum')->user();
        $request = request();

        return AuditLog::create([
            'user_id' => $user?->id,
            'role' => $user?->roles()->first()?->slug,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'action' => 'integration.'.$action,
            'entity_type' => 'integration_settings',
            'entity_id' => null,
            'description' => $description ?? ucfirst($service).' integration '.$action,
            'level' => 'info',
            'meta' => array_merge([
                'service' => $service,
                'changed_fields' => $changedFields,
            ], $meta),
        ]);
    }
}
