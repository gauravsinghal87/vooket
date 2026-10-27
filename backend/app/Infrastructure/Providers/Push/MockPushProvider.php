<?php

namespace App\Infrastructure\Providers\Push;

use App\Infrastructure\Interfaces\NotificationProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Jobs\AsyncFirebaseRequest;
use App\Models\Notification;

class MockPushProvider extends AbstractIntegrationProvider implements NotificationProviderInterface, TestableProvider
{
    public function sendPush(array $tokens, string $title, string $body, array $data = []): bool
    {
        AsyncFirebaseRequest::dispatch('mock', $tokens, array_merge($data, ['title' => $title, 'body' => $body]));

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
        return ['success' => true, 'message' => 'Mock push provider ready.'];
    }
}
