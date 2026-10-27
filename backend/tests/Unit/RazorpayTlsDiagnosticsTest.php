<?php

namespace Tests\Unit;

use App\Infrastructure\Providers\Payments\RazorpayProvider;
use App\Infrastructure\Providers\Payments\RazorpayRouteProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RazorpayTlsDiagnosticsTest extends TestCase
{
    private function provider(): RazorpayProvider
    {
        return new RazorpayProvider([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'credentials' => [
                'key_id' => 'rzp_test_PublicKeyId',
                'key_secret' => 'rzp_test_SecretKey',
                'webhook_secret' => 'whsec_test',
            ],
        ]);
    }

    public function test_test_connection_reports_actionable_message_on_tls_verification_failure(): void
    {
        config(['http.ca_bundle' => 'C:\\path\\to\\cacert.pem']);

        Http::fake(function () {
            throw new ConnectionException(
                'cURL error 60: SSL certificate problem: self-signed certificate in certificate chain (see https://curl.haxx.se/libcurl/c/libcurl-errors.html) for https://api.razorpay.com/v1/orders?count=1'
            );
        });

        $result = $this->provider()->testConnection();

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('cURL error 60', $result['message']);
        $this->assertStringContainsString('php.ini', $result['message']);
        $this->assertStringContainsString('HTTP_CA_BUNDLE', $result['message']);
        $this->assertStringContainsString('C:\\path\\to\\cacert.pem', $result['message']);
    }

    public function test_tls_diagnostic_never_leaks_credentials(): void
    {
        Http::fake(function () {
            throw new ConnectionException('cURL error 60: SSL certificate problem: self-signed certificate in certificate chain');
        });

        $result = $this->provider()->testConnection();

        $this->assertFalse($result['success']);
        $this->assertStringNotContainsString('rzp_test_SecretKey', $result['message']);
        $this->assertStringNotContainsString('rzp_test_PublicKeyId', $result['message']);
        $this->assertStringNotContainsString('whsec_test', $result['message']);
    }

    public function test_timeout_reports_network_specific_message(): void
    {
        Http::fake(function () {
            throw new ConnectionException('cURL error 28: Operation timed out after 30001 milliseconds');
        });

        $result = $this->provider()->testConnection();

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('Timed out', $result['message']);
    }

    public function test_non_200_response_is_reported_without_diagnostics_leak(): void
    {
        Http::fake([
            'api.razorpay.com/*' => Http::response(['error' => 'unauthorized'], 401),
        ]);

        $result = $this->provider()->testConnection();

        $this->assertFalse($result['success']);
        $this->assertSame('Razorpay responded with HTTP 401.', $result['message']);
    }

    public function test_successful_response_reports_working(): void
    {
        Http::fake([
            'api.razorpay.com/*' => Http::response(['count' => 1, 'items' => []], 200),
        ]);

        $result = $this->provider()->testConnection();

        $this->assertTrue($result['success']);
        $this->assertSame('Razorpay connection working.', $result['message']);
    }

    public function test_route_provider_reports_tls_diagnostic(): void
    {
        Http::fake(function () {
            throw new ConnectionException('cURL error 60: SSL certificate problem: self-signed certificate in certificate chain');
        });

        $provider = new RazorpayRouteProvider([
            'service' => 'settlements',
            'provider' => 'razorpay_route',
            'environment' => 'live',
            'credentials' => [
                'key_id' => 'rzp_live_PublicKeyId',
                'key_secret' => 'rzp_live_SecretKey',
            ],
        ]);

        $result = $provider->testConnection();

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('cURL error 60', $result['message']);
        $this->assertStringNotContainsString('rzp_live_SecretKey', $result['message']);
    }
}
