<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->char('idempotency_fingerprint', 64)->nullable()->after('idempotency_key');
            $table->timestamp('picking_at')->nullable()->after('preparing_at');
            $table->timestamp('packed_at')->nullable()->after('picking_at');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_idempotency_key_unique');
            $table->unique(['user_id', 'idempotency_key'], 'orders_user_id_idempotency_key_unique');
            $table->index('idempotency_fingerprint', 'orders_idempotency_fingerprint_index');
        });

        Schema::table('order_status_histories', function (Blueprint $table) {
            $table->string('old_status', 30)->nullable()->after('status');
            $table->string('new_status', 30)->nullable()->after('old_status');
            $table->timestamp('changed_at')->nullable()->after('new_status');
            $table->index(['order_id', 'changed_at'], 'osh_order_changed_at_index');
        });

        $this->dedupeCommissions();

        Schema::table('commissions', function (Blueprint $table) {
            $table->unique(['party_type', 'source_type', 'source_id'], 'commissions_source_once_unique');
        });

        Schema::create('inventory_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained('order_items')->nullOnDelete();
            $table->foreignId('inventory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->enum('state', ['reserved', 'sold', 'released'])->default('reserved');
            $table->string('notes')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'inventory_id'], 'inv_reservations_order_inventory_unique');
            $table->index(['inventory_id', 'state'], 'inv_reservations_inventory_state_index');
        });

        Schema::create('delivery_partner_earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_partner_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('earning_number')->unique();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('type', 20)->default('delivery');
            $table->enum('status', ['earned', 'paid', 'reversed'])->default('earned');
            $table->foreignId('payout_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'delivery_partner_id'], 'dpe_order_partner_unique');
            $table->index(['delivery_partner_id', 'status'], 'dpe_partner_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_partner_earnings');
        Schema::dropIfExists('inventory_reservations');

        Schema::table('commissions', function (Blueprint $table) {
            $table->dropUnique('commissions_source_once_unique');
        });

        Schema::table('order_status_histories', function (Blueprint $table) {
            $table->dropIndex('osh_order_changed_at_index');
            $table->dropColumn(['old_status', 'new_status', 'changed_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_idempotency_fingerprint_index');
            $table->dropUnique('orders_user_id_idempotency_key_unique');
            $table->unique('idempotency_key');
            $table->dropColumn(['idempotency_fingerprint', 'picking_at', 'packed_at']);
        });
    }

    private function dedupeCommissions(): void
    {
        if (! Schema::hasTable('commissions')) {
            return;
        }

        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement(
                'DELETE c1 FROM commissions c1 '
                .'INNER JOIN commissions c2 '
                .'ON c1.party_type = c2.party_type '
                .'AND c1.source_type = c2.source_type '
                .'AND c1.source_id = c2.source_id '
                .'AND c1.id > c2.id'
            );
        } else {
            $duplicates = DB::table('commissions')
                ->select('party_type', 'source_type', 'source_id')
                ->groupBy('party_type', 'source_type', 'source_id')
                ->havingRaw('COUNT(*) > 1')
                ->get();

            foreach ($duplicates as $duplicate) {
                $keepId = DB::table('commissions')
                    ->where('party_type', $duplicate->party_type)
                    ->where('source_type', $duplicate->source_type)
                    ->where('source_id', $duplicate->source_id)
                    ->orderBy('id')
                    ->value('id');

                DB::table('commissions')
                    ->where('party_type', $duplicate->party_type)
                    ->where('source_type', $duplicate->source_type)
                    ->where('source_id', $duplicate->source_id)
                    ->where('id', '!=', $keepId)
                    ->delete();
            }
        }
    }
};
