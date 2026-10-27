<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The generic `home_hero` placement no longer has a surface, so a banner
     * saved without an explicit placement must not silently fall back to it.
     * Null now means "eligible for the requesting service's hero", which is
     * what the banner queries already treat a missing placement as.
     */
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('placement', 40)->nullable()->default(null)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('placement', 40)->nullable(false)->default('home_hero')->change();
        });
    }
};
