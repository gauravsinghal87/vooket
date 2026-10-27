<?php

namespace App\Infrastructure\Providers\Email;

use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Services\Mail\MailConfigurationException;
use App\Services\Mail\MailConfigurationService;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;

/**
 * Real SMTP transport built from the admin-managed integration settings.
 *
 * The connection test opens and immediately closes an SMTP session: it performs
 * the handshake (including AUTH when credentials are present) but never sends a
 * message, so it has no customer-facing side effect.
 *
 * The transport is built by Laravel's own mail manager, so the test exercises
 * exactly the same construction path as a real send and cannot drift from it.
 */
class SmtpProvider extends AbstractIntegrationProvider implements TestableProvider
{
    public function __construct(
        array $config = [],
        protected ?MailConfigurationService $mail = null,
    ) {
        parent::__construct($config);
    }

    public function testConnection(): array
    {
        $mail = $this->mail;

        if (! $mail) {
            return ['success' => false, 'message' => 'Mail configuration service is unavailable.'];
        }

        try {
            $mail->withSmtpMailer(function () {
                $transport = Mail::mailer(MailConfigurationService::MAILER)->getSymfonyTransport();

                if (! $transport instanceof EsmtpTransport) {
                    throw new MailConfigurationException('The configured transport is not an SMTP transport.');
                }

                // Handshake only: connect, negotiate TLS, authenticate, disconnect.
                $transport->start();
                $transport->stop();
            });
        } catch (MailConfigurationException $e) {
            return ['success' => false, 'message' => $this->safeMessage($e)];
        } catch (\Throwable) {
            return ['success' => false, 'message' => $this->failureMessage()];
        }

        return [
            'success' => true,
            'message' => 'SMTP connection succeeded. Use "Send Test Email" to verify end-to-end delivery.',
        ];
    }

    protected function safeMessage(MailConfigurationException $e): string
    {
        return str_contains($e->getMessage(), 'SMTP delivery is not enabled')
            ? $e->getMessage()
            : $this->failureMessage();
    }

    protected function failureMessage(): string
    {
        return 'SMTP connection failed. Please verify host, port, encryption, username, password and sender settings.';
    }
}
