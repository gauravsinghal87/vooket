<?php

namespace Tests\Unit;

use App\Support\Money;
use InvalidArgumentException;
use Tests\TestCase;

class MoneyTest extends TestCase
{
    public function test_paise_and_major_round_trip(): void
    {
        $this->assertSame('249.50', Money::fromMajor('249.50')->major());
        $this->assertSame(24950, Money::fromMajor('249.50')->paise());
        $this->assertSame('249.50', Money::fromPaise(24950)->major());
    }

    public function test_fraction_rounding_is_half_up(): void
    {
        $this->assertSame(156, Money::fromMajor('1.559')->paise());
        $this->assertSame(155, Money::fromMajor('1.554')->paise());
    }

    public function test_integer_major_input(): void
    {
        $this->assertSame(1000, Money::fromMajor(10)->paise());
        $this->assertSame('10.00', Money::fromMajor(10)->major());
    }

    public function test_float_input_avoids_binary_rounding(): void
    {
        $this->assertSame(109, Money::fromMajor(1.09)->paise());
        $this->assertSame('108.90', Money::fromMajor(108.9)->major());
    }

    public function test_rejects_non_numeric_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Money::fromMajor('abc');
    }

    public function test_arithmetic_is_exact_integer_math(): void
    {
        $a = Money::fromMajor('19.99');

        $this->assertSame('39.98', $a->add($a)->major());
        $this->assertSame('0.00', $a->sub($a)->major());
        $this->assertSame('39.98', Money::fromMajor('19.99')->multiply(2)->major());
    }

    public function test_percent_rounds_half_up_per_paise(): void
    {
        $this->assertSame(1250, Money::fromMajor('100.00')->percent('12.5')->paise());
        $this->assertSame('0.13', Money::fromMajor('1.00')->percent('12.5')->major());
        $this->assertSame(0, Money::fromMajor('1.00')->percent('0')->paise());
    }

    public function test_comparison_and_sign_checks(): void
    {
        $this->assertTrue(Money::fromMajor('5.00')->compareTo(Money::fromMajor('3.50')) > 0);
        $this->assertTrue(Money::fromPaise(50)->equals(Money::fromMajor('0.50')));
        $this->assertTrue(Money::zero()->isZero());
        $this->assertFalse(Money::zero()->isPositive());
        $this->assertTrue(Money::fromMajor('-2.00')->isNegative());
        $this->assertSame('2.00', Money::fromMajor('-2.00')->negate()->major());
    }
}
