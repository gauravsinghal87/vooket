<?php

namespace App\Exceptions;

use App\Support\Money;

/**
 * Raised when a delivery partner or ride driver payout would take the wallet
 * below the admin-configured `partner_min_wallet_balance` floor.
 *
 * This is a floor on the REMAINING balance, not a minimum on the request: a
 * small payout is valid as long as the balance stays above the floor afterwards.
 */
class PartnerWalletBalanceException extends \RuntimeException
{
    public static function balanceNotAboveMinimum(Money $minimum): self
    {
        return new self(sprintf(
            'Minimum wallet balance of %s must remain after payout. No payout amount is currently available.',
            self::format($minimum)
        ));
    }

    public static function exceedsMaximum(Money $maximum, Money $minimum): self
    {
        return new self(sprintf(
            'Maximum payout available is %s because %s must remain in your wallet.',
            self::format($maximum),
            self::format($minimum)
        ));
    }

    private static function format(Money $amount): string
    {
        return '₹'.number_format((float) $amount->major(), 2);
    }
}
