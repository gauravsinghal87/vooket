<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\NotificationProviderInterface;
use Illuminate\Support\Facades\Log;

class LogNotificationProvider implements NotificationProviderInterface
{
    public function sendPush(array $tokens, string $title, string $body, array $data = []): bool
    {
        Log::info('[NOTIFICATION] Push', ['tokens' => count($tokens), 'title' => $title, 'body' => $body]);

        return true;
    }

    public function sendEmail(string $to, string $subject, string $content, array $attachments = []): bool
    {
        Log::info('[NOTIFICATION] Email', ['to' => $to, 'subject' => $subject]);

        return true;
    }

    public function sendInApp(int $userId, string $title, string $body, array $data = []): bool
    {
        Log::info('[NOTIFICATION] InApp', ['user_id' => $userId, 'title' => $title, 'body' => $body]);

        return true;
    }
}
