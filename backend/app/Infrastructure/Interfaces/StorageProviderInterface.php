<?php

namespace App\Infrastructure\Interfaces;

interface StorageProviderInterface
{
    public function upload(string $path, $file, array $options = []): string;

    public function uploadFromPath(string $path, string $sourcePath, array $options = []): string;

    public function delete(string $path): bool;

    public function getUrl(string $path): string;

    public function getSignedUrl(string $path, int $expiresIn = 3600): string;
}
