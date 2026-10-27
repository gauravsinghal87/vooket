<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\AiProviderInterface;
use Illuminate\Support\Facades\Log;

class LogAiProvider implements AiProviderInterface
{
    public function generateText(string $prompt, array $options = []): string
    {
        Log::info('[AI] generateText', ['prompt' => $prompt]);

        return 'Example response generated for: '.Str::limit($prompt, 100);
    }

    public function generateRecommendations(array $context): array
    {
        Log::info('[AI] generateRecommendations', $context);

        return [];
    }

    public function generateEmbeddings(string $text): array
    {
        return array_fill(0, 128, 0);
    }

    public function analyzeIntent(string $userMessage): array
    {
        Log::info('[AI] analyzeIntent', ['message' => $userMessage]);

        return [
            'intent' => 'order_status',
            'confidence' => 0.9,
            'response' => 'I can help you with that.',
        ];
    }
}
