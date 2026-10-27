<?php

namespace App\Http\Controllers\API\Vendor;

use App\Http\Controllers\API\BaseController;
use Illuminate\Http\Request;

class OutletController extends BaseController
{
    public function index(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        if ($vendor->vendor_type === 'grocery') {
            $outlets = $vendor->stores()->withCount(['products', 'orders'])->get()->map(fn ($s) => [
                'id' => $s->id,
                'type' => 'store',
                'name' => $s->name,
                'slug' => $s->slug,
                'description' => $s->description,
                'address' => $s->address,
                'phone' => $s->phone,
                'logo' => $s->logo,
                'cover_image' => $s->cover_image,
                'is_open' => $s->is_open,
                'is_featured' => $s->is_featured,
                'opens_at' => $s->opens_at,
                'closes_at' => $s->closes_at,
                'rating' => $s->rating,
                'rating_count' => $s->rating_count,
                'products_count' => (int) $s->products_count,
                'orders_count' => (int) $s->orders_count,
            ]);
        } else {
            $outlets = $vendor->restaurants()->withCount(['products', 'orders'])->get()->map(fn ($r) => [
                'id' => $r->id,
                'type' => 'restaurant',
                'name' => $r->name,
                'slug' => $r->slug,
                'description' => $r->description,
                'cuisine_type' => $r->cuisine_type,
                'address' => $r->address,
                'phone' => $r->phone,
                'logo' => $r->logo,
                'cover_image' => $r->cover_image,
                'is_open' => $r->is_open,
                'is_featured' => $r->is_featured,
                'opens_at' => $r->opens_at,
                'closes_at' => $r->closes_at,
                'avg_prep_time_min' => $r->avg_prep_time_min,
                'rating' => $r->rating,
                'rating_count' => $r->rating_count,
                'products_count' => (int) $r->products_count,
                'orders_count' => (int) $r->orders_count,
            ]);
        }

        return $this->success($outlets);
    }
}
