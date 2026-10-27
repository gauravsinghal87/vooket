<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Commission;
use App\Models\Vendor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class VendorManagementController extends BaseController
{
    public function index(Request $request)
    {
        $query = Vendor::with('user:id,name,email,phone')
            ->withCount([
                'restaurants',
                'stores',
                'products',
                'orders' => fn ($q) => $q->whereNotIn('status', ['CANCELLED', 'cancelled']),
            ])
            ->withSum(['orders' => fn ($q) => $q->where('payment_status', '!=', 'failed')], 'total_amount');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($type = $request->query('vendor_type')) {
            $query->where('vendor_type', $type);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('business_name', 'like', "%{$search}%")
                    ->orWhere('owner_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u->where('email', 'like', "%{$search}%"));
            });
        }

        $vendors = $query->latest()->paginate($request->integer('per_page', 20))
            ->through(fn ($v) => [
                'id' => $v->id,
                'business_name' => $v->business_name,
                'vendor_type' => $v->vendor_type,
                'owner_name' => $v->owner_name,
                'email' => $v->email,
                'phone' => $v->phone,
                'status' => $v->status,
                'rejection_reason' => $v->rejection_reason,
                'commission_rate' => (float) $v->commission_rate,
                'approved_at' => $v->approved_at,
                'is_active' => $v->is_active,
                'restaurants_count' => (int) $v->restaurants_count,
                'stores_count' => (int) $v->stores_count,
                'products_count' => (int) $v->products_count,
                'orders_count' => (int) $v->orders_count,
                'gross_order_value' => (float) $v->orders_sum_total_amount,
                'commission' => (float) Commission::where('vendor_id', $v->id)
                    ->where('status', '!=', 'reversed')
                    ->sum('commission_amount'),
                'logo' => $v->logo,
                'created_at' => $v->created_at,
                'user' => $v->user,
            ]);

        return $this->success($vendors->items(), 'Vendors retrieved', 200, [
            'pagination' => [
                'current_page' => $vendors->currentPage(),
                'last_page' => $vendors->lastPage(),
                'per_page' => $vendors->perPage(),
                'total' => $vendors->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $vendor = Vendor::with([
            'user:id,name,email,phone,is_active,banned_at,ban_reason',
            'restaurants',
            'stores',
            'vendorDocuments',
        ])
            ->withCount(['products', 'orders'])
            ->find($id);

        if (! $vendor) {
            return $this->error('Vendor not found', null, 404);
        }

        return $this->success($vendor);
    }

    public function review(Request $request, int $id)
    {
        $vendor = Vendor::find($id);
        if (! $vendor) {
            return $this->error('Vendor not found', null, 404);
        }

        $action = $request->input('action');

        $rules = [
            'action' => 'required|in:approve,reject,suspend,reactivate',
            'rejection_reason' => 'required_if:action,reject|string|max:500',
            'suspension_reason' => 'required_if:action,suspend|string|max:500',
            'commission_rate' => 'sometimes|nullable|numeric|min:0|max:100',
        ];

        if ($action === 'approve' && $vendor->vendor_type === 'restaurant') {
            $rules['commission_rate'] = 'required|numeric|min:0|max:100';
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        return DB::transaction(function () use ($request, $vendor, $action) {
            $updates = ['status' => $vendor->status];

            match ($action) {
                'approve' => $updates = [
                    'status' => 'approved',
                    'rejection_reason' => null,
                    'approved_at' => now(),
                    'is_active' => true,
                    'commission_rate' => (float) $request->input('commission_rate'),
                ],
                'reject' => $updates = [
                    'status' => 'rejected',
                    'rejection_reason' => $request->input('rejection_reason'),
                    'approved_at' => null,
                    'is_active' => false,
                ],
                'suspend' => $updates = [
                    'status' => 'suspended',
                    'rejection_reason' => $request->input('suspension_reason'),
                    'is_active' => false,
                ],
                'reactivate' => $updates = [
                    'status' => 'approved',
                    'rejection_reason' => null,
                    'approved_at' => now(),
                    'is_active' => true,
                ],
                default => null,
            };

            if (($action === 'approve' || $action === 'reactivate')
                && $request->has('commission_rate')
                && $vendor->vendor_type === 'restaurant') {
                $updates['commission_rate'] = (float) $request->input('commission_rate');
            }

            $vendor->update($updates);

            if ($action === 'approve' || $action === 'reactivate') {
                $vendor->user()?->update(['is_active' => true, 'banned_at' => null]);
                $vendor->ensureOutlet();
            }

            return $this->success($vendor->fresh(['restaurants', 'stores']), 'Vendor status updated');
        });
    }

    public function updateCommission(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'commission_rate' => 'required|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $vendor = Vendor::find($id);
        if (! $vendor) {
            return $this->error('Vendor not found', null, 404);
        }

        $vendor->update(['commission_rate' => $request->input('commission_rate')]);

        return $this->success($vendor->fresh(), 'Commission rate updated');
    }
}
