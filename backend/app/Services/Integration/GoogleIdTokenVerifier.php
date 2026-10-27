<?php

namespace App\Services\Integration;

use App\Exceptions\GoogleTokenException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Verifies Google Identity Services ID tokens locally.
 *
 * The signature is checked against Google's published JWKS with OpenSSL
 * (RS256), and the issuer, audience and expiry are validated against the
 * configured OAuth Client ID. No Google access or refresh token is ever
 * requested or stored — sign-in only needs the ID token.
 */
class GoogleIdTokenVerifier
{
    public const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

    public const CACHE_KEY = 'integration:google:jwks';

    public const CACHE_TTL = 3600;

    /**
     * Tolerance for clock drift between this server and Google, in seconds.
     */
    public const CLOCK_SKEW = 60;

    /**
     * Accepted token issuers. Google signs as the URL form; the bare host is
     * accepted for compatibility with older credential formats.
     */
    public const ISSUERS = [
        'https://accounts.google.com',
        'accounts.google.com',
    ];

    /**
     * Customer-facing failure message. Deliberately identical for every
     * verification failure so token internals are never disclosed.
     */
    public const FAILURE_MESSAGE = 'Google sign-in could not be verified. Please try again.';

    /**
     * @return array{sub:string,email:string,email_verified:bool,name:?string,picture:?string}
     *
     * @throws GoogleTokenException
     */
    public function verify(string $idToken, string $clientId): array
    {
        $clientId = trim($clientId);

        if ($clientId === '' || strlen($idToken) > 8192) {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        try {
            return $this->verifyClaims($idToken, $clientId);
        } catch (GoogleTokenException $e) {
            // The customer only ever sees the generic message; the reason is
            // recorded server-side. No token, credential or secret is logged.
            Log::warning('Google ID token verification failed', [
                'reason' => $e->getMessage() === self::FAILURE_MESSAGE ? 'rejected' : $e->getMessage(),
                'token_received' => true,
                'token_length_bucket' => $this->lengthBucket(strlen($idToken)),
            ]);

            throw $e;
        }
    }

    /**
     * @return array{sub:string,email:string,email_verified:bool,name:?string,picture:?string}
     *
     * @throws GoogleTokenException
     */
    private function verifyClaims(string $idToken, string $clientId): array
    {
        [$header, $claims, $signature, $signingInput] = $this->parse($idToken);

        $diagnostics = [
            'token_received' => true,
            'alg' => $header['alg'] ?? null,
            'issuer' => is_string($claims['iss'] ?? null) ? $claims['iss'] : null,
            'audience_match' => $this->audienceMatches($claims, $clientId),
            'expired' => true,
            'email_verified' => null,
            'signing_key_found' => false,
        ];

        if (($header['alg'] ?? null) !== 'RS256') {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        $kid = $header['kid'] ?? null;
        if (! is_string($kid) || $kid === '') {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        $jwk = $this->jwkFor($kid);

        if ($jwk === null) {
            // The signing key rotated after the JWKS was cached. Refresh once
            // before giving up so a routine Google rotation is not an outage.
            $jwk = $this->jwkFor($kid, forceRefresh: true);

            if ($jwk === null) {
                Log::warning('Google ID token rejected', $diagnostics + ['failed_at' => 'signing_key_lookup']);

                throw new GoogleTokenException(self::FAILURE_MESSAGE);
            }
        }

        $diagnostics['signing_key_found'] = true;

        $verified = openssl_verify(
            $signingInput,
            $signature,
            $this->pemFromJwk($jwk),
            OPENSSL_ALGO_SHA256
        );

        if ($verified !== 1) {
            Log::warning('Google ID token rejected', $diagnostics + ['failed_at' => 'signature']);

            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        $this->assertAudience($claims, $clientId);
        $this->assertIssuer($claims);
        $this->assertTimeClaims($claims);

        $sub = $claims['sub'] ?? null;
        $email = $claims['email'] ?? null;

        $diagnostics['expired'] = false;
        $diagnostics['email_verified'] = filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOL);

        if (! is_string($sub) || $sub === '' || ! is_string($email) || $email === '') {
            Log::warning('Google ID token rejected', $diagnostics + ['failed_at' => 'missing_claims']);

            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        Log::info('Google ID token verified', $diagnostics);

        return [
            'sub' => $sub,
            'email' => strtolower($email),
            'email_verified' => filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOL),
            'name' => is_string($claims['name'] ?? null) ? trim($claims['name']) ?: null : null,
            'picture' => is_string($claims['picture'] ?? null) ? trim($claims['picture']) ?: null : null,
        ];
    }

    /**
     * Bucket a token length so logs reveal nothing about the token itself.
     */
    private function lengthBucket(int $length): string
    {
        return match (true) {
            $length < 200 => '<200',
            $length < 600 => '200-600',
            $length < 1200 => '600-1200',
            default => '>=1200',
        };
    }

    private function audienceMatches(array $claims, string $clientId): bool
    {
        $aud = $claims['aud'] ?? null;

        $audiences = is_array($aud) ? $aud : [$aud];

        return in_array($clientId, array_map('strval', $audiences), true);
    }

    /**
     * The token audience must be this application's own Google Client ID.
     */
    private function assertAudience(array $claims, string $clientId): void
    {
        $aud = $claims['aud'] ?? null;

        // An ID token may carry an array audience when it is also intended for
        // another consumer; ours must still be present.
        $audiences = is_array($aud) ? $aud : [$aud];

        if (! in_array($clientId, array_map('strval', $audiences), true)) {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }
    }

    private function assertIssuer(array $claims): void
    {
        $iss = $claims['iss'] ?? null;

        if (! is_string($iss) || ! in_array($iss, self::ISSUERS, true)) {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }
    }

    /**
     * Reject expired tokens and tokens issued implausibly far in the future.
     */
    private function assertTimeClaims(array $claims): void
    {
        $now = time();
        $exp = $claims['exp'] ?? null;

        if (! is_numeric($exp) || (int) $exp + self::CLOCK_SKEW <= $now) {
            throw new GoogleTokenException('Your Google session has expired. Please sign in again.');
        }

        $iat = $claims['iat'] ?? null;

        if (is_numeric($iat) && (int) $iat - self::CLOCK_SKEW > $now) {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }
    }

    /**
     * Split a compact JWS into its parts without trusting any of them yet.
     *
     * @return array{0:array,1:array,2:string,3:string}
     */
    private function parse(string $jwt): array
    {
        $parts = explode('.', $jwt);

        if (count($parts) !== 3) {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        $header = $this->decodeSegment($encodedHeader);
        $claims = $this->decodeSegment($encodedPayload);
        $signature = $this->base64UrlDecode($encodedSignature);

        if ($signature === '') {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        return [$header, $claims, $signature, $encodedHeader.'.'.$encodedPayload];
    }

    private function decodeSegment(string $segment): array
    {
        $decoded = $this->base64UrlDecode($segment);
        $data = json_decode($decoded, true);

        if (! is_array($data)) {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        return $data;
    }

    /**
     * Number of signing keys Google currently publishes. Used by the admin
     * connection test to confirm the key endpoint is reachable.
     */
    public function signingKeyCount(): int
    {
        return count($this->jwks());
    }

    /**
     * Locate the signing key by id in Google's published key set.
     */
    private function jwkFor(string $kid, bool $forceRefresh = false): ?array
    {
        $keys = $this->jwks($forceRefresh);

        foreach ($keys as $key) {
            if (($key['kid'] ?? null) === $kid && ($key['kty'] ?? null) === 'RSA') {
                return $key;
            }
        }

        return null;
    }

    /**
     * @return array<int,array>
     */
    private function jwks(bool $forceRefresh = false): array
    {
        if (! $forceRefresh) {
            $cached = Cache::get(self::CACHE_KEY);

            if (is_array($cached) && $cached !== []) {
                return $cached;
            }
        }

        $result = $this->fetchJwks();

        if ($result['keys'] === []) {
            // Fall back to the cached copy rather than failing every sign-in
            // because Google is briefly unreachable.
            $cached = Cache::get(self::CACHE_KEY);

            return is_array($cached) ? $cached : [];
        }

        Cache::put(self::CACHE_KEY, $result['keys'], self::CACHE_TTL);

        return $result['keys'];
    }

    /**
     * Retrieve Google's published signing keys.
     *
     * Returns the keys plus a diagnostic-safe description of any failure. The
     * description never contains a token, credential or stack trace.
     *
     * @return array{keys:array<int,array>,error:?string,status:?int}
     */
    private function fetchJwks(): array
    {
        $url = (string) (config('integrations.credentials.google_jwks.url') ?: self::JWKS_URL);

        $request = Http::acceptJson()
            ->connectTimeout(5)
            ->timeout(10);

        // Some outbound filtering proxies answer 403 for this host. When
        // explicitly configured, talk to Google directly instead. Certificate
        // verification is never disabled.
        if (config('integrations.credentials.google_jwks.bypass_proxy')) {
            $request = $request->withOptions(['proxy' => '']);
        }

        try {
            $response = $request->get($url);
        } catch (\Throwable $e) {
            Log::warning('Google signing keys unreachable', [
                'url_host' => parse_url($url, PHP_URL_HOST),
                'error' => $this->describeFetchError($e),
            ]);

            return ['keys' => [], 'error' => $this->describeFetchError($e), 'status' => null];
        }

        if (! $response->successful()) {
            Log::warning('Google signing keys returned an error response', [
                'url_host' => parse_url($url, PHP_URL_HOST),
                'http_status' => $response->status(),
            ]);

            return [
                'keys' => [],
                'error' => 'The Google signing-key endpoint returned HTTP '.$response->status().'.',
                'status' => $response->status(),
            ];
        }

        $keys = array_values(array_filter((array) ($response->json('keys') ?? []), 'is_array'));

        if ($keys === []) {
            return [
                'keys' => [],
                'error' => 'The Google signing-key endpoint replied without any usable keys.',
                'status' => $response->status(),
            ];
        }

        return ['keys' => $keys, 'error' => null, 'status' => $response->status()];
    }

    /**
     * Classify a transport-level failure without leaking internals.
     */
    private function describeFetchError(\Throwable $e): string
    {
        return match (true) {
            $e instanceof ConnectionException => 'The connection to the Google signing-key endpoint failed or timed out.',
            $e instanceof RequestException => 'The request to the Google signing-key endpoint failed.',
            default => 'The Google signing-key endpoint could not be reached.',
        };
    }

    /**
     * Diagnostic-safe description of why the key endpoint is not usable.
     * Used by the admin connection test so operators get an actionable message
     * instead of a generic "unreachable".
     */
    public function signingKeyDiagnostic(): array
    {
        $cached = Cache::get(self::CACHE_KEY);

        if (is_array($cached) && $cached !== []) {
            $result = $this->fetchJwks();

            if ($result['keys'] !== []) {
                return ['ok' => true, 'count' => count($result['keys']), 'error' => null, 'from_cache' => false];
            }

            return [
                'ok' => true,
                'count' => count($cached),
                'error' => 'Using the last cached copy of the signing keys; the live endpoint is currently failing.',
                'from_cache' => true,
            ];
        }

        $result = $this->fetchJwks();

        if ($result['keys'] !== []) {
            return ['ok' => true, 'count' => count($result['keys']), 'error' => null, 'from_cache' => false];
        }

        return ['ok' => false, 'count' => 0, 'error' => $result['error'], 'from_cache' => false];
    }

    /**
     * Build an OpenSSL public key from a JWK modulus/exponent pair.
     */
    private function pemFromJwk(array $jwk): string
    {
        $n = $this->base64UrlDecode((string) ($jwk['n'] ?? ''));
        $e = $this->base64UrlDecode((string) ($jwk['e'] ?? ''));

        if ($n === '' || $e === '') {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        // RSAPublicKey ::= SEQUENCE { modulus INTEGER, publicExponent INTEGER }
        $rsaKeyContent = $this->encodeDerInteger($this->stripLeadingZero($n))
            .$this->encodeDerInteger($this->stripLeadingZero($e));

        $rsaPublicKey = "\x30".$this->encodeLength(strlen($rsaKeyContent)).$rsaKeyContent;

        // AlgorithmIdentifier for rsaEncryption with NULL parameters.
        $rsaAlgorithmIdentifier = pack('H*', '300d06092a864886f70d0101010500');

        // BIT STRING carries the key with a leading "unused bits" octet.
        $subjectPublicKey = "\x03"
            .$this->encodeLength(strlen($rsaPublicKey) + 1)
            ."\x00"
            .$rsaPublicKey;

        // SubjectPublicKeyInfo ::= SEQUENCE { algorithm, subjectPublicKey }
        $der = "\x30"
            .$this->encodeLength(strlen($rsaAlgorithmIdentifier) + strlen($subjectPublicKey))
            .$rsaAlgorithmIdentifier
            .$subjectPublicKey;

        $pem = "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($der), 64, "\n")."-----END PUBLIC KEY-----\n";

        if (! openssl_pkey_get_public($pem)) {
            throw new GoogleTokenException(self::FAILURE_MESSAGE);
        }

        return $pem;
    }

    private function stripLeadingZero(string $bytes): string
    {
        $bytes = ltrim($bytes, "\x00");

        return $bytes === '' ? "\x00" : $bytes;
    }

    private function encodeDerInteger(string $bytes): string
    {
        // A DER INTEGER is signed, so a leading high bit needs a zero pad.
        if (ord($bytes[0]) > 0x7F) {
            $bytes = "\x00".$bytes;
        }

        return "\x02".$this->encodeLength(strlen($bytes)).$bytes;
    }

    private function encodeLength(int $length): string
    {
        if ($length <= 0x7F) {
            return chr($length);
        }

        $encoded = '';
        while ($length > 0) {
            $encoded = chr($length & 0xFF).$encoded;
            $length >>= 8;
        }

        return chr(0x80 | strlen($encoded)).$encoded;
    }

    private function base64UrlDecode(string $value): string
    {
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);

        return $decoded === false ? '' : $decoded;
    }
}
