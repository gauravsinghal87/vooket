<?php

namespace App\Infrastructure\Providers;

abstract class AbstractIntegrationProvider
{
    protected string $service;

    protected array $config = [];

    /** @var callable[]|array */
    protected array $callbacks = [];

    public function __construct(array $config = [])
    {
        $this->config = $config;
        $this->service = (string) ($config['service'] ?? 'unknown');
    }

    /**
     * Read a credential. Never call this from unreachable code paths.
     */
    protected function cred(string $key, mixed $default = null): mixed
    {
        return $this->config['credentials'][$key] ?? $default;
    }

    /**
     * Read a non-secret option.
     */
    protected function opt(string $key, mixed $default = null): mixed
    {
        return $this->config['settings'][$key] ?? $default;
    }

    /**
     * Return resolved config for test-connection / status purposes.
     */
    public function configState(): array
    {
        return [
            'service' => $this->service,
            'provider' => $this->config['provider'] ?? get_class($this),
            'environment' => $this->config['environment'] ?? 'test',
            'enabled' => (bool) ($this->config['enabled'] ?? true),
        ];
    }
}
