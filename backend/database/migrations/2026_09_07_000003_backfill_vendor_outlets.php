<?php

use App\Models\Vendor;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Vendor::query()
            ->where('status', 'approved')
            ->get()
            ->each(fn (Vendor $vendor) => $vendor->ensureOutlet());
    }

    public function down(): void
    {
        // No-op: outlet cleanup is handled by the parent vendor's cascade.
    }
};
