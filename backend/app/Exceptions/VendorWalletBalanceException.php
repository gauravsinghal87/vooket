<?php

namespace App\Exceptions;

use App\Support\Money;
use RuntimeException;

/**
 * Raised when a Food/Grocery vendor payout would leave the wallet below the
 * admin-controlled minimum remaining balance, or when the wallet has not yet
 * grown past that balance so no request could ever succeed.
 *
 * This is deliberately NOT a minimum request amount: a request well under the
 * floor is fine as long as the balance left behind still meets it.
 */
class VendorWalletBalanceException extends RuntimeException
{
    public function __construct(
        public readonly Money $minimumBalance,
        public readonly Money $maximumPayout,
        string $message,
    ) {
        parent::__construct($message, 422);
    }

    /**
     * The wallet holds the floor or less, so withdrawing anything would breach it.
     */
    public static function balanceNotAboveMinimum(Money $minimumBalance, Money $walletBalance): self
    {
        return new self(
            $minimumBalance,
            Money::zero(),
            'Wallet balance must be more than the minimum vendor wallet balance of ₹'.self::render($minimumBalance).'.'
        );
    }

    /**
     * The wallet clears the floor, but the request is larger than the headroom
     * above it.
     */
    public static function exceedsMaximum(Money $minimumBalance, Money $maximumPayout): self
    {
        return new self(
            $minimumBalance,
            $maximumPayout,
            'Maximum payout amount is ₹'.self::render($maximumPayout).'.'
        );
    }

    /**
     * Render an amount the way an operator typed it. `Money::major()` always
     * returns two decimals, which would read as "₹500.00" for a whole-rupee
     * amount, so the fraction is dropped only when it is exactly zero.
     */
    private static function render(Money $amount): string
    {
        $major = $amount->major();

        return str_ends_with($major, '.00') ? substr($major, 0, -3) : $major;
    }
}
