<?php

namespace App\Infrastructure\Providers\Oauth;

use App\Exceptions\GoogleTokenException;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Services\Integration\GoogleIdTokenVerifier;

/**
 * Google Identity Services sign-in.
 *
 * Only the ID token is exchanged: the client secret is never used to
 * authenticate customers and no Google access/refresh token is requested.
 */
class GoogleOAuthProvider extends AbstractIntegrationProvider implements TestableProvider
{
    public function __construct(
        array $config = [],
        private GoogleIdTokenVerifier $verifier = new GoogleIdTokenVerifier,
    ) {
        parent::__construct($config);
    }

    public function clientId(): ?string
    {
        $clientId = trim((string) $this->cred('client_id', ''));

        return $clientId === '' ? null : $clientId;
    }

    /**
     * Verify a Google ID token against the configured Client ID.
     *
     * @return array{sub:string,email:string,email_verified:bool,name:?string,picture:?string}
     */
    public function verifyIdToken(string $credential): array
    {
        $clientId = $this->clientId();

        if ($clientId === null) {
            throw new GoogleTokenException('Google sign-in is not available right now.');
        }

        return $this->verifier->verify($credential, $clientId);
    }

    /**
     * Validate that the stored settings are usable without claiming that a
     * customer sign-in succeeded. A real ID token can only be obtained by an
     * interactive Google account chooser, so this test cannot cover that step.
     */
    public function testConnection(): array
    {
        $clientId = $this->clientId();

        if ($clientId === null) {
            return ['success' => false, 'message' => 'Client ID is not configured.'];
        }

        if (! $this->looksLikeGoogleWebClientId($clientId)) {
            return ['success' => false, 'message' => 'Client ID is not a Google web application client ID.'];
        }

        $diagnostic = $this->verifier->signingKeyDiagnostic();

        if (! $diagnostic['ok']) {
            $detail = $diagnostic['error'] ?? 'The Google signing-key endpoint is not responding.';

            return [
                'success' => false,
                'message' => 'Configuration saved, but the Google signing keys could not be fetched. '.$detail
                    .' If a local or corporate proxy filters googleapis.com, set GOOGLE_JWKS_BYPASS_PROXY=true.',
            ];
        }

        if ($diagnostic['from_cache']) {
            return [
                'success' => true,
                'message' => 'Configuration saved: Client ID looks valid. '.$diagnostic['error'],
            ];
        }

        return [
            'success' => true,
            'message' => 'Configuration saved: Client ID looks valid and the Google signing keys are reachable ('
                .$diagnostic['count'].' published keys). '
                .'This does not verify a real sign-in — confirm end-to-end with "Continue with Google" on the customer login page.',
        ];
    }

    private function looksLikeGoogleWebClientId(string $clientId): bool
    {
        return (bool) preg_match('/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i', $clientId);
    }
}
