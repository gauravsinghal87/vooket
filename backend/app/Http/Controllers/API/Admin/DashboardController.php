<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Commission;
use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\Order;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends BaseController
{
    public function index(Request $request)
    {
        $days = min(max((int) $request->query('days', 7), 1), 30);

        $counts = [
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->whereNull('banned_at')->count(),
            'total_vendors' => Vendor::count(),
            'pending_vendors' => Vendor::where('status', 'pending')->count(),
            'suspended_vendors' => Vendor::where('status', 'suspended')->count(),
            'total_restaurants' => Restaurant::count(),
            'total_stores' => Store::count(),
            'total_products' => Product::count(),
            'total_orders' => Order::count(),
            'total_drivers' => Driver::count(),
            'total_delivery_partners' => DeliveryPartner::count(),
            'today_orders' => Order::whereDate('created_at', today())->count(),
            // Gross order value is the money customers paid, NOT platform
            // revenue. Platform revenue is the commission the platform keeps.
            'today_gross_order_value' => (float) Order::whereDate('created_at', today())->where('payment_status', '!=', 'failed')->sum('total_amount'),
            'total_gross_order_value' => (float) Order::where('payment_status', '!=', 'failed')->sum('total_amount'),
            'today_platform_revenue' => $this->platformRevenue(today()),
            'total_platform_revenue' => $this->platformRevenue(),
            'delivered_orders' => Order::whereIn('status', ['DELIVERED', 'delivered'])->count(),
        ];

        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = today()->subDays($i);
            $series[] = [
                'date' => $date->toDateString(),
                'orders' => Order::whereDate('created_at', $date)->count(),
                'gross_order_value' => (float) Order::whereDate('created_at', $date)->where('payment_status', '!=', 'failed')->sum('total_amount'),
                'commission' => $this->platformRevenue($date),
            ];
        }

        $statusDistribution = Order::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->orderByDesc('total')
            ->get();

        $recentOrders = Order::with(['user:id,name,email,phone', 'vendor:id,business_name,vendor_type'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn ($o) => $this->orderShape($o));

        $topVendors = Vendor::withCount(['orders' => fn ($q) => $q->whereNotIn('status', ['CANCELLED', 'cancelled'])])
            ->withSum(['orders' => fn ($q) => $q->where('payment_status', '!=', 'failed')], 'total_amount')
            ->orderByDesc('orders_sum_total_amount')
            ->limit(5)
            ->get()
            ->map(fn ($v) => [
                'id' => $v->id,
                'business_name' => $v->business_name,
                'vendor_type' => $v->vendor_type,
                'status' => $v->status,
                'orders_count' => (int) $v->orders_count,
                'gross_order_value' => (float) $v->orders_sum_total_amount,
                'commission' => (float) Commission::where('vendor_id', $v->id)
                    ->where('status', '!=', 'reversed')
                    ->sum('commission_amount'),
            ]);

        return $this->success([
            'counts' => $counts,
            'revenue_series' => $series,
            'order_status_distribution' => $statusDistribution,
            'recent_orders' => $recentOrders,
            'top_vendors' => $topVendors,
        ]);
    }

    /**
     * Platform revenue = commission the platform actually earns from vendor
     * and driver commissions. Reversed commissions (refunds) are excluded.
     * This is the figure that may legitimately be labelled "revenue".
     */
    private function platformRevenue(?\DateTimeInterface $onDate = null): float
    {
        $query = Commission::where('status', '!=', 'reversed');

        if ($onDate !== null) {
            $query->whereDate('created_at', $onDate);
        }

        return (float) $query->sum('commission_amount');
    }

    protected function orderShape(Order $o): array
    {
        return [
            'id' => $o->id,
            'order_number' => $o->order_number,
            'order_type' => $o->order_type,
            'status' => $o->status,
            'payment_status' => $o->payment_status,
            'total_amount' => (float) $o->total_amount,
            'created_at' => $o->created_at,
            'user' => $o->user ? ['id' => $o->user->id, 'name' => $o->user->name, 'email' => $o->user->email, 'phone' => $o->user->phone] : null,
            'vendor' => $o->vendor ? ['id' => $o->vendor->id, 'business_name' => $o->vendor->business_name, 'vendor_type' => $o->vendor->vendor_type] : null,
        ];
    }
}
