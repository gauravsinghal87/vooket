<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Zone;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Maps\ZoneService;
use Illuminate\Http\JsonResponse;

/**
 * Serves client bootstrap configuration. Only safe, non-secret values are
 * exposed — secret credentials never leave the backend.
 */
class AppConfigController extends Controller
{
    public function __construct(
        protected IntegrationConfigResolver $resolver,
        protected ZoneService $zoneService,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->resolver->clientSafe(),
        ]);
    }

    /**
     * Client-safe Google Maps bootstrap config (public key + display defaults).
     * No secret credentials are ever exposed.
     */
    public function maps(): JsonResponse
    {
        $data = $this->resolver->clientSafe()['maps'] ?? [];

        $data['serviceability'] = [
            'services' => $this->zoneService->services(),
            'zones_enabled' => Zone::query()->where('is_active', true)->exists(),
        ];

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
