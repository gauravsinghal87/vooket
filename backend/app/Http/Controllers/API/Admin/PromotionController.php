<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Banner;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PromotionController extends BaseController
{
    // ============ COUPONS ============

    public function coupons(Request $request)
    {
        $query = Coupon::withCount('couponUsages');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }
        if ($service = $request->query('service')) {
            $query->where('service', $service);
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $coupons = $query->latest()->paginate($request->integer('per_page', 20));

        return $this->success($coupons->items(), 'Coupons retrieved', 200, $this->paginationMeta($coupons));
    }

    public function storeCoupon(Request $request)
    {
        $validator = Validator::make($request->all(), $this->couponCreateRules())
            ->after(fn ($v) => $this->validateCouponCrossFields($v, $request));

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $this->normalizeCouponData($validator->validated());
        $data['code'] = strtoupper($data['code']);

        try {
            $coupon = Coupon::create($data);

            return $this->success($coupon, 'Coupon created', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function updateCoupon(Request $request, int $id)
    {
        $coupon = Coupon::find($id);
        if (! $coupon) {
            return $this->error('Coupon not found', null, 404);
        }

        $validator = Validator::make($request->all(), $this->couponUpdateRules($id))
            ->after(fn ($v) => $this->validateCouponCrossFields($v, $request));

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $coupon->update($this->normalizeCouponData($validator->validated()));

        return $this->success($coupon->fresh(), 'Coupon updated');
    }

    /**
     * @return string[]
     */
    private function couponCreateRules(): array
    {
        return [
            'code' => 'required|alpha_num:ascii|max:30|unique:coupons,code',
            'name' => 'required|string|max:120',
            'description' => 'sometimes|string|max:255',
            'type' => 'required|in:percentage,fixed,shipping',
            'value' => 'required|numeric|min:0.01',
            'max_discount' => 'sometimes|nullable|numeric|min:0.01',
            'min_order_amount' => 'sometimes|nullable|numeric|min:0',
            'service' => 'sometimes|in:food,grocery,rides,all',
            'vendor_id' => 'sometimes|nullable|exists:vendors,id',
            'category_ids' => 'sometimes|nullable|array',
            'category_ids.*' => 'integer',
            'product_ids' => 'sometimes|nullable|array',
            'product_ids.*' => 'integer',
            'city_ids' => 'sometimes|nullable|array',
            'city_ids.*' => 'integer',
            'zone_ids' => 'sometimes|nullable|array',
            'zone_ids.*' => 'integer',
            'user_eligibility' => 'sometimes|in:all,new,existing',
            'usage_limit' => 'sometimes|nullable|integer|min:1',
            'per_user_limit' => 'sometimes|integer|min:1',
            'payment_methods' => 'sometimes|in:all,wallet,online,cod',
            'starts_at' => 'sometimes|date',
            'expires_at' => 'sometimes|date',
            'time_start' => 'sometimes|date_format:H:i:s',
            'time_end' => 'sometimes|date_format:H:i:s',
            'day_of_week' => 'sometimes|in:all,0,1,2,3,4,5,6',
            'first_order_only' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'status' => 'sometimes|in:active,paused,expired',
        ];
    }

    /**
     * @return string[]
     */
    private function couponUpdateRules(int $id): array
    {
        $rules = $this->couponCreateRules();

        foreach ($rules as $key => $rule) {
            $rules[$key] = 'sometimes|'.str_replace('required|', '', $rule);
        }

        $rules['code'] = 'sometimes|alpha_num:ascii|max:30|unique:coupons,code,'.$id;

        return $rules;
    }

    /**
     * @param  \Illuminate\Validation\Validator  $validator
     */
    private function validateCouponCrossFields($validator, Request $request): void
    {
        $data = $request->all();

        if (($data['type'] ?? 'percentage') === 'percentage' && (float) ($data['value'] ?? 0) > 100) {
            $validator->errors()->add('value', 'Percentage value cannot exceed 100.');
        }

        if (($data['type'] ?? 'percentage') !== 'percentage'
            && isset($data['max_discount'])
            && $data['max_discount'] !== null) {
            $validator->errors()->add('max_discount', 'Maximum discount only applies to percentage coupons.');
        }

        if (! empty($data['starts_at']) && ! empty($data['expires_at'])
            && strtotime($data['expires_at']) <= strtotime($data['starts_at'])) {
            $validator->errors()->add('expires_at', 'Expiry must be after the start date.');
        }
    }

    private function normalizeCouponData(array $data): array
    {
        foreach (['category_ids', 'product_ids', 'city_ids', 'zone_ids'] as $listKey) {
            if (isset($data[$listKey])) {
                $data[$listKey] = implode(',', array_map('intval', (array) $data[$listKey]));
            }
        }

        if (($data['type'] ?? null) !== 'percentage') {
            unset($data['max_discount']);
        }

        return $data;
    }

    public function destroyCoupon(Request $request, int $id)
    {
        $coupon = Coupon::find($id);
        if (! $coupon) {
            return $this->error('Coupon not found', null, 404);
        }

        $coupon->delete();

        return $this->success(null, 'Coupon deleted');
    }

    // ============ BANNERS ============

    public function banners(Request $request)
    {
        $query = Banner::query();

        if ($position = $request->query('position')) {
            $query->where('position', $position);
        }
        if ($service = $request->query('service')) {
            $query->where('service', $service);
        }
        if ($placement = $request->query('placement')) {
            $query->where('placement', $placement);
        }
        if (($request->query('is_active') ?? null) !== null) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOL));
        }

        $banners = $query->orderBy('sort_order')->orderByDesc('id')->paginate($request->integer('per_page', 20));

        return $this->success($banners->items(), 'Banners retrieved', 200, $this->paginationMeta($banners));
    }

    public function showBanner(Request $request, int $id)
    {
        $banner = Banner::find($id);
        if (! $banner) {
            return $this->error('Banner not found', null, 404);
        }

        return $this->success($banner, 'Banner retrieved');
    }

    /**
     * @return string[]
     */
    private function bannerValidationRules(): array
    {
        return [
            'title' => 'required|string|max:120',
            'subtitle' => 'sometimes|nullable|string|max:255',
            'cta_text' => 'sometimes|nullable|string|max:60',
            'image' => 'required|string',
            'media_type' => 'sometimes|in:image,video',
            'video' => 'sometimes|nullable|string',
            'poster_image' => 'sometimes|nullable|string',
            'position' => 'sometimes|in:home,food,grocery,rides,promo',
            'service' => 'sometimes|nullable|in:food,grocery,rides,all',
            'placement' => 'sometimes|nullable|in:food_home_hero,grocery_home_hero,grocery_home_brand_promo,grocery_home_festive_promo,rides_home_hero,rides_promotions,order_tracking,food_home_card,grocery_home_card,food_home_secondary,grocery_home_secondary',
            'target_type' => 'sometimes|in:restaurant,store,product,category,url',
            'target_id' => 'sometimes|nullable|integer',
            'target_url' => 'sometimes|nullable|string|max:255',
            'starts_at' => 'sometimes|nullable|date',
            'expires_at' => 'sometimes|nullable|date|after:starts_at',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ];
    }

    public function storeBanner(Request $request)
    {
        $validator = Validator::make($request->all(), $this->bannerValidationRules());

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $banner = Banner::create($validator->validated());

        return $this->success($banner, 'Banner created', 201);
    }

    public function updateBanner(Request $request, int $id)
    {
        $banner = Banner::find($id);
        if (! $banner) {
            return $this->error('Banner not found', null, 404);
        }

        $rules = $this->bannerValidationRules();

        foreach ($rules as $key => $rule) {
            $rule = str_replace('required|', '', $rule);
            // `after:starts_at` requires starts_at in the same payload, which is
            // not guaranteed during a partial update.
            $rule = str_replace('|after:starts_at', '', $rule);
            $rules[$key] = 'sometimes|'.$rule;
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $banner->update($validator->validated());

        return $this->success($banner->fresh(), 'Banner updated');
    }

    public function toggleBanner(Request $request, int $id)
    {
        $banner = Banner::find($id);
        if (! $banner) {
            return $this->error('Banner not found', null, 404);
        }

        $banner->update(['is_active' => ! $banner->is_active]);

        return $this->success($banner->fresh(), 'Banner toggled');
    }

    public function destroyBanner(Request $request, int $id)
    {
        $banner = Banner::find($id);
        if (! $banner) {
            return $this->error('Banner not found', null, 404);
        }

        $banner->delete();

        return $this->success(null, 'Banner deleted');
    }

    public function uploadImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,webp,gif|max:4096',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $path = $request->file('image')->store('banner-images', 'public');

            return $this->success(['image' => $this->imageUrl($path)], 'Image uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function uploadVideo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'video' => 'required|file|mimes:mp4,webm,mov|max:24576',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $path = $request->file('video')->store('banner-videos', 'public');

            return $this->success(['video' => $this->imageUrl($path)], 'Video uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    protected function imageUrl(string $path): string
    {
        return rtrim(config('app.url'), '/').'/storage/'.$path;
    }

    protected function paginationMeta($paginator): array
    {
        return [
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }
}
