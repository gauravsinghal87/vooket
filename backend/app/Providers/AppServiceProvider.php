<?php

namespace App\Providers;

use App\Events\OrderReady;
use App\Listeners\DispatchOrder;
use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\Order;
use App\Models\User;
use App\Services\Tracking\OrderTrackingService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(OrderReady::class, DispatchOrder::class);

        $this->configureHttpClient();

        $this->configureAuthRateLimiters();
        $this->configureTrackingRateLimiters();

        Broadcast::routes(['prefix' => 'api/v1', 'middleware' => ['auth:sanctum']]);

        Broadcast::channel('orders.{orderId}', function (User $user, string $orderId) {
            $order = Order::query()->find((int) $orderId);

            if (! $order) {
                return false;
            }

            return app(OrderTrackingService::class)->canTrack($user, $order);
        });

        Broadcast::channel('delivery_partner.{id}', function (User $user, string $id) {
            return DeliveryPartner::query()
                ->where('user_id', $user->id)
                ->where('id', (int) $id)
                ->exists();
        });

        Broadcast::channel('driver.{id}', function (User $user, string $id) {
            return Driver::query()
                ->where('user_id', $user->id)
                ->where('id', (int) $id)
                ->exists();
        });
    }

    /**
     * Point the outbound HTTP client (Guzzle) at a real CA bundle so TLS peer
     * and hostname verification succeed on Windows/WAMP, where PHP's cURL has
     * no default trust store. Verification is never disabled: we only ever set
     * a CA bundle path.
     */
    private function configureHttpClient(): void
    {
        $options = [];

        $verify = config('http.verify');
        if (is_string($verify) && $verify !== '') {
            $options['verify'] = $verify;
        }

        $proxy = config('http.proxy');
        if (is_string($proxy) && $proxy !== '') {
            $options['proxy'] = $proxy;
        }

        if ($options === []) {
            return;
        }

        app(HttpFactory::class)->globalOptions($options);
    }

    /**
     * Named rate limiters referenced by the auth/registration routes.
     */
    private function configureAuthRateLimiters(): void
    {
        $limits = config('auth.rate_limits');
        $otp = config('auth.otp.throttle');

        RateLimiter::for('otp-send', fn (Request $request) => Limit::perMinutes(
            (int) $otp['send']['decay_minutes'],
            (int) $otp['send']['max']
        )->by($this->phoneKey($request, 'otp-send')));

        RateLimiter::for('otp-verify', fn (Request $request) => Limit::perMinutes(
            (int) $otp['verify']['decay_minutes'],
            (int) $otp['verify']['max']
        )->by($this->phoneKey($request, 'otp-verify')));

        RateLimiter::for('register', fn (Request $request) => Limit::perMinutes(
            (int) $limits['register']['decay_minutes'],
            (int) $limits['register']['max']
        )->by($this->mixedKey($request, 'register')));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinutes(
            (int) $limits['login']['decay_minutes'],
            (int) $limits['login']['max']
        )->by($this->phoneKey($request, 'login')));

        RateLimiter::for('login-email', fn (Request $request) => Limit::perMinutes(
            (int) $limits['login_email']['decay_minutes'],
            (int) $limits['login_email']['max']
        )->by($this->emailKey($request, 'login-email')));

        RateLimiter::for('google-login', fn (Request $request) => Limit::perMinutes(
            (int) $limits['google_login']['decay_minutes'],
            (int) $limits['google_login']['max']
        )->by($request->ip()));

        RateLimiter::for('forgot-password', fn (Request $request) => Limit::perMinutes(
            (int) $limits['forgot_password']['decay_minutes'],
            (int) $limits['forgot_password']['max']
        )->by($this->emailKey($request, 'forgot-password')));

        RateLimiter::for('reset-password', fn (Request $request) => Limit::perMinutes(
            (int) $limits['reset_password']['decay_minutes'],
            (int) $limits['reset_password']['max']
        )->by($this->mixedKey($request, 'reset-password')));

        RateLimiter::for('partner-register', fn (Request $request) => Limit::perMinutes(
            (int) $limits['partner_register']['decay_minutes'],
            (int) $limits['partner_register']['max']
        )->by($this->mixedKey($request, 'partner-register')));

        RateLimiter::for('vendor-register', fn (Request $request) => Limit::perMinutes(
            (int) $limits['vendor_register']['decay_minutes'],
            (int) $limits['vendor_register']['max']
        )->by($this->mixedKey($request, 'vendor-register')));
    }

    /**
     * Named rate limiters referenced by the partner location feed and the
     * customer tracking endpoint.
     */
    private function configureTrackingRateLimiters(): void
    {
        RateLimiter::for('partner-location', fn (Request $request) => Limit::perMinute(
            (int) config('tracking.location_updates_per_minute', 30)
        )->by($request->user()?->id ?: $request->ip().':guest'));

        RateLimiter::for('tracking', fn (Request $request) => Limit::perMinute(
            60
        )->by($request->user()?->id ?: $request->ip().':guest'));

        RateLimiter::for('partner-delivery-otp', fn (Request $request) => Limit::perMinutes(
            (int) config('auth.otp.throttle.send.decay_minutes', 1),
            (int) config('auth.otp.throttle.send.max', 5)
        )->by($request->user()?->id ?: $request->ip().':guest'));

        RateLimiter::for('partner-delivery-otp-verify', fn (Request $request) => Limit::perMinutes(
            (int) config('auth.otp.throttle.verify.decay_minutes', 15),
            (int) config('auth.otp.throttle.verify.max', 10)
        )->by($request->user()?->id ?: $request->ip().':guest'));
    }

    private function phoneKey(Request $request, string $prefix): string
    {
        $phone = preg_replace('/\D+/', '', (string) $request->input('phone', ''));

        return $prefix.':phone:'.($phone ?: $request->ip()).':ip:'.$request->ip();
    }

    private function emailKey(Request $request, string $prefix): string
    {
        $email = strtolower(trim((string) $request->input('email', '')));

        return $prefix.':email:'.($email ?: $request->ip()).':ip:'.$request->ip();
    }

    private function mixedKey(Request $request, string $prefix): string
    {
        $identifier = $request->filled('email')
            ? 'email:'.strtolower(trim((string) $request->input('email')))
            : $this->phoneKey($request, $prefix);

        return $prefix.':'.$identifier.':ip:'.$request->ip();
    }
}
