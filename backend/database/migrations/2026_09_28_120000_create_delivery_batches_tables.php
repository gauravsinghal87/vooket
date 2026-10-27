<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Grocery multi-order delivery batches.
 *
 * A batch is one physical trip for one delivery partner. It never replaces
 * `orders.delivery_partner_id` or any per-order status/payment/OTP column —
 * it only groups orders that share a trip so they can be offered, sequenced
 * and completed independently.
 *
 * `delivery_batch_orders` is the normalised membership table: one row per
 * order per batch, carrying the stop sequence and the per-stop mirror of the
 * order status. A unique index on `order_id` guarantees an order can never be
 * part of two batches at once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_partner_id')->constrained('delivery_partners')->cascadeOnDelete();
            $table->string('order_type', 32)->default('grocery');
            $table->string('status', 32)->default('active');
            $table->string('batch_number')->unique();

            // Immutable snapshot of the slot window the batch was built for.
            $table->timestamp('window_start')->nullable();
            $table->timestamp('window_end')->nullable();
            $table->foreignId('delivery_slot_id')->nullable()->constrained('delivery_slots')->nullOnDelete();

            $table->unsignedInteger('stop_count')->default(1);

            // MySQL has no partial indexes, so "one active trip per partner" is
            // enforced with a flag that is 1 while the batch is active and NULL
            // once it closes. A unique (partner_id, active_flag) index then
            // allows exactly one active batch and unlimited closed ones.
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);

            // Ordered stops + leg distances/durations, measured by the map
            // provider. Stored so the partner UI can render a real route
            // without re-quoting Google Maps on every poll.
            $table->json('route')->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            // One active trip per partner.
            $table->unique(['delivery_partner_id', 'active_flag'], 'delivery_batches_partner_active_unique');
            $table->index(['order_type', 'status'], 'delivery_batches_type_status_index');
        });

        Schema::create('delivery_batch_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_batch_id')->constrained('delivery_batches')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('status', 32)->default('PARTNER_ASSIGNED');
            $table->timestamp('pickup_completed_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->unique('order_id', 'delivery_batch_orders_order_unique');
            $table->unique(['delivery_batch_id', 'sequence'], 'delivery_batch_orders_batch_sequence_unique');
        });

        Schema::table('delivery_partners', function (Blueprint $table) {
            // Cached count of orders across the partner's active batch(s). Kept
            // separate from `is_busy` so capacity no longer relies on a single
            // boolean, while `is_busy` keeps meaning "has any active work".
            $table->unsignedInteger('active_batch_order_count')->default(0)
                ->after('is_busy');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_partners', function (Blueprint $table) {
            $table->dropColumn('active_batch_order_count');
        });

        Schema::dropIfExists('delivery_batch_orders');
        Schema::dropIfExists('delivery_batches');
    }
};
