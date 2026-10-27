<?php

namespace App\Console\Commands;

use App\Models\IntegrationSetting;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\SecretMasker;
use Illuminate\Console\Command;

class IntegrationsSetCommand extends Command
{
    protected $signature = 'integrations:set
                            {service : Integration service slug, e.g. payments}
                            {key : Credential key, e.g. key_secret}
                            {value : Credential value, or "****" to keep / omit to clear}
                            {--provider= : Set provider name}
                            {--env= : test|live}
                            {--enable : Enable the integration}
                            {--disable : Disable the integration}
                            {--reset : Reset service to defaults}';

    protected $description = 'Set integration credentials from the command line (admin hub equivalent).';

    public function handle(IntegrationConfigResolver $resolver): int
    {
        $service = $this->argument('service');

        try {
            $def = $resolver->definition($service);
        } catch (\InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $row = IntegrationSetting::query()->firstOrNew(['service' => $service]);
        $credentials = $row->credentials ?? [];

        if ($this->option('reset')) {
            $row->delete();
            $resolver->clear($service);
            $this->info("{$service}: reset to defaults.");

            return self::SUCCESS;
        }

        $key = $this->argument('key');
        $value = $this->argument('value');

        if (! array_key_exists($key, $def['env_map']) && ! in_array($key, ['provider', 'environment', 'is_enabled'], true)) {
            $this->error("Unknown credential '{$key}'. Valid keys: ".implode(', ', array_keys($def['env_map'])));

            return self::FAILURE;
        }

        if (SecretMasker::isPlaceholder($value)) {
            $this->info("{$service}.{$key}: keeping current value.");
        } else {
            $credentials[$key] = $value;
        }

        $row->service = $service;
        $row->credentials = $credentials;

        if ($provider = $this->option('provider')) {
            $row->provider = $this->normalizeProvider($provider);
        }

        if ($env = $this->option('env')) {
            $row->environment = $env;
        }

        if ($this->option('enable')) {
            $row->is_enabled = true;
        }

        if ($this->option('disable')) {
            $row->is_enabled = false;
        }

        $row->save();
        $resolver->clear($service);

        $this->table(['Service', 'Provider', 'Environment', 'Enabled', 'Stored'], [
            [$service, $row->provider ?? '(default)', $row->environment ?? 'test', $row->is_enabled ? 'yes' : 'no', count($credentials).' credential(s)'],
        ]);

        return self::SUCCESS;
    }

    private function normalizeProvider(string $provider): string
    {
        return match (strtolower($provider)) {
            'log', 'demo' => 'mock',
            default => strtolower($provider),
        };
    }
}
