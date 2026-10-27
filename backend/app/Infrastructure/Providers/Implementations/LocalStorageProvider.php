<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\StorageProviderInterface;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LocalStorageProvider implements StorageProviderInterface
{
    public function upload(string $path, $file, array $options = []): string
    {
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        $fullPath = rtrim($path, '/').'/'.$filename;
        Storage::disk('local')->put($fullPath, file_get_contents($file));

        return $fullPath;
    }

    public function uploadFromPath(string $path, string $sourcePath, array $options = []): string
    {
        $filename = Str::uuid().'.'.pathinfo($sourcePath, PATHINFO_EXTENSION);
        $fullPath = rtrim($path, '/').'/'.$filename;
        Storage::disk('local')->put($fullPath, file_get_contents($sourcePath));

        return $fullPath;
    }

    public function delete(string $path): bool
    {
        return Storage::disk('local')->delete($path);
    }

    public function getUrl(string $path): string
    {
        return Storage::disk('local')->url($path);
    }

    public function getSignedUrl(string $path, int $expiresIn = 3600): string
    {
        return Storage::disk('local')->temporaryUrl($path, now()->addSeconds($expiresIn));
    }
}
