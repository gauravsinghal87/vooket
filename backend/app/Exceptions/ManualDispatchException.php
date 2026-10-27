<?php

namespace App\Exceptions;

use Exception;

/**
 * A vendor-manual dispatch request could not be completed — the order is not
 * manual-eligible, is already assigned, or the chosen partner is not eligible.
 */
class ManualDispatchException extends Exception
{
    public function __construct(string $message, public string $errorCode)
    {
        parent::__construct($message, 422);
    }
}
