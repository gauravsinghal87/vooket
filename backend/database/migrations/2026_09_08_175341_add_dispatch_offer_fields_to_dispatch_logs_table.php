<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add offer lifecycle fields and query indexes to dispatch_logs.
     */
    public function up(): void
    {
        Schema::table('dispatch_logs', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('status');
            $table->index(['candidate_id', 'status'], 'dispatch_logs_candidate_status_idx');
            $table->index(['order_id', 'status'], 'dispatch_logs_order_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_logs', function (Blueprint $table) {
            $table->dropIndex('dispatch_logs_candidate_status_idx');
            $table->dropIndex('dispatch_logs_order_status_idx');
            $table->dropColumn('expires_at');
        });
    }
};
