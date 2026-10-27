<?php

namespace App\Infrastructure\Providers\Email;

use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;

/**
 * Fallback used when the SMTP integration is disabled or running in mock mode.
 * Mail is written to the application log instead of being delivered, so local
 * development and CI never attempt a real SMTP connection.
 */
class MockSmtpProvider extends AbstractIntegrationProvider implements TestableProvider
{
    public function testConnection(): array
    {
        return [
            'success' => false,
            'message' => 'SMTP is running in log mode. No email is delivered until a real SMTP provider is configured and enabled.',
        ];
    }
}
