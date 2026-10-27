<?php

namespace App\Infrastructure\Providers\Kyc;

use App\Infrastructure\Interfaces\KycProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Str;

class MockKycProvider extends AbstractIntegrationProvider implements KycProviderInterface
{
    public function startVerification(array $data, array $documentFiles = []): array
    {
        return [
            'verification_id' => 'kv_'.Str::random(12),
            'status' => 'initiated',
            'mock' => true,
        ];
    }

    public function getVerificationStatus(string $verificationId): array
    {
        return [
            'verification_id' => $verificationId,
            'status' => 'verified',
            'mock' => true,
        ];
    }

    public function verifyDocument(string $documentType, string $filePath, array $options = []): array
    {
        return [
            'status' => 'verified',
            'document_type' => $documentType,
            'masked_number' => 'XXXXXXXX1234',
            'mock' => true,
        ];
    }

    public function performBiometricCheck(array $data): array
    {
        return [
            'status' => 'passed',
            'liveness' => 0.97,
            'mock' => true,
        ];
    }
}
