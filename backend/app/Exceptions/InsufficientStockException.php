<?php

namespace App\Exceptions;

use Exception;

class InsufficientStockException extends Exception
{
    public function __construct(
        string $message,
        public array $unavailable = [],
        public ?int $orderId = null,
    ) {
        parent::__construct($message, 422);
    }

    /**
     * Details of the requested-but-unavailable stock lines.
     *
     * @return list<array{product_id: int, product_name: string|null, requested: int, available: int}>
     */
    public function unavailableItems(): array
    {
        return $this->unavailable;
    }
}
