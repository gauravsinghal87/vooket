<?php

namespace App\Infrastructure\Providers\Ai;

use App\Infrastructure\Interfaces\AiProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Http;

class GeminiAiProvider extends AbstractIntegrationProvider implements AiProviderInterface, TestableProvider
{
    protected string $baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    protected function model(): string
    {
        return (string) ($this->opt('model') ?: 'gemini-1.5-flash');
    }

    public function generateText(string $prompt, array $options = []): string
    {
        $res = Http::connectTimeout(10)->timeout(60)->asJson()->post(
            "{$this->baseUrl}/models/{$this->model()}:generateContent",
            [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => array_filter([
                    'temperature' => $options['temperature'] ?? null,
                    'maxOutputTokens' => $options['max_tokens'] ?? null,
                ]),
            ],
            ['key' => $this->cred('api_key')]
        );

        $res->throw();

        $json = $res->json();
        $candidates = $json['candidates'] ?? [];

        if (! $candidates) {
            throw new \RuntimeException('Gemini returned no candidates.');
        }

        $text = collect($candidates[0]['content']['parts'] ?? [])
            ->pluck('text')
            ->implode('');

        return trim((string) $text);
    }

    public function generateRecommendations(array $context): array
    {
        $prompt = 'Recommend items (id, name, score) matching context: '.json_encode($context);

        return ['recommendations' => [$this->generateText($prompt)]];
    }

    public function generateEmbeddings(string $text): array
    {
        throw new \BadMethodCallException('Embeddings are not exposed by the configured Gemini model.');
    }

    public function analyzeIntent(string $userMessage): array
    {
        return [
            'intent' => 'conversation',
            'confidence' => 0.0,
            'response' => $this->generateText($userMessage),
        ];
    }

    public function testConnection(): array
    {
        try {
            $res = Http::connectTimeout(10)->timeout(30)->get(
                "{$this->baseUrl}/models",
                ['key' => $this->cred('api_key')]
            );

            return ['success' => $res->successful(), 'message' => $res->successful() ? 'Gemini reachable.' : 'Gemini API error.'];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
