<?php

namespace App\Http\Controllers\API;

use App\Models\PushToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PushTokenController extends BaseController
{
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'token' => ['required', 'string', 'max:512'],
            'platform' => ['required', 'string', 'in:android,ios,web'],
            'app_id' => ['required', 'string', 'in:customer_web,customer_app,vendor_web,partner_web,admin_web'],
            'device_id' => ['nullable', 'string', 'max:191'],
            'device_type' => ['nullable', 'string', 'max:50'],
            'language' => ['nullable', 'string', 'max:10'],
            'meta' => ['nullable', 'array'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $userId = $request->user()->id;

        // Remove any existing token with same value (could belong to another user if token reused)
        PushToken::where('token', $request->input('token'))->delete();

        $pushToken = PushToken::updateOrCreate(
            [
                'user_id' => $userId,
                'token' => $request->input('token'),
            ],
            [
                'platform' => $request->input('platform'),
                'app_id' => $request->input('app_id'),
                'device_id' => $request->input('device_id'),
                'device_type' => $request->input('device_type'),
                'language' => $request->input('language'),
                'meta' => $request->input('meta'),
                'last_used_at' => now(),
                'disabled_at' => null,
            ]
        );

        return $this->success($pushToken, 'Push token registered.');
    }

    public function destroy(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'token' => ['required', 'string', 'max:512'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        PushToken::where('user_id', $request->user()->id)
            ->where('token', $request->input('token'))
            ->update(['disabled_at' => now()]);

        return $this->success(null, 'Push token revoked.');
    }
}
