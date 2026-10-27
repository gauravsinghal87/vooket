<?php

namespace App\Http\Controllers\API;

use App\Models\Coupon;
use App\Services\CouponService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CouponController extends BaseController
{
    public function __construct(private CouponService $couponService) {}

    public function available(Request $request)
    {
        $query = Coupon::where('is_active', true)
            ->where('expires_at', '>', now())
            ->where(function ($q) {
                $q->whereNull('usage_limit')->orWhereColumn('total_uses', '<', 'usage_limit');
            });

        if ($request->has('service')) {
            $query->where(function ($q) use ($request) {
                $q->where('service', $request->service)->orWhereNull('service');
            });
        }

        $coupons = $query->orderByDesc('created_at')->get();

        return $this->success($coupons);
    }

    public function validate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:50',
            'order_amount' => 'required|numeric|min:0',
            'service' => 'sometimes|in:food,grocery,rides',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $coupon = Coupon::where('code', $request->code)->first();

            if (! $coupon) {
                return $this->error('Invalid or expired coupon', null, 400);
            }

            try {
                $this->couponService->validateForUser(
                    $coupon,
                    $request->user(),
                    Money::fromMajor($request->order_amount),
                    ['service' => $request->service ?? null, 'payment_method' => null]
                );
            } catch (\Exception $e) {
                return $this->error($e->getMessage(), null, 400);
            }

            $discount = $this->couponService->calculateDiscount($coupon, Money::fromMajor($request->order_amount));

            return $this->success([
                'code' => $coupon->code,
                'name' => $coupon->name,
                'type' => $coupon->type,
                'value' => $coupon->value,
                'discount' => $discount->major(),
                'min_order_amount' => $coupon->min_order_amount,
            ], 'Coupon is valid');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }
}
