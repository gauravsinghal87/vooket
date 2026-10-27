<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Inventory;
use App\Models\InventoryReservation;
use App\Models\InventoryTransaction;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Durable, row-locked inventory lifecycle.
 *
 * Every inventory row is locked (SELECT ... FOR UPDATE) before its
 * availability is read or mutated, reservation rows are keyed by a DB
 * unique constraint (order_id, inventory_id) so an order can only ever be
 * reserved once per inventory line, and state is advanced only through an
 * explicit lifecycle (reserved -> sold | released) that is validated under
 * the lock. All stock math is integer-based.
 */
class InventoryService
{
    public function reserveForOrder(Order $order, ?int $userId = null): void
    {
        DB::transaction(function () use ($order, $userId) {
            $inventoryIds = $this->involvedInventoryIds($order)->unique()->values()->all();
            $locked = $this->lockInventoriesInOrder($inventoryIds);

            $grouped = [];

            foreach ($order->items as $item) {
                $inventory = $locked->get($this->inventoryKey($item->product_id, $item->product_variant_id));

                if (! $inventory || ! $inventory->track_inventory) {
                    continue;
                }

                $key = $this->inventoryKey($item->product_id, $item->product_variant_id);

                $grouped[$key] ??= ['inventory' => $inventory, 'first_item_id' => $item->id, 'qty' => 0];
                $grouped[$key]['first_item_id'] ??= $item->id;
                $grouped[$key]['qty'] += $item->quantity;
            }

            $unavailable = [];

            foreach ($grouped as $entry) {
                $inventory = $entry['inventory'];

                if ($inventory->reserved_quantity + $entry['qty'] > $inventory->quantity) {
                    $unavailable[] = [
                        'product_id' => $inventory->product_id,
                        'product_name' => $inventory->product?->name,
                        'requested' => $entry['qty'],
                        'available' => max(0, $inventory->quantity - $inventory->reserved_quantity),
                    ];
                }
            }

            if ($unavailable !== []) {
                throw new InsufficientStockException(
                    'One or more items are out of stock',
                    $unavailable
                );
            }

            foreach ($grouped as $key => $entry) {
                $inventory = $entry['inventory'];

                InventoryReservation::create([
                    'order_id' => $order->id,
                    'order_item_id' => $entry['first_item_id'],
                    'inventory_id' => $inventory->id,
                    'product_id' => $inventory->product_id,
                    'quantity' => $entry['qty'],
                    'state' => 'reserved',
                    'notes' => "Reserved for order #{$order->order_number}",
                ]);

                $inventory->update([
                    'reserved_quantity' => $inventory->reserved_quantity + $entry['qty'],
                ]);

                InventoryTransaction::create([
                    'inventory_id' => $inventory->id,
                    'product_id' => $inventory->product_id,
                    'type' => 'reservation',
                    'quantity_change' => $entry['qty'],
                    'quantity_after' => $inventory->fresh()->reserved_quantity,
                    'reference_type' => Order::class,
                    'reference_id' => $order->id,
                    'notes' => "Reserved for order #{$order->order_number}",
                    'created_by' => $userId,
                ]);
            }
        });
    }

    /**
     * Commit a completed delivery: reserved stock becomes sold exactly once.
     * Idempotent — a fully-sold order is a no-op; re-entering after release
     * is rejected so released stock can never be double-sold.
     */
    public function completeSale(Order $order, ?int $userId = null): void
    {
        DB::transaction(function () use ($order, $userId) {
            $reservations = InventoryReservation::where('order_id', $order->id)
                ->lockForUpdate()
                ->orderBy('inventory_id')
                ->get();

            if ($reservations->isEmpty()) {
                return;
            }

            $touched = [];
            $toDeduct = [];

            foreach ($reservations as $reservation) {
                if ($reservation->state === 'sold') {
                    continue;
                }

                if ($reservation->state === 'released') {
                    throw new RuntimeException('Cannot complete sale: inventory was already released');
                }

                $touched[] = $reservation->inventory_id;
                $toDeduct[$reservation->inventory_id] = ($toDeduct[$reservation->inventory_id] ?? 0) + $reservation->quantity;
            }

            if ($toDeduct === []) {
                return;
            }

            $inventories = Inventory::whereIn('id', array_values(array_unique($touched)))
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($reservations as $reservation) {
                if ($reservation->state !== 'reserved') {
                    continue;
                }

                $inventory = $inventories->get($reservation->inventory_id);

                if (! $inventory) {
                    throw new RuntimeException('Inventory row missing for committed sale');
                }

                if ($inventory->quantity < $reservation->quantity || $inventory->reserved_quantity < $reservation->quantity) {
                    throw new RuntimeException('Inventory balance under the committed reservation');
                }

                $inventory->update([
                    'quantity' => $inventory->quantity - $reservation->quantity,
                    'reserved_quantity' => $inventory->reserved_quantity - $reservation->quantity,
                ]);

                $reservation->update(['state' => 'sold']);

                InventoryTransaction::create([
                    'inventory_id' => $inventory->id,
                    'product_id' => $reservation->product_id,
                    'type' => 'sale',
                    'quantity_change' => -$reservation->quantity,
                    'quantity_after' => $inventory->fresh()->quantity,
                    'reference_type' => Order::class,
                    'reference_id' => $order->id,
                    'notes' => "Sale for order #{$order->order_number}",
                    'created_by' => $userId,
                ]);
            }
        });
    }

