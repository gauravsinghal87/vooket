<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\User;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UserManagementController extends BaseController
{
    public function __construct(private WalletService $walletService) {}

    public function index(Request $request)
    {
        $query = User::with(['roles', 'vendor:id,user_id,business_name,vendor_type,status'])
            ->withCount(['orders', 'rides']);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($type = $request->query('user_type')) {
            $query->where('user_type', $type);
        }

        if ($role = $request->query('role')) {
            $query->whereHas('roles', fn ($q) => $q->where('slug', $role));
        }

        if ($status = $request->query('status')) {
            if ($status === 'banned') {
                $query->whereNotNull('banned_at');
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            } else {
                $query->where('is_active', true)->whereNull('banned_at');
            }
        }

        $users = $query->latest()->paginate($request->integer('per_page', 20));

        return $this->success($users->items(), 'Users retrieved', 200, [
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $user = User::with(['roles', 'wallet', 'driver', 'deliveryPartner', 'vendor', 'addresses'])
            ->withCount(['orders', 'rides'])
            ->find($id);

        if (! $user) {
            return $this->error('User not found', null, 404);
        }

        return $this->success($user);
    }

    public function updateStatus(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'action' => 'required|in:activate,ban',
            'ban_reason' => 'required_if:action,ban|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $user = User::find($id);
        if (! $user) {
            return $this->error('User not found', null, 404);
        }

        $action = $request->input('action');
        if ($action === 'activate') {
            $user->update([
                'is_active' => true,
                'banned_at' => null,
                'ban_reason' => null,
            ]);
        } else {
            $user->update([
                'is_active' => false,
                'banned_at' => now(),
                'ban_reason' => $request->input('ban_reason'),
            ]);
            $user->tokens()->delete();
        }

        return $this->success($user->fresh(), 'User status updated');
    }

    public function assignRole(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'role' => 'required|exists:roles,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $user = User::find($id);
        if (! $user) {
            return $this->error('User not found', null, 404);
        }

        $user->roles()->syncWithoutDetaching([(int) $request->input('role')]);

        return $this->success($user->fresh('roles'), 'Role assigned');
    }

    public function removeRole(Request $request, int $id, int $roleId)
    {
        $user = User::find($id);
        if (! $user) {
            return $this->error('User not found', null, 404);
        }

        $user->roles()->detach($roleId);

        return $this->success($user->fresh('roles'), 'Role removed');
    }

    public function wallet(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'wallet_type' => 'required|in:customer,vendor,driver,delivery_partner',
            'amount' => 'required|numeric|not_in:0',
            'type' => 'required|in:credit,debit',
            'note' => 'sometimes|string|max:255',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $user = User::find($id);
        if (! $user) {
            return $this->error('User not found', null, 404);
        }

        $type = $request->input('type');

        try {
            $this->walletService->adjust(
                $user,
                $request->input('wallet_type'),
                Money::fromMajor($request->input('amount')),
                $type,
                $request->input('note') ?? 'Admin adjustment',
                $request->user(),
                $request->input('note'),
                $request->input('idempotency_key') ?: null,
            );

            $wallet = $this->walletService->ensureWallet($user, $request->input('wallet_type'));

            return $this->success($wallet->fresh(), 'Wallet adjusted');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }
}
