<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Addon extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'vendor_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function addonOptions()
    {
        return $this->hasMany(AddonOption::class);
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'product_addons');
    }
}
