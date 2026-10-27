<?php

use Composer\CaBundle\CaBundle;

/*
|--------------------------------------------------------------------------
| Outbound HTTP client (Guzzle) configuration
|--------------------------------------------------------------------------
|
| TLS trust for outbound HTTPS calls (Razorpay, Google, etc.).
|
| PHP's bundled cURL on Windows ships without a CA bundle and WAMP's
| php.ini normally leaves `curl.cainfo`/`openssl.cafile` empty, so peer
| verification fails with "cURL error 60: SSL certificate problem". Rather
| than disabling verification, we always point Guzzle at a real CA bundle:
|
|   1. HTTP_CA_BUNDLE (env) — explicit override, e.g. an operator-managed
|      bundle. Validated below so a bad path fails loudly instead of
|      silently falling back to no verification.
|   2. composer/ca-bundle — a vendor-maintained, portable bundle that ships
|      with the application (no machine-specific paths).
|
| When a bundle is found we set `verify` to its path (peer + hostname
| verification stay ON). We never set `verify => false`.
|
*/

$caBundle = env('HTTP_CA_BUNDLE');

if (is_string($caBundle) && $caBundle !== '' && ! is_file($caBundle)) {
    // Fail fast: a configured-but-missing bundle is a misconfiguration, not a
    // reason to drop TLS verification.
    throw new RuntimeException("HTTP_CA_BUNDLE is set to [{$caBundle}] but the file does not exist.");
}

if (! is_string($caBundle) || $caBundle === '') {
    $caBundle = CaBundle::getBundledCaBundlePath();
}

return [
    'ca_bundle' => $caBundle,

    // Guzzle "verify" option. A string path keeps peer and hostname
    // verification enabled against that bundle; true uses cURL/PHP defaults.
    'verify' => $caBundle ?: true,

    // Optional outbound proxy (honours standard env vars). Never used to
    // bypass TLS verification.
    'proxy' => env('HTTP_PROXY') ?: env('HTTPS_PROXY'),

    'timeout' => (int) env('HTTP_TIMEOUT', 30),
    'connect_timeout' => (int) env('HTTP_CONNECT_TIMEOUT', 10),
];
