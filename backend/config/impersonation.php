<?php

/*
|--------------------------------------------------------------------------
| Admin -> vendor impersonation
|--------------------------------------------------------------------------
|
| Vendor impersonation is a backend-issued capability, never a password
| bypass. An administrator receives a short-lived, single-use exchange code;
| the vendor panel trades that code for its own short-lived Sanctum token
| minted against the vendor's own user row.
|
| The admin's own authentication is never touched, so closing the vendor
| session returns the administrator to a still-valid admin session.
|
*/

return [

    /*
    | Master switch. When disabled, starting a session is refused with 403 and
    | no exchange code is ever issued.
    */
    'enabled' => (bool) env('IMPERSONATION_ENABLED', true),

    /*
    | Token ability attached to impersonation tokens. Vendor panel requests
    | made with such a token can be told apart from a genuine vendor login,
    | and the ability is what makes that detection possible server-side.
    */
    'ability' => 'impersonate',

    /*
    | How long the single-use exchange code stays valid. This only bounds the
    | window between "admin clicks Login as Vendor" and "vendor panel redeems
    | it", so it is intentionally short.
    */
    'code_ttl_seconds' => (int) env('IMPERSONATION_CODE_TTL', 120),

    /*
    | Lifetime of the impersonated vendor session itself. Short by design:
    | the vendor panel must re-request a session rather than hold one
    | indefinitely.
    */
    'token_ttl_minutes' => (int) env('IMPERSONATION_TOKEN_TTL', 30),

    /*
    | Where the admin is returned after the vendor session ends.
    */
    'return_path' => '/vendors',

];
