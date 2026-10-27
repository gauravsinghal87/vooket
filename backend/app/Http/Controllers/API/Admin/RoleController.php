<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class RoleController extends BaseController
{
    public function index(Request $request)
    {
        $roles = Role::withCount('users')
            ->with('permissions:permissions.id,permissions.slug')
            ->orderBy('id')
            ->get()
            ->map(fn ($role) => $role->is_system ? $role : $role);

        return $this->success($roles);
    }

    public function show(Request $request, int $id)
    {
        $role = Role::with('permissions')->find($id);

        if (! $role) {
            return $this->error('Role not found', null, 404);
        }

        $permissions = Permission::orderBy('module')->get();

        return $this->success([
            'role' => $role,
            'permissions' => $permissions,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $slug = Str::slug($request->input('name'));

        $role = Role::create([
            'name' => $request->input('name'),
            'slug' => $slug,
            'is_system' => false,
        ]);

        return $this->success($role, 'Role created', 201);
    }

    public function updatePermissions(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'permissions' => 'required|array',
            'permissions.*' => 'integer|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $role = Role::find($id);
        if (! $role) {
            return $this->error('Role not found', null, 404);
        }

        $role->permissions()->sync($request->input('permissions'));

        return $this->success($role->fresh('permissions'), 'Permissions updated');
    }

    public function modules(Request $request)
    {
        $modules = Permission::select('module')
            ->distinct()
            ->orderBy('module')
            ->pluck('module');

        return $this->success($modules);
    }
}
