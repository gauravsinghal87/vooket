<?php

namespace App\Infrastructure\Interfaces;

interface FaceVerificationProviderInterface
{
    /**
     * Compare a live selfie against a reference document photo.
     *
     * @return array{verified: bool, match_score?: float, error?: string}
     */
    public function verify(string $selfiePath, ?string $referencePath = null): array;
}
