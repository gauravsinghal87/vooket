<?php

namespace App\Infrastructure\Providers\Media;

use App\Infrastructure\Interfaces\StorageProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Http;

/**
 * Cloudinary upload provider using the signed upload API.
 */
class CloudinaryStorageProvider extends AbstractIntegrationProvider implements StorageProviderInterface, TestableProvider
{
    protected function cloud(): string
    {
        return (string) $this->cred('cloud_name');
    }

    public function upload(string $path, $file, array $options = []): string
    {
        $timestamp = time();
        $params = [
            'timestamp' => $timestamp,
            'folder' => rtrim((string) $this->opt('default_folder', 'superapp'), '/').'/'.trim($path, '/'),
            'use_filename' => true,
            'unique_filename' => true,
        ];

        $signature = $this->signature($params);

        $res = Http::connectTimeout(10)->timeout(60)
            ->attach('file', is_string($file) ? $file : (string) file_get_contents($file->getRealPath()), $file instanceof \SplFileInfo ? $file->getFilename() : 'upload')
            ->post("https://api.cloudinary.com/v1_1/{$this->cloud()}/image/upload", [
                'api_key' => $this->cred('api_key'),
                'timestamp' => $timestamp,
                'folder' => $params['folder'],
                'signature' => $signature,
            ]);

        $res->throw();

        return (string) ($res->json()['public_id'] ?? '');
    }

    public function uploadFromPath(string $path, string $sourcePath, array $options = []): string
    {
        return $this->upload($path, new \SplFileInfo($sourcePath), $options);
    }

    public function delete(string $path): bool
    {
        $timestamp = time();
        $params = ['timestamp' => $timestamp, 'public_id' => $path];
        $res = Http::connectTimeout(10)->timeout(30)->post(
            "https://api.cloudinary.com/v1_1/{$this->cloud()}/image/destroy",
            array_merge($params, ['api_key' => $this->cred('api_key'), 'signature' => $this->signature($params)])
        );

        return $res->successful() && ($res->json()['result'] ?? null) === 'ok';
    }

    public function getUrl(string $path): string
    {
        $secure = (bool) ($this->opt('secure', true) ?? true);

        return ($secure ? 'https://res.cloudinary.com' : 'http://res.cloudinary.com')
            ."/{$this->cloud()}/image/upload/{$path}";
    }

    public function getSignedUrl(string $path, int $expiresIn = 3600): string
    {
        $timestamp = time();
        $expires = $timestamp + $expiresIn;
        $params = ['timestamp' => $timestamp, 'public_id' => $path, 'expires_at' => $expires];

        return $this->getUrl($path).'?'.http_build_query([
            'expires_at' => $expires,
            'signature' => $this->signature($params),
        ]);
    }

    protected function signature(array $params): string
    {
        ksort($params);
        $string = http_build_query($params).$this->cred('api_secret');

        return hash('sha1', $string);
    }

    public function testConnection(): array
    {
        $res = Http::connectTimeout(10)->timeout(30)->get("https://res.cloudinary.com/{$this->cloud()}/image/list");

        return ['success' => $res->successful(), 'message' => $res->successful() ? "Cloudinary cloud {$this->cloud()} reachable." : 'Cloudinary error.'];
    }
}
