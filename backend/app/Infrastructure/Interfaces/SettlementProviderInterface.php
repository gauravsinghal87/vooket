<?php

namespace App\Infrastructure\Interfaces;

interface SettlementProviderInterface
{
    /**
     * Create a payout from an available balance (must never run in test env).
     */
    public function createPayout(array $data): array;

    /**
     * Whether settlement handling is delegated to the gateway's route mechanism.
     */
    public function isAmountManagedByGateway(): bool;
}
