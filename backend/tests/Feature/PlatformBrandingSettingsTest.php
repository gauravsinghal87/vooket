<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Platform logo upload / removal and the public branding block of `/app-config`.
 *
 * The logo must be persisted as a publicly resolvable URL (never raw bytes or
 * base64), old files must be cleaned up safely when replaced or removed, and the
 * customer-facing `/app-config` endpoint must publish the same General settings
 * values the Admin edits.
 */
class PlatformBrandingSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $this->admin = User::create([
            'name' => 'Branding Admin',
            'email' => 'branding@example.com',
            'phone' => '9666666667',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $this->admin->roles()->sync([$role->id]);

        AppSetting::updateOrCreate(
            ['key' => 'platform_name'],
            ['group' => 'general', 'label' => 'Platform Name', 'value' => 'SuperApp', 'type' => 'string', 'is_public' => true]
        );
        AppSetting::updateOrCreate(
            ['key' => 'platform_logo'],
            ['group' => 'general', 'label' => 'Platform Logo', 'value' => null, 'type' => 'string', 'is_public' => true]
        );
        AppSetting::updateOrCreate(
            ['key' => 'currency'],
            ['group' => 'general', 'label' => 'Currency', 'value' => 'INR', 'type' => 'string', 'is_public' => true]
        );
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->admin->createToken('test')->plainTextToken];
    }

    public function test_an_admin_can_upload_a_logo_and_it_is_persisted_as_a_public_url(): void
    {
        $file = UploadedFile::fake()->image('logo.png', 120, 120);

        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $file], $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $setting = AppSetting::where('key', 'platform_logo')->firstOrFail();
        $prefix = rtrim(config('app.url'), '/').'/storage/branding/';

        $this->assertNotNull($setting->value);
        $this->assertStringStartsWith($prefix, $setting->value);

        $relative = substr($setting->value, strlen(rtrim(config('app.url'), '/').'/storage/'));
        Storage::disk('public')->assertExists($relative);
    }

    public function test_logo_upload_creates_the_setting_when_it_does_not_exist_yet(): void
    {
        AppSetting::where('key', 'platform_logo')->delete();

        $file = UploadedFile::fake()->image('logo.png', 120, 120);

        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $file], $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $setting = AppSetting::where('key', 'platform_logo')->firstOrFail();
        $this->assertNotNull($setting->value);
        $this->assertSame('general', $setting->group);
        $this->assertSame(2, $setting->sort_order);
    }

    public function test_uploading_a_replacement_deletes_the_previous_logo(): void
    {
        $first = UploadedFile::fake()->image('first.png', 120, 120);
        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $first], $this->authHeaders())->assertStatus(200);

        $oldValue = AppSetting::where('key', 'platform_logo')->firstOrFail()->value;
        $oldPath = substr($oldValue, strlen(rtrim(config('app.url'), '/').'/storage/'));

        $second = UploadedFile::fake()->image('second.png', 120, 120);
        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $second], $this->authHeaders())->assertStatus(200);

        $newValue = AppSetting::where('key', 'platform_logo')->firstOrFail()->value;

        $this->assertNotSame($oldValue, $newValue);
        Storage::disk('public')->assertMissing($oldPath);

        $newPath = substr($newValue, strlen(rtrim(config('app.url'), '/').'/storage/'));
        Storage::disk('public')->assertExists($newPath);
    }

    public function test_removing_a_logo_deletes_the_file_and_clears_the_setting(): void
    {
        $uploaded = UploadedFile::fake()->image('logo.png', 120, 120);
        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $uploaded], $this->authHeaders())->assertStatus(200);

        $value = AppSetting::where('key', 'platform_logo')->firstOrFail()->value;
        $path = substr($value, strlen(rtrim(config('app.url'), '/').'/storage/'));

        $this->deleteJson('/api/v1/admin/settings/logo', [], $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNull(AppSetting::where('key', 'platform_logo')->firstOrFail()->value);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_logo_upload_rejects_unacceptable_file_types_and_sizes(): void
    {
        // SVG is intentionally not allowed.
        $svg = UploadedFile::fake()->create('logo.svg', 1, 'image/svg+xml');
        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $svg], $this->authHeaders())
            ->assertStatus(422);

        // Oversized files are rejected.
        $big = UploadedFile::fake()->create('logo.png', 2049, 'image/png');
        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $big], $this->authHeaders())
            ->assertStatus(422);

        // A missing file is rejected.
        $this->postJson('/api/v1/admin/settings/logo', [], $this->authHeaders())
            ->assertStatus(422);

        $this->assertNull(AppSetting::where('key', 'platform_logo')->firstOrFail()->value);
    }

    public function test_logo_upload_requires_an_authenticated_super_admin(): void
    {
        $file = UploadedFile::fake()->image('logo.png', 120, 120);

        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $file])
            ->assertStatus(401);

        $member = User::create([
            'name' => 'Regular Member',
            'email' => 'member@example.com',
            'phone' => '9666666668',
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/admin/settings/logo', ['logo' => $file], [
            'Authorization' => 'Bearer '.$member->createToken('test')->plainTextToken,
        ])->assertStatus(403);
    }

    public function test_app_config_publishes_the_configured_branding(): void
    {
        AppSetting::updateOrCreate(['key' => 'platform_name'], ['value' => 'Vooket']);
        AppSetting::updateOrCreate(['key' => 'currency'], ['value' => 'USD']);
        AppSetting::updateOrCreate(['key' => 'platform_logo'], ['value' => null]);

        $this->getJson('/api/v1/app-config')
            ->assertStatus(200)
            ->assertOk()
            ->assertJsonPath('data.branding.name', 'Vooket')
            ->assertJsonPath('data.branding.currency', 'USD')
            ->assertJsonPath('data.branding.logo', null);

        // A logo saved by the Admin is published as an absolute public URL.
        $this->postJson('/api/v1/admin/settings/logo', ['logo' => UploadedFile::fake()->image('logo.png', 120, 120)], $this->authHeaders())
            ->assertStatus(200);

        $this->getJson('/api/v1/app-config')
            ->assertOk()
            ->assertJsonPath('data.branding.name', 'Vooket')
            ->assertJsonPath('data.branding.logo', AppSetting::where('key', 'platform_logo')->firstOrFail()->value);
    }

    public function test_app_config_publishes_a_usable_url_for_a_relative_storage_path(): void
    {
        AppSetting::updateOrCreate(['key' => 'platform_logo'], ['value' => 'branding/legacy-logo.png']);
        Storage::disk('public')->put('branding/legacy-logo.png', 'fake');

        $this->getJson('/api/v1/app-config')
            ->assertOk()
            ->assertJsonPath('data.branding.logo', rtrim(config('app.url'), '/').'/storage/branding/legacy-logo.png');
    }
}
