<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class AuditService
{
    public function log(
        string $action,
        string $entityType,
        ?int $entityId = null,
        array $oldValues = [],
        array $newValues = [],
        ?string $description = null,
        string $level = 'info',
        array $meta = [],
        ?User $actor = null
    ): AuditLog {
        // During vendor impersonation the authenticated user is the vendor, but
        // the real actor is the admin. Callers pass $actor so the audit trail
        // attributes the privileged action to the administrator, not to the
        // vendor whose session happened to be active.
        $user = $actor ?? auth('sanctum')->user();
        $audit = AuditLog::create([
            'user_id' => $user?->id,
            'role' => $user?->roles()->first()?->slug,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'description' => $description,
            'level' => $level,
            'meta' => $meta ?: null,
        ]);

        if ($level === 'error') {
            Log::error("[Audit] {$action} on {$entityType} failed", ['entity_id' => $entityId]);
        }

        return $audit;
    }

    public function created(Model $model, array $data = []): AuditLog
    {
        return $this->log('created', $model::class, $model->getKey(), [], $data, class_basename($model).' created');
    }

    public function updated(Model $model, array $oldValues = [], array $newValues = []): AuditLog
    {
        return $this->log('updated', $model::class, $model->getKey(), $oldValues, $newValues, class_basename($model).' updated');
    }

    public function deleted(Model $model): AuditLog
    {
        return $this->log('deleted', $model::class, $model->getKey(), $model->getAttributes(), [], class_basename($model).' deleted', 'warning');
    }
}
