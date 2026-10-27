<?php

namespace App\Infrastructure\Providers\Payments;

use App\Infrastructure\Interfaces\SettlementProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Http;

class RazorpayRouteProvider extends AbstractIntegrationProvider implements SettlementProviderInterface, TestableProvider
{
    protected string $baseUrl = 'https://api.razorpay.com';

    public function createPayout(array $data): array
    {
        $this->guardLive();

        $params = [
            'account_number' => $this->cred('account_number') ?: $data['account_number'] ?? null,
            'amount' => round((float) ($data['amount'] ?? 0) * 100),
            'currency' => $data['currency'] ?? 'INR',
            'mode' => $data['mode'] ?? 'IMPS',
            'purpose' => $data['purpose'] ?? 'payout',
            'fund_account_id' => $data['fund_account_id'] ?? null,
            'reference_id' => $data['reference_id'] ?? null,
            'narration' => $data['narration'] ?? null,
        ];

        $res = Http::connectTimeout(10)->timeout(30)
            ->withBasicAuth($this->cred('key_id'), (string) $this->cred('key_secret'))
            ->acceptJson()
            ->post("{$this->baseUrl}/v1/payouts", array_filter($params));

        $res->throw();

        return $res->json();
    }

    public function createFundAccount(array $fundAccount): array
    {
        $this->guardLive();

        $res = Http::connectTimeout(10)->timeout(30)
            ->withBasicAuth($this->cred('key_id'), (string) $this->cred('key_secret'))
            ->acceptJson()
            ->post("{$this->baseUrl}/v1/fund_accounts", $fundAccount);

        $res->throw();

        return $res->json();
    }

    public function isAmountManagedByGateway(): bool
    {
        return true;
    }

    public function testConnection(): array
    {
        try {
            if (($this->config['environment'] ?? 'test') !== 'live') {
                return ['success' => true, 'message' => 'Settlement provider requires live mode; configuration is safe.'];
            }
            $res = Http::connectTimeout(10)->timeout(30)
                ->withBasicAuth($this->cred('key_id'), (string) $this->cred('key_secret'))
                ->acceptJson()
                ->get("{$this->baseUrl}/v1/payouts", ['count' => 1]);

            return ['success' => $res->successful(), 'message' => "Razorpay routes responded with HTTP {$res->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $this->diagnose($e)];
        }
    }

    /**
     * Translate a connection failure into an actionable message without
     * leaking credentials, calling out TLS trust (cURL error 60) explicitly.
     */
    private function diagnose(\Throwable $e): string
    {
        $raw = $e->getMessage();
        $isTls = str_contains($raw, 'cURL error 60')
            || stripos($raw, 'SSL certificate problem') !== false
            || stripos($raw, 'certificate verify failed') !== false;

        if ($isTls) {
            $bundle = (string) config('http.ca_bundle');

            return 'TLS certificate validation failed (cURL error 60). The server could not verify Razorpay\'s TLS certificate, which means PHP/cURL has no usable CA bundle. '
                .'Fix: configure `curl.cainfo` and `openssl.cafile` in php.ini to a valid CA bundle (restart Apache/PHP), or set HTTP_CA_BUNDLE to a readable bundle path. '
                .'Active CA bundle: '.($bundle !== '' ? $bundle : '(none)').'.';
        }

        return 'Razorpay routes connection failed: '.$raw;
    }

    protected function guardLive(): void
    {
        if (($this->config['environment'] ?? 'test') !== 'live') {
            throw new \DomainException('Settlements are only available in live environment.');
        }
    }
}
