<?php

namespace App\Console\Commands;

use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\SecretMasker;
use Illuminate\Console\Command;

class IntegrationsListCommand extends Command
{
    protected $signature = 'integrations:list
                            {--service= : Show one service in detail}';

    protected $description = 'Show effective integration configuration per service.';

    public function handle(IntegrationConfigResolver $resolver): int
    {
        if ($service = $this->option('service')) {
            return $this->showService($resolver, $service);
        }

        $rows = [];
        foreach ($resolver->resolveAll() as $row) {
            $rows[] = [
                $row['service'],
                $row['configured_provider'],
                $row['provider'] !== $row['configured_provider'] ? $row['provider'].' (effective)' : $row['provider'],
                $row['environment'],
                $row['enabled'] ? 'enabled' : 'disabled',
                count(array_filter($resolver->credentials($row['service']))).' cred(s)',
                $row['is_configured'] ? 'configured' : ($row['from'] === 'env' ? 'env-defaults' : (collect($row['reasons'])->implode(' ') ?: 'not configured')),
            ];
        }

        $this->table(['Service', 'Configured', 'Effective', 'Env', 'Status', 'Credentials', 'Notes'], $rows);

        $this->newLine();
        $this->info('THIRD_PARTY_MODE='.config('integrations.mode', 'mock'));

        return self::SUCCESS;
    }

    protected function showService(IntegrationConfigResolver $resolver, string $service): int
    {
        try {
            $def = $resolver->definition($service);
            $row = $resolver->resolve($service);
        } catch (\InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("[{$service}] {$row['label']}");
        $this->table(['Attribute', 'Value'], [
            ['Provider', $row['configured_provider']],
            ['Effective provider', $row['provider']],
            ['Environment', $row['environment']],
            ['Mode', $row['mode']],
            ['Enabled', $row['enabled'] ? 'yes' : 'no'],
            ['Source', $row['from']],
        ]);

        if (! empty($row['reasons'])) {
            $this->warn(implode(' ', $row['reasons']));
        }

        $credentials = [];
        foreach (array_keys($def['env_map']) as $key) {
            $value = $row['credentials'][$key] ?? null;
            $credentials[] = [$key, $value !== null && $value !== '' ? SecretMasker::mask($value) : '(not set)'];
        }
        $this->table(['Credential', 'Value (masked)'], $credentials);

        return self::SUCCESS;
    }
}
