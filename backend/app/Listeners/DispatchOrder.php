<?php

namespace App\Listeners;

use App\Events\OrderReady;
use App\Services\Dispatch\OrderDispatchService;

/**
 * Runs the delivery dispatch flow synchronously when an order becomes READY.
 *
 * Dispatch only touches the database and is fast, so it is kept synchronous
 * to guarantee offers are created for the vendor response (no queue worker
 * is guaranteed to be running). Failures never bubble up and block the
 * vendor status update.
 */
class DispatchOrder
{
    public function handle(OrderReady $event): void
    {
        try {
            app(OrderDispatchService::class)->dispatchForOrder($event->order);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
