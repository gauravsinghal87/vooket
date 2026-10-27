<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed the Platform Logo setting and place it directly below Platform Name
     * in the General group.
     *
     * The upsert is idempotent: on an existing database where the row (and a
     * possibly already-uploaded logo value) is present it only re-asserts the
     * label, help text and sort order, without touching the stored value, so a
     * configured logo is never lost by running this migration again.
     */
    public function up(): void
    {
        $label = 'Platform Logo';
        $helpText = 'Square PNG, JPG or WebP logo (max 2MB). Shown across the customer apps.';

        $existing = DB::table('app_settings')->where('key', 'platform_logo')->first();

        if ($existing) {
            DB::table('app_settings')->where('key', 'platform_logo')->update([
                'group' => 'general',
                'label' => $label,
                'help_text' => $helpText,
                'type' => 'string',
                'is_public' => true,
                'sort_order' => 2,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('app_settings')->insert([
                'group' => 'general',
                'key' => 'platform_logo',
                'label' => $label,
                'help_text' => $helpText,
                'value' => null,
                'type' => 'string',
                'is_public' => true,
                'sort_order' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Shift the remaining General fields down by one so Platform Logo sits
        // immediately below Platform Name while the existing fields keep their
        // relative order.
        foreach (['currency' => 3, 'support_phone' => 4, 'support_email' => 5] as $key => $order) {
            DB::table('app_settings')
                ->where('group', 'general')
                ->where('key', $key)
                ->update(['sort_order' => $order]);
        }
    }

    public function down(): void
    {
        DB::table('app_settings')
            ->where('key', 'platform_logo')
            ->whereNull('value')
            ->delete();

        foreach (['currency' => 2, 'support_phone' => 3, 'support_email' => 4] as $key => $order) {
            DB::table('app_settings')
                ->where('group', 'general')
                ->where('key', $key)
                ->update(['sort_order' => $order]);
        }
    }
};
