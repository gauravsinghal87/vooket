<?php

namespace App\Http\Controllers\API;

use App\Models\Referral;
use App\Models\ReferralRule;
use Illuminate\Http\Request;

class ReferralController extends BaseController
{
    public function show(Request $request)
    {
        $user = $request->user();

        $referrals = Referral::where('referrer_id', $user->id)
            ->with('referee:id,name,phone')
            ->get();

        $totalReferrals = $referrals->count();
        $successfulReferrals = $referrals->where('status', 'completed')->count();
        $totalEarned = $referrals->where('status', 'completed')->sum('award_amount');

        $rule = ReferralRule::where('is_active', true)->first();

        return $this->success([
            'referral_code' => $user->referral_code,
            'total_referrals' => $totalReferrals,
            'successful_referrals' => $successfulReferrals,
            'total_earned' => $totalEarned,
            'referrals' => $referrals,
            'rule' => $rule,
        ]);
    }
}
