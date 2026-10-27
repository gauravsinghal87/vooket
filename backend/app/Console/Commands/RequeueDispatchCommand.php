<?php

namespace App\Console\Commands;

use App\Models\DispatchLog;
use App\Models\Order;
use App\Services\Dispatch\OrderDispatchService;
use Illuminate\Console\Command;

/**
 * Re-attempt delivery dispatch for unassigned orders that exhausted their
 * offer queue (every candidate rejected or expired without anyone accepting).
 *
 * Runs on a schedule; orders with a fresh dispatch attempt within the retry
 * interval are skipped so the command never churns a live offer chain.
 */
class RequeueDispatchCommand extends Command
{
    protected $signature = 'dispatch:requeue';

    protected $description = 'Re-attempt delivery dispatch for unassigned orders with no active offers.';

    public function handle(OrderDispatchService $dispatch): int
    {
        $intervalSeconds = (int) config('dispatch.requeue_interval_seconds', 180);

        $orders = Order::query()
            ->whereNull('delivery_partner_id')
            // PACKED is dispatchable per OrderDispatchService's scheduled
            // gate, so it must be requeued too or it would gate through and
            // then never reach a partner.
            ->whereIn('status', ['PENDING', 'PACKED', 'READY', 'PLACED', 'CONFIRMED', 'PREPARING', 'ACCEPTED'])
            ->whereDoesntHave('dispatchLogs', fn ($query) => $query->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT]))
            ->get();

        $requeued = 0;

        foreach ($orders as $order) {
            $recentAttempt = DispatchLog::query()
                ->where('order_id', $order->id)
                ->where('created_at', '>=', now()->subSeconds($intervalSeconds))
                ->exists();

            if ($recentAttempt) {
                continue;
            }

            $freshOrder = $order->fresh() ?? $order;

            $dispatch->expirePendingOffers($freshOrder);

            $result = $dispatch->dispatchForOrder($freshOrder);

            if (in_array($result['status'] ?? '', ['offered', 'promoted'], true)) {
                $requeued++;
            }
        }

        $this->info("Requeued {$requeued} order(s).");

        return self::SUCCESS;
    }
}
