<?php

namespace Tests\Feature;

use App\Models\SavedPlace;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SavedPlaceTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Saved Place Tester',
            'email' => 'saved-places@example.com',
            'phone' => '9888888888',
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->user->createToken('test')->plainTextToken];
    }

    public function test_user_can_save_and_list_places(): void
    {
        $create = $this->postJson('/api/v1/saved-places', [
            'label' => 'Home',
            'address' => '12 MG Road, New Delhi',
            'latitude' => 28.6139,
            'longitude' => 77.2090,
        ], $this->authHeaders());

        $create->assertCreated()->assertJsonPath('success', true);

        $this->assertDatabaseHas('saved_places', [
            'user_id' => $this->user->id,
            'label' => 'Home',
        ]);

        $list = $this->getJson('/api/v1/saved-places', $this->authHeaders());

        $list->assertOk()->assertJsonPath('success', true);
        $this->assertCount(1, $list->json('data'));
    }

    public function test_user_can_delete_own_saved_place(): void
    {
        $place = SavedPlace::create([
            'user_id' => $this->user->id,
            'label' => 'Work',
            'address' => '5 Connaught Place, New Delhi',
            'latitude' => 28.6304,
            'longitude' => 77.2177,
        ]);

        $res = $this->deleteJson("/api/v1/saved-places/{$place->id}", [], $this->authHeaders());

        $res->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseMissing('saved_places', ['id' => $place->id]);
    }

    public function test_user_cannot_delete_another_users_saved_place(): void
    {
        $other = User::create([
            'name' => 'Other User',
            'email' => 'other-saved@example.com',
            'phone' => '9777777777',
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);

        $place = SavedPlace::create([
            'user_id' => $other->id,
            'label' => 'Gym',
            'address' => 'Somewhere',
            'latitude' => 28.5,
            'longitude' => 77.2,
        ]);

        $res = $this->deleteJson("/api/v1/saved-places/{$place->id}", [], $this->authHeaders());

        $res->assertStatus(404)->assertJsonPath('success', false);
        $this->assertDatabaseHas('saved_places', ['id' => $place->id]);
    }
}
