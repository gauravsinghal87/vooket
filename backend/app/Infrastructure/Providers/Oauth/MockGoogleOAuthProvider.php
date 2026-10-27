<?php

namespace App\Infrastructure\Providers\Oauth;

use App\Exceptions\GoogleTokenException;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;

/**
 * Stand-in used when Google OAuth is disabled or missing a Client ID. The
 * resolver downgrades the service to this provider so the admin connection
 * test reports a clear reason instead of throwing.
 */
class MockGoogleOAuthProvider extends AbstractIntegrationProvider implements TestableProvider
{
    /**
     * @throws GoogleTokenException
     */
    public function verifyIdToken(string $credential): array
    {
        throw new GoogleTokenException('Google sign-in is not available right now.');
    }

    public function testConnection(): array
    {
        $reasons = $this->config['reasons'] ?? [];

        return [
            'success' => false,
            'message' => $reasons === []
                ? 'Google OAuth is not configured.'
                : 'Google OAuth is not available: '.$reasons[0],
        ];
    }
}
