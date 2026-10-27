<?php

namespace App\Services\Integration;

class SecretMasker
{
    /**
     * Mask a secret for safe display, e.g.:
     *   rzp_live_AbCdEfGhIjK1  =>  rzp_l********K1
     *   empty string            =>  null (not configured)
     */
    public static function mask(?string $value, int $tail = 4, int $head = 4): ?string
    {
        if ($value === null || trim($value) === '' || $value === '****') {
            return null;
        }

        $value = trim($value);
        if (strlen($value) <= $head + $tail) {
            return str_repeat('*', 8);
        }

        return substr($value, 0, $head).str_repeat('*', 8).substr($value, -$tail);
    }

    /**
     * True when the submitted value is the "keep current secret" placeholder.
     */
    public static function isPlaceholder(?string $value): bool
    {
        return $value === null || trim((string) $value) === '' || $value === '****';
    }
}
