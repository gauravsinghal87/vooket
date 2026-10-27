<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use Illuminate\Http\Request;

class AdminController extends BaseController
{
    public function me(Request $request)
    {
        $user = $request->user()->load(['roles', 'wallet']);

        return $this->success($user);
    }
}
