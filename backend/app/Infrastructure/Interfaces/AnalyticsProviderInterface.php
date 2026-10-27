<?php

namespace App\Infrastructure\Interfaces;

interface AnalyticsProviderInterface
{
    /**
     * Track an event (fire and forget).
     */
    public function capture(string $event, array $properties = [], ?string $distinctId = null): bool;
}
