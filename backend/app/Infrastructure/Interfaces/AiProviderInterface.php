<?php

namespace App\Infrastructure\Interfaces;

interface AiProviderInterface
{
    public function generateText(string $prompt, array $options = []): string;

    public function generateRecommendations(array $context): array;

    public function generateEmbeddings(string $text): array;

    public function analyzeIntent(string $userMessage): array;
}
