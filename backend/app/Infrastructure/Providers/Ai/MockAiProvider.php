<?php

namespace App\Infrastructure\Providers\Ai;

use App\Infrastructure\Interfaces\AiProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;

class MockAiProvider extends AbstractIntegrationProvider implements AiProviderInterface
{
    public function generateText(string $prompt, array $options = []): string
    {
        return 'Mock response for: '.mb_substr($prompt, 0, 120);
    }

    public function generateRecommendations(array $context): array
    {
        return [
            'recommendations' => array_slice(array_keys($context), 0, 3),
            'mock' => true,
        ];
    }

    public function generateEmbeddings(string $text): array
    {
        return array_fill(0, 128, 0);
    }

    public function analyzeIntent(string $userMessage): array
    {
        return [
            'intent' => 'general',
            'confidence' => 1.0,
            'response' => 'Mock analysis for: '.mb_substr($userMessage, 0, 120),
        ];
    }
}
