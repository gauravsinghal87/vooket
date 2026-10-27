<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntegrationSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'service',
        'provider',
        'environment',
        'is_enabled',
        'credentials',
        'settings',
        'last_tested_at',
        'last_test_status',
        'last_test_message',
    ];

    protected function casts(): array
    {
        return [
            'credentials' => 'encrypted:array',
            'settings' => 'array',
            'is_enabled' => 'boolean',
            'last_tested_at' => 'datetime',
        ];
    }

    /**
     * Never serialize credentials (encrypted string may be surprisingly long).
     * API resources must explicitly exclude the column too.
     */
    protected function hidden(): array
    {
        return ['credentials'];
    }
}
