<?php

namespace App\Infrastructure\Providers\Payments;

use App\Infrastructure\Interfaces\SettlementProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Str;

class MockSettlementProvider extends AbstractIntegrationProvider implements SettlementProviderInterface
{
    public function createPayout(array $data): array
    {
        return [
            'payout_id' => 'payout_'.Str::random(16),
            'status' => 'initiated',
            'amount' => $data['amount'] ?? 0,
            'currency' => $data['currency'] ?? 'INR',
            'mock' => true,
        ];
    }

    public function isAmountManagedByGateway(): bool
    {
        return false;
    }
}
