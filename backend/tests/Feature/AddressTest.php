<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AddressTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.geocoding.enabled' => false]);

        $this->user = User::create([
            'name' => 'Address Tester',
            'email' => 'addresses@example.com',
            'phone' => '9999999999',
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->user->createToken('test')->plainTextToken];
    }

    public function test_user_can_create_address_without_coordinates(): void
    {
        $res = $this->postJson('/api/v1/addresses', [
            'label' => 'Home',
            'address_line_1' => '221B Baker Street',
            'city' => 'London',
            'country' => 'UK',
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('success', true);
        $this->assertDatabaseHas('addresses', [
            'user_id' => $this->user->id,
            'address_line_1' => '221B Baker Street',
            'is_default' => true,
        ]);
        $this->assertDatabaseMissing('addresses', ['latitude' => '0.0000000']);
    }

    public function test_user_can_create_address_with_coordinates(): void
    {
        $res = $this->postJson('/api/v1/addresses', [
            'address_line_1' => 'MG Road',
            'city' => 'Bengaluru',
            'latitude' => 12.971599,
            'longitude' => 77.594563,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('success', true);
        $this->assertSame(12.971599, (float) Address::where('user_id', $this->user->id)->first()->latitude);
    }

    public function test_user_can_create_address_with_place_id_and_coordinates(): void
    {
        $res = $this->postJson('/api/v1/addresses', [
            'label' => 'Office',
            'address_line_1' => '1 MG Road',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'country' => 'India',
            'place_id' => 'ChIJ-ABC123',
            'formatted_address' => '1 MG Road, Bengaluru, Karnataka 560001, India',
            'latitude' => 12.971599,
            'longitude' => 77.594563,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('success', true);

        $address = Address::where('user_id', $this->user->id)->first();
        $this->assertSame('ChIJ-ABC123', $address->place_id);
        $this->assertSame('1 MG Road, Bengaluru, Karnataka 560001, India', $address->formatted_address);
        $this->assertSame(12.971599, (float) $address->latitude);
    }

    public function test_geocoding_fills_missing_coordinates(): void
    {
        config(['services.geocoding.enabled' => true]);
        config(['integrations.mode' => 'live']);
        config(['integrations.provider.maps' => 'google']);
        config(['integrations.credentials.maps.server_key' => 'test-key']);
        Cache::flush();

        Http::fake([
            'maps.googleapis.com/*' => Http::response([
                'status' => 'OK',
                'results' => [['geometry' => ['location' => ['lat' => 12.99, 'lng' => 77.59]]]],
            ]),
        ]);

        $res = $this->postJson('/api/v1/addresses', [
            'address_line_1' => '1 MG Road',
            'city' => 'Bengaluru',
        ], $this->authHeaders());

        $res->assertCreated();
        $address = Address::where('user_id', $this->user->id)->first();
        $this->assertNotNull($address);
        $this->assertSame(12.99, (float) $address->latitude);
        $this->assertSame(77.59, (float) $address->longitude);
    }

    public function test_invalid_coordinates_are_rejected(): void
    {
        $res = $this->postJson('/api/v1/addresses', [
            'address_line_1' => 'MG Road',
            'city' => 'Bengaluru',
            'latitude' => 200,
            'longitude' => 500,
        ], $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('latitude', $res->json('errors'));
        $this->assertArrayHasKey('longitude', $res->json('errors'));
    }

    public function test_update_preserves_existing_coordinates_when_omitted(): void
    {
        $address = Address::create([
            'user_id' => $this->user->id,
            'address_line_1' => 'Old Street',
            'city' => 'Delhi',
            'latitude' => 28.61,
            'longitude' => 77.21,
        ]);

        $res = $this->putJson("/api/v1/addresses/{$address->id}", [
            'address_line_1' => 'New Street',
        ], $this->authHeaders());

        $res->assertOk();
        $address->refresh();
        $this->assertSame('New Street', $address->address_line_1);
        $this->assertSame(28.61, (float) $address->latitude);
        $this->assertSame(77.21, (float) $address->longitude);
    }

    public function test_only_one_default_address_is_kept(): void
    {
        $first = Address::create([
            'user_id' => $this->user->id,
            'address_line_1' => 'First Street',
            'city' => 'Delhi',
            'is_default' => true,
        ]);
        Address::create([
            'user_id' => $this->user->id,
            'address_line_1' => 'Second Street',
            'city' => 'Delhi',
        ]);

        $res = $this->postJson('/api/v1/addresses', [
            'address_line_1' => 'Third Street',
            'city' => 'Delhi',
            'is_default' => true,
        ], $this->authHeaders());

        $res->assertCreated();
        $this->assertSame(1, Address::where('user_id', $this->user->id)->where('is_default', true)->count());
        $this->assertFalse($first->fresh()->is_default);
    }
}
