<?php

namespace App\Services\Notifications;

use App\Infrastructure\Interfaces\NotificationProviderInterface;
use App\Models\PushToken;
use App\Services\Integration\IntegrationManager;
use Illuminate\Support\Facades\Log;

class PushNotificationService
{
    public function __construct(
        protected IntegrationManager $manager,
    ) {}

    public function sendToUser(int $userId, string $title, string $body, array $data = [], ?array $appIds = null): int
    {
        $query = PushToken::query()->where('user_id', $userId)->active();
        if ($appIds !== null && ! empty($appIds)) {
            $query->whereIn('app_id', $appIds);
        }

        $tokens = $query->pluck('token')->all();
        if (empty($tokens)) {
            return 0;
        }

        try {
            $provider = $this->manager->notifications();
            if ($provider instanceof NotificationProviderInterface) {
                $provider->sendPush($tokens, $title, $body, $data);
                PushToken::query()->whereIn('token', $tokens)->update(['last_used_at' => now()]);
                return count($tokens);
            }
        } catch (\Throwable $e) {
            Log::warning('push.send_to_user_failed', ['user_id' => $userId, 'error' => $e->getMessage()]);
        }

        return 0;
    }

    public function sendToUsers(array $userIds, string $title, string $body, array $data = [], ?array $appIds = null): int
    {
        $total = 0;
        $unique = array_values(array_unique(array_map('intval', $userIds)));
        foreach ($unique as $userId) {
            $total += $this->sendToUser($userId, $title, $body, $data, $appIds);
        }

        return $total;
    }
}
