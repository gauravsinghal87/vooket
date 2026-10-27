<?php

namespace App\Infrastructure\Providers\Analytics;

use App\Infrastructure\Interfaces\AnalyticsProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;

class NullAnalyticsProvider extends AbstractIntegrationProvider implements AnalyticsProviderInterface
{
    public function capture(string $event, array $properties = [], ?string $distinctId = null): bool
    {
        return true;
    }
}
