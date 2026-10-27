<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppSetting extends Model
{
    use HasFactory;

    /**
     * Settings that used to be operator-tunable but are no longer part of the
     * product. Rows already written by an older seeder are hidden from the
     * admin settings API and can no longer be edited, but they are left in the
     * table so an existing database is not mutated by a deploy.
     */
    public const RETIRED_KEYS = [
        'grocery_scheduled_dispatch_lead_minutes',
        'grocery_max_scheduled_orders_per_batch',
    ];

    protected $fillable = [
        'group',
        'key',
        'label',
        'help_text',
        'value',
        'type',
        'is_public',
        'options',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'options' => 'array',
        ];
    }

    /**
     * Scope limiting the query to settings that are still editable in the admin
     * UI, excluding every retired key.
     *
     * @param  Builder<self>  $query
     */
    public function scopeEditable(Builder $query): void
    {
        $query->whereNotIn('key', self::RETIRED_KEYS);
    }
}
