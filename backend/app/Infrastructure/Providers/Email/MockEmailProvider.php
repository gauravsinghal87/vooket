<?php

namespace App\Infrastructure\Providers\Email;

use App\Infrastructure\Interfaces\NotificationProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Log;

class MockEmailProvider extends AbstractIntegrationProvider implements NotificationProviderInterface
{
    public function sendEmail(string $to, string $subject, string $content, array $attachments = []): bool
    {
        Log::info('MOCK EMAIL', ['to' => $to, 'subject' => $subject]);

        return true;
    }

    public function sendPush(array $tokens, string $title, string $body, array $data = []): bool
    {
        throw new \BadMethodCallException('Push is handled by the "push" integration service.');
    }

    public function sendInApp(int $userId, string $title, string $body, array $data = []): bool
    {
        throw new \BadMethodCallException('In-app notifications are handled by the "push" integration service.');
    }
}
