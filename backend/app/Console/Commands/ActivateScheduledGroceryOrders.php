<?php

namespace App\Console\Commands;

use App\Services\DeliverySlotService;
use Illuminate\Console\Command;

/**
 * Moves grocery orders whose scheduled delivery slot has started into the
 * normal PENDING flow, where the vendor picks them up like any other order.
 *
 * Until this runs a scheduled order is inert: no vendor status change is
 * accepted on it and no delivery offer is created for it.
 */
class ActivateScheduledGroceryOrders extends Command
{
    protected $signature = 'grocery:activate-scheduled-orders {--limit=200 : Maximum orders to activate per run}';

    protected $description = 'Activate grocery orders whose scheduled delivery slot has started.';

    public function handle(DeliverySlotService $deliverySlotService): int
    {
        $activated = $deliverySlotService->activateDueOrders((int) $this->option('limit'));

        $this->info("Activated {$activated} scheduled grocery order(s).");

        return self::SUCCESS;
    }
}
