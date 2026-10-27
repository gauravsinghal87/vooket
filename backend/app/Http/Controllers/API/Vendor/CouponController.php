<?php

namespace App\Http\Controllers\API\Vendor;

use App\Http\Controllers\API\BaseController;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CouponController extends BaseController
{
    public function index(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $query = Coupon::where('vendor_id', $vendor->id)->withCount('couponUsages');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $coupons = $query->latest()->paginate($request->integer('per_page', 20));

        return $this->success($coupons->items(), 'Coupons retrieved', 200, [
            'pagination' => [
                'current_page' => $coupons->currentPage(),
                'last_page' => $coupons->lastPage(),
                'per_page' => $coupons->perPage(),
                'total' => $coupons->total(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'code' => 'required|alpha_num:ascii|max:30|unique:coupons,code',
            'name' => 'required|string|max:120',
            'description' => 'sometimes|string|max:255',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0.01',
            'max_discount' => 'sometimes|nullable|numeric|min:0.01',
            'min_order_amount' => 'sometimes|nullable|numeric|min:0',
            'usage_limit' => 'sometimes|nullable|integer|min:1',
            'per_user_limit' => 'sometimes|integer|min:1',
            'starts_at' => 'sometimes|date',
            'expires_at' => 'sometimes|date',
            'first_order_only' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ])->after(function ($v) use ($request) {
            $data = $request->all();

            if (($data['type'] ?? 'percentage') === 'percentage' && (float) ($data['value'] ?? 0) > 100) {
                $v->errors()->add('value', 'Percentage value cannot exceed 100.');
            }

            if (! empty($data['starts_at']) && ! empty($data['expires_at'])
                && strtotime($data['expires_at']) <= strtotime($data['starts_at'])) {
                $v->errors()->add('expires_at', 'Expiry must be after the start date.');
            }
        });

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();
        $data['code'] = strtoupper($data['code']);
        $data['vendor_id'] = $vendor->id;
        $data['service'] = $vendor->vendor_type === 'grocery' ? 'grocery' : 'food';
        $data['status'] = 'active';

        if ($data['type'] !== 'percentage') {
            unset($data['max_discount']);
        }

        try {
            $coupon = Coupon::create($data);

            return $this->success($coupon, 'Coupon created', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function update(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $coupon = Coupon::where('vendor_id', $vendor->id)->find($id);
        if (! $coupon) {
            return $this->error('Coupon not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:120',
            'value' => 'sometimes|numeric|min:0.01',
            'max_discount' => 'sometimes|nullable|numeric|min:0.01',
            'min_order_amount' => 'sometimes|nullable|numeric|min:0',
            'usage_limit' => 'sometimes|nullable|integer|min:1',
            'per_user_limit' => 'sometimes|integer|min:1',
            'starts_at' => 'sometimes|date',
            'expires_at' => 'sometimes|date',
            'first_order_only' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'status' => 'sometimes|in:active,paused,expired',
        ])->after(function ($v) use ($request, $coupon) {
            $data = $request->all();

            if (($data['value'] ?? null) !== null && $coupon->type === 'percentage' && (float) $data['value'] > 100) {
                $v->errors()->add('value', 'Percentage value cannot exceed 100.');
            }

            $starts = $request->input('starts_at', $coupon->starts_at);
            $expires = $request->input('expires_at', $coupon->expires_at);
            if ($starts && $expires && strtotime($expires) <= strtotime($starts)) {
                $v->errors()->add('expires_at', 'Expiry must be after the start date.');
            }
        });

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        if ($coupon->type !== 'percentage') {
            unset($data['max_discount']);
        }

        $coupon->update($data);

        return $this->success($coupon->fresh(), 'Coupon updated');
    }

    public function destroy(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $coupon = Coupon::where('vendor_id', $vendor->id)->find($id);
        if (! $coupon) {
            return $this->error('Coupon not found', null, 404);
        }

        $coupon->delete();

        return $this->success(null, 'Coupon deleted');
    }
}
