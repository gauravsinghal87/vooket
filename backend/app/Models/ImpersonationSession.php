<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A single admin-initiated vendor impersonation session.
 *
 * The row is the authoritative record of "this Sanctum token is an
 * impersonation token, started by this admin, for this vendor". It is resolved
 * from the bearer token on every request, never from anything the client
 * supplies.
 *
 * @property int $id
 * @property int $impersonator_user_id
 * @property int $impersonated_user_id
 * @property int $impersonated_vendor_id
 * @property string $code_hash
 * @property Carbon $code_expires_at
 * @property int|null $access_token_id
 * @property Carbon $started_at
 * @property Carbon|null $exchanged_at
 * @property Carbon $expires_at
 * @property Carbon|null $ended_at
 * @property array|null $meta
 */
class ImpersonationSession extends Model
{
    protected $fillable = [
        'impersonator_user_id',
        'impersonated_user_id',
        'impersonated_vendor_id',
        'code_hash',
        'code_expires_at',
        'access_token_id',
        'started_at',
        'exchanged_at',
        'expires_at',
        'ended_at',
        'ip_address',
        'user_agent',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'code_expires_at' => 'datetime',
            'started_at' => 'datetime',
            'exchanged_at' => 'datetime',
            'expires_at' => 'datetime',
            'ended_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function impersonator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'impersonator_user_id');
    }

    public function impersonatedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'impersonated_user_id');
    }

    public function impersonatedVendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class, 'impersonated_vendor_id');
    }

    /** The code is only redeemable once and only inside its short window. */
    public function isCodeRedeemable(): bool
    {
        return $this->exchanged_at === null
            && $this->code_expires_at->isFuture()
            && ! $this->isEnded();
    }

    public function isEnded(): bool
    {
        return $this->ended_at !== null;
    }
}
