<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'name',
        'type',
        'channel',
        'title_template',
        'body_template',
        'sms_template',
        'email_subject_template',
        'email_body_template',
        'variables',
        'is_active',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'variables' => 'array',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }
}
