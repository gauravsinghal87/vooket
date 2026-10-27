<?php

namespace App\Infrastructure\Providers\Kyc;

use App\Infrastructure\Interfaces\FaceVerificationProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;

class MockFaceVerificationProvider extends AbstractIntegrationProvider implements FaceVerificationProviderInterface
{
    public function verify(string $selfiePath, ?string $referencePath = null): array
    {
        return [
            'verified' => $selfiePath !== '',
            'match_score' => 0.91,
            'mock' => true,
        ];
    }
}
