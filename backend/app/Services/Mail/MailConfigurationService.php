<?php

namespace App\Services\Mail;

use App\Services\Integration\IntegrationConfigResolver;
use Illuminate\Contracts\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Applies the admin-managed SMTP credentials to Laravel's mailer for the
 * duration of a single callback and always restores the previous
 * configuration afterwards, so a request can never leak SMTP settings into
 * another request (relevant when the app runs under Octane/queue workers).
 *
 * Credentials are read through the integration resolver, which decrypts the
 * stored `integration_settings.credentials` payload. They are never cached in
 * a static, never returned by an API, and never logged.
 */
class MailConfigurationService
{
    /**
     * Mailer name used for the dynamically configured transport.
     */
    public const MAILER = 'admin_smtp';

    public function __construct(
        protected IntegrationConfigResolver $resolver,
    ) {}

    /**
     * True when a real SMTP transport has been configured and enabled.
     */
    public function isConfigured(): bool
    {
        $settings = $this->settings();

        return $settings['provider'] === 'smtp'
            && $settings['enabled']
            && $settings['host'] !== null
            && $settings['port'] !== null;
    }

    /**
     * Effective, decrypted SMTP settings for the current request.
     *
     * @return array{provider: string, enabled: bool, host: ?string, port: ?int, encryption: string, username: ?string, password: ?string, from_email: ?string, from_name: ?string}
     */
    public function settings(): array
    {
        $resolved = $this->resolver->resolve('smtp');
        $credentials = $resolved['credentials'] ?? [];

        $encryption = strtolower(trim((string) ($credentials['encryption'] ?? '')));
        if (! in_array($encryption, ['tls', 'ssl', 'none'], true)) {
            $encryption = $encryption === '' ? 'tls' : 'none';
        }

        return [
            'provider' => (string) $resolved['provider'],
            'enabled' => (bool) $resolved['enabled'],
            'host' => $this->blankToNull($credentials['host'] ?? null),
            'port' => $this->toPort($credentials['port'] ?? null),
            'encryption' => $encryption,
            'username' => $this->blankToNull($credentials['username'] ?? null),
            'password' => $this->blankToNull($credentials['password'] ?? null),
            'from_email' => $this->blankToNull($credentials['from_email'] ?? null),
            'from_name' => $this->blankToNull($credentials['from_name'] ?? null),
        ];
    }

    /**
     * Run $callback with the admin SMTP transport active.
     *
     * The previous mail configuration is restored in a `finally` block, and any
     * failure is logged without credentials and re-thrown as a safe
     * MailConfigurationException.
     *
     * @template TReturn
     *
     * @param  callable():TReturn  $callback
     * @return TReturn
     *
     * @throws MailConfigurationException
     */
    public function withSmtpMailer(callable $callback): mixed
    {
        $settings = $this->settings();

        if (! $settings['enabled'] || $settings['provider'] !== 'smtp') {
            throw new MailConfigurationException(
                'SMTP delivery is not enabled. Enable SMTP and complete the host, port and sender settings first.'
            );
        }

        if ($settings['host'] === null || $settings['port'] === null) {
            throw new MailConfigurationException(
                'SMTP delivery is not enabled. Enable SMTP and complete the host, port and sender settings first.'
            );
        }

        $previous = [
            'default' => config('mail.default'),
            'mailer' => config('mail.mailers.'.self::MAILER),
            'from' => config('mail.from'),
        ];

        try {
            $this->applyMailerConfiguration($settings);

            return $callback();
        } catch (MailConfigurationException $e) {
            throw $e;
        } catch (Throwable $e) {
            // Log the transport failure for operators. The exception message from
            // Symfony can echo the server response but never contains our
            // username/password, and we additionally strip any credential that
            // may have been interpolated.
            Log::warning('SMTP delivery failed', [
                'host' => $settings['host'],
                'port' => $settings['port'],
                'encryption' => $settings['encryption'],
                'exception' => $this->redact($e->getMessage(), $settings),
            ]);

            throw new MailConfigurationException(
                'The email could not be delivered. Please try again later.',
                previous: $e
            );
        } finally {
            $this->restoreMailConfiguration($previous);
        }
    }

    /**
     * Send a mailable through the admin-configured transport.
     */
    public function send(Mailable $mailable): void
    {
        $this->withSmtpMailer(fn () => Mail::mailer(self::MAILER)->send($mailable));
    }

    /**
     * @param  array{host: ?string, port: ?int, encryption: string, username: ?string, password: ?string, from_email: ?string, from_name: ?string}  $settings
     */
    protected function applyMailerConfiguration(array $settings): void
    {
        config(['mail.mailers.'.self::MAILER => [
            'transport' => 'smtp',
            'host' => $settings['host'],
            'port' => $settings['port'],
            // Laravel maps the transport `scheme` onto the Symfony DSN scheme:
            //   smtp  -> STARTTLS (opportunistic upgrade, the usual port 587 setup)
            //   smtps -> implicit TLS (the usual port 465 setup)
            //   none  -> plain SMTP with opportunistic STARTTLS explicitly disabled
            'scheme' => match ($settings['encryption']) {
                'ssl' => 'smtps',
                'none' => 'smtp',
                default => 'smtp',
            },
            'auto_tls' => $settings['encryption'] !== 'none',
            'username' => $settings['username'],
            'password' => $settings['password'],
            'timeout' => 15,
            'local_domain' => parse_url((string) config('app.url'), PHP_URL_HOST) ?: null,
        ]]);

        config(['mail.default' => self::MAILER]);

        if ($settings['from_email'] !== null) {
            config(['mail.from.address' => $settings['from_email']]);
        }

        if ($settings['from_name'] !== null) {
            config(['mail.from.name' => $settings['from_name']]);
        }

        // Force a fresh mailer instance so a previously resolved default mailer
        // (or the log driver) is not reused for this send.
        Mail::purge(self::MAILER);
    }

    /**
     * @param  array{default: mixed, mailer: mixed, from: mixed}  $previous
     */
    protected function restoreMailConfiguration(array $previous): void
    {
        Mail::purge(self::MAILER);

        config(['mail.default' => $previous['default']]);
        config(['mail.mailers.'.self::MAILER => $previous['mailer']]);
        config(['mail.from' => $previous['from']]);
    }

    /**
     * Strip credentials from a transport error before it reaches the log.
     *
     * @param  array<string, mixed>  $settings
     */
    protected function redact(string $message, array $settings): string
    {
        foreach (['password', 'username'] as $key) {
            $value = $settings[$key] ?? null;
            if (is_string($value) && $value !== '') {
                $message = str_replace($value, '[redacted]', $message);
            }
        }

        return mb_substr($message, 0, 500);
    }

    protected function blankToNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' || $value === 'null' ? null : $value;
    }

    protected function toPort(mixed $value): ?int
    {
        $port = $this->blankToNull($value);

        if ($port === null || ! is_numeric($port)) {
            return null;
        }

        $port = (int) $port;

        return $port >= 1 && $port <= 65535 ? $port : null;
    }
}
