<?php

namespace App\Infrastructure\Providers\Push;

use App\Infrastructure\Interfaces\NotificationProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Jobs\AsyncFirebaseRequest;
use App\Models\Notification;
use Illuminate\Support\Facades\Bus;

/**
 * Firebase Cloud Messaging provider (legacy HTTP API).
 */
class FirebasePushProvider extends AbstractIntegrationProvider implements NotificationProviderInterface, TestableProvider
{
    public function sendPush(array $tokens, string $title, string $body, array $data = []): bool
    {
        if ($tokens === []) {
            return true;
        }

        $payload = [
            'registration_ids' => $tokens,
            'notification' => [
                'title' => $title,
                'body' => $body,
                'sound' => 'default',
            ],
            'data' => $data ?: (object) [],
            'content_available' => true,
            'priority' => 'high',
        ];

        $job = new AsyncFirebaseRequest(
            'firebase',
            $tokens,
            $data,
            [
                'url' => 'https://fcm.googleapis.com/fcm/send',
                'method' => 'POST',
                'headers' => [
                    'Authorization' => 'key='.$this->cred('api_key'),
                    'Content-Type' => 'application/json',
                ],
                'json' => $payload,
            ]
        );

        Bus::dispatch($job);

        return true;
    }

    public function sendEmail(string $to, string $subject, string $content, array $attachments = []): bool
    {
        throw new \BadMethodCallException('Email is handled by the "email" integration service.');
    }

    public function sendInApp(int $userId, string $title, string $body, array $data = []): bool
    {
        Notification::create([
            'user_id' => $userId,
            'title' => $title,
            'body' => $body,
            'type' => 'push',
            'channel' => 'in_app',
            'data' => $data,
        ]);

        return true;
    }

    public function testConnection(): array
    {
        $key = $this->cred('api_key');

        return [
            'success' => (bool) $key,
            'message' => $key ? 'Firebase credentials present.' : 'FIREBASE_API_KEY is missing.',
        ];
    }
}
