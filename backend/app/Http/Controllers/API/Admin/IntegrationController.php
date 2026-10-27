<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Http\Requests\API\Admin\UpdateIntegrationSettingRequest;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Models\IntegrationSetting;
use App\Services\Integration\IntegrationAuditor;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\IntegrationManager;
use App\Services\Integration\SecretMasker;

class IntegrationController extends BaseController
{
    public function __construct(
        protected IntegrationConfigResolver $resolver,
        protected IntegrationManager $manager,
        protected IntegrationAuditor $auditor,
    ) {}

    /**
     * List services with their current effective configuration (masked).
     */
    public function index()
    {
        $resolved = $this->resolver->resolveAll();

        $data = collect($resolved)->map(function ($row) {
            $credentials = [];
            foreach ($this->resolver->definition($row['service'])['env_map'] ?? [] as $key => $envName) {
                $credentials[$key] = SecretMasker::mask($row['credentials'][$key] ?? null);
            }

            return array_merge($row, ['credentials' => $credentials]);
        })->values();

        return $this->success($data);
    }

    public function show(string $service)
    {
        try {
            $resolved = $this->resolver->resolve($service);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), null, 404);
        }

        $def = $this->resolver->definition($service);
        $credentials = [];
        foreach ($def['env_map'] ?? [] as $key => $envName) {
            $credentials[$key] = [
                'masked' => SecretMasker::mask($resolved['credentials'][$key] ?? null),
                'configured' => ! empty($resolved['credentials'][$key] ?? null),
            ];
        }

        $db = IntegrationSetting::query()->where('service', $service)->first();

        return $this->success([
            'service' => $service,
            'label' => $resolved['label'],
            'provider' => $resolved['configured_provider'],
            'allowed_providers' => $def['allowed_providers'],
            'environment' => $db?->environment ?? $resolved['environment'],
            'is_enabled' => $db?->is_enabled ?? $resolved['enabled'],
            'is_configured' => $resolved['is_configured'],
            'reasons' => $resolved['reasons'],
            'from' => $resolved['from'],
            'public_keys' => array_intersect_key($resolved['credentials'], array_flip($def['public_keys'])),
            'credentials' => $credentials,
            'settings' => $resolved['settings'],
            'last_tested_at' => $db?->last_tested_at,
            'last_test_status' => $db?->last_test_status,
            'last_test_message' => $db?->last_test_message,
        ]);
    }

    public function update(UpdateIntegrationSettingRequest $request, string $service)
    {
        try {
            $this->resolver->definition($service);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), null, 404);
        }

        $def = $this->resolver->definition($service);
        $selectedProvider = $request->input('provider');

        $row = IntegrationSetting::query()->firstOrNew(['service' => $service]);
        $existing = $row->credentials ?? [];
        $changed = [];

        $credentials = $existing;
        foreach (array_keys($def['env_map'] ?? []) as $key) {
            if (! $request->has($key)) {
                continue;
            }
            $value = $request->input($key);
            if (SecretMasker::isPlaceholder($value)) {
                continue; // keep the currently stored secret untouched
            }
            if (($credentials[$key] ?? null) !== $value) {
                $credentials[$key] = $value;
                $changed[] = $key;
            }
        }

        $environment = $request->input('environment', $row->environment ?? 'test');

        $row->service = $service;
        if ($selectedProvider) {
            $row->provider = $selectedProvider;
        }
        $row->environment = $environment;
        $row->is_enabled = (bool) $request->input('is_enabled', $row->is_enabled ?? true);
        $row->credentials = $credentials;

        if (is_array($request->input('settings'))) {
            $row->settings = array_merge($row->settings ?? [], $request->input('settings'));
            $changed[] = 'settings';
        }

        $row->save();

        $this->resolver->clear($service);
        $this->resolver->resolve($service); // warm + validate

        $this->auditor->log($service, 'settings.updated', ucfirst($service).' settings updated.', $changed, [
            'provider' => $row->provider,
            'environment' => $row->environment,
        ]);

        return $this->success($this->show($service)->getData()->data, ucfirst($service).' settings updated.');
    }

    public function test(string $service)
    {
        $provider = $this->manager->providerFor($service);

        if (! $provider instanceof TestableProvider) {
            return $this->error("{$service} provider does not expose a safe connection test.");
        }

        $result = $provider->testConnection();

        IntegrationSetting::query()
            ->updateOrCreate(['service' => $service], [
                'last_tested_at' => now(),
                'last_test_status' => $result['success'] ? 'ok' : 'error',
                'last_test_message' => $result['message'] ?? null,
            ]);

        $this->resolver->clear($service);
        $this->auditor->log($service, 'test.connection', "{$service} connection test ".($result['success'] ? 'passed' : 'failed').'.', [], $result);

        if (! $result['success']) {
            return $this->error('Connection test failed: '.($result['message'] ?? 'unknown error'), null, 422);
        }

        return $this->success(['message' => $result['message'] ?? 'Connection OK'], 'Connection test passed.');
    }

    public function reset(string $service)
    {
        IntegrationSetting::query()->where('service', $service)->delete();

        $this->resolver->clear($service);
        $this->auditor->log($service, 'settings.reset', ucfirst($service).' settings reset to defaults.', ['service' => $service]);

        return $this->success(null, ucfirst($service).' settings reset to defaults.');
    }
}
