<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when a grocery delivery slot cannot be published or booked: the slot
 * is disabled, full, in the past, owned by another store/vendor, or would drop
 * capacity below the orders already booked against it.
 *
 * Carries an HTTP-friendly reason so controllers can answer 422 without
 * leaking internals.
 */
class DeliverySlotException extends RuntimeException
{
    public function __construct(string $message, private readonly string $reason = 'slot_unavailable')
    {
        parent::__construct($message);
    }

    public function reason(): string
    {
        return $this->reason;
    }
}
