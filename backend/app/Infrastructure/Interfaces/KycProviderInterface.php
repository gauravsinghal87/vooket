<?php

namespace App\Infrastructure\Interfaces;

interface KycProviderInterface
{
    public function startVerification(array $data, array $documentFiles = []): array;

    public function getVerificationStatus(string $verificationId): array;

    public function verifyDocument(string $documentType, string $filePath, array $options = []): array;

    public function performBiometricCheck(array $data): array;
}
