<?php

namespace App\Http\Controllers\API\Vendor;

use App\Exceptions\DeliverySlotException;
use App\Http\Controllers\API\BaseController;
use App\Models\DeliverySlot;
use App\Models\Store;
use App\Models\Vendor;
use App\Services\DeliverySlotService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Grocery vendor delivery-slot management.
 *
 * A vendor only ever sees and edits slots for its own stores, and only grocery
 * vendors have slot management at all.
 */
class DeliverySlotController extends BaseController
{
    public function __construct(
        private DeliverySlotService $deliverySlotService,
    ) {}

    public function index(Request $request)
    {
        $vendor = $this->groceryVendor($request);

        $request->validate([
            'from' => 'sometimes|date_format:Y-m-d',
            'to' => 'sometimes|date_format:Y-m-d|after_or_equal:from',
        ]);

        $slots = $this->deliverySlotService->vendorSlots($vendor, $request->query('from'), $request->query('to'));

        return $this->success($slots, 'Delivery slots retrieved');
    }

    public function shifts(Request $request)
    {
        $vendor = $this->groceryVendor($request);

        return $this->success($this->deliverySlotService->shifts(), 'Delivery shifts retrieved');
    }

    public function bulkStore(Request $request)
    {
        $vendor = $this->groceryVendor($request);

        $validator = Validator::make($request->all(), [
            'store_id' => 'required|integer|exists:stores,id',
            'from_date' => 'required|date_format:Y-m-d',
            'to_date' => 'required|date_format:Y-m-d|after_or_equal:from_date',
            'shifts' => 'required|array|min:1',
            'shifts.*' => 'string|in:morning,evening',
            'max_orders' => 'sometimes|integer|min:1|max:500',
            'lead_time_min' => 'sometimes|integer|min:0|max:10080',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $store = $this->resolveStore($vendor, (int) $request->input('store_id'));

        if (! $store) {
            return $this->error('Store not found', null, 404);
        }

        try {
            $result = $this->deliverySlotService->bulkCreateForVendor($vendor, $store, $validator->validated());
        } catch (DeliverySlotException $e) {
            return $this->error($e->getMessage(), null, 422);
        }

        return $this->success($result, 'Delivery slots created', 201);
    }

    public function store(Request $request)
    {
        $vendor = $this->groceryVendor($request);

        $validator = Validator::make($request->all(), [
            'store_id' => 'required|integer|exists:stores,id',
            'slot_date' => 'required|date_format:Y-m-d',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'max_orders' => 'sometimes|integer|min:1|max:500',
            'lead_time_min' => 'sometimes|integer|min:0|max:10080',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $store = $this->resolveStore($vendor, (int) $request->input('store_id'));

        if (! $store) {
            return $this->error('Store not found', null, 404);
        }

        try {
            $slot = $this->deliverySlotService->createForVendor($vendor, $store, $validator->validated());
        } catch (DeliverySlotException $e) {
            return $this->error($e->getMessage(), null, 422);
        }

        return $this->success($slot, 'Delivery slot created', 201);
    }

    public function update(Request $request, int $id)
    {
        $vendor = $this->groceryVendor($request);

        $slot = $this->findVendorSlot($vendor, $id);

        if (! $slot) {
            return $this->error('Delivery slot not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'slot_date' => 'sometimes|date_format:Y-m-d',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i',
            'max_orders' => 'sometimes|integer|min:1|max:500',
            'lead_time_min' => 'sometimes|integer|min:0|max:10080',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $slot = $this->deliverySlotService->updateForVendor($vendor, $slot, $validator->validated());
        } catch (DeliverySlotException $e) {
            return $this->error($e->getMessage(), null, 422);
        }

        return $this->success($slot, 'Delivery slot updated');
    }

    public function destroy(Request $request, int $id)
    {
        $vendor = $this->groceryVendor($request);

        $slot = $this->findVendorSlot($vendor, $id);

        if (! $slot) {
            return $this->error('Delivery slot not found', null, 404);
        }

        try {
            $this->deliverySlotService->deleteForVendor($vendor, $slot);
        } catch (DeliverySlotException $e) {
            return $this->error($e->getMessage(), null, 422);
        }

        return $this->success(null, 'Delivery slot deleted');
    }

    private function groceryVendor(Request $request): Vendor
    {
        $vendor = $request->user()->vendor;

        abort_unless($vendor, 404, 'Vendor profile not found');
        abort_unless($vendor->vendor_type === 'grocery', 403, 'Delivery slots are only available to grocery vendors');

        return $vendor;
    }

    private function resolveStore(Vendor $vendor, int $storeId): ?Store
    {
        return $vendor->stores()->whereKey($storeId)->first();
    }

    private function findVendorSlot(Vendor $vendor, int $id): ?DeliverySlot
    {
        return DeliverySlot::query()->forVendor($vendor->id)->find($id);
    }
}