    /**
     * Restore a cancelled order's reservation. Idempotent for an already
     * released order; a released-then-sold lifecycle is rejected.
     */
    public function releaseReservation(Order $order, ?int $userId = null): void
    {
        DB::transaction(function () use ($order, $userId) {
            $reservations = InventoryReservation::where('order_id', $order->id)
                ->lockForUpdate()
                ->orderBy('inventory_id')
                ->get();

            if ($reservations->isEmpty()) {
                return;
            }

            $inventories = Inventory::whereIn('id', $reservations->pluck('inventory_id')->unique()->all())
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($reservations as $reservation) {
                if ($reservation->state === 'released') {
                    continue;
                }

                if ($reservation->state === 'sold') {
                    throw new RuntimeException('Cannot release inventory for a sold reservation');
                }

                $inventory = $inventories->get($reservation->inventory_id);

                if (! $inventory) {
                    throw new RuntimeException('Inventory row missing for release');
                }

                if ($inventory->reserved_quantity < $reservation->quantity) {
                    throw new RuntimeException('Inventory reservation balance is inconsistent');
                }

                $inventory->update([
                    'reserved_quantity' => $inventory->reserved_quantity - $reservation->quantity,
                ]);

                $reservation->update(['state' => 'released']);

                InventoryTransaction::create([
                    'inventory_id' => $inventory->id,
                    'product_id' => $reservation->product_id,
                    'type' => 'release',
                    'quantity_change' => -$reservation->quantity,
                    'quantity_after' => $inventory->fresh()->reserved_quantity,
                    'reference_type' => Order::class,
                    'reference_id' => $order->id,
                    'notes' => "Released reservation for cancelled order #{$order->order_number}",
                    'created_by' => $userId,
                ]);
            }
        });
    }

    public function addStock(int $productId, int $quantity, ?string $notes = null, ?int $userId = null): Inventory
    {
        return DB::transaction(function () use ($productId, $quantity, $notes, $userId) {
            $inventory = Inventory::where('product_id', $productId)
                ->whereNull('product_variant_id')
                ->lockForUpdate()
                ->first() ?? Inventory::updateOrCreate(
                    ['product_id' => $productId, 'product_variant_id' => null],
                    ['vendor_id' => Product::find($productId)?->vendor_id, 'quantity' => 0, 'low_stock_threshold' => 10, 'track_inventory' => true]
                );

            $inventory->increment('quantity', $quantity);

            InventoryTransaction::create([
                'inventory_id' => $inventory->id,
                'product_id' => $productId,
                'type' => 'adjustment',
                'quantity_change' => $quantity,
                'quantity_after' => $inventory->fresh()->quantity,
                'notes' => $notes ?? "Manual stock addition of {$quantity}",
                'created_by' => $userId,
            ]);

            if ($inventory->fresh()->quantity <= 0) {
                Product::whereKey($productId)->update(['is_available' => false]);
            }

            return $inventory->fresh();
        });
    }

    public function deductStock(int $productId, int $quantity, ?string $notes = null, ?int $userId = null): Inventory
    {
        return DB::transaction(function () use ($productId, $quantity, $notes, $userId) {
            $inventory = Inventory::where('product_id', $productId)
                ->whereNull('product_variant_id')
                ->lockForUpdate()
                ->first();

            if (! $inventory) {
                throw new RuntimeException('Inventory not found for product');
            }

            if ($inventory->quantity < $quantity || $inventory->reserved_quantity > $inventory->quantity - $quantity) {
                throw new RuntimeException('Insufficient inventory to deduct');
            }

            $inventory->decrement('quantity', $quantity);

            InventoryTransaction::create([
                'inventory_id' => $inventory->id,
                'product_id' => $productId,
                'type' => 'adjustment',
                'quantity_change' => -$quantity,
                'quantity_after' => $inventory->fresh()->quantity,
                'notes' => $notes ?? "Manual stock deduction of {$quantity}",
                'created_by' => $userId,
            ]);

            if ($inventory->fresh()->quantity <= 0) {
                Product::whereKey($productId)->update(['is_available' => false]);
            }

            return $inventory->fresh();
        });
    }

    /**
     * Lock inventory rows in deterministic id order to avoid deadlocks when
     * multiple reservations/sales touch the same rows concurrently.
     */
    private function lockInventoriesInOrder(array $inventoryIds): Collection
    {
        if ($inventoryIds === []) {
            return collect();
        }

        return Inventory::whereIn('id', $inventoryIds)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy(fn (Inventory $inventory) => $this->inventoryKey($inventory->product_id, $inventory->product_variant_id));
    }

    private function involvedInventoryIds(Order $order): Collection
    {
        return $order->items
            ->filter(fn ($item) => $item->product_id !== null)
            ->map(fn ($item) => Inventory::where('product_id', $item->product_id)
                ->where('product_variant_id', $item->product_variant_id)
                ->value('id'))
            ->filter(fn ($id) => $id !== null)
            ->unique();
    }

    private function inventoryKey(mixed $productId, mixed $productVariantId): string
    {
        return ($productVariantId ?? 'null').':'.$productId;
    }
}
