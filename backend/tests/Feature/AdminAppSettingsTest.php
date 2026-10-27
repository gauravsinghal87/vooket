<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\ConfigurationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * The admin settings API for the `grocery_delivery` group.
 *
 * The two retired scheduled-Grocery keys (dispatch lead time and max orders
 * per batch) must not reach the admin UI and must not be editable, even when
 * an older seeder already wrote their rows. Every remaining grocery fee setting
 * must still be listed and savable.
 */
class AdminAppSettingsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @var array<int, string>
     */
    private const GROCERY_RETAINED_KEYS = [
        'grocery_delivery_fee_per_km',
        'grocery_delivery_fee_paid_by_admin_per_km',
        'grocery_free_delivery_above',
        'grocery_delivery_gst_percent',
        'grocery_free_delivery_km',
    ];

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $this->admin = User::create([
            'name' => 'Settings Admin',
            'email' => 'settings@example.com',
            'phone' => '9666666666',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $this->admin->roles()->sync([$role->id]);
    }

    /**
     * @return array<string, mixed>
     */
    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->admin->createToken('test')->plainTextToken];
    }

    public function test_seeder_does_not_create_the_retired_scheduled_grocery_settings(): void
    {
        $this->seed(ConfigurationSeeder::class);

        $keys = AppSetting::where('group', 'grocery_delivery')->pluck('key');

        foreach (AppSetting::RETIRED_KEYS as $retired) {
            $this->assertFalse($keys->contains($retired), "{$retired} must not be seeded.");
        }
    }

    public function test_grocery_settings_response_excludes_retired_keys_and_keeps_the_fee_settings(): void
    {
        // A stale row from an older seeder must not reappear in the UI.
        $this->staleRetiredRow('grocery_scheduled_dispatch_lead_minutes', '60', 'Grocery Scheduled Dispatch Lead Time (minutes)');
        $this->staleRetiredRow('grocery_max_scheduled_orders_per_batch', '3', 'Grocery Max Orders per Delivery Batch');

        $keys = $this->groceryKeysFromResponse();

        foreach (AppSetting::RETIRED_KEYS as $retired) {
            $this->assertFalse(in_array($retired, $keys, true), "{$retired} must be hidden from the admin UI.");
        }

        foreach (self::GROCERY_RETAINED_KEYS as $retained) {
            $this->assertContains($retained, $keys);
        }
    }

    public function test_a_retired_setting_cannot_be_updated_even_though_its_row_exists(): void
    {
        $setting = $this->staleRetiredRow('grocery_max_scheduled_orders_per_batch', '3', 'Grocery Max Orders per Delivery Batch');

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => '5'], $this->authHeaders())
            ->assertStatus(410);

        $this->assertSame('3', $setting->fresh()->value);
    }

    public function test_a_retained_grocery_fee_setting_is_still_savable(): void
    {
        $setting = AppSetting::where('key', 'grocery_delivery_fee_per_km')->firstOrFail();

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => '8'], $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('data.value', '8');

        $this->assertSame('8', $setting->fresh()->value);
    }

    private function staleRetiredRow(string $key, string $value, string $label): AppSetting
    {
        return AppSetting::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'label' => $label, 'group' => 'grocery_delivery', 'type' => 'number', 'is_public' => false],
        );
    }

    /**
     * @return array<int, string>
     */
    private function groceryKeysFromResponse(): array
    {
        return $this->getJson('/api/v1/admin/app-settings?group=grocery_delivery', $this->authHeaders())
            ->assertStatus(200)
            ->json('data.*.key');
    }
}
