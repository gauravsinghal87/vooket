<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Payout;
use App\Services\WithdrawalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PayoutController extends BaseController
{
    public function __construct(
        private WithdrawalService $withdrawalService,
    ) {}

    public function index(Request $request)
    {
        $query = Payout::query()
            ->with(['vendor.user', 'driver.user', 'deliveryPartner.user']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('party_type')) {
            $query->where('party_type', $request->input('party_type'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('payout_number', 'like', "%{$search}%")
                    ->orWhere(fn ($w) => $w->whereHas('vendor.user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"))
                        ->orWhereHas('driver.user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"))
                        ->orWhereHas('deliveryPartner.user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%")));
            });
        }

        if ($request->filled('vendor_id')) {
            $query->where('vendor_id', $request->input('vendor_id'));
        }

        if ($request->filled('driver_id')) {
            $query->where('driver_id', $request->input('driver_id'));
        }

        return $this->success($query->latest()->paginate($request->integer('per_page', 20)));
    }

    public function show(Payout $payout)
    {
        $payout->load(['vendor.user', 'driver.user', 'deliveryPartner.user', 'settlements']);

        return $this->success($payout);
    }

    public function processing(Payout $payout)
    {
        try {
            $payout = $this->withdrawalService->markPayoutProcessing($payout);

            return $this->success($payout, 'Payout moved to processing');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function paid(Payout $payout, Request $request)
    {
        $validator = Validator::make($request->all(), [
            // Optional so existing clients (and payouts marked paid without a
            // note) stay backward compatible. A blank note is stored as null.
            'admin_remark' => 'sometimes|nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $remark = $request->input('admin_remark');

        if (is_string($remark)) {
            $remark = trim($remark);
            $remark = $remark === '' ? null : $remark;
        }

        try {
            $payout = $this->withdrawalService->markPayoutSuccess(
                $payout,
                $remark,
                $request->user(),
            );

            return $this->success($payout, 'Payout marked as paid');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function failed(Payout $payout, Request $request)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'sometimes|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $payout = $this->withdrawalService->markPayoutFailed($payout, $request->input('reason'));

            return $this->success($payout, 'Payout marked as failed');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }
}
