<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\DispatchLog;
use Illuminate\Http\Request;

class DispatchLogController extends BaseController
{
    public function index(Request $request)
    {
        $query = DispatchLog::query()->with([
            'order:id,order_number,order_type,status,total_amount,delivery_partner_id',
            'ride:id,ride_number,status,estimated_fare',
            'deliveryPartner.user:id,name,phone',
            'driver.user:id,name,phone',
        ]);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($orderId = $request->query('order_id')) {
            $query->where('order_id', (int) $orderId);
        }

        if ($partnerId = $request->query('delivery_partner_id')) {
            $query->where('candidate_id', (int) $partnerId);
        }

        if ($candidateType = $request->query('candidate_type')) {
            $query->where('candidate_type', $candidateType);
        }

        $logs = $query->latest('id')->paginate($request->integer('per_page', 20));

        return $this->success($logs->items(), 'Dispatch logs retrieved', 200, [
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
