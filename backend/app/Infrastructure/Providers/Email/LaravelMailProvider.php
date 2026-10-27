<?php

namespace App\Infrastructure\Providers\Email;

use App\Infrastructure\Interfaces\NotificationProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Mail;

/**
 * Sends via Laravel's configured mail driver (SMTP, Mailtrap, log, ...).
 */
class LaravelMailProvider extends AbstractIntegrationProvider implements NotificationProviderInterface, TestableProvider
{
    public function sendEmail(string $to, string $subject, string $content, array $attachments = []): bool
    {
        Mail::html($content, function ($message) use ($to, $subject, $attachments) {
            $message->to($to)->subject($subject);
            foreach ($attachments as $attachment) {
                $message->attach(is_string($attachment) ? $attachment : $attachment->getRealPath(), [
                    'as' => is_string($attachment) ? basename($attachment) : $attachment->getClientOriginalName(),
                ]);
            }
        });

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

    public function testConnection(): array
    {
        return [
            'success' => (bool) config('mail.from.address'),
            'message' => 'MAIL_FROM_ADDRESS present and mail driver available.',
        ];
    }
}
