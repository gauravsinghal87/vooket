<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Immutable money value that stores amounts as integer paise (minor units)
 * so that all financial arithmetic is exact integer math. Never use floats.
 */
final class Money
{
    private function __construct(private int $paise) {}

    public static function zero(): self
    {
        return new self(0);
    }

    public static function fromPaise(int $paise): self
    {
        return new self($paise);
    }

    /**
     * Build a Money from a major-unit amount (e.g. "249.50" rupees).
     *
     * Accepts a decimal string or numeric literal. Float inputs are converted
     * through a string representation to avoid binary float rounding.
     */
    public static function fromMajor(mixed $amount): self
    {
        if ($amount instanceof self) {
            return $amount;
        }

        if (is_int($amount)) {
            return new self($amount * 100);
        }

        if (is_float($amount)) {
            return new self(self::parseString((string) $amount));
        }

        if (is_string($amount) && trim($amount) !== '') {
            return new self(self::parseString($amount));
        }

        throw new InvalidArgumentException('Invalid money amount: '.var_export($amount, true));
    }

    /**
     * Number of minor units (paise).
     */
    public function paise(): int
    {
        return $this->paise;
    }

    /**
     * Major-unit value formatted to exactly two decimal places (e.g. "249.50").
     */
    public function major(): string
    {
        $sign = $this->paise < 0 ? '-' : '';
        $abs = abs($this->paise);

        return $sign.intdiv($abs, 100).'.'.str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT);
    }

    public function __toString(): string
    {
        return $this->major();
    }

    public function add(self $other): self
    {
        return new self($this->paise + $other->paise);
    }

    public function sub(self $other): self
    {
        return new self($this->paise - $other->paise);
    }

    /**
     * Multiply by an integer factor exactly.
     */
    public function multiply(int $factor): self
    {
        return new self($this->paise * $factor);
    }

    /**
     * Apply a percentage rate (e.g. 12.5 for 12.5%) using exact integer math.
     * The result is rounded half-up to the nearest paise.
     */
    public function percent(string $rate): self
    {
        $basisPoints = self::parseBasisPoints($rate);
        $scaled = $this->paise * $basisPoints;
        $result = intdiv($scaled, 10000);
        $remainder = $scaled % 10000;

        if ($remainder !== 0 && abs($remainder * 2) >= 10000) {
            $result += (($scaled < 0) === false) ? 1 : -1;
        }

        return new self($result);
    }

    public function compareTo(self $other): int
    {
        return $this->paise <=> $other->paise;
    }

    public function equals(self $other): bool
    {
        return $this->paise === $other->paise;
    }

    public function isPositive(): bool
    {
        return $this->paise > 0;
    }

    public function isNegative(): bool
    {
        return $this->paise < 0;
    }

    public function isZero(): bool
    {
        return $this->paise === 0;
    }

    public function negate(): self
    {
        return new self(-$this->paise);
    }

    private static function parseString(string $raw): int
    {
        $raw = trim($raw);

        if (! is_numeric($raw)) {
            throw new InvalidArgumentException('Invalid money amount: '.var_export($raw, true));
        }

        $negative = str_starts_with($raw, '-');
        $raw = ltrim($raw, '+-');

        if (! str_contains($raw, '.')) {
            $raw .= '.00';
        }

        [$major, $fraction] = explode('.', $raw, 2);
        $majorValue = $major === '' ? 0 : (int) $major;
        $roundDigit = (int) ($fraction[2] ?? '0');
        $fraction = str_pad(substr($fraction, 0, 2), 2, '0');
        $paise = $majorValue * 100 + (int) ($fraction[0] ?? '0') * 10 + (int) ($fraction[1] ?? '0');

        if ($roundDigit >= 5) {
            $paise++;
        }

        return $negative ? -$paise : $paise;
    }

    /**
     * Parse a percentage value into integer basis points (rate * 100),
     * e.g. "6.5" => 650.
     */
    private static function parseBasisPoints(string $rate): int
    {
        $rate = trim($rate);

        if (! is_numeric($rate)) {
            throw new InvalidArgumentException('Invalid percentage rate: '.var_export($rate, true));
        }

        $negative = str_starts_with($rate, '-');
        $rate = ltrim($rate, '+-');
        [$major, $fraction] = array_pad(explode('.', $rate, 2), 2, '');
        $fraction = str_pad(substr($fraction, 0, 4), 4, '0');
        $rateScaled = ($major === '' ? 0 : (int) $major) * 10000
            + (int) $fraction[0] * 1000 + (int) $fraction[1] * 100
            + (int) $fraction[2] * 10 + (int) $fraction[3];
        $basisPoints = intdiv($rateScaled, 100);

        return $negative ? -$basisPoints : $basisPoints;
    }
}
