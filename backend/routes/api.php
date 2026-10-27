<?php

use App\Http\Controllers\API\AddressController;
use App\Http\Controllers\API\Admin\AdminController;
use App\Http\Controllers\API\Admin\CatalogController;
use App\Http\Controllers\API\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\API\Admin\DashboardController;
use App\Http\Controllers\API\Admin\DispatchLogController;
use App\Http\Controllers\API\Admin\FareRuleController;
use App\Http\Controllers\API\Admin\IntegrationController;
use App\Http\Controllers\API\Admin\OrderManagementController;
use App\Http\Controllers\API\Admin\PayoutController;
use App\Http\Controllers\API\Admin\PromotionController;
use App\Http\Controllers\API\Admin\RefundController;
use App\Http\Controllers\API\Admin\RoleController;
use App\Http\Controllers\API\Admin\SettingsController;
use App\Http\Controllers\API\Admin\SmtpTestController;
use App\Http\Controllers\API\Admin\UserManagementController;
use App\Http\Controllers\API\Admin\VendorImpersonationController;
use App\Http\Controllers\API\Admin\VendorManagementController;
use App\Http\Controllers\API\Admin\ZoneController;
use App\Http\Controllers\API\Admin\ZoneDeliveryConfigController;
use App\Http\Controllers\API\AiController;
use App\Http\Controllers\API\AppConfigController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\CartController;
use App\Http\Controllers\API\CouponController;
use App\Http\Controllers\API\DeliveryPartnerController;
use App\Http\Controllers\API\DiscoveryController;
use App\Http\Controllers\API\DriverController;
use App\Http\Controllers\API\FoodController;
use App\Http\Controllers\API\GeocodeController;
use App\Http\Controllers\API\GroceryController;
use App\Http\Controllers\API\ImpersonationExchangeController;
use App\Http\Controllers\API\LoyaltyController;
use App\Http\Controllers\API\NotificationController;
use App\Http\Controllers\API\OrderController;
use App\Http\Controllers\API\PartnerAuthController;
use App\Http\Controllers\API\PaymentController;
use App\Http\Controllers\API\PaymentWebhookController;
use App\Http\Controllers\API\ReferralController;
use App\Http\Controllers\API\RideController;
use App\Http\Controllers\API\ServiceabilityController;
use App\Http\Controllers\API\SupportTicketController;
use App\Http\Controllers\API\UserController;
use App\Http\Controllers\API\Vendor\CategoryController as VendorCategoryController;
use App\Http\Controllers\API\Vendor\DeliverySlotController;
use App\Http\Controllers\API\Vendor\EarningsController;
use App\Http\Controllers\API\Vendor\ImpersonationController;
use App\Http\Controllers\API\Vendor\OutletController;
use App\Http\Controllers\API\Vendor\ProductController;
use App\Http\Controllers\API\Vendor\VendorController;
use App\Http\Controllers\API\VendorAuthController;
use App\Http\Controllers\API\WalletController;
use App\Http\Controllers\API\WebhookSubscriptionController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public auth routes
    Route::prefix('auth')->group(function () {
        Route::post('/otp/send', [AuthController::class, 'sendOtp'])->middleware('throttle:otp-send');
        Route::post('/otp/verify', [AuthController::class, 'verifyOtp'])->middleware('throttle:otp-verify');
        Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('/login/email', [AuthController::class, 'loginWithEmail'])->middleware('throttle:login-email');
        Route::post('/google', [AuthController::class, 'google'])->middleware('throttle:google-login');
        Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:forgot-password');
        Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:reset-password');
        Route::post('/partner/register', [PartnerAuthController::class, 'register'])->middleware('throttle:partner-register');
        Route::post('/vendor/register', [VendorAuthController::class, 'register'])->middleware('throttle:vendor-register');

        // Admin -> vendor impersonation handoff. Unauthenticated by design:
        // the short-lived single-use code is the credential. Hard rate limited
        // because there is no session to throttle against.
        Route::post('/vendor/impersonate/exchange', [ImpersonationExchangeController::class, 'exchange'])
            ->middleware('throttle:20,1');
    });

    // Public catalog / discovery
    Route::get('/zones', [ZoneController::class, 'publicActive']);

    // Public banners, targeted by service + placement (e.g. food_home_hero)
    Route::get('/banners', [DiscoveryController::class, 'banners']);

    Route::prefix('discovery')->group(function () {
        Route::get('/home', [DiscoveryController::class, 'home']);
        Route::get('/search', [DiscoveryController::class, 'search']);
        Route::get('/categories', [DiscoveryController::class, 'categories']);
        Route::get('/featured', [DiscoveryController::class, 'featured']);
    });

    // Food public
    Route::prefix('food')->group(function () {
        Route::get('/restaurants', [FoodController::class, 'restaurants']);
        Route::get('/restaurants/{id}', [FoodController::class, 'restaurantDetail']);
        Route::get('/restaurants/{id}/menu', [FoodController::class, 'menu']);
        Route::get('/categories', [FoodController::class, 'categories']);
        Route::get('/cuisines', [FoodController::class, 'cuisines']);
    });

    // Public place-search discovery (pre-login address map picker — all-India data)
    Route::prefix('geocode')->group(function () {
        Route::get('/search', [GeocodeController::class, 'search']);
        Route::get('/details', [GeocodeController::class, 'details']);
        Route::get('/reverse', [GeocodeController::class, 'reverse']);
    });

    // Grocery public
    Route::prefix('grocery')->group(function () {
        Route::get('/stores', [GroceryController::class, 'stores']);
        Route::get('/stores/{id}', [GroceryController::class, 'storeDetail']);
        Route::get('/stores/{id}/products', [GroceryController::class, 'products']);
        Route::get('/products', [GroceryController::class, 'allProducts']);
        Route::get('/categories', [GroceryController::class, 'categories']);
        Route::get('/brands', [GroceryController::class, 'brands']);
        Route::get('/delivery-slots', [GroceryController::class, 'deliverySlots']);
        Route::get('/stores/{store}/delivery-slots', [GroceryController::class, 'deliverySlots'])
            ->whereNumber('store');
    });

    // Rides public (fare estimate, promos)
    Route::get('/vehicle-types', [RideController::class, 'vehicleTypes']);
    Route::post('/rides/estimate', [RideController::class, 'estimate'])
        ->middleware('throttle:30,1');
    Route::get('/rides/promos', [DiscoveryController::class, 'ridesPromos']);

    // Public client bootstrap config (safe values only, no secrets)
    Route::get('/app-config', [AppConfigController::class, 'show']);
    Route::get('/config/maps', [AppConfigController::class, 'maps']);

    // Public zone serviceability (drives the address map picker gating)
    Route::get('/serviceability', [ServiceabilityController::class, 'check']);
    Route::get('/serviceability/services', [ServiceabilityController::class, 'services']);

    // Inbound payment provider webhooks (signature-verified, not auth'd)
    Route::post('/webhooks/razorpay', [PaymentWebhookController::class, 'razorpay'])
        ->middleware('throttle:60,1');

    // Authenticated routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/device', [AuthController::class, 'registerDevice']);
        Route::post('/auth/partner/reapply', [PartnerAuthController::class, 'reapply']);
        Route::post('/auth/vendor/reapply', [VendorAuthController::class, 'reapply']);
        Route::delete('/account', [UserController::class, 'destroy']);

        // Outbound webhook subscriptions / delivery history
        Route::prefix('webhooks')->group(function () {
            Route::get('/health', [WebhookSubscriptionController::class, 'health']);
            Route::get('/subscriptions', [WebhookSubscriptionController::class, 'index']);
            Route::post('/subscribe', [WebhookSubscriptionController::class, 'store']);
            Route::get('/subscriptions/{id}', [WebhookSubscriptionController::class, 'show']);
            Route::put('/subscriptions/{id}', [WebhookSubscriptionController::class, 'update']);
            Route::delete('/subscriptions/{id}', [WebhookSubscriptionController::class, 'destroy']);
            Route::post('/subscriptions/{id}/ping', [WebhookSubscriptionController::class, 'ping']);
            Route::get('/subscriptions/{id}/deliveries', [WebhookSubscriptionController::class, 'deliveries']);
        });

        // User profile
        Route::prefix('profile')->group(function () {
            Route::get('/', [UserController::class, 'show']);
            Route::put('/', [UserController::class, 'update']);
            Route::post('/avatar', [UserController::class, 'uploadAvatar']);
        });

        // Addresses
        Route::apiResource('addresses', AddressController::class);
        Route::post('/addresses/{id}/default', [AddressController::class, 'setDefault']);

        // Cart
        Route::prefix('cart')->group(function () {
            Route::get('/', [CartController::class, 'show']);
            Route::post('/items', [CartController::class, 'addItem']);
            Route::put('/items/{id}', [CartController::class, 'updateItem']);
            Route::delete('/items/{id}', [CartController::class, 'removeItem']);
            Route::post('/coupon', [CartController::class, 'applyCoupon']);
            Route::delete('/coupon', [CartController::class, 'removeCoupon']);
            Route::post('/delivery-address', [CartController::class, 'setDeliveryAddress']);
            Route::delete('/', [CartController::class, 'clear']);
        });

        // Orders
        Route::prefix('orders')->group(function () {
            Route::get('/', [OrderController::class, 'index']);
            Route::post('/', [OrderController::class, 'store']);
            Route::get('/{id}', [OrderController::class, 'show']);
            Route::post('/{id}/cancel', [OrderController::class, 'cancel']);
            Route::post('/{id}/refund', [RefundController::class, 'refundCancelledOrder']);
            Route::post('/{id}/reorder', [OrderController::class, 'reorder']);
            Route::post('/{id}/rate', [OrderController::class, 'rate']);
            Route::get('/{id}/invoice', [OrderController::class, 'invoice']);
            Route::post('/{id}/refund-request', [OrderController::class, 'refundRequest']);
            Route::get('/{id}/tracking', [OrderController::class, 'tracking'])->middleware('throttle:tracking');
            Route::get('/{id}/delivery-otp', [OrderController::class, 'deliveryOtp']);
            Route::get('/{id}/preparation-instructions', [OrderController::class, 'preparationInstructions']);
            Route::patch('/{id}/preparation-instructions', [OrderController::class, 'updatePreparationInstructions']);
        });

        // Rides
        Route::prefix('rides')->group(function () {
            Route::get('/', [RideController::class, 'index']);
            Route::post('/', [RideController::class, 'store']);
            Route::get('/nearby-drivers', [RideController::class, 'nearbyDrivers']);
            Route::post('/route', [RideController::class, 'route'])
                ->middleware('throttle:30,1');
            Route::get('/{id}', [RideController::class, 'show']);
            Route::post('/{id}/cancel', [RideController::class, 'cancel']);
            Route::post('/{id}/verify-otp', [RideController::class, 'verifyOtp']);
            Route::post('/{id}/rate', [RideController::class, 'rate']);
            Route::post('/{id}/sos', [RideController::class, 'sos']);
            Route::get('/{id}/tracking', [RideController::class, 'tracking'])->middleware('throttle:tracking');
        });

        // Wallet
        Route::prefix('wallet')->group(function () {
            Route::get('/', [WalletController::class, 'show']);
            Route::get('/transactions', [WalletController::class, 'transactions']);
            Route::post('/topup', [WalletController::class, 'topup']);
            Route::post('/verify-payment', [WalletController::class, 'verifyTopup']);
        });

        // Payments
        Route::prefix('payments')->group(function () {
            Route::post('/initiate', [PaymentController::class, 'initiate']);
            Route::post('/verify', [PaymentController::class, 'verify']);
        });

        // Coupons
        Route::get('/coupons', [CouponController::class, 'available']);
        Route::post('/coupons/validate', [CouponController::class, 'validate']);

        // Loyalty
        Route::prefix('loyalty')->group(function () {
            Route::get('/', [LoyaltyController::class, 'show']);
            Route::get('/transactions', [LoyaltyController::class, 'transactions']);
        });

        // Notifications
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
            Route::post('/{id}/read', [NotificationController::class, 'markRead']);
            Route::post('/read-all', [NotificationController::class, 'markAllRead']);
        });

        // Support
        Route::get('/support-tickets/issue-categories', [SupportTicketController::class, 'issueCategories']);
        Route::apiResource('support-tickets', SupportTicketController::class);
        Route::post('/support-tickets/{id}/messages', [SupportTicketController::class, 'sendMessage']);
        Route::get('/support-tickets/{ticketId}/attachments/{attachmentId}', [SupportTicketController::class, 'attachmentUrl']);
        Route::get('/support-tickets/{ticketId}/attachments/{attachmentId}/file', [SupportTicketController::class, 'attachmentFile']);

        // Referral
        Route::get('/referral', [ReferralController::class, 'show']);

        // AI
        Route::prefix('ai')->group(function () {
            Route::get('/recommendations/{service}', [AiController::class, 'recommendations']);
            Route::get('/grocery/predictions', [AiController::class, 'groceryPredictions']);
            Route::get('/grocery/monthly', [AiController::class, 'monthlySuggestions']);
            Route::post('/assistant', [AiController::class, 'assistant']);
        });

        // Orders history / activity
        Route::get('/activity', [UserController::class, 'activity']);
        Route::get('/saved-places', [UserController::class, 'savedPlaces']);
        Route::post('/saved-places', [UserController::class, 'storeSavedPlace']);
        Route::delete('/saved-places/{savedPlace}', [UserController::class, 'destroySavedPlace']);

        // Driver-specific routes (driver role only)
        Route::prefix('driver')->middleware('role:driver')->group(function () {
            Route::get('/profile', [DriverController::class, 'profile']);
            Route::put('/profile', [DriverController::class, 'updateProfile']);
            Route::post('/documents', [DriverController::class, 'uploadDocuments']);
            Route::post('/bank-details', [DriverController::class, 'updateBank']);
            Route::post('/availability', [DriverController::class, 'toggleAvailability']);
            Route::post('/location', [DriverController::class, 'updateLocation']);
            Route::get('/incoming-requests', [DriverController::class, 'incomingRequests']);
            Route::post('/requests/{rideRequestId}/accept', [DriverController::class, 'acceptRequest']);
            Route::post('/requests/{rideRequestId}/reject', [DriverController::class, 'rejectRequest']);
            Route::get('/trips/active', [DriverController::class, 'activeTrip']);
            Route::post('/trips/{rideId}/status', [DriverController::class, 'updateTripStatus']);
            Route::post('/rides/{rideId}/verify-customer-otp', [DriverController::class, 'verifyCustomerOtp']);
            Route::post('/rides/{rideId}/cash-collect', [DriverController::class, 'confirmCashCollection']);
            Route::post('/rides/{rideId}/cash-settle', [DriverController::class, 'settleCash']);
            Route::get('/earnings', [DriverController::class, 'earnings']);
            Route::get('/withdrawals', [DriverController::class, 'withdrawals']);
            Route::post('/withdrawals', [DriverController::class, 'requestWithdrawal']);
            Route::get('/wallet', [DriverController::class, 'wallet']);
            Route::get('/wallet/transactions', [DriverController::class, 'walletTransactions']);
            Route::post('/wallet/topup', [DriverController::class, 'walletTopup']);
            Route::post('/wallet/verify-topup', [DriverController::class, 'verifyWalletTopup']);
        });

        // Delivery partner-specific routes (delivery_partner role only)
        Route::prefix('delivery-partner')->middleware('role:delivery_partner')->group(function () {
            Route::get('/profile', [DeliveryPartnerController::class, 'profile']);
            Route::put('/profile', [DeliveryPartnerController::class, 'updateProfile']);
            Route::post('/documents', [DeliveryPartnerController::class, 'uploadDocuments']);
            Route::post('/bank-details', [DeliveryPartnerController::class, 'updateBank']);
            Route::post('/availability', [DeliveryPartnerController::class, 'toggleAvailability']);
            Route::post('/location', [DeliveryPartnerController::class, 'updateLocation'])->middleware('throttle:partner-location');
            Route::get('/incoming-orders', [DeliveryPartnerController::class, 'incomingOrders']);
            Route::get('/active-job', [DeliveryPartnerController::class, 'activeJob']);
            Route::post('/orders/{dispatchLogId}/accept', [DeliveryPartnerController::class, 'acceptOrder']);
            Route::post('/orders/{dispatchLogId}/reject', [DeliveryPartnerController::class, 'rejectOrder']);
            Route::post('/orders/{orderId}/status', [DeliveryPartnerController::class, 'updateOrderStatus']);
            Route::post('/orders/{orderId}/proof', [DeliveryPartnerController::class, 'uploadProof']);
            Route::post('/orders/{orderId}/confirm-payment', [DeliveryPartnerController::class, 'confirmPaymentCollection']);
            Route::post('/orders/{orderId}/settle-cash', [DeliveryPartnerController::class, 'settleCash']);
            Route::post('/orders/{orderId}/delivery-otp', [DeliveryPartnerController::class, 'requestDeliveryOtp'])->middleware('throttle:partner-delivery-otp');
            Route::post('/orders/{orderId}/verify-delivery-otp', [DeliveryPartnerController::class, 'verifyDeliveryOtp'])->middleware('throttle:partner-delivery-otp-verify');
            Route::get('/earnings', [DeliveryPartnerController::class, 'earnings']);
            Route::get('/withdrawals', [DeliveryPartnerController::class, 'withdrawals']);
            Route::post('/withdrawals', [DeliveryPartnerController::class, 'requestWithdrawal']);
            Route::get('/wallet', [DeliveryPartnerController::class, 'wallet']);
            Route::get('/wallet/transactions', [DeliveryPartnerController::class, 'walletTransactions']);
            Route::post('/wallet/topup', [DeliveryPartnerController::class, 'walletTopup']);
            Route::post('/wallet/verify-topup', [DeliveryPartnerController::class, 'verifyWalletTopup']);
        });
    });

    // ================= Admin panel (super_admin role) =================
    Route::prefix('admin')->middleware(['auth:sanctum', 'role:super_admin'])->group(function () {
        Route::get('/me', [AdminController::class, 'me']);
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Users
        Route::get('/users', [UserManagementController::class, 'index']);
        Route::get('/users/{id}', [UserManagementController::class, 'show']);
        Route::put('/users/{id}/status', [UserManagementController::class, 'updateStatus']);
        Route::post('/users/{id}/roles', [UserManagementController::class, 'assignRole']);
        Route::delete('/users/{id}/roles/{roleId}', [UserManagementController::class, 'removeRole']);
        Route::post('/users/{id}/wallet', [UserManagementController::class, 'wallet']);

        // Refunds
        Route::get('/refunds', [RefundController::class, 'index']);
        Route::get('/refunds/{refund}', [RefundController::class, 'show']);
        Route::post('/refunds', [RefundController::class, 'store']);
        Route::post('/refunds/{refund}/approve', [RefundController::class, 'approve']);
        Route::post('/refunds/{refund}/process', [RefundController::class, 'process']);
        Route::post('/refunds/{refund}/reject', [RefundController::class, 'reject']);

        // Grocery item-level adjustments (admin)
        Route::post('/orders/{id}/adjust-items', [RefundController::class, 'adjustItems']);

        // Payouts (vendor/driver/delivery-partner settlement payouts)
        Route::get('/payouts', [PayoutController::class, 'index']);
        Route::get('/payouts/{payout}', [PayoutController::class, 'show']);
        Route::post('/payouts/{payout}/processing', [PayoutController::class, 'processing']);
        Route::post('/payouts/{payout}/paid', [PayoutController::class, 'paid']);
        Route::post('/payouts/{payout}/failed', [PayoutController::class, 'failed']);

        // Vendors (approval workflow)
        Route::get('/vendors', [VendorManagementController::class, 'index']);
        Route::get('/vendors/{id}', [VendorManagementController::class, 'show']);
        Route::post('/vendors/{id}/review', [VendorManagementController::class, 'review']);
        Route::put('/vendors/{id}/commission', [VendorManagementController::class, 'updateCommission']);

        // Super Admin vendor impersonation. Already behind auth:sanctum +
        // role:super_admin; the controller additionally requires the
        // vendors.view permission.
        Route::post('/vendors/{id}/impersonate', [VendorImpersonationController::class, 'start']);

        // Restaurants / Stores / Products
        Route::get('/restaurants', [CatalogController::class, 'restaurants']);
        Route::get('/restaurants/{id}', [CatalogController::class, 'restaurantShow']);
        Route::post('/restaurants/{id}/toggle', [CatalogController::class, 'toggleRestaurant']);
        Route::get('/stores', [CatalogController::class, 'stores']);
        Route::get('/stores/{id}', [CatalogController::class, 'storeShow']);
        Route::post('/stores/{id}/toggle', [CatalogController::class, 'toggleStore']);
        Route::get('/products', [CatalogController::class, 'products']);
        Route::post('/products/{id}/toggle', [CatalogController::class, 'toggleProduct']);

        // Categories (hierarchical global taxonomy)
        Route::prefix('categories')->group(function () {
            Route::get('/', [AdminCategoryController::class, 'index'])->middleware('permission:categories.view');
            Route::get('/tree', [AdminCategoryController::class, 'tree'])->middleware('permission:categories.view');
            Route::post('/', [AdminCategoryController::class, 'store'])->middleware('permission:categories.create');
            Route::post('/reorder', [AdminCategoryController::class, 'reorder'])->middleware('permission:categories.reorder');
            Route::post('/bulk', [AdminCategoryController::class, 'bulk'])->middleware('permission:categories.update');
            Route::post('/upload-image', [AdminCategoryController::class, 'uploadImage'])->middleware('permission:categories.update');
            Route::post('/upload-navigation-icon', [AdminCategoryController::class, 'uploadNavigationIcon'])->middleware('permission:categories.update');
            Route::get('/{category}', [AdminCategoryController::class, 'show'])->middleware('permission:categories.view');
            Route::put('/{category}', [AdminCategoryController::class, 'update'])->middleware('permission:categories.update');
            Route::delete('/{category}', [AdminCategoryController::class, 'destroy'])->middleware('permission:categories.delete');
            Route::delete('/{category}/image', [AdminCategoryController::class, 'deleteImage'])->middleware('permission:categories.update');
            Route::delete('/{category}/navigation-icon', [AdminCategoryController::class, 'deleteNavigationIcon'])->middleware('permission:categories.update');
            Route::post('/{id}/restore', [AdminCategoryController::class, 'restore'])->middleware('permission:categories.restore');
            Route::post('/{category}/toggle', [AdminCategoryController::class, 'toggle'])->middleware('permission:categories.update');
            Route::post('/{category}/toggle-featured', [AdminCategoryController::class, 'toggleFeatured'])->middleware('permission:categories.feature');
        });

        // Orders
        Route::get('/orders', [OrderManagementController::class, 'index']);
        Route::get('/orders/{id}', [OrderManagementController::class, 'show']);
        Route::put('/orders/{id}/status', [OrderManagementController::class, 'updateStatus']);
        Route::put('/orders/{id}/assign-partner', [OrderManagementController::class, 'assignPartner']);
        Route::get('/orders/{id}/eligible-delivery-partners', [OrderManagementController::class, 'eligibleDeliveryPartners']);
        Route::post('/orders/{id}/assign-delivery-partner', [OrderManagementController::class, 'assignDeliveryPartner']);
        Route::get('/dispatch-logs', [DispatchLogController::class, 'index']);

        // Coupons & Banners
        Route::get('/coupons', [PromotionController::class, 'coupons']);
        Route::post('/coupons', [PromotionController::class, 'storeCoupon']);
        Route::put('/coupons/{id}', [PromotionController::class, 'updateCoupon']);
        Route::delete('/coupons/{id}', [PromotionController::class, 'destroyCoupon']);
        Route::get('/banners', [PromotionController::class, 'banners']);
        Route::post('/banners/upload', [PromotionController::class, 'uploadImage']);
        Route::post('/banners/upload-video', [PromotionController::class, 'uploadVideo']);
        Route::post('/banners', [PromotionController::class, 'storeBanner']);
        Route::put('/banners/{id}', [PromotionController::class, 'updateBanner']);
        Route::post('/banners/{id}/toggle', [PromotionController::class, 'toggleBanner']);
        Route::delete('/banners/{id}', [PromotionController::class, 'destroyBanner']);
        Route::get('/banners/{id}', [PromotionController::class, 'showBanner']);

        // Settings / operations
        Route::get('/app-settings', [SettingsController::class, 'appSettings']);
        Route::get('/app-setting-groups', [SettingsController::class, 'appSettingGroups']);
        Route::put('/app-settings/{id}', [SettingsController::class, 'updateAppSetting']);
        Route::post('/settings/logo', [SettingsController::class, 'uploadLogo']);
        Route::delete('/settings/logo', [SettingsController::class, 'removeLogo']);
        Route::get('/feature-flags', [SettingsController::class, 'featureFlags']);
        Route::post('/feature-flags/{id}/toggle', [SettingsController::class, 'toggleFeatureFlag']);

        // Service zones (verified geofences + service toggles)
        Route::prefix('zones')->group(function () {
            Route::get('/', [ZoneController::class, 'index']);
            Route::post('/', [ZoneController::class, 'store']);
            Route::post('/validate', [ZoneController::class, 'validate']);
            Route::get('/delivery-config-global', [ZoneDeliveryConfigController::class, 'globalValues']);
            Route::get('/delivery-config-status', [ZoneDeliveryConfigController::class, 'status']);
            Route::post('/delivery-config-backfill', [ZoneDeliveryConfigController::class, 'backfill']);
            Route::get('/{id}', [ZoneController::class, 'show']);
            Route::put('/{id}', [ZoneController::class, 'update']);
            Route::post('/{id}/toggle', [ZoneController::class, 'toggleStatus']);
            Route::delete('/{id}', [ZoneController::class, 'destroy']);
            Route::get('/{zone}/delivery-configs', [ZoneDeliveryConfigController::class, 'show']);
            Route::put('/{zone}/delivery-configs', [ZoneDeliveryConfigController::class, 'upsert']);
            Route::delete('/{zone}/delivery-configs', [ZoneDeliveryConfigController::class, 'destroy']);
        });

        Route::get('/vehicle-types', [SettingsController::class, 'vehicleTypes']);
        Route::get('/delivery-fee-rules', [SettingsController::class, 'deliveryFeeRules']);

        // Fare rules (ride pricing — managed by super admin)
        Route::post('/fare-rules/preview', [FareRuleController::class, 'preview']);
        Route::get('/fare-rules', [FareRuleController::class, 'index']);
        Route::get('/fare-rules/{id}', [FareRuleController::class, 'show']);
        Route::post('/fare-rules', [FareRuleController::class, 'store']);
        Route::put('/fare-rules/{id}', [FareRuleController::class, 'update']);
        Route::post('/fare-rules/{id}/toggle', [FareRuleController::class, 'toggle']);
        Route::delete('/fare-rules/{id}', [FareRuleController::class, 'destroy']);

        // Integrations hub (provider credentials lives in integration_settings)
        Route::prefix('integrations')->group(function () {
            Route::get('/', [IntegrationController::class, 'index'])->middleware('permission:integrations.view');
            Route::get('/{service}', [IntegrationController::class, 'show'])->middleware('permission:integrations.view');
            Route::put('/{service}', [IntegrationController::class, 'update'])->middleware('permission:integrations.update');
            // Declared before '/{service}/test' so the literal "smtp" segment is
            // never captured by the generic parameterised route.
            Route::post('/smtp/test', SmtpTestController::class)->middleware(['permission:integrations.update', 'throttle:10,1']);
            Route::post('/{service}/test', [IntegrationController::class, 'test'])->middleware('permission:integrations.update');
            Route::delete('/{service}', [IntegrationController::class, 'reset'])->middleware('permission:integrations.update');
        });
        Route::post('/delivery-fee-rules/{id}/toggle', [SettingsController::class, 'toggleDeliveryFeeRule']);
        Route::get('/drivers', [SettingsController::class, 'drivers']);
        Route::get('/drivers/{id}', [SettingsController::class, 'driverDetail']);
        Route::put('/drivers/{id}', [SettingsController::class, 'updateDriver']);
        Route::get('/delivery-partners', [SettingsController::class, 'deliveryPartners']);
        Route::get('/delivery-partners/{id}', [SettingsController::class, 'deliveryPartnerDetail']);
        Route::put('/delivery-partners/{id}', [SettingsController::class, 'updateDeliveryPartner']);

        // Support tickets (admin)
        Route::get('/support-tickets', [App\Http\Controllers\API\Admin\SupportTicketController::class, 'index']);
        Route::get('/support-tickets/{supportTicket}', [App\Http\Controllers\API\Admin\SupportTicketController::class, 'show']);
        Route::put('/support-tickets/{supportTicket}', [App\Http\Controllers\API\Admin\SupportTicketController::class, 'update']);
        Route::post('/support-tickets/{supportTicket}/refund', [App\Http\Controllers\API\Admin\SupportTicketController::class, 'approveRefund']);
        Route::post('/support-tickets/{supportTicket}/reconcile', [App\Http\Controllers\API\Admin\SupportTicketController::class, 'reconciliation']);
        Route::get('/support-tickets/{supportTicket}/attachments/{attachmentId}/file', [App\Http\Controllers\API\Admin\SupportTicketController::class, 'attachmentFile']);

        // Roles & permissions
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/roles/modules', [RoleController::class, 'modules']);
        Route::get('/roles/{id}', [RoleController::class, 'show']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{id}/permissions', [RoleController::class, 'updatePermissions']);
    });

    // ================= Vendor panel (vendor role) =================
    Route::prefix('vendor')->middleware(['auth:sanctum', 'role:vendor'])->group(function () {
        Route::get('/me', [VendorController::class, 'me']);
        Route::put('/profile', [VendorController::class, 'updateProfile']);
        Route::post('/profile/upload-image', [VendorController::class, 'uploadImage']);
        Route::get('/dashboard', [App\Http\Controllers\API\Vendor\DashboardController::class, 'index']);

        Route::get('/outlets', [OutletController::class, 'index']);

        Route::get('/categories/platform', [VendorCategoryController::class, 'platform'])->middleware('permission:categories.view');
        Route::post('/categories/platform', [VendorCategoryController::class, 'syncPlatform'])->middleware('permission:categories.update');
        Route::get('/categories/options', [VendorCategoryController::class, 'options'])->middleware('permission:vendor_categories.view');
        Route::get('/categories', [VendorCategoryController::class, 'index'])->middleware('permission:vendor_categories.view');
        Route::post('/categories', [VendorCategoryController::class, 'store'])->middleware('permission:vendor_categories.create');
        Route::post('/categories/reorder', [VendorCategoryController::class, 'reorder'])->middleware('permission:vendor_categories.reorder');
        Route::post('/categories/upload-image', [VendorCategoryController::class, 'uploadImage'])->middleware('permission:vendor_categories.update');
        Route::get('/categories/{id}', [VendorCategoryController::class, 'show'])->middleware('permission:vendor_categories.view');
        Route::put('/categories/{id}', [VendorCategoryController::class, 'update'])->middleware('permission:vendor_categories.update');
        Route::delete('/categories/{id}', [VendorCategoryController::class, 'destroy'])->middleware('permission:vendor_categories.delete');
        Route::delete('/categories/{id}/image', [VendorCategoryController::class, 'deleteImage'])->middleware('permission:vendor_categories.update');
        Route::post('/categories/{id}/restore', [VendorCategoryController::class, 'restore'])->middleware('permission:vendor_categories.restore');
        Route::post('/categories/{id}/toggle', [VendorCategoryController::class, 'toggle'])->middleware('permission:vendor_categories.update');

        Route::get('/products/categories', [ProductController::class, 'categories']);
        Route::get('/products', [ProductController::class, 'index']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::post('/products/upload-image', [ProductController::class, 'uploadImage']);
        Route::get('/products/{id}', [ProductController::class, 'show']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::post('/products/{id}/toggle-availability', [ProductController::class, 'toggleAvailability']);
        Route::put('/products/{id}/inventory', [ProductController::class, 'updateInventory']);
        Route::delete('/products/{id}/image', [ProductController::class, 'deleteImage']);

        Route::get('/orders', [App\Http\Controllers\API\Vendor\OrderController::class, 'index']);
        Route::get('/orders/{id}', [App\Http\Controllers\API\Vendor\OrderController::class, 'show']);
        Route::put('/orders/{id}/status', [App\Http\Controllers\API\Vendor\OrderController::class, 'updateStatus']);
        Route::get('/orders/{id}/eligible-delivery-partners', [App\Http\Controllers\API\Vendor\OrderController::class, 'eligibleDeliveryPartners']);
        Route::post('/orders/{id}/assign-delivery-partner', [App\Http\Controllers\API\Vendor\OrderController::class, 'assignDeliveryPartner']);

        // Grocery delivery slots (grocery vendors only)
        Route::get('/delivery-slots', [DeliverySlotController::class, 'index']);
        Route::post('/delivery-slots', [DeliverySlotController::class, 'store']);
        Route::get('/delivery-slots/shifts', [DeliverySlotController::class, 'shifts']);
        Route::post('/delivery-slots/bulk', [DeliverySlotController::class, 'bulkStore']);
        Route::put('/delivery-slots/{id}', [DeliverySlotController::class, 'update'])->whereNumber('id');
        Route::delete('/delivery-slots/{id}', [DeliverySlotController::class, 'destroy'])->whereNumber('id');

        Route::get('/coupons', [App\Http\Controllers\API\Vendor\CouponController::class, 'index']);
        Route::post('/coupons', [App\Http\Controllers\API\Vendor\CouponController::class, 'store']);
        Route::put('/coupons/{id}', [App\Http\Controllers\API\Vendor\CouponController::class, 'update']);
        Route::delete('/coupons/{id}', [App\Http\Controllers\API\Vendor\CouponController::class, 'destroy']);

        Route::get('/earnings', [EarningsController::class, 'overview']);
        Route::get('/settlements', [EarningsController::class, 'settlements']);
        Route::get('/payouts', [EarningsController::class, 'payouts']);
        Route::post('/payouts', [EarningsController::class, 'requestPayout']);

        // Impersonation context + exit. Subject to the same vendor role and
        // permission checks as every other vendor route - no bypass.
        Route::get('/impersonation', [ImpersonationController::class, 'context']);
        Route::post('/impersonation/end', [ImpersonationController::class, 'end']);
    });

    // Signed, short-lived attachment downloads (no auth header required; signature authorizes).
    Route::get('/support-attachments/{attachmentId}/file', [SupportTicketController::class, 'signedAttachmentFile'])
        ->name('support.attachment.file')
        ->middleware('signed');
});
