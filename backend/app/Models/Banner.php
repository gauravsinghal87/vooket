<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    use HasFactory;

    public const SERVICE_ALL = 'all';

    protected $fillable = [
        'title',
        'subtitle',
        'cta_text',
        'image',
        'media_type',
        'video',
        'poster_image',
        'position',
        'service',
        'placement',
        'target_id',
        'target_type',
        'target_url',
        'starts_at',
        'expires_at',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Scope the query to banners that are currently within their scheduling window.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->where('is_active', true)
            ->where(function (Builder $q) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function (Builder $q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            });
    }

    /**
     * Scope the query to banners targeting the given service home hero placement.
     *
     * A banner applies to a service when its `service` is null/legacy, "all", or
     * equal to the requested service, and its `placement` is null or the
     * service-specific hero.
     */
    public function scopeForService(Builder $query, string $service): Builder
    {
        return $query
            ->where(function (Builder $q) use ($service) {
                $q->whereNull('service')
                    ->orWhere('service', self::SERVICE_ALL)
                    ->orWhere('service', $service);
            })
            ->where(function (Builder $q) use ($service) {
                $q->whereNull('placement')
                    ->orWhere('placement', $service.'_home_hero');
            });
    }
}
