<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->string('reference_type')->nullable()->change();
            $table->unsignedBigInteger('reference_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->string('reference_type')->nullable(false)->change();
            $table->unsignedBigInteger('reference_id')->nullable(false)->change();
        });
    }
};
