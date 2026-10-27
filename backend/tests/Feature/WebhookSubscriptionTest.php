<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WebhookDelivery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WebhookSubscriptionTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Merchant',
            'phone' => '7777777777',
            'user_type' => 'vendor',
            'is_active' => true,
        ]);
    }

    private function headers(): array
    {
        return ['Authorization' => 'Bearer '.$this->user->createToken('test')->plainTextToken];
    }

    public function test_merchant_can_create_subscription_and_gets_secret_once(): void
    {
        $res = $this->postJson('/api/v1/webhooks/subscribe', [
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.created', 'payment.captured'],
        ], $this->headers());

        $res->assertCreated()
            ->assertJsonPath('success', true);

        $data = $res->json('data');
        $this->assertArrayHasKey('secret', $data);
        $this->assertArrayHasKey('id', $data);
        $this->assertSame(['order.created', 'payment.captured'], $data['events']);
    }

    public function test_invalid_event_is_rejected(): void
    {
        $res = $this->postJson('/api/v1/webhooks/subscribe', [
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['not.a.real.event'],
        ], $this->headers());

        $res->assertStatus(422);
    }

    public function test_plain_http_url_is_rejected(): void
    {
        $res = $this->postJson('/api/v1/webhooks/subscribe', [
            'target_url' => 'http://merchant.example.com/hook',
            'events' => ['ping'],
        ], $this->headers());

        $res->assertStatus(422);
    }

    public function test_merchant_can_list_update_and_delete_own_subscription(): void
    {
        $create = $this->postJson('/api/v1/webhooks/subscribe', [
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.created'],
        ], $this->headers());

        $id = $create->json('data.id');

        $this->getJson('/api/v1/webhooks/subscriptions', $this->headers())
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->putJson("/api/v1/webhooks/subscriptions/{$id}", ['events' => ['order.created', 'ping']], $this->headers())
            ->assertOk()
            ->assertJsonPath('data.events', ['order.created', 'ping']);

        $this->deleteJson("/api/v1/webhooks/subscriptions/{$id}", [], $this->headers())
            ->assertOk();

        $this->assertSoftDeleted('webhook_subscriptions', ['id' => $id]);
    }

    public function test_other_user_cannot_touch_subscription(): void
    {
        $other = User::create(['name' => 'Other', 'phone' => '6666666666', 'user_type' => 'customer', 'is_active' => true]);

        $id = $this->postJson('/api/v1/webhooks/subscribe', [
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['ping'],
        ], $this->headers())->json('data.id');

        // Reset the cached auth guard user so the next request authenticates $other.
        $this->app['auth']->forgetGuards();

        $this->getJson("/api/v1/webhooks/subscriptions/{$id}", ['Authorization' => 'Bearer '.$other->createToken('t')->plainTextToken])
            ->assertStatus(404);
    }

    public function test_ping_dispatches_a_delivery_record(): void
    {
        Http::fake();

        $id = $this->postJson('/api/v1/webhooks/subscribe', [
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['ping'],
        ], $this->headers())->json('data.id');

        $res = $this->postJson("/api/v1/webhooks/subscriptions/{$id}/ping", [], $this->headers());

        $res->assertOk();

        $delivery = WebhookDelivery::where('event', 'ping')->first();
        $this->assertNotNull($delivery);
        $this->assertSame($id, $delivery->subscription_id);

        $this->getJson("/api/v1/webhooks/subscriptions/{$id}/deliveries", $this->headers())
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_health_lists_event_catalog(): void
    {
        $this->getJson('/api/v1/webhooks/health', $this->headers())
            ->assertOk()
            ->assertJsonStructure(['data' => ['events' => [['name', 'description']]]]);
    }
}
