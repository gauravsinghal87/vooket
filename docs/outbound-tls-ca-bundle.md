# Outbound HTTPS / TLS trust (WAMP + PHP)

## Symptom

Admin Web → Integrations → Razorpay → **Test Connection** fails with:

```
Connection test failed: cURL error 60: SSL certificate problem: self-signed certificate in certificate chain
```

The failing request is `GET https://api.razorpay.com/v1/orders?count=1`.

## Root cause

This is **not** a Razorpay credential problem and **not** an intercepting proxy.
Razorpay's certificate chain is publicly trusted:

- Subject: `*.razorpay.com`
- Issuer: `DigiCert Inc` / `RapidSSL TLS RSA CA G1`

The failure is that **PHP's cURL has no CA bundle to verify against**:

- On Windows, the cURL library bundled with PHP does **not** use the OS trust
  store by default.
- WAMP's `php.ini` ships with `curl.cainfo`, `openssl.cafile`, and
  `openssl.capath` all **empty**.
- WAMP's PHP distribution contains no `cacert.pem` of its own.

With no trust anchors, every outbound HTTPS call fails verification with
`cURL error 60`. This affects any real integration (Razorpay, Google Maps,
Google OAuth, etc.), not just Razorpay.

## The fix (in the application)

The application now always points the Laravel HTTP client (Guzzle) at a real
CA bundle — verification stays enabled.

1. **`composer/ca-bundle`** is a dependency. It ships a vendor-maintained,
   portable bundle at
   `vendor/composer/ca-bundle/res/cacert.pem` — no machine-specific paths.

2. **`config/http.php`** resolves the bundle:

   - `HTTP_CA_BUNDLE` (env) — explicit override path. If set but missing, the
     app fails loudly at boot instead of silently disabling verification.
   - Otherwise the vendored `composer/ca-bundle` path is used.

   The resolved path is exposed as `http.ca_bundle` / `http.verify`.

3. **`AppServiceProvider::configureHttpClient()`** applies
   `Http::globalOptions(['verify' => <bundle>])` so all outbound calls
   (including `RazorpayProvider`, `RazorpayRouteProvider`, and every other
   provider using the `Http` facade) verify against the bundle.

   `verify` is always a bundle **path** (or PHP's default); it is **never set to
   `false`**. Peer and hostname verification remain enabled.

4. **Diagnostics:** `RazorpayProvider::testConnection()` and
   `RazorpayRouteProvider::testConnection()` detect TLS failures (cURL error 60)
   and return an actionable message naming the fix and the active CA bundle —
   without leaking credentials.

## Required server configuration (WAMP)

The application-level bundle above fixes the default deployment with no server
changes. To also make PHP/WAMP verify outbound TLS **globally** (recommended,
and required if any code uses raw cURL outside Laravel's HTTP client):

1. Download the current CA bundle (Mozilla/curl bundle). Example:

   ```
   https://curl.se/ca/cacert.pem
   ```

   Save it somewhere stable, e.g.
   `C:\wamp64\bin\php\php8.4.15\extras\ssl\cacert.pem`.

2. Edit the active `php.ini` (for CLI this is
   `C:\wamp64\bin\php\php8.4.15\php.ini`; Apache may use the same or a copy —
   check `php --ini` and the WAMP tray → PHP → php.ini). Set:

   ```ini
   curl.cainfo = "C:\wamp64\bin\php\php8.4.15\extras\ssl\cacert.pem"
   openssl.cafile = "C:\wamp64\bin\php\php8.4.15\extras\ssl\cacert.pem"
   ```

3. **Restart** WAMP (this restarts both Apache and PHP). PHP reads these
   INI values at process start — a running process will not pick them up.

4. Verify:

   ```
   php -i | findstr /I "curl.cainfo openssl.cafile"
   php -r "var_dump(ini_get('curl.cainfo'));"
   ```

   Both should print the path.

> Note: `OPENSSL_CONF` (pointing at `openssl.cnf`) is a separate setting and
> does not provide trust anchors; the CA bundle is what fixes error 60.

## Environment variables

| Variable          | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `HTTP_CA_BUNDLE`  | Explicit CA bundle path override. Empty = vendored bundle.     |
| `HTTP_PROXY` / `HTTPS_PROXY` | Optional outbound proxy (routing only; TLS never relaxed). |
| `HTTP_TIMEOUT` / `HTTP_CONNECT_TIMEOUT` | Outbound HTTP timeouts.                    |

See `.env.example` for the documented defaults.

## Verifying the fix

Run the unit tests (no real network calls):

```
vendor/bin/phpunit tests/Unit/RazorpayTlsDiagnosticsTest.php
```

These assert that a simulated `cURL error 60` produces an actionable,
credential-free message, and that non-TLS statuses are surfaced correctly.

To verify the live TLS handshake specifically (fake credentials are fine — a
`401` response proves TLS succeeded):

```
php artisan tinker
>>> config('http.ca_bundle');
>>> (new App\Infrastructure\Providers\Payments\RazorpayProvider([
...   'service' => 'payments',
...   'credentials' => ['key_id' => 'rzp_test_x', 'key_secret' => 'rzp_test_x'],
... ]))->testConnection();
```

- Before the fix: `success => false`, message contains `cURL error 60`.
- After the fix: message `Razorpay responded with HTTP 401.` (TLS OK; only the
  credentials are fake).

With **real** test keys configured in the admin Integrations hub, the Admin Web
Test Connection should then report success.

## Do / Don't

- **Do** keep `verify` as a CA bundle path or leave it at PHP defaults.
- **Do** restart WAMP after editing `php.ini`.
- **Don't** set `curl.cainfo` to an unrelated `.cnf` file.
- **Don't** disable `CURLOPT_SSL_VERIFYPEER`/`VERIFYHOST` or set
  `verify => false` to "work around" the error.
