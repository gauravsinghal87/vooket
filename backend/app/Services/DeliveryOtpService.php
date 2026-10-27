<?php

namespace App\Services;

use App\Exceptions\DeliveryGateException;
use App\Exceptions\OtpCooldownException;
use App\Models\Order;
use App\Models\OtpCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Order-scoped customer delivery OTP (purpose 'delivery').
 *
 * Complete separation from the login OTP flow: every delivery code is bound
 * to an order_id, is single-use, expires after the shared auth.otp TTL, is
 * attempt-limited, honours the shared resend cooldown plus a per-order resend
 * cap, and is only ever handed back to the order's customer. Unlike auth OTPs
 * the code is deliberately stored as plaintext in otp_codes.otp because there
 * is no SMS leg — the customer reads the code from their order screen and
 * shares it verbally with the delivery partner. A live code is reused on
 * resend (never discarded, never duplicated); once it expires or is consumed
 * a fresh lifecycle starts with a clean resend budget, so the cap can never
 * strand a delivery that has no usable code.
 */
class DeliveryOtpService
{
    public const PURPOSE_DELIVERY = 'delivery';

    public function issue(Order $order): array
    {
        return DB::transaction(function () use ($order) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new DeliveryGateException('Order not found');
            }

            $this->assertIssuable($locked);

            $maxResends = (int) config('auth.otp.max_resend_attempts', 3);
            $resendCount = (int) $locked->delivery_otp_resend_count;

            // A still-valid code is never discarded: the resend cap measures
            // resends of one live code, and burning a fresh code on top of a
            // working one would only confuse the customer. Return the active
            // code's state so the partner knows one already exists.
            $live = $this->liveOtp($locked);
            if ($live) {
                return [
                    'active' => true,
                    'expires_at' => $live->expires_at->toISOString(),
                    'resend_count' => $resendCount,
                    'max_resend_attempts' => $maxResends,
                    'limit_reached' => $resendCount >= $maxResends,
                ];
            }

            // No usable code survives (expired or consumed). Guard rapid
            // re-minting with the shared cooldown measured against the most
            // recent code, then start a fresh lifecycle: the old code's resend
            // budget no longer applies, so the cap is reset before counting.
            $cooldown = (int) config('auth.otp.resend_cooldown_seconds', 60);
            $previous = OtpCode::where('order_id', $locked->id)
                ->where('purpose', self::PURPOSE_DELIVERY)
                ->latest('id')
                ->first();

            if ($cooldown > 0 && $previous && abs($previous->created_at->diffInSeconds(now())) < $cooldown) {
                throw new OtpCooldownException('Please wait before requesting a new delivery OTP.');
            }

            if ($resendCount >= $maxResends) {
                $resendCount = 0;
            }

            $otp = (string) random_int(100000, 999999);
            $ttlMinutes = (int) config('auth.otp.ttl_minutes', 10);

            OtpCode::where('order_id', $locked->id)
                ->where('purpose', self::PURPOSE_DELIVERY)
                ->delete();

            // Stored in plaintext on purpose (no SMS leg): the customer
            // retrieves the code from their own order screen via
            // getActiveOtp() and reads it aloud to the partner.
            OtpCode::create([
                'order_id' => $locked->id,
                'phone' => $locked->user?->phone,
                'otp' => $otp,
                'purpose' => self::PURPOSE_DELIVERY,
                'token' => Str::random(64),
                'expires_at' => now()->addMinutes($ttlMinutes),
            ]);

            $locked->update(['delivery_otp_resend_count' => $resendCount + 1]);

            return [
                'active' => true,
                'expires_at' => now()->addMinutes($ttlMinutes)->toISOString(),
                'resend_count' => $resendCount + 1,
                'max_resend_attempts' => $maxResends,
                'limit_reached' => false,
            ];
        });
    }

    public function verify(Order $order, string $otp): Order
    {
        $failure = null;

        $result = DB::transaction(function () use ($order, $otp, &$failure) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new DeliveryGateException('Order not found');
            }

            if (! $locked->delivery_partner_id) {
                throw new DeliveryGateException('Order has no assigned delivery partner');
            }

            // Verified once is enough; replaying the same code stays idempotent.
            if ($locked->delivery_otp_verified_at) {
                return $locked->fresh();
            }

            $this->assertVerifiable($locked);

            $maxAttempts = (int) config('auth.otp.max_attempts', 5);

            $record = OtpCode::where('order_id', $locked->id)
                ->where('purpose', self::PURPOSE_DELIVERY)
                ->whereNull('used_at')
                ->where('expires_at', '>', now())
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $record || ! $record->expires_at->isFuture()) {
                $failure = 'Invalid or expired OTP';

                return null;
            }

            // Read attempts once and bump them ourselves so the exhaustion
            // boundary is exact (Eloquent's increment() does not refresh the
            // in-memory attribute synchronously).
            $attempts = (int) $record->attempts;

            if ($attempts >= $maxAttempts) {
                $record->delete();
                $failure = 'Too many attempts. Please request a new OTP.';

                return null;
            }

            // Delivery codes are stored in plaintext (see the class docblock);
            // tolerate any bcrypt rows left over from a previous deployment.
            $matches = str_starts_with($record->otp, '$2')
                ? password_verify($otp, $record->otp)
                : hash_equals($record->otp, $otp);

            if (! $matches) {
                // Persist the attempt count even on failure; the exception is
                // raised after this transaction commits so a wrong code cannot
                // be replayed against a fresh counter forever.
                $record->update(['attempts' => $attempts + 1]);

                if (($attempts + 1) >= $maxAttempts) {
                    $record->delete();
                    $failure = 'Too many attempts. Please request a new OTP.';

                    return null;
                }

                $failure = 'Invalid OTP';

                return null;
            }

            $record->update([
                'attempts' => $attempts + 1,
                'used_at' => now(),
            ]);

            $locked->update(['delivery_otp_verified_at' => now()]);

            return $locked->fresh();
        });

        if ($failure) {
            throw new RuntimeException($failure);
        }

        return $result;
    }

    /**
     * Latest, still-valid delivery OTP for an order, if any.
     */
    private function liveOtp(Order $order): ?OtpCode
    {
        return OtpCode::where('order_id', $order->id)
            ->where('purpose', self::PURPOSE_DELIVERY)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();
    }

    /**
     * Hand the active delivery code to the order's customer so they can read
     * it to the partner. Ownership is enforced by the caller (OrderController).
     */
    public function getActiveOtp(Order $order): array
    {
        $this->assertIssuable($order);

        if ($order->delivery_otp_verified_at) {
            throw new DeliveryGateException('Delivery OTP has already been verified');
        }

        $record = $this->liveOtp($order);

        if (! $record || ! $record->otp) {
            throw new DeliveryGateException('No active delivery OTP. Ask your delivery partner to request one.');
        }

        return [
            'otp' => $record->otp,
            'expires_at' => $record->expires_at->toISOString(),
        ];
    }

    private function assertIssuable(Order $order): void
    {
        if (! in_array($order->order_type, ['food', 'grocery'], true)) {
            throw new DeliveryGateException('Delivery OTP is only available for food and grocery orders');
        }

        if (! $order->delivery_partner_id) {
            throw new DeliveryGateException('Order has no assigned delivery partner');
        }

        if (! in_array($order->status, ['OUT_FOR_DELIVERY', 'ARRIVED'], true)) {
            throw new DeliveryGateException('Delivery OTP can only be requested once the order is out for delivery');
        }
    }

    private function assertVerifiable(Order $order): void
    {
        if (! in_array($order->order_type, ['food', 'grocery'], true)) {
            throw new DeliveryGateException('Delivery OTP is only available for food and grocery orders');
        }

        if (! in_array($order->status, ['OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED'], true)) {
            throw new DeliveryGateException('Delivery OTP can only be verified while the order is out for delivery');
        }
    }
}
