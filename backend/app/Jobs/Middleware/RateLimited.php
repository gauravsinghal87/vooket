<?php

namespace App\Jobs\Middleware;

use Illuminate\Support\Facades\Redis;

/**
 * Global safe-outbound queue limiter. When Redis is unavailable (local dev
 * without Redis) the job runs immediately so providers degrade gracefully.
 */
class RateLimited
{
    public function handle($job, $next)
    {
        if (! method_exists($job, 'getRateKey')) {
            return $next($job);
        }

        try {
            $attempts = (int) ($job->getRateAttempts() ?? 30);

            return Redis::throttle($job->getRateKey())
                ->allow($attempts)
                ->every(60)
                ->then(
                    fn () => $next($job),
                    fn () => $job->release(10)
                );
        } catch (\Throwable $e) {
            return $next($job);
        }
    }
}
