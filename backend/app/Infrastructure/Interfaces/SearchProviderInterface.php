<?php

namespace App\Infrastructure\Interfaces;

interface SearchProviderInterface
{
    public function search(string $query, array $options = []): array;

    public function index(string $model, array $data): bool;

    public function updateIndex(string $model, string $id, array $data): bool;

    public function deleteIndex(string $model, string $id): bool;

    public function reindex(string $model): bool;
}
