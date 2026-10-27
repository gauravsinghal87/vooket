<?php

namespace Tests\Feature;

use App\Models\PushToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PushTokensTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_push_token(): void
    {
        $user = User::create([
            'name' => 'Test User',
            'phone' => '9999999991',
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);

        $token = $user->createToken('test')->plainTextToken;

        $res = $this->postJson('/api/v1/push-tokens', [
            'token' => 'fcm-test-token-123',
            'platform' => 'web',
            'app_id' => 'customer_web',
        ], ['Authorization' => 'Bearer '.$token]);

        $res->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user->id,
            'token' => 'fcm-test-token-123',
            'app_id' => 'customer_web',
        ]);
    }

    public function test_user_can_revoke_push_token(): void
    {
        $user = User::create([
            'name' => 'Test User',
            'phone' => '9999999992',
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);

        PushToken::create([
            'user_id' => $user->id,
            'token' => 'fcm-test-token-456',
            'platform' => 'web',
            'app_id' => 'customer_web',
        ]);

        $token = $user->createToken('test')->plainTextToken;

        $res = $this->deleteJson('/api/v1/push-tokens', [
            'token' => 'fcm-test-token-456',
        ], ['Authorization' => 'Bearer '.$token]);

        $res->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user->id,
            'token' => 'fcm-test-token-456',
        ]);
        $this->assertNotNull(PushToken::where('token', 'fcm-test-token-456')->first()->disabled_at);
    }
}
