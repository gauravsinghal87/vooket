<?php

namespace App\Services;

/**
 * Authoritative ride fare calculation. Both the customer estimate flow
 * (RideService) and the admin "Fare Preview" calculator run through this
 * single formula so pricing is never recomputed on a frontend client.
 */
class FareCalculationService
{
    /**
     * Compute the fare breakdown for the given fare-rule attributes.
     *
     * @param  array<string, mixed>  $rule  fare rule attributes (schema column names)
     * @return array{base_fare: float, distance_charge: float, time_charge: float, booking_fee: float, platform_fee: float, tax_amount: float, subtotal: float, estimated_fare: float}
     */
    public function calculate(array $rule, float $distanceKm, int $durationMin): array
    {
        $baseFare = (float) ($rule['base_fare'] ?? 0);
        $distanceCharge = round($distanceKm * (float) ($rule['per_km'] ?? 0), 2);
        $timeCharge = round($durationMin * (float) ($rule['per_minute'] ?? 0), 2);
        $bookingFee = (float) ($rule['booking_fee'] ?? 0);
        $platformFee = (float) ($rule['platform_fee'] ?? 0);

        $subtotal = $baseFare + $distanceCharge + $timeCharge + $bookingFee + $platformFee;
        $tax = round($subtotal * (float) ($rule['tax_rate'] ?? 0) / 100, 2);
        $estimatedFare = round($subtotal + $tax, 2);
        $estimatedFare = max($estimatedFare, (float) ($rule['minimum_fare'] ?? 0));

        return [
            'base_fare' => $baseFare,
            'distance_charge' => $distanceCharge,
            'time_charge' => $timeCharge,
            'booking_fee' => $bookingFee,
            'platform_fee' => $platformFee,
            'tax_amount' => $tax,
            'subtotal' => round($subtotal, 2),
            'estimated_fare' => round($estimatedFare, 2),
        ];
    }
}
