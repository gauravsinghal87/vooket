<?php

namespace App\Http\Requests\API;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWebhookSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $allowed = array_keys(config('webhooks.events', []));

        return [
            'target_url' => ['required', 'url', 'max:2048', 'starts_with:https://,http://localhost'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', Rule::in(['*', ...$allowed])],
        ];
    }

    public function messages(): array
    {
        return [
            'target_url.starts_with' => 'Webhook URLs must use HTTPS (http://localhost is allowed for local tests).',
            'events.*.in' => 'Event must be one of: '.implode(', ', array_keys(config('webhooks.events', []))).'.',
        ];
    }
}
