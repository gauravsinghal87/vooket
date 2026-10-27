<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VendorDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'vendor_id',
        'type',
        'file_path',
        'filename',
        'status',
        'rejection_reason',
        'reviewed_at',
        'reviewed_by',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function reviewedBy()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
