<?php

namespace App\Http\Controllers\API;

use App\Http\Requests\API\StoreWebhookSubscriptionRequest;
use App\Http\Requests\API\UpdateWebhookSubscriptionRequest;
use App\Models\WebhookDelivery;
use App\Models\WebhookSubscription;
use App\Services\Integration\IntegrationAuditor;
use App\Services\Integration\IntegrationManager;
use Illuminate\Http\Request;

class WebhookSubscriptionController extends BaseController
{
    public function __construct(
        protected IntegrationManager $manager,
        protected IntegrationAuditor $auditor,
    ) {}

    /**
     * Create a webhook subscription for the authenticated user.
     * The signing secret is returned exactly once.
     */
    public function store(StoreWebhookSubscriptionRequest $request)
    {
        $user = $request->user();

        $data = $request->only(['target_url', 'events']);
        $data['user_id'] = $user->id;
        $data['events'] = array_values(array_unique($data['events']));
        $data['status'] = true;
        $data['secret'] = base64_encode(random_bytes(32));

        $subscription = WebhookSubscription::create($data);

        $this->auditor->log('webhook', 'subscription.created', 'Webhook subscription created.', [
            'target_url' => $subscription->target_url,
        ]);

        return $this->success($this->present($subscription, withSecret: true), 'Webhook subscription created.', 201);
    }

    public function index(Request $request)
    {
        $subscriptions = WebhookSubscription::query()
            ->where('user_id', $request->user()->id)
            ->withCount('deliveries')
            ->orderByDesc('created_at')
            ->get()
            ->transform(fn ($s) => $this->present($s));

        return $this->success($subscriptions);
    }

    public function show(Request $request, int $id)
    {
        $subscription = $this->own($request, $id);

        return $this->success($this->present($subscription));
    }

    public function update(UpdateWebhookSubscriptionRequest $request, int $id)
    {
        $subscription = $this->own($request, $id);

        if ($request->has('target_url')) {
            $subscription->target_url = $request->input('target_url');
        }
        if ($request->has('events')) {
            $subscription->events = array_values(array_unique($request->input('events')));
        }
        if ($request->has('status')) {
            $subscription->status = filter_var($request->input('status'), FILTER_VALIDATE_BOOL);
        }
        $subscription->save();

        $this->auditor->log('webhook', 'subscription.updated', 'Webhook subscription updated.', [
            'id' => $subscription->id,
        ]);

        return $this->success($this->present($subscription), 'Webhook subscription updated.');
    }

    public function destroy(Request $request, int $id)
    {
        $subscription = $this->own($request, $id);
        $subscription->delete();

        $this->auditor->log('webhook', 'subscription.deleted', 'Webhook subscription deleted.', [
            'id' => $subscription->id,
        ]);

        return $this->success(null, 'Webhook subscription deleted.');
    }

    /**
     * Send a test ping payload through the normal delivery pipeline.
     */
    public function ping(Request $request, int $id)
    {
        $subscription = $this->own($request, $id);

        $result = $this->manager->webhook()->dispatch(
            $subscription->target_url,
            'ping',
            [
                'subscription_id' => $subscription->id,
                'timestamp' => now()->toISOString(),
                'app' => config('app.name'),
            ]
        );

        return $this->success(['dispatched' => $result['dispatched'] ?? 0], 'Ping dispatched.');
    }

    public function deliveries(Request $request, int $id)
    {
        $subscription = $this->own($request, $id);

        $deliveries = WebhookDelivery::query()
            ->where('subscription_id', $subscription->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn ($d) => [
                'id' => $d->id,
                'event' => $d->event,
                'status' => $d->status,
                'attempts' => $d->attempts,
                'last_error' => $d->last_error,
                'delivered_at' => $d->delivered_at?->toISOString(),
                'created_at' => $d->created_at->toISOString(),
            ]);

        return $this->success($deliveries);
    }

    public function health()
    {
        return $this->success([
            'events' => collect(config('webhooks.events', []))->map(fn ($desc, $name) => ['name' => $name, 'description' => $desc])->values(),
        ]);
    }

    protected function own(Request $request, int $id): WebhookSubscription
    {
        $subscription = WebhookSubscription::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $subscription) {
            abort(404, 'Webhook subscription not found.');
        }

        return $subscription;
    }

    protected function present(WebhookSubscription $subscription, bool $withSecret = false): array
    {
        $data = [
            'id' => $subscription->id,
            'target_url' => $subscription->target_url,
            'events' => $subscription->events,
            'status' => (bool) $subscription->status,
            'created_at' => $subscription->created_at?->toISOString(),
        ];

        if ($withSecret) {
            $data['secret'] = $subscription->secret;
        }

        return $data;
    }
}
