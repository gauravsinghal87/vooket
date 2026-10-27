<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when a password reset cannot be delivered because the mail transport
 * is not available. The message is intentionally identical for "SMTP disabled"
 * and "SMTP unreachable" so it cannot be used to probe the configuration.
 */
class PasswordResetUnavailableException extends RuntimeException
{
    public const MESSAGE = 'Password reset email service is currently unavailable. Please try again later.';

    public static function make(): self
    {
        return new self(self::MESSAGE);
    }
}
