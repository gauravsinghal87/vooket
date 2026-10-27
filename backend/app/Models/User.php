<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use App\Services\Mail\MailConfigurationService;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'country_code',
        'password',
        'google_sub',
        'auth_provider',
        'google_linked_at',
        'avatar',
        'referral_code',
        'referred_by',
        'user_type',
        'language',
        'currency',
        'timezone',
        'is_active',
        'is_verified',
        'phone_verified_at',
        'email_verified_at',
        'last_login_at',
        'last_login_ip',
        'fcm_token',
        'device_id',
        'device_type',
        'notification_preferences',
        'privacy_settings',
        'rating',
        'rating_count',
        'banned_at',
        'ban_reason',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'banned_at' => 'datetime',
            'google_linked_at' => 'datetime',
            'password' => 'hashed',
            'notification_preferences' => 'array',
            'privacy_settings' => 'array',
            'is_active' => 'boolean',
            'is_verified' => 'boolean',
            'rating' => 'decimal:2',
        ];
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function hasRole(string $role): bool
    {
        return $this->roles()->where('slug', $role)->exists();
    }

    public function hasPermission(string $permission): bool
    {
        return $this->roles()->whereHas('permissions', function ($q) use ($permission) {
            $q->where('slug', $permission);
        })->exists();
    }

    public function addresses()
    {
        return $this->hasMany(Address::class);
    }

    public function wallet()
    {
        return $this->hasOne(Wallet::class)->where('wallet_type', '!=', 'platform');
    }

    public function wallets()
    {
        return $this->hasMany(Wallet::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function rides()
    {
        return $this->hasMany(Ride::class);
    }

    public function driver()
    {
        return $this->hasOne(Driver::class);
    }

    public function deliveryPartner()
    {
        return $this->hasOne(DeliveryPartner::class);
    }

    public function vendor()
    {
        return $this->hasOne(Vendor::class);
    }

    public function referrals()
    {
        return $this->hasMany(Referral::class, 'referrer_id');
    }

    public function loyaltyAccount()
    {
        return $this->hasOne(LoyaltyAccount::class);
    }

    public function devices()
    {
        return $this->hasMany(UserDevice::class);
    }

    public function restaurant()
    {
        return $this->hasOne(Restaurant::class);
    }

    public function store()
    {
        return $this->hasOne(Store::class);
    }

    public function isActive(): bool
    {
        return $this->is_active && ! $this->banned_at;
    }

    /**
     * True when the account authenticates with a local password.
     *
     * Google-only and OTP-only accounts are created with a NULL password and
     * must never be taken over through the password reset flow.
     */
    public function usesPasswordAuth(): bool
    {
        return filled($this->password);
    }

    /**
     * Send the password reset notification through the admin-managed SMTP
     * transport instead of the default mailer.
     *
     * Overrides the CanResetPassword trait method so Laravel's password broker
     * keeps working unchanged while the delivery transport is resolved at
     * runtime from the integration settings.
     */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        if (blank($this->email)) {
            return;
        }

        // Notified as the user (not an anonymous route) so the notification can
        // read the account name when greeting them. The send is wrapped so it
        // travels on the admin-configured SMTP transport, which is restored
        // immediately afterwards.
        app(MailConfigurationService::class)->withSmtpMailer(
            fn () => Notification::sendNow($this, new ResetPasswordNotification($token))
        );
    }
}
