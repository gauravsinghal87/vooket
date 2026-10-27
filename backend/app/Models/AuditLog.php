<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'role',
        'ip_address',
        'user_agent',
        'action',
        'entity_type',
        'entity_id',
        'old_values',
        'new_values',
        'description',
        'level',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public $timestamps = false;

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
