<?php

namespace App\Http\Controllers\API;

use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\AuthService;
use App\Services\RestaurantOperatingHoursService;
use App\Services\WalletService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class VendorAuthController extends BaseController
{
    public function __construct(private WalletService $walletService) {}

    public function register(Request $request)
    {
        $rules = [
            'vendor_type' => 'required|in:restaurant,grocery',
            'business_name' => 'required|string|max:255',
            'owner_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|digits_between:7,15',
            'password' => 'required|string|min:8',
            'country_code' => 'sometimes|string|max:5',
            'address' => 'sometimes|nullable|string|max:500',
            'gst_number' => 'sometimes|nullable|string|max:50',
            'pan_number' => 'sometimes|nullable|string|max:50',
            'fssai_number' => 'required_if:vendor_type,restaurant|nullable|string|max:50',
            'bank_account_name' => 'sometimes|nullable|string|max:255',
            'bank_account_number' => 'sometimes|nullable|string|max:50',
            'bank_ifsc' => 'sometimes|nullable|string|max:20',
            'bank_name' => 'sometimes|nullable|string|max:120',
            'latitude' => 'sometimes|nullable|numeric|between:-90,90',
            'longitude' => 'sometimes|nullable|numeric|between:-180,180',
        ];

        // Restaurant-only preparation time and operating hours. Required for
        // food registrations; rejected outright for grocery vendors so the
        // fields can never silently attach to a non-food business.
        foreach (RestaurantOperatingHoursService::rules(true) as $field => $fieldRules) {
            $fieldRules[0] = 'required_if:vendor_type,restaurant';
            $rules[$field] = array_merge($fieldRules, ['prohibited_unless:vendor_type,restaurant']);
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $data = $validator->validated();

            // Never reuse or modify an existing account (by email OR phone).
            AuthService::assertCredentialsAvailable($data['phone'], $data['email']);

            $user = DB::transaction(function () use ($data) {
                $user = User::create([
                    'name' => $data['owner_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'country_code' => $data['country_code'] ?? '+91',
                    'password' => $data['password'],
                    'referral_code' => $this->generateReferralCode(),
                    'user_type' => 'vendor',
                    'is_active' => true,
                ]);

                $role = Role::where('slug', 'vendor')->first();
                if ($role) {
                    $user->roles()->attach($role->id);
                }

                $this->walletService->ensureWallet($user, 'vendor');
                $this->walletService->ensureWallet($user, 'platform');

                $vendor = Vendor::create([
                    'user_id' => $user->id,
                    'business_name' => $data['business_name'],
                    'vendor_type' => $data['vendor_type'],
                    'owner_name' => $data['owner_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'address' => $data['address'] ?? null,
                    'gst_number' => $data['gst_number'] ?? null,
                    'pan_number' => $data['pan_number'] ?? null,
                    'fssai_number' => $data['fssai_number'] ?? null,
                    'bank_account_name' => $data['bank_account_name'] ?? null,
                    'bank_account_number' => $data['bank_account_number'] ?? null,
                    'bank_ifsc' => $data['bank_ifsc'] ?? null,
                    'bank_name' => $data['bank_name'] ?? null,
                    'latitude' => $data['latitude'] ?? null,
                    'longitude' => $data['longitude'] ?? null,
                    'status' => 'pending',
                    'rejection_reason' => null,
                    'approved_at' => null,
                    'is_active' => true,
                ]);

                // Create the food outlet up front (same shape the approval
                // flow's ensureOutlet() produces) so the restaurant's
                // preparation time and operating hours are persisted at
                // registration. ensureOutlet() stays idempotent, so approval
                // and later calls reuse this row instead of duplicating it.
                if ($vendor->vendor_type === 'restaurant') {
                    $vendor->ensureOutlet()?->update([
                        'avg_prep_time_min' => $data['avg_prep_time_min'],
                        'opens_at' => $data['opens_at'],
                        'closes_at' => $data['closes_at'],
                    ]);
                }

                return $user;
            });

            $user->refresh();

            return $this->success(
                [
                    'user' => $user->load('roles'),
                    'profile' => Vendor::where('user_id', $user->id)->first(),
                ],
                'Application submitted. We will review your business shortly.',
                201
            );
        } catch (QueryException $e) {
            return $this->isUniqueViolation($e)
                ? $this->error(AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE, null, 422)
                : $this->authFailure($e, 400);
        } catch (\Exception $e) {
            return $this->authFailure($e, 400);
        }
    }

    public function reapply(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vendor_type' => 'sometimes|in:restaurant,grocery',
            'business_name' => 'sometimes|string|max:255',
            'owner_name' => 'sometimes|string|max:255',
            'address' => 'sometimes|nullable|string|max:500',
            'gst_number' => 'sometimes|nullable|string|max:50',
            'pan_number' => 'sometimes|nullable|string|max:50',
            'fssai_number' => 'sometimes|nullable|string|max:50',
            'bank_account_name' => 'sometimes|nullable|string|max:255',
            'bank_account_number' => 'sometimes|nullable|string|max:50',
            'bank_ifsc' => 'sometimes|nullable|string|max:20',
            'bank_name' => 'sometimes|nullable|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $user = $request->user();
        $vendor = $user->vendor;

        if (! $vendor) {
            return $this->error('No vendor profile found for this account', null, 404);
        }

        $vendor->update(array_merge($validator->validated(), [
            'status' => 'pending',
            'rejection_reason' => null,
            'approved_at' => null,
            'is_active' => true,
        ]));

        $user->update(['is_active' => true, 'banned_at' => null]);

        return $this->success($vendor->fresh(), 'Application resubmitted for review');
    }

    private function generateReferralCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (User::where('referral_code', $code)->exists());

        return $code;
    }
}
