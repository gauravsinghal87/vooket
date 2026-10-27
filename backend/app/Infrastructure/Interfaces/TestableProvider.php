<?php

namespace App\Infrastructure\Interfaces;

interface TestableProvider
{
    /**
     * Perform a SAFE connection test. Must never create real charges,
     * settlements, SMS messages or any customer-facing side effects.
     */
    public function testConnection(): array;
}
