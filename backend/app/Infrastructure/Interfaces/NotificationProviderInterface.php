<?php

namespace App\Infrastructure\Interfaces;

interface NotificationProviderInterface
{
    public function sendPush(array $tokens, string $title, string $body, array $data = []): bool;

    public function sendEmail(string $to, string $subject, string $content, array $attachments = []): bool;

    public function sendInApp(int $userId, string $title, string $body, array $data = []): bool;
}
