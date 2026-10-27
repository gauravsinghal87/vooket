<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->registerSqliteMathFunctions();
    }

    /**
     * The MySQL-targeted Haversine SQL (ASIN/SQRT/POWER/SIN/RADIANS/COS) has no
     * equivalent in SQLite, so the geo/serviceability queries would fatal with
     * "no such function" on the in-memory test database. Expose the PHP math
     * functions to SQLite for the duration of the connection.
     */
    private function registerSqliteMathFunctions(): void
    {
        $connection = DB::connection();

        if ($connection->getDriverName() !== 'sqlite') {
            return;
        }

        $pdo = $connection->getPdo();
        $pdo->sqliteCreateFunction('radians', fn (float $degrees): float => deg2rad($degrees), 1);
        $pdo->sqliteCreateFunction('sin', fn (float $radians): float => sin($radians), 1);
        $pdo->sqliteCreateFunction('cos', fn (float $radians): float => cos($radians), 1);
        $pdo->sqliteCreateFunction('asin', fn (float $value): float => asin($value), 1);
        $pdo->sqliteCreateFunction('sqrt', fn (float $value): float => sqrt($value), 1);
        $pdo->sqliteCreateFunction('power', fn (float $base, float $exponent): float => $base ** $exponent, 2);
    }
}
