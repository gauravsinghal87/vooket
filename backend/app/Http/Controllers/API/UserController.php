<?php

namespace App\Http\Controllers\API;

use App\Models\Order;
use App\Models\Ride;
use App\Models\SavedPlace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UserController extends BaseController
{
    public function show(Request $request)
    {
        $user = $request->user()->load(['addresses', 'wallet' => fn ($q) => $q->where('wallet_type', 'customer')]);

        return $this->success($user);
    }

    public function update(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$request->user()->id,
            'language' => 'sometimes|string|max:10',
            'currency' => 'sometimes|string|max:5',
            'timezone' => 'sometimes|string|max:50',
            'notification_preferences' => 'sometimes|array',
            'privacy_settings' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $user = $request->user();
            $user->update($validator->validated());

            return $this->success($user->fresh(), 'Profile updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function uploadAvatar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'avatar' => 'required|image|mimes:jpeg,png,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $user = $request->user();
            $path = $request->file('avatar')->store('avatars', 'public');
            $user->update(['avatar' => $path]);

            return $this->success(['avatar' => $user->fresh()->avatar], 'Avatar uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function destroy(Request $request)
    {
        try {
            $user = $request->user();
            $user->update(['is_active' => false, 'banned_at' => now(), 'ban_reason' => 'Account deleted by user']);
            $user->tokens()->delete();

            return $this->success(null, 'Account deactivated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function activity(Request $request)
    {
        $user = $request->user();

        $orders = Order::where('user_id', $user->id)
            ->latest()
            ->limit(20)
            ->get(['id', 'order_number', 'status', 'total_amount', 'order_type', 'created_at']);

        $rides = Ride::where('user_id', $user->id)
            ->latest()
            ->limit(20)
            ->get(['id', 'ride_number', 'status', 'estimated_fare', 'created_at']);

        return $this->success([
            'food' => $orders->where('order_type', 'food')->values(),
            'grocery' => $orders->where('order_type', 'grocery')->values(),
            'rides' => $rides,
        ]);
    }

    public function savedPlaces(Request $request)
    {
        $places = SavedPlace::where('user_id', $request->user()->id)->get();

        return $this->success($places);
    }

    public function storeSavedPlace(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'label' => 'required|string|max:50',
            'address' => 'required|string|max:255',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'icon' => 'sometimes|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $place = SavedPlace::create(array_merge(
                $validator->validated(),
                ['user_id' => $request->user()->id]
            ));

            return $this->success($place, 'Place saved', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function destroySavedPlace(Request $request, SavedPlace $savedPlace)
    {
        if ($savedPlace->user_id !== $request->user()->id) {
            return $this->error('Saved place not found', null, 404);
        }

        $savedPlace->delete();

        return $this->success(null, 'Place removed');
    }
}
