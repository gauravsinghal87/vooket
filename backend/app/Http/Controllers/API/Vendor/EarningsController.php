<?php

namespace App\Http\Controllers\API\Vendor;

use App\Exceptions\VendorWalletBalanceException;
use App\Http\Controllers\API\BaseController;
use App\Models\Payout;
use App\Models\Settlement;
use App\Models\Wallet;
use App\Services\WithdrawalService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class EarningsController extends BaseController
{
    public function __construct(
        private WithdrawalService $withdrawalService,
    ) {}

    public function overview(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $wallet = Wallet::where('user_id', $request->user()->id)->where('wallet_type', 'vendor')->first();

        $settledPaid = Settlement::where('vendor_id', $vendor->id)->where('status', 'paid')->sum('net_payable');

        // Read through the withdrawal service so the ceiling the vendor sees is
        // the exact one the payout endpoint enforces, floor included.
        return $this->success([
            'vendor' => [
                'id' => $vendor->id,
                'business_name' => $vendor->business_name,
                'vendor_type' => $vendor->vendor_type,
                'commission_rate' => (float) $vendor->commission_rate,
            ],
            'wallet' => $wallet,
            'due_settlement' => (float) Settlement::where('vendor_id', $vendor->id)->where('status', 'processing')->sum('net_payable'),
            'minimum_wallet_balance' => (float) $this->withdrawalService->vendorMinimumWalletBalance()->major(),
            'max_withdrawable_amount' => (float) $this->withdrawalService->vendorMaximumPayout($vendor)->major(),
            'total_settled' => (float) $settledPaid,
            'pending_payouts' => (float) Payout::where('vendor_id', $vendor->id)->whereIn('status', ['pending', 'processing'])->sum('amount'),
        ]);
    }

    public function settlements(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $query = Settlement::where('vendor_id', $vendor->id)->withCount('settlementItems');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $settlements = $query->orderByDesc('period_end')->paginate($request->integer('per_page', 20));

        return $this->success($settlements->items(), 'Settlements retrieved', 200, [
            'pagination' => [
                'current_page' => $settlements->currentPage(),
                'last_page' => $settlements->lastPage(),
                'per_page' => $settlements->perPage(),
                'total' => $settlements->total(),
            ],
        ]);
    }

    public function payouts(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $query = Payout::where('vendor_id', $vendor->id);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $payouts = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

        return $this->success($payouts->items(), 'Payouts retrieved', 200, [
            'pagination' => [
                'current_page' => $payouts->currentPage(),
                'last_page' => $payouts->lastPage(),
                'per_page' => $payouts->perPage(),
                'total' => $payouts->total(),
            ],
        ]);
    }

    public function requestPayout(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        if (! $vendor->bank_account_number || ! $vendor->bank_ifsc) {
            return $this->error('Add bank details before requesting a payout', null, 422);
        }

        try {
            $payout = $this->withdrawalService->requestVendorPayout(
                $request->user(),
                Money::fromMajor($request->input('amount')),
                $request->input('idempotency_key')
            );

            return $this->success($payout->fresh(), 'Payout requested', 201);
        } catch (VendorWalletBalanceException $e) {
            // Surface the field so the client can attach the message to the
            // amount input rather than showing a bare toast.
            return $this->error($e->getMessage(), ['amount' => [$e->getMessage()]], 422);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }
}
