<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\KycProviderInterface;
use Illuminate\Support\Facades\Log;

class HyperVergeKycProvider implements KycProviderInterface
{
    public function startVerification(array $data, array $documentFiles = []): array
    {
        Log::info('[KYC] startVerification', $data);

        return ['verification_id' => 'kv_'.uniqid(), 'status' => 'initiated'];
    }

    public function getVerificationStatus(string $verificationId): array
    {
        Log::info('[KYC] status', ['id' => $verificationId]);

        return ['verification_id' => $verificationId, 'status' => 'verified'];
    }

    public function verifyDocument(string $documentType, string $filePath, array $options = []): array
    {
        Log::info('[KYC] verifyDocument', ['type' => $documentType, 'file' => $filePath]);

        return ['status' => 'verified', 'document_number' => 'XXXX1234'];
    }

    public function performBiometricCheck(array $data): array
    {
        Log::info('[KYC] biometricCheck', $data);

        return ['status' => 'passed', 'liveness' => 0.95];
    }
}
