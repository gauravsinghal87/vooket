<?php

return [

    /**
     * Fallback for the admin-controlled `vendor_min_wallet_balance` app setting.
     *
     * The `app_settings` row (group `vendor_payout`) is the source of truth and
     * is what Super Admin edits on the settings screen. This value is only used
     * when that row is missing or holds an unusable value, so a fresh install
     * and a migrated install behave identically without a second system.
     *
     * It is the amount that must REMAIN in a Food/Grocery vendor wallet after a
     * payout, not a floor on the request itself. It is a string because
     * `app_settings.value` is text, and every comparison goes through
     * App\Support\Money (integer paise) so no float arithmetic is involved.
     */
    'min_wallet_balance' => (string) env('VENDOR_MIN_WALLET_BALANCE', '500'),

    /**
     * Upper bound accepted when an admin saves the setting. A floor beyond this
     * would lock every vendor out of withdrawing at all.
     */
    'max_min_wallet_balance' => 1000000,
];
