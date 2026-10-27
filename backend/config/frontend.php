<?php

/*
|--------------------------------------------------------------------------
| Frontend application URLs
|--------------------------------------------------------------------------
|
| Absolute origins of the separately deployed SPAs. The backend uses these to
| build links that must open in the browser (e.g. password reset links), so
| production links are never guessed from request headers.
|
| These are server-side values only. They must never be exposed to customer
| JavaScript, and no SMTP or provider credential is stored here.
|
*/

return [

    'customer_web_url' => rtrim((string) env('CUSTOMER_WEB_URL', 'http://localhost:5173'), '/'),

    'admin_web_url' => rtrim((string) env('ADMIN_WEB_URL', 'http://localhost:5174'), '/'),

    // Used to build the admin -> vendor impersonation handoff URL server-side,
    // so the redirect target origin is never taken from the client.
    'vendor_web_url' => rtrim((string) env('VENDOR_WEB_URL', 'http://localhost:5175'), '/'),

];
