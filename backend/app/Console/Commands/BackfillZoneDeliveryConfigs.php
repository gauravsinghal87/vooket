<?php

namespace App\Console\Commands;

use App\Services\Pricing\ZoneDeliveryConfigService;
use Illuminate\Console\Command;

class BackfillZoneDeliveryConfigs extends Command
{
    protected $signature = 'zone-delivery-configs:backfill
                            {--dry-run : Report what would be created without writing}';

    protected $description = 'Copy current global Food/Grocery delivery values into zones that have no configuration yet.';

    public function handle(ZoneDeliveryConfigService $configs): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $summary = $configs->backfillMissingFromGlobal($dryRun);

        $this->table(
            ['Zones', 'Created', 'Already saved', 'Incomplete existing', 'Mode'],
            [[
                $summary['zones'],
                $summary['created'],
                $summary['existing'],
                $summary['incomplete_existing'],
                $dryRun ? 'dry-run' : 'applied',
            ]]
        );

        foreach ($summary['created_configs'] as $row) {
            $this->line(sprintf(
                '  %s zone #%d %s/%s%s',
                $row['zone_name'] ?? 'Zone',
                $row['zone_id'],
                $row['module'],
                $row['delivery_mode'],
                $row['delivery_type'] ? " ({$row['delivery_type']})" : ''
            ));
        }

        if ($summary['incomplete_existing'] > 0) {
            $this->warn(
                $summary['incomplete_existing'].' existing configuration(s) are incomplete and were left untouched. Fix them in Zone Delivery Configuration.'
            );
        }

        $this->info($dryRun
            ? 'Dry run complete. Re-run without --dry-run to write the missing rows.'
            : 'Backfill complete. Existing zone configurations were not modified.');

        return self::SUCCESS;
    }
}
