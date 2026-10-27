<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->dedupeCouponOrderPairs();

        // MySQL refuses to drop an index that backs a foreign key, so the
        // replacement indexes must exist before the old unique key goes away.
        Schema::table('coupon_usages', function (Blueprint $table) {
            $table->unique(['coupon_id', 'order_id']);
            $table->index(['coupon_id', 'user_id']);
            $table->dropUnique('coupon_usages_coupon_id_order_id_ride_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('coupon_usages', function (Blueprint $table) {
            // restore the FK-backing index first, then remove the replacements
            $table->unique(['coupon_id', 'order_id', 'ride_id']);
            $table->dropIndex('coupon_usages_coupon_id_user_id_index');
            $table->dropUnique('coupon_usages_coupon_id_order_id_unique');
        });
    }

    /**
     * A coupon can only ever be redeemed once per order. Remove any existing
     * duplicate (coupon_id, order_id) rows, keeping the earliest record so
     * audit history and redemption counts stay intact.
     */
    private function dedupeCouponOrderPairs(): void
    {
        $duplicates = DB::table('coupon_usages')
            ->select(['coupon_id', 'order_id'])
            ->whereNotNull('order_id')
            ->groupBy(['coupon_id', 'order_id'])
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            $keep = DB::table('coupon_usages')
                ->where('coupon_id', $duplicate->coupon_id)
                ->where('order_id', $duplicate->order_id)
                ->orderBy('id')
                ->value('id');

            DB::table('coupon_usages')
                ->where('coupon_id', $duplicate->coupon_id)
                ->where('order_id', $duplicate->order_id)
                ->where('id', '!=', $keep)
                ->delete();
        }
    }
};
