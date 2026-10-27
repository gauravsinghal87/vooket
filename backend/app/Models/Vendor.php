<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Vendor extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'business_name',
        'vendor_type',
        'owner_name',
        'email',
        'phone',
        'gst_number',
        'pan_number',
        'fssai_number',
        'bank_account_name',
        'bank_account_number',
        'bank_ifsc',
        'bank_name',
        'logo',
        'cover_image',
        'status',
        'rejection_reason',
        'approved_at',
        'commission_rate',
        'latitude',
        'longitude',
        'address',
        'zone_id',
        'documents',
        'kyc_data',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'commission_rate' => 'decimal:2',
            'approved_at' => 'datetime',
            'documents' => 'array',
            'kyc_data' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function zone()
    {
        return $this->belongsTo(Zone::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function vendorDocuments()
    {
        return $this->hasMany(VendorDocument::class);
    }

    public function restaurants()
    {
        return $this->hasMany(Restaurant::class);
    }

    public function stores()
    {
        return $this->hasMany(Store::class);
    }

    public function ensureOutlet(): Restaurant|Store|null
    {
        if ($this->vendor_type === 'restaurant') {
            if ($this->restaurants()->exists()) {
                return $this->restaurants()->first();
            }

            return $this->restaurants()->create([
                'name' => $this->business_name,
                'slug' => $this->uniqueSlug($this->business_name, 'outlet', Restaurant::class),
                'address' => $this->address,
                'phone' => $this->phone,
                'logo' => $this->logo,
                'cover_image' => $this->cover_image,
                'latitude' => $this->latitude,
                'longitude' => $this->longitude,
                'is_open' => false,
                'order_type' => 'both',
            ]);
        }

        if ($this->vendor_type === 'grocery') {
            if ($this->stores()->exists()) {
                return $this->stores()->first();
            }

            return $this->stores()->create([
                'name' => $this->business_name,
                'slug' => $this->uniqueSlug($this->business_name, 'outlet', Store::class),
                'store_type' => 'supermarket',
                'address' => $this->address,
                'phone' => $this->phone,
                'logo' => $this->logo,
                'cover_image' => $this->cover_image,
                'latitude' => $this->latitude,
                'longitude' => $this->longitude,
                'is_open' => false,
                'order_type' => 'both',
                'supports_instant_delivery' => true,
                'supports_scheduled_delivery' => true,
            ]);
        }

        return null;
    }

    private function uniqueSlug(string $name, string $prefix, string $model): string
    {
        $base = Str::slug($name) ?: sprintf('%s-%d', $prefix, $this->id);
        $slug = $base;
        $i = 2;

        while (DB::table((new $model)->getTable())->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
