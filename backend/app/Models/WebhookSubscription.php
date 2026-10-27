<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WebhookSubscription extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'client_id',
        'target_url',
        'events',
        'status',
        'secret',
    ];

    protected $casts = [
        'events' => 'array',
        'status' => 'boolean',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function deliveries()
    {
        return $this->hasMany(WebhookDelivery::class, 'subscription_id');
    }
}
