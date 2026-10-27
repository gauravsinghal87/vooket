<?php

namespace App\Http\Controllers\API;

use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\Role;
use App\Models\User;
use App\Services\AuthService;
use App\Services\WalletService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PartnerAuthController extends BaseController
{
    public function __construct(private WalletService $walletService) {}

    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'role' => 'required|in:driver,delivery_partner',
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|digits_between:7,15',
            'password' => 'required|string|min:8',
            'country_code' => 'sometimes|string|max:5',
            // Vehicle / licence / KYC
            'vehicle_type_id' => 'required_if:role,driver|exists:vehicle_types,id|nullable',
            'vehicle_type' => 'required_if:role,delivery_partner|in:car,bike,scooter,bicycle|nullable',
            'service_type' => 'required_if:role,delivery_partner|in:food,grocery|nullable',
            'zone_id' => 'required_if:role,delivery_partner|exists:zones,id|nullable',
            'vehicle_number' => 'required|string|max:20',
            'vehicle_model' => 'sometimes|nullable|string|max:100',
            'vehicle_color' => 'sometimes|nullable|string|max:50',
            'license_number' => 'required|string|max:50',
            'license_expiry' => 'required|date|after:today',
            'aadhar_number' => 'required|string|max:20',
            'pan_number' => 'sometimes|nullable|string|max:20',
            // Bank details (optional at signup, editable later)
            'bank_account_name' => 'sometimes|nullable|string|max:255',
            'bank_account_number' => 'sometimes|nullable|string|max:40',
            'bank_ifsc' => 'sometimes|nullable|string|max:20',
            'bank_name' => 'sometimes|nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $data = $validator->validated();
            $roleSlug = $data['role'];

            // Never reuse or modify an existing account (by email OR phone).
            AuthService::assertCredentialsAvailable($data['phone'], $data['email']);

            $user = DB::transaction(function () use ($data, $roleSlug) {
                $user = User::create([
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'country_code' => $data['country_code'] ?? '+91',
                    'password' => $data['password'],
                    'referral_code' => $this->generateReferralCode(),
                    'user_type' => $roleSlug,
                    'is_active' => true,
                ]);

                $role = Role::where('slug', $roleSlug)->first();
                if ($role) {
                    $user->roles()->attach($role->id);
                }

                $this->walletService->ensureWallet($user, $roleSlug);
                $this->walletService->ensureWallet($user, 'platform');

                $this->createProfile($user, $data, $roleSlug);

                return $user;
            });

            $user->refresh();

            return $this->success(
                [
                    'user' => $user->load('roles'),
                    'profile' => $roleSlug === 'driver'
                        ? Driver::where('user_id', $user->id)->first()
                        : DeliveryPartner::where('user_id', $user->id)->first(),
                ],
                'Application submitted. We will review your profile shortly.',
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
            'vehicle_type_id' => 'sometimes|exists:vehicle_types,id',
            'vehicle_type' => 'sometimes|in:car,bike,scooter,bicycle',
            'service_type' => 'sometimes|in:food,grocery',
            'vehicle_number' => 'sometimes|string|max:20',
            'vehicle_model' => 'sometimes|nullable|string|max:100',
            'vehicle_color' => 'sometimes|nullable|string|max:50',
            'license_number' => 'sometimes|string|max:50',
            'license_expiry' => 'sometimes|date|after:today',
            'aadhar_number' => 'sometimes|string|max:20',
            'pan_number' => 'sometimes|nullable|string|max:20',
            'bank_account_name' => 'sometimes|nullable|string|max:255',
            'bank_account_number' => 'sometimes|nullable|string|max:40',
            'bank_ifsc' => 'sometimes|nullable|string|max:20',
            'bank_name' => 'sometimes|nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $user = $request->user();
        $profile = $this->profileFor($user);

        if (! $profile) {
            return $this->error('No partner profile found for this account', null, 404);
        }

        $profile->update(array_merge($validator->validated(), [
            'status' => 'pending',
            'rejection_reason' => null,
            'reviewed_at' => null,
        ]));

        return $this->success($profile->fresh(), 'Application resubmitted for review');
    }

    private function createProfile(User $user, array $data, string $roleSlug): void
    {
        $fields = [
            'user_id' => $user->id,
            'status' => 'pending',
            'vehicle_number' => $data['vehicle_number'] ?? null,
            'vehicle_model' => $data['vehicle_model'] ?? null,
            'vehicle_color' => $data['vehicle_color'] ?? null,
            'license_number' => $data['license_number'] ?? null,
            'license_expiry' => $data['license_expiry'] ?? null,
            'aadhar_number' => $data['aadhar_number'] ?? null,
            'bank_account_name' => $data['bank_account_name'] ?? null,
            'bank_account_number' => $data['bank_account_number'] ?? null,
            'bank_ifsc' => $data['bank_ifsc'] ?? null,
            'bank_name' => $data['bank_name'] ?? null,
            'is_online' => false,
            'is_busy' => false,
        ];

        if ($roleSlug === 'driver') {
            Driver::create(
                array_merge($fields, [
                    'vehicle_type_id' => $data['vehicle_type_id'] ?? null,
                    'pan_number' => $data['pan_number'] ?? null,
                    'is_verified' => false,
                ])
            );
        } else {
            DeliveryPartner::create(
                array_merge($fields, [
                    'vehicle_type' => $data['vehicle_type'] ?? 'bike',
                    'service_type' => $data['service_type'] ?? 'food',
                    'current_zone_id' => $data['zone_id'] ?? null,
                ])
            );
        }
    }

    private function profileFor(User $user): Driver|DeliveryPartner|null
    {
        return Driver::where('user_id', $user->id)->first()
            ?? DeliveryPartner::where('user_id', $user->id)->first();
    }

    private function generateReferralCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (User::where('referral_code', $code)->exists());

        return $code;
    }
}
