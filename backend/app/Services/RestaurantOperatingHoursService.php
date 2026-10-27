<?php

namespace App\Services;

use Carbon\CarbonInterface;

/**
 * Shared validation rules and availability logic for a food restaurant's
 * preparation time and local operating schedule (restaurants.avg_prep_time_min,
 * restaurants.opens_at, restaurants.closes_at).
 *
 * Times are stored as plain local wall-clock values in the business timezone
 * (config delivery_slots.timezone) — the same convention grocery delivery
 * slots use — while the application itself runs in UTC. Closing earlier than
 * opening (e.g. 18:00 → 02:00) is a valid overnight schedule.
 */
class RestaurantOperatingHoursService
{
    /**
     * Safe defaults for legacy restaurant rows without saved values. These
     * mirror the schema default for avg_prep_time_min and the backfill
     * migration for the operating window.
     */
    public const DEFAULT_PREPARATION_TIME_MIN = 20;

    public const DEFAULT_OPENS_AT = '09:00';

    public const DEFAULT_CLOSES_AT = '22:00';

    /**
     * Validation rules for the restaurant schedule fields.
     *
     * @param  bool  $required  true at food restaurant registration, false for
     *                          partial vendor profile updates
     * @return array<string, array<int, string>>
     */
    public static function rules(bool $required): array
    {
        $presence = $required ? 'required' : 'sometimes';

        return [
            'avg_prep_time_min' => [$presence, 'integer', 'min:1', 'max:180'],
            'opens_at' => [$presence, 'date_format:H:i'],
            'closes_at' => [$presence, 'date_format:H:i', 'different:opens_at'],
        ];
    }

    /**
     * The request keys that describe a restaurant's schedule.
     *
     * @return array<int, string>
     */
    public static function fieldKeys(): array
    {
        return ['avg_prep_time_min', 'opens_at', 'closes_at'];
    }

    /**
     * Normalise a stored "HH:MM[:SS]" value to "HH:MM"; null when unusable.
     */
    public static function normalize(?string $time): ?string
    {
        $minutes = self::toMinutes($time);

        if ($minutes === null) {
            return null;
        }

        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }

    /**
     * Whether a restaurant is open right now according to its saved local
     * schedule. Handles normal windows (09:00–22:00), overnight windows
     * (18:00–02:00), inclusive opening / exclusive closing boundaries, and
     * legacy rows without saved hours via the safe defaults.
     */
    public function isOpenNow(?string $opensAt, ?string $closesAt, ?CarbonInterface $now = null): bool
    {
        $now ??= now();
        $local = $now->copy()->setTimezone($this->timezone());
        $minutes = ((int) $local->format('G')) * 60 + (int) $local->format('i');

        $open = self::toMinutes($opensAt) ?? self::toMinutes(self::DEFAULT_OPENS_AT);
        $close = self::toMinutes($closesAt) ?? self::toMinutes(self::DEFAULT_CLOSES_AT);

        if ($open === $close) {
            // Legacy rows can hold identical times; treat them like any other
            // unset schedule instead of declaring the restaurant closed forever.
            $open = self::toMinutes(self::DEFAULT_OPENS_AT);
            $close = self::toMinutes(self::DEFAULT_CLOSES_AT);
        }

        if ($open < $close) {
            return $minutes >= $open && $minutes < $close;
        }

        // Overnight window, e.g. 18:00–02:00.
        return $minutes >= $open || $minutes < $close;
    }

    /**
     * Business timezone used for local wall-clock schedule values.
     */
    public function timezone(): string
    {
        return config('delivery_slots.timezone') ?: config('app.timezone');
    }

    /**
     * Parse "HH:MM[:SS]" into minutes since midnight; null when unusable.
     */
    private static function toMinutes(?string $time): ?int
    {
        if ($time === null || $time === '') {
            return null;
        }

        $parts = explode(':', $time);

        if (count($parts) < 2 || ! ctype_digit($parts[0]) || ! ctype_digit($parts[1])) {
            return null;
        }

        $hours = (int) $parts[0];
        $minutes = (int) $parts[1];

        if ($hours > 23 || $minutes > 59) {
            return null;
        }

        return ($hours * 60) + $minutes;
    }
}
