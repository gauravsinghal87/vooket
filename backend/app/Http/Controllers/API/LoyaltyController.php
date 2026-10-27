<?php

namespace App\Http\Controllers\API;

use App\Models\LoyaltyAccount;
use App\Models\LoyaltyTransaction;
use Illuminate\Http\Request;

class LoyaltyController extends BaseController
{
    public function show(Request $request)
    {
        $account = LoyaltyAccount::where('user_id', $request->user()->id)->first();

        if (! $account) {
            $account = LoyaltyAccount::create([
                'user_id' => $request->user()->id,
                'points_balance' => 0,
                'lifetime_points' => 0,
                'tier' => 'bronze',
                'tier_multiplier' => 1.00,
            ]);
        }

        return $this->success($account);
    }

    public function transactions(Request $request)
    {
        $transactions = LoyaltyTransaction::where('user_id', $request->user()->id)
            ->latest()
            ->paginate($request->get('per_page', 15));

        return $this->success($transactions);
    }
}
