<?php

namespace App\Exceptions;

use App\Models\Zone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Raised when Food/Grocery delivery cannot be priced because the destination
 * zone has no complete, active delivery configuration.
 *
 * Delivery pricing is mandatory per zone. Global app settings are never a
 * silent fallback for a deployment that has active service zones, so this
 * exception is the single, actionable failure surfaced to the customer.
 */
class DeliveryConfigurationException extends RuntimeException
{
    public static function missingForZone(?Zone $zone): self
    {
        $area = $zone?->name ? " ({$zone->name})" : '';

        return new self(
            "Delivery pricing is not configured for this area{$area} yet. Please contact support."
        );
    }

    public static function outsideServiceZone(): self
    {
        return new self(
            'Delivery is not available for this address. Please choose another delivery address.'
        );
    }

    public static function addressRequired(): self
    {
        return new self(
            'Select a delivery address so we can calculate the delivery charges.'
        );
    }

    public static function quoteChanged(): self
    {
        return new self(
            'Delivery charges changed since your cart was updated. Please refresh your cart and try again.'
        );
    }

    /**
     * Standard API error envelope, so the customer web/app receives the same
     * shape as every other validation/service error.
     */
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->getMessage(),
            'errors' => null,
        ], 422);
    }
}
