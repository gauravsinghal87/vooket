<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when an order has not yet satisfied the delivery-completion gate
 * (payment collected and/or customer delivery OTP verified) for food orders.
 */
class DeliveryGateException extends RuntimeException
{
    //
}
