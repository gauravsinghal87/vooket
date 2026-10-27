<?php

namespace App\Http\Controllers\API\Vendor;

use App\Http\Controllers\API\BaseController;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends BaseController
{
    public function index(Request $request)
    {
        $vendor = $request->user()->vendor;

        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $days = min(max((int) $request->query('days', 7), 1), 30);

        $counts = [
            'vendor' => [
                'id' => $vendor->id,
                'business_name' => $vendor->business_name,
                'vendor_type' => $vendor->vendor_type,
                'status' => $vendor->status,
                'commission_rate' => (float) $vendor->commission_rate,
                'is_active' => $vendor->is_active,
                'rating' => $this->vendorRating($vendor),
            ],
            'total_orders' => Order::where('vendor_id', $vendor->id)->count(),
            'today_orders' => Order::where('vendor_id', $vendor->id)->whereDate('created_at', today())->count(),
            'pending_orders' => Order::where('vendor_id', $vendor->id)->whereIn('status', ['PENDING', 'pending', 'PLACED', 'placed'])->count(),
            'active_orders' => Order::where('vendor_id', $vendor->id)->whereIn('status', ['CONFIRMED', 'confirmed', 'PREPARING', 'preparing', 'READY', 'ready', 'OUT_FOR_DELIVERY', 'out_for_delivery'])->count(),
            'delivered_orders' => Order::where('vendor_id', $vendor->id)->whereIn('status', ['DELIVERED', 'delivered'])->count(),
            'cancelled_orders' => Order::where('vendor_id', $vendor->id)->whereIn('status', ['CANCELLED', 'cancelled'])->count(),
            'today_revenue' => $this->netEarnings($vendor->id, today()),
            'total_revenue' => $this->netEarnings($vendor->id),
            'total_products' => Product::where('vendor_id', $vendor->id)->count(),
            'active_products' => Product::where('vendor_id', $vendor->id)->where('is_active', true)->count(),
            'out_of_stock' => Product::where('vendor_id', $vendor->id)->where('is_active', true)->where('is_available', false)->count(),
            'stores_count' => $vendor->stores()->count(),
            'restaurants_count' => $vendor->restaurants()->count(),
        ];

        $revenueSeries = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = today()->subDays($i);
            $revenueSeries[] = [
                'date' => $date->toDateString(),
                'orders' => Order::where('vendor_id', $vendor->id)->whereDate('created_at', $date)->count(),
                'revenue' => $this->netEarnings($vendor->id, $date),
            ];
        }

        $statusDistribution = Order::where('vendor_id', $vendor->id)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->orderByDesc('total')
            ->get();

        $recentOrders = Order::with(['user:id,name,phone'])
            ->where('vendor_id', $vendor->id)
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn ($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'order_type' => $o->order_type,
                'status' => $o->status,
                'payment_status' => $o->payment_status,
                'total_amount' => (float) $o->total_amount,
                'net_vendor_payout' => (float) $o->net_vendor_payout,
                'created_at' => $o->created_at,
                'user' => $o->user ? ['id' => $o->user->id, 'name' => $o->user->name, 'phone' => $o->user->phone] : null,
            ]);

        $topProducts = OrderItemSummary::forVendor($vendor->id)->top(5);

        return $this->success([
            'counts' => $counts,
            'revenue_series' => $revenueSeries,
            'status_distribution' => $statusDistribution,
            'recent_orders' => $recentOrders,
            'top_products' => $topProducts,
        ]);
    }

    protected function netEarnings(int $vendorId, $date = null): float
    {
        $query = Order::where('vendor_id', $vendorId)->where('payment_status', '!=', 'failed');

        if ($date) {
            $query->whereDate('created_at', $date);
        }

        return (float) $query->sum(DB::raw('COALESCE(net_vendor_payout, total_amount - COALESCE(delivery_fee, 0) - COALESCE(commission_fee, 0))'));
    }

    protected function vendorRating($vendor): float
    {
        $sources = $vendor->restaurants()->get(['rating'])->merge($vendor->stores()->get(['rating']))->filter(fn ($r) => $r->rating > 0);

        if ($sources->isEmpty()) {
            return 5.0;
        }

        return round($sources->avg('rating'), 1);
    }
}

class OrderItemSummary
{
    public static function forVendor(int $vendorId)
    {
        return new static($vendorId);
    }

    public function __construct(private int $vendorId) {}

    public function top(int $limit = 5)
    {
        return OrderItem::join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.vendor_id', $this->vendorId)
            ->whereNotIn('orders.status', ['CANCELLED', 'cancelled'])
            ->select('products.id as product_id', 'products.name as product_name', 'products.image as product_image', DB::raw('sum(order_items.quantity) as sold'), DB::raw('sum(order_items.quantity * order_items.unit_price) as revenue'))
            ->groupBy('products.id', 'products.name', 'products.image')
            ->orderByDesc('sold')
            ->limit($limit)
            ->get();
    }
}
