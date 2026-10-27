<?php

namespace App\Exceptions;

use Exception;

class InvalidOrderTransitionException extends Exception
{
    public function __construct(
        string $message,
        public ?string $currentStatus = null,
        public ?string $targetStatus = null,
        public ?int $orderId = null,
    ) {
        parent::__construct($message, 422);
    }
}
