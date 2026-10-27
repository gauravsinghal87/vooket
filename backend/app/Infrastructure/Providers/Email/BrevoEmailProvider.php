<?php

namespace App\Infrastructure\Providers\Email;

use App\Infrastructure\Interfaces\NotificationProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Jobs\SyncBrevoEmailRequest;
use Illuminate\Support\Facades\Http;

/**
 * Brevo (Sendinblue) transactional email provider.
 */
class BrevoEmailProvider extends AbstractIntegrationProvider implements NotificationProviderInterface, TestableProvider
{
    public function sendEmail(string $to, string $subject, string $content, array $attachments = []): bool
    {
        $attachments = array_values(array_map(fn ($file) => [
            'content' => base64_encode(is_string($file) ? $file : (string) file_get_contents($file)),
            'name' => is_string($file) ? basename($file) : ($file->getClientOriginalName() ?? 'attachment'),
        ], $attachments));

        $job = new SyncBrevoEmailRequest('brevo', [
            'url' => 'https://api.brevo.com/v3/smtp/email',
            'method' => 'POST',
            'headers' => [
                'api-key' => (string) $this->cred('api_key'),
                'Accept' => 'application/json',
            ],
            'json' => [
                'sender' => [
                    'name' => $this->cred('sender_name') ?? config('mail.from.name', 'SuperApp'),
                    'email' => $this->cred('sender_email') ?? config('mail.from.address'),
                ],
                'to' => [['email' => $to]],
                'subject' => $subject,
                'htmlContent' => $content,
                'replyTo' => ['email' => $this->cred('reply_to') ?? config('mail.from.address')],
                'attachment' => $attachments ?: [],
            ],
        ]);

        dispatch($job);

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
        try {
            $res = Http::connectTimeout(10)->timeout(20)
                ->withHeaders(['api-key' => (string) $this->cred('api_key')])
                ->get('https://api.brevo.com/v3/account');

            return ['success' => $res->successful(), 'message' => $res->successful() ? 'Brevo account reachable.' : 'Brevo API error.'];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
