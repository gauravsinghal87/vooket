<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Http\Requests\API\Admin\SendSmtpTestEmailRequest;
use App\Mail\SmtpTestMail;
use App\Models\IntegrationSetting;
use App\Services\Integration\IntegrationAuditor;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Mail\MailConfigurationException;
use App\Services\Mail\MailConfigurationService;

/**
 * SMTP "Send Test Email" action.
 *
 * Lives beside the generic integration controller because delivering a real
 * message needs a recipient address and is not a safe "connection test".
 */
class SmtpTestController extends BaseController
{
    public function __construct(
        protected MailConfigurationService $mail,
        protected IntegrationConfigResolver $resolver,
        protected IntegrationAuditor $auditor,
    ) {}

    public function __invoke(SendSmtpTestEmailRequest $request)
    {
        $recipient = $request->string('email')->toString();

        try {
            $this->mail->send(new SmtpTestMail($recipient));
        } catch (MailConfigurationException $e) {
            $this->recordResult('error', $e->getMessage());

            // Disabled/unreachable transport. The message is intentionally
            // generic and never contains host, username or password.
            return $this->error(
                'SMTP connection failed. Please verify host, port, encryption, username, password and sender settings.',
                null,
                422
            );
        }

        $this->recordResult('ok', 'Test email delivered.');

        return $this->success(['recipient' => $recipient], 'Test email sent successfully.');
    }

    protected function recordResult(string $status, string $message): void
    {
        IntegrationSetting::query()->updateOrCreate(['service' => 'smtp'], [
            'last_tested_at' => now(),
            'last_test_status' => $status,
            'last_test_message' => $message,
        ]);

        $this->resolver->clear('smtp');

        // The audit log records the outcome only; no credential is ever passed.
        $this->auditor->log('smtp', 'test.email', "SMTP test email {$status}.", []);
    }
}
